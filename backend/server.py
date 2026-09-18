"""Loopback-only autonomous flight service, shared by all connected viewers."""
import asyncio
from contextlib import asynccontextmanager
import json
import os
import time
from .brain import Brain, Decoder, ROOT
from .game import Flight, DT
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles


def read_report(name):
    path = ROOT / "reports" / name
    return json.loads(path.read_text()) if path.exists() else None


class Lab:
    def __init__(self):
        self.brain = Brain()
        path = ROOT / "checkpoints/trained.json"
        self.decoder = Decoder.load(path) if path.exists() else Decoder()
        self.game = Flight(30001)
        self.clients = set()
        self.commands = asyncio.Queue()
        self.paused = False
        self.mode = "adapt"
        self.course = "meadow"
        self.episode = 1
        self.best = 0
        self.history = []
        self.events = [{"text": "Whole connectome loaded", "kind": "system", "time": 0}]
        self.probability = 0.0
        self.reward = 0.0
        self.total_reward = 0.0
        self.done_at = None
        self.steps = 0
        self.last_saved = None
        self.weight_origin = self.decoder.weights.copy()
        self.wall_step = 0.1
        self.latest = None
        self.decision = None
        self.slow = False
        self.muted = False
        self.single_step = False
        self.catch_flap = False

    def event(self, text, kind="system"):
        self.events.insert(0, {"text": text, "kind": kind, "time": round(self.game.time, 1)})
        self.events = self.events[:8]

    def reset(self):
        self.game = Flight(30000+self.episode, self.course)
        self.brain.reset()
        self.done_at = None
        self.total_reward = 0
        self.decision = None
        self.catch_flap = False

    def command(self, data):
        action = data.get("action")
        if action == "pause":
            self.paused = not self.paused
        elif action == "step" and self.paused:
            self.single_step = True
        elif action == "catch":
            self.catch_flap = not self.catch_flap
            if self.catch_flap:
                self.paused = False
        elif action == "slow":
            self.slow = not self.slow
        elif action == "mute":
            self.muted = not self.muted
            self.event("Neural output disconnected · learning held" if self.muted else "Neural output reconnected", "intervention")
        elif action == "restart":
            self.episode += 1
            self.reset()
        elif action == "mode" and data.get("value") in ["watch", "adapt"]:
            self.mode = data["value"]
            self.event("Coach corrections enabled" if self.mode == "adapt" else "Weights frozen · autonomous flight", "learning")
        elif action == "checkpoint" and data.get("value") in ["trained", "untrained", "saved"]:
            name = data["value"]
            path = ROOT / f"checkpoints/{'live' if name == 'saved' else name}.json"
            if path.exists():
                self.decoder = Decoder.load(path)
                if name == "untrained" and (ROOT / "checkpoints/trained.json").exists():
                    template = Decoder.load(ROOT / "checkpoints/trained.json")
                    self.decoder.mean, self.decoder.scale = template.mean, template.scale
                self.weight_origin = self.decoder.weights.copy()
                self.episode += 1
                self.reset()
                self.event(f"Loaded {name} brain decoder", "learning")
        elif action == "course" and data.get("value") in ["meadow", "wind", "narrow"]:
            self.course = data["value"]
            self.episode += 1
            self.reset()
            self.event(f"Environment changed: {self.course}", "environment")
        elif action == "save":
            self.save()

    def save(self):
        self.decoder.save(ROOT / "checkpoints/live.json", {"episode": self.episode, "course": self.course, "mode": self.mode})
        self.last_saved = time.strftime("%H:%M:%S")
        self.event("Learning checkpoint saved", "learning")

    def advance(self):
        observation = self.game.observation()
        before = {"y": self.game.y, "vy": self.game.vy, "cooldown": self.game.cooldown,
                  "gap": self.game.target()["y"] - self.game.y,
                  "distance": self.game.target()["z"] - self.game.z, "wind": self.game.wind}
        x = self.brain.step(observation)
        self.probability = self.decoder.probability(x)
        explanation = self.decoder.explain(x)
        target = self.game.coach() if self.mode == "adapt" else None
        old_score = self.game.score
        requested = self.probability > 0.5
        self.reward = self.game.step(requested and not self.muted)
        self.total_reward += self.reward
        if self.mode == "adapt" and not self.muted:
            self.decoder.learn(x, target, rate=0.07)
            self.decoder.label = "Adapting"
        self.steps += 1
        self.decision = {**explanation, "id": self.steps, "time": self.game.time,
                         "observation": observation.tolist(), "before": before,
                         "afterVy": self.game.vy, "requested": requested,
                         "applied": self.game.flapped, "muted": self.muted,
                         "outcome": "DISCONNECTED" if self.muted else "FLAP" if self.game.flapped else "COOLDOWN" if requested else "COAST",
                         "teacher": target if not self.muted else None}
        if self.catch_flap and self.game.flapped:
            self.paused = True
            self.catch_flap = False
        if self.game.score > old_score:
            self.event(f"Gate {self.game.score:02d} cleared", "reward")
        self.best = max(self.best, self.game.score)
        if self.game.done:
            self.done_at = time.monotonic()
            self.history.append({"episode": self.episode, "score": self.game.score,
                                 "reward": round(self.total_reward, 2), "mode": self.mode})
            self.history = self.history[-100:]
            self.event(self.game.reason, "reward" if self.game.reason == "Course complete" else "collision")
            if self.mode == "adapt":
                self.save()
        return self.snapshot()

    def snapshot(self):
        return {"game": self.game.snapshot(), "brain": self.brain.telemetry(), "decision": self.decision,
                "lab": {"paused": self.paused, "mode": self.mode, "course": self.course,
                        "episode": self.episode, "best": self.best, "history": self.history,
                        "probability": round(self.probability, 4), "reward": round(self.total_reward, 2),
                        "updates": self.decoder.updates, "loss": round(self.decoder.loss, 4),
                        "weightChange": round(float(((self.decoder.weights-self.weight_origin)**2).sum()**0.5), 4),
                        "checkpoint": self.decoder.label, "lastSaved": self.last_saved,
                        "events": self.events, "simSpeed": round(DT/max(self.wall_step, .1), 2),
                        "workerDutyTarget": 45, "workerThreads": 1, "slow": self.slow, "muted": self.muted,
                        "catchFlap": self.catch_flap}}

    async def run(self):
        while True:
            start = time.monotonic()
            while not self.commands.empty():
                self.command(await self.commands.get())
            if not self.clients:
                await asyncio.sleep(.3)
                continue
            if (not self.paused or self.single_step) and not self.game.done:
                state = await asyncio.to_thread(self.advance)
            else:
                if not self.paused and self.game.done and time.monotonic() - self.done_at > 2:
                    self.episode += 1
                    self.reset()
                state = self.snapshot()
            self.single_step = False
            self.latest = state
            for client in list(self.clients):
                try:
                    await asyncio.wait_for(client.send_json(state), timeout=.4)
                except Exception:
                    self.clients.discard(client)
            await asyncio.sleep(max(0.005, (.5 if self.slow else .1) - (time.monotonic()-start)))
            self.wall_step = time.monotonic()-start


lab = None


@asynccontextmanager
async def lifespan(app):
    global lab
    try:
        os.nice(10)
    except OSError:
        pass
    lab = await asyncio.to_thread(Lab)
    task = asyncio.create_task(lab.run())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(lifespan=lifespan)


@app.get("/api/status")
def status():
    return {"manifest": lab.brain.manifest, "training": read_report("training.json"),
            "evaluation": read_report("evaluation.json"), "saved": (ROOT / "checkpoints/live.json").exists(),
            "resourcePolicy": "One worker, 45% target duty, 10 Hz maximum, no GPU training. Idle without viewers."}


@app.websocket("/ws")
async def websocket(ws: WebSocket):
    origin = ws.headers.get("origin", "")
    if origin and not (origin.startswith("http://127.0.0.1:") or origin.startswith("http://localhost:")):
        await ws.close(code=1008)
        return
    await ws.accept()
    lab.clients.add(ws)
    try:
        await ws.send_json(lab.snapshot())
        while True:
            data = await ws.receive_json()
            if isinstance(data, dict):
                await lab.commands.put(data)
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        lab.clients.discard(ws)


if (ROOT / "dist").exists():
    app.mount("/", StaticFiles(directory=ROOT / "dist", html=True), name="game")
