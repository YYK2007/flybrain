"""Coach demonstrations -> on-policy corrections -> frozen held-out evaluation."""
import argparse
import json
import time
from pathlib import Path
import numpy as np
from backend.brain import Brain, Decoder, ROOT
from backend.game import Flight


def rollout(brain, decoder, seed, gates=12, coach=False, collect=False, difficulty="meadow", silent=False):
    env = Flight(seed, difficulty, max_gates=gates)
    brain.reset()
    xs, ys, total, errors, count = [], [], 0.0, 0, 0
    while not env.done:
        x = brain.step(env.observation(), silent=silent)
        target = env.coach()
        p = decoder.probability(x)
        if collect:
            xs.append(x)
            ys.append(target)
        errors += int((p > 0.5) != bool(target))
        count += 1
        total += env.step(target if coach else p > 0.5)
    return {"seed": seed, "score": env.score, "seconds": round(env.time, 2),
            "reward": round(total, 2), "reason": env.reason, "difficulty": difficulty,
            "decisions": count, "coachAgreement": round(1-errors/max(count, 1), 4)}, xs, ys


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--demos", type=int, default=8)
    ap.add_argument("--dagger", type=int, default=8)
    ap.add_argument("--eval", type=int, default=8)
    ap.add_argument("--gates", type=int, default=15)
    args = ap.parse_args()
    started = time.time()
    brain, decoder = Brain(), Decoder()
    history, all_x, all_y = [], [], []
    report_path = ROOT / "reports/training.json"
    def publish(stage, result=None):
        if result:
            history.append({"episode": len(history)+1, "stage": stage, **result})
        p = {"status": stage, "method": "Supervised imitation + DAgger, fixed full-connectome rate reservoir",
             "history": history, "elapsedSeconds": round(time.time()-started, 1),
             "neurons": brain.n, "edges": brain.graph.nnz}
        report_path.with_suffix(".tmp").write_text(json.dumps(p, indent=2)+"\n")
        report_path.with_suffix(".tmp").replace(report_path)
        print(json.dumps({"stage": stage, **(result or {}), "elapsed": p["elapsedSeconds"]}), flush=True)
    publish("Baseline")
    baseline = [rollout(brain, decoder, 10001+i, args.gates)[0] for i in range(args.eval)]
    decoder.save(ROOT / "checkpoints/untrained.json")
    for i in range(args.demos):
        r, xs, ys = rollout(brain, decoder, 101+i, min(args.gates, 10), coach=True, collect=True,
                            difficulty=["meadow", "wind", "narrow"][i % 3])
        all_x.extend(xs); all_y.extend(ys)
        decoder.fit(np.array(all_x), np.array(all_y))
        decoder.save(ROOT / "checkpoints/trained.json", {"stage": "demonstrations", "trainingSeeds": list(range(101, 101+i+1))})
        publish("Coach demonstrations", r)
    for i in range(args.dagger):
        r, xs, ys = rollout(brain, decoder, 501+i, args.gates, collect=True,
                            difficulty=["meadow", "wind", "narrow"][i % 3])
        all_x.extend(xs); all_y.extend(ys)
        decoder.fit(np.array(all_x), np.array(all_y))
        decoder.save(ROOT / "checkpoints/trained.json", {"stage": "DAgger", "samples": len(all_x)})
        publish("Autonomous + corrections", r)
    publish("Held-out evaluation")
    # No teacher actions or updates below this boundary.
    trained = []
    for i in range(args.eval):
        r = rollout(brain, decoder, 10001+i, args.gates)[0]
        trained.append(r)
        publish("Held-out evaluation", r)
    perturbations = [rollout(brain, decoder, 20001+i, args.gates, difficulty=["wind", "narrow"][i % 2])[0] for i in range(4)]
    silenced = [rollout(brain, decoder, 10001+i, args.gates, silent=True)[0] for i in range(3)]
    # Identical decoder, identical courses; changes only the graph's presynaptic IDs.
    perm = np.random.default_rng(901).permutation(brain.n)
    brain.graph.indices = perm[brain.graph.indices].astype(np.int32)
    shuffled = [rollout(brain, decoder, 10001+i, args.gates)[0] for i in range(3)]
    def summarize(items):
        return {"meanScore": float(np.mean([r["score"] for r in items])),
                "meanSeconds": float(np.mean([r["seconds"] for r in items])),
                "completed": sum(r["reason"] == "Course complete" for r in items),
                "episodes": len(items), "runs": items}
    evaluation = {"baseline": summarize(baseline), "trained": summarize(trained),
                  "perturbations": summarize(perturbations), "silenced": summarize(silenced), "shuffled": summarize(shuffled),
                  "gateCap": args.gates, "trainingSamples": len(all_x),
                  "trainingSeeds": list(range(101, 101+args.demos))+list(range(501, 501+args.dagger)),
                  "evaluationSeeds": list(range(10001, 10001+args.eval)),
                  "claim": "Decoder learning only. Whole graph simulated. No claim of biological learning or topology advantage.",
                  "elapsedSeconds": round(time.time()-started, 1)}
    (ROOT / "reports/evaluation.json").write_text(json.dumps(evaluation, indent=2)+"\n")
    publish("Complete")
    print(json.dumps({k: {s:v for s,v in evaluation[k].items() if s != "runs"} for k in ["baseline", "trained", "perturbations", "silenced", "shuffled"]}, indent=2))


if __name__ == "__main__":
    main()
