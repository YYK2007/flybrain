import json
import numpy as np
import pytest
from backend.brain import Brain, Decoder, ROOT


def test_decoder_learning_and_checkpoint_roundtrip(tmp_path):
    decoder = Decoder(4)
    x = np.array([.1, .3, .5, .7])
    before = decoder.probability(x)
    for _ in range(80):
        decoder.learn(x, 1, rate=.2)
    assert decoder.probability(x) > before + .5
    decoder.save(tmp_path / "checkpoint.json")
    restored = Decoder.load(tmp_path / "checkpoint.json")
    assert restored.probability(x) == decoder.probability(x)
    np.testing.assert_array_equal(restored.weights, decoder.weights)
    assert restored.updates == 80


@pytest.mark.skipif(not (ROOT / "data/processed/connectome.npz").exists(), reason="Download/import MaleCNS first")
def test_full_graph_finite_sensory_response_and_silencing():
    brain = Brain()
    assert brain.n == 166700 and brain.graph.nnz == 25582938
    assert len(brain.activity) == brain.n
    low = np.zeros(7, dtype=np.float32)
    high = low.copy(); high[0] = 1
    brain.reset(); x0 = brain.step(low)
    brain.reset(); x1 = brain.step(high)
    assert np.isfinite(x1).all() and x1.shape == (128,)
    assert not np.allclose(x0, x1)
    for _ in range(12):
        x1 = brain.step(high)
    assert np.all((brain.activity >= 0) & (brain.activity <= 1))
    assert np.count_nonzero(brain.activity > 0) > 100000
    assert len(brain.telemetry()["activity"]) == 1800
    brain.reset()
    silent = brain.step(high, silent=True)
    np.testing.assert_array_equal(silent, np.zeros(128))


def test_saved_training_and_eval_seed_sets_do_not_overlap():
    path = ROOT / "reports/evaluation.json"
    if not path.exists():
        pytest.skip("Run training first")
    report = json.loads(path.read_text())
    assert set(report["trainingSeeds"]).isdisjoint(report["evaluationSeeds"])
