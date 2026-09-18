import numpy as np
import pytest
from backend.brain import Decoder
from backend import server


def test_contributions_reconstruct_actual_action_probability():
    rng = np.random.default_rng(34)
    d = Decoder()
    d.weights = rng.normal(size=128)
    d.mean = rng.normal(size=128)
    d.scale = rng.uniform(.01, 2, size=128)
    x = rng.normal(size=128)
    explanation = d.explain(x)
    z = explanation['bias'] + sum(c['value'] for c in explanation['contributions'])
    assert z == pytest.approx(explanation['logit'])
    assert 1 / (1 + np.exp(-np.clip(z, -30, 30))) == pytest.approx(d.probability(x))


class SmallBrain:
    def reset(self):
        pass

    def step(self, observation):
        return np.tile(observation[:4], 32)

    def telemetry(self):
        return {}


@pytest.fixture
def lab(monkeypatch):
    monkeypatch.setattr(server, 'Brain', SmallBrain)
    lab = server.Lab()
    lab.decoder = Decoder()
    lab.weight_origin = lab.decoder.weights.copy()
    lab.decoder.bias = 1
    return lab


def test_decision_is_captured_before_learning_and_matches_physics(lab):
    before = lab.decoder.probability(lab.brain.step(lab.game.observation()))
    packet = lab.advance()
    d = packet['decision']
    assert packet['lab']['probability'] == pytest.approx(before, abs=.0001)
    assert d['bias'] == 1
    assert d['applied'] and d['requested'] and d['outcome'] == 'FLAP'
    assert d['afterVy'] == pytest.approx(6.7 + (-16 + d['before']['wind']) * .05)
    assert lab.decoder.updates == 1
    packet = lab.advance()
    assert packet['decision']['outcome'] == 'COOLDOWN'
    assert not packet['decision']['applied']


def test_disconnect_blocks_motor_output_and_learning_then_restores(lab):
    lab.command({'action':'mute'})
    packet = lab.advance()
    assert packet['decision']['requested']
    assert not packet['decision']['applied']
    assert packet['decision']['outcome'] == 'DISCONNECTED'
    assert lab.decoder.updates == 0
    assert packet['game']['vy'] == pytest.approx(-.8)
    lab.command({'action':'mute'})
    packet = lab.advance()
    assert packet['decision']['applied'] and lab.decoder.updates == 1


def test_restart_clears_old_decision(lab):
    lab.advance()
    lab.command({'action':'restart'})
    assert lab.snapshot()['decision'] is None
    assert lab.game.time == 0


def test_catch_pauses_on_an_applied_flap_not_a_requested_one(lab):
    lab.game.cooldown = .10
    lab.mode = 'watch'
    lab.command({'action': 'catch'})
    packet = lab.advance()
    assert packet['decision']['outcome'] == 'COOLDOWN'
    assert not lab.paused and lab.catch_flap
    lab.advance()
    packet = lab.advance()
    assert packet['decision']['applied']
    assert lab.paused and not lab.catch_flap
