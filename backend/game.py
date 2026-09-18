"""Deterministic vertical flight. Units are illustrative game metres and seconds."""
import math
import numpy as np

DT = 0.05


class Flight:
    def __init__(self, seed=1, difficulty="meadow", max_gates=40):
        self.seed = int(seed)
        self.difficulty = difficulty
        self.rng = np.random.default_rng(seed)
        self.y, self.vy, self.z = 6.5, 0.0, 0.0
        self.time, self.cooldown, self.score = 0.0, 0.0, 0
        self.done, self.reason, self.flapped = False, "", False
        self.max_gates = max_gates
        self.speed = 10.0
        self.gates = []
        for i in range(max_gates + 5):
            center = float(self.rng.uniform(3.6, 10.2))
            self.gates.append({"z": 28.0 + i * 23.0, "y": center,
                               "half": 1.65 if difficulty == "narrow" else 2.1, "id": i})

    @property
    def wind(self):
        return 3.5 * math.sin(self.time * 0.7 + self.seed) if self.difficulty == "wind" else 0.0

    def target(self):
        return next(g for g in self.gates if g["z"] + 1.6 >= self.z)

    def observation(self):
        g = self.target()
        after = self.gates[min(g["id"] + 1, len(self.gates) - 1)]
        return np.array([(g["y"] - self.y) / 7, self.vy / 9,
                         min((g["z"] - self.z) / 26, 1.2), (self.y - 7) / 7,
                         (after["y"] - self.y) / 7, self.wind / 4,
                         (g["half"] - 1.8) / 1.8], dtype=np.float32)

    def coach(self):
        # The teacher supplies labels during training only, never evaluation actions.
        g = self.target()
        return float(self.y < g["y"] - 0.45)

    def step(self, flap):
        if self.done:
            return 0.0
        self.flapped = bool(flap and self.cooldown <= 1e-6)
        if self.flapped:
            self.vy = 6.7
            self.cooldown = 0.20
        self.cooldown = max(0.0, self.cooldown - DT)
        self.vy += (-16.0 + self.wind) * DT
        self.y += self.vy * DT
        self.z += self.speed * DT
        self.time += DT
        reward = DT
        if self.y < 0.38 or self.y > 13.62:
            self.done, self.reason = True, "Ground" if self.y < 0.38 else "Canopy"
        for g in self.gates:
            if abs(g["z"] - self.z) < 1.25 + 0.32 and abs(self.y - g["y"]) > g["half"] - 0.32:
                self.done, self.reason = True, "Pipe collision"
                break
        passed = sum(self.z > g["z"] + 1.6 for g in self.gates)
        if passed > self.score:
            reward += 3.0
            self.score = passed
        if self.score >= self.max_gates:
            self.done, self.reason = True, "Course complete"
        if self.done and self.reason != "Course complete":
            reward -= 5.0
        return reward

    def snapshot(self):
        return {"y": self.y, "vy": self.vy, "z": self.z, "time": self.time,
                "score": self.score, "done": self.done, "reason": self.reason,
                "flap": self.flapped, "wind": self.wind, "seed": self.seed,
                "difficulty": self.difficulty, "maxGates": self.max_gates,
                "gates": [g for g in self.gates if self.z - 15 < g["z"] < self.z + 210]}
