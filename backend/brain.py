"""All-node MaleCNS rate dynamics plus a trainable neural-activity decoder."""
from pathlib import Path
import json
import os
import time
# Limit numerical libraries before importing them; one CPU worker, no GPU compute.
for _key in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS", "VECLIB_MAXIMUM_THREADS", "NUMEXPR_NUM_THREADS"):
    os.environ[_key] = "1"
import numpy as np
from scipy import sparse

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/processed"


class Brain:
    def __init__(self, shuffled=False):
        self.manifest = json.loads((DATA / "manifest.json").read_text())
        self.graph = sparse.load_npz(DATA / "connectome.npz")
        if shuffled:
            # One consistent presynaptic permutation destroys named wiring while
            # preserving each row's weight distribution and total input.
            perm = np.random.default_rng(901).permutation(self.graph.shape[0])
            self.graph.indices = perm[self.graph.indices].astype(np.int32)
        self.pool = sparse.load_npz(DATA / "pool.npz")
        with np.load(DATA / "channels.npz") as f:
            self.channels = [f[f"c{i}"] for i in range(14)]
        self.display_indices = np.load(DATA / "display_indices.npy")
        self.n = self.graph.shape[0]
        self.reset()
        self.ms = 0.0
        self.duty = 0.45

    def reset(self):
        self.activity = np.zeros(self.n, dtype=np.float32)
        self.previous = np.zeros(self.pool.shape[0], dtype=np.float32)
        self.pooled = self.previous.copy()
        self.display_change = np.zeros(len(self.display_indices), dtype=np.float32)

    def step(self, observation, silent=False):
        start = time.perf_counter()
        previous_display = self.activity[self.display_indices].copy()
        if silent:
            self.activity.fill(0)
        else:
            drive = 0.06 + 0.85 * (self.graph @ self.activity)
            for k, value in enumerate(np.clip(observation, -1.5, 1.5)):
                drive[self.channels[2*k]] += 0.7 + 0.42 * value
                drive[self.channels[2*k+1]] += 0.7 - 0.42 * value
            self.activity = (0.12 * self.activity + 0.88 * np.tanh(np.maximum(drive, 0))).astype(np.float32)
        self.pooled = self.pool @ self.activity
        self.display_change = self.activity[self.display_indices] - previous_display
        features = np.concatenate([self.pooled, self.pooled - self.previous]).astype(np.float32)
        self.previous = self.pooled.copy()
        self.ms = (time.perf_counter() - start) * 1000
        # Cooperatively yield after every whole-graph update. The 45% duty budget
        # is a target for this worker, not a hard OS-wide CPU guarantee.
        time.sleep(self.ms / 1000 * (1/self.duty - 1))
        return features

    def telemetry(self):
        return {"activity": np.round(self.activity[self.display_indices], 3).tolist(),
                "change": np.round(self.display_change, 5).tolist(),
                "pools": np.round(self.pooled, 4).tolist(),
                "mean": float(self.activity.mean()), "active": int(np.count_nonzero(self.activity > 0.12)),
                "stepMs": round(self.ms, 2)}


class Decoder:
    def __init__(self, size=128):
        self.weights = np.zeros(size, dtype=np.float64)
        self.bias = -2.0
        self.mean = np.zeros(size)
        self.scale = np.ones(size)
        self.updates = 0
        self.label = "Untrained"
        self.loss = 0.0

    def vector(self, x):
        return np.clip((x - self.mean) / self.scale, -8, 8)

    def probability(self, x):
        z = float(self.vector(x) @ self.weights + self.bias)
        return float(1 / (1 + np.exp(-np.clip(z, -30, 30))))

    def explain(self, x):
        """Exact additive logit contributions, captured before online learning."""
        terms = self.vector(x) * self.weights
        groups = [("Sensory", 0, 14), ("Optic lobes", 14, 24),
                  ("Visual projection", 24, 32), ("Central brain", 32, 48),
                  ("Descending", 48, 56), ("Ventral cord", 56, 64)]
        return {"bias": float(self.bias), "logit": float(terms.sum() + self.bias),
                "contributions": [{"name": name, "value": float(terms[a:b].sum() + terms[64+a:64+b].sum())}
                                  for name, a, b in groups]}

    def learn(self, x, target, rate=0.015):
        p = self.probability(x)
        v = self.vector(x)
        # Bounded normalized SGD is stable after pretraining and from cold start.
        gradient = rate * (float(target) - p) / (1 + float(v @ v) / 16)
        self.weights += gradient * v
        self.bias += gradient
        self.updates += 1
        self.loss = -float(target*np.log(max(p, 1e-8)) + (1-target)*np.log(max(1-p, 1e-8)))
        return p

    def fit(self, x, y):
        from sklearn.linear_model import LogisticRegression
        self.mean = x.mean(axis=0)
        self.scale = np.maximum(x.std(axis=0), 0.003)
        clf = LogisticRegression(C=2.0, max_iter=600)
        clf.fit(np.clip((x-self.mean)/self.scale, -8, 8), y)
        self.weights, self.bias = clf.coef_[0], float(clf.intercept_[0])
        self.updates = len(x)
        self.label = "Trained"

    def save(self, path, metadata=None):
        payload = {"format": 1, "weights": self.weights.tolist(), "bias": self.bias,
                   "mean": self.mean.tolist(), "scale": self.scale.tolist(),
                   "updates": self.updates, "label": self.label, "metadata": metadata or {}}
        path = Path(path)
        partial = path.with_suffix(".tmp")
        partial.write_text(json.dumps(payload, indent=2)+"\n")
        partial.replace(path)

    @classmethod
    def load(cls, path):
        data = json.loads(Path(path).read_text())
        obj = cls(len(data["weights"]))
        for key in ["weights", "mean", "scale"]:
            setattr(obj, key, np.array(data[key], dtype=float))
        if not all(np.all(np.isfinite(getattr(obj, key))) for key in ["weights", "mean", "scale"]) or np.any(obj.scale <= 0):
            raise ValueError("Invalid decoder checkpoint")
        obj.bias, obj.updates, obj.label = data["bias"], data["updates"], data["label"]
        return obj
