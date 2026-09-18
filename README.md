# Flybrain

A local 3D flight simulator controlled by a rate model built from the MaleCNS fly connectome. Watch the fly navigate gates, inspect the activity behind each flap, and train the decoder while it flies.

The controller uses 166,700 neurons and 25,582,938 directed connections. Training adjusts a logistic decoder; connectome weights stay fixed. The model uses engineered sensory inputs and simplified dynamics, so game performance does not establish biological learning or a benefit from the original wiring.

## Setup

Requires Python 3.12+, Node.js 22+, [uv](https://docs.astral.sh/uv/), and a browser with WebGL2. No API key or paid service is required.

```sh
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r requirements.lock.txt
npm ci
.venv/bin/python -m scripts.download_data
OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 VECLIB_MAXIMUM_THREADS=1 \
  .venv/bin/python -m scripts.prepare_connectome
npm run build
npm start
```

Open **http://127.0.0.1:8765**. Stop the server with Ctrl-C. On macOS, `Launch Flybrain.command` runs the same startup script after setup.

The download is about 1.1 GB. Raw files and the prepared graph are excluded from Git; the scripts recreate them. Source URLs and SHA-256 hashes are recorded in [`data/sources.json`](data/sources.json). Trained and untrained decoder checkpoints are included. Your saved `checkpoints/live.json` stays local.

## Controls

- **Watch it fly:** freeze the decoder and watch autonomous flight.
- **Let it learn:** update the decoder with coach corrections while it controls the fly. This is supervised adaptation.
- **Trained / Untrained / Saved learning:** choose the starting decoder.
- **Calm / Gusts / Narrow:** change the course conditions.
- **Pause / Step one decision:** freeze the simulation or advance it by 50 ms.
- **Inspect next flap:** pause when a flap is applied.
- **Disconnect output:** block motor commands and suspend learning while neural activity continues.
- **Save learning checkpoint:** save the current decoder locally.

The inspector shows sampled neuron IDs, modeled activity, decoder contributions, and a shared timeline for flap probability and vertical velocity. Anatomy shows 1,800 sampled neuron coordinates; the simulation updates the full retained graph. Display gains are labeled in the interface.

## Model

Seven measurements of the game state drive 14 paired channels assigned to 3,377 R1–R6 neurons. These include gap height, velocity, gate distance, fly height, the following gap, wind, and gap width. The controller does not receive rendered images.

Connection weights use synapse counts normalized by total incoming weight. GABA and glutamate receive inhibitory signs; other transmitters receive excitatory signs. The recurrent update is:

```text
drive = 0.06 + 0.85 * W @ activity + sensory_input
activity_next = 0.12 * activity + 0.88 * tanh(max(drive, 0))
```

The decoder reads 64 population averages and their changes. A probability above 0.5 requests a flap, subject to the wing cooldown. The implementation uses rate dynamics, not biological spikes or the Shiu leaky integrate-and-fire model.

## Training and tests

Stop the live server before offline training:

```sh
OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 VECLIB_MAXIMUM_THREADS=1 \
  nice -n 15 .venv/bin/python -m scripts.train --demos 4 --dagger 4 --eval 6 --gates 15
.venv/bin/python -m pytest -q
```

Training starts with coach demonstrations, then collects corrections on states visited by the controller (DAgger). Evaluation freezes the decoder and uses separate course seeds.

The included [`evaluation.json`](reports/evaluation.json) records six completed standard courses and four wind/narrow courses, each capped at 15 gates. Untrained and silenced controls cleared zero gates. Shuffled wiring also completed its three courses with the same decoder. These results do not establish an advantage for the biological topology; that comparison would require retraining matched controls. Training history is in [`training.json`](reports/training.json).

## Runtime

One low-priority CPU worker runs the network, with one numerical-library thread and a 45% target duty cycle. This is cooperative pacing, not a system-wide CPU limit. The graph arrays occupy about 205 MB, with additional Python and browser memory overhead.

The simulator runs at up to 10 decisions per wall-clock second, each advancing 50 ms of game time. Rendering is capped at 30 FPS. The simulation idles without connected viewers; Pause also stops it while connected. There is no GPU training.

For frontend development, run the Python server with `npm start` and Vite with `npm run dev`. Vite proxies simulator requests to port 8765. Both services bind to loopback.

## Data and credits

The [MaleCNS project](https://male-cns.janelia.org/) provides the connectome under CC BY 4.0. The fly and scenery are procedural meshes. See [`THIRD_PARTY.md`](THIRD_PARTY.md) for dataset, dependency, and research credits.
