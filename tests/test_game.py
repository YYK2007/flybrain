import numpy as np
import pytest
from backend.game import Flight


def test_no_flaps_hits_ground_and_ends():
    game = Flight(2)
    while not game.done:
        game.step(False)
    assert game.reason == "Ground" and game.score == 0
    snapshot = game.snapshot()
    assert game.step(True) == 0
    assert game.snapshot() == snapshot


def test_flap_cooldown_and_gravity():
    game = Flight(3)
    game.step(True)
    up = game.vy
    game.step(True)
    assert not game.flapped and game.vy < up


def test_pipe_collision_and_score_only_after_clearing():
    game = Flight(1)
    gate = game.gates[0]
    game.z = gate["z"] - 1.5
    game.y = gate["y"] - gate["half"] - 0.5
    game.step(False)
    assert game.done and game.reason == "Pipe collision" and game.score == 0
    safe = Flight(1)
    safe.z, safe.y = gate["z"] + 1.5, gate["y"]
    safe.step(False)
    assert safe.score == 1 and not safe.done
    safe.step(False)
    assert safe.score == 1


@pytest.mark.parametrize("difficulty", ["meadow", "wind", "narrow"])
def test_coach_can_demonstrate_complete_courses(difficulty):
    # A coach that fails cannot generate useful demonstration training data.
    for seed in [101, 102, 509, 909]:
        game = Flight(seed, difficulty, max_gates=15)
        while not game.done:
            game.step(game.coach())
        assert game.score == 15, (seed, difficulty, game.snapshot())


def test_seed_reproducibility_and_distinct_courses():
    a, b, c = Flight(77), Flight(77), Flight(78)
    assert a.gates == b.gates and a.gates != c.gates
    for i in range(10):
        a.step(i % 7 == 0); b.step(i % 7 == 0)
        np.testing.assert_array_equal(a.observation(), b.observation())
