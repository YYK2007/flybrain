# Flybrain

Can a fruit fly connectome steer a game?

Flybrain is a third-person 3D flight experiment driven by a rate model built from the **MaleCNS v1.0 connectome**. A small fly navigates gates while the interface exposes the activity, decoder signal, and exact decision behind every flap.

The simulation updates **166,700 neurons and 25,582,938 directed connections** at every decision. You can watch a trained controller fly, start from an untrained decoder, let it adapt, pause on a flap, inspect individual neurons, or disconnect the neural output and see what changes.

## What you can explore

- A live 3D flight course with calm air, gusts, and narrow gaps
- The controller's flap probability and applied action
- A sampled anatomical view of 1,800 real neuron coordinates
- Activity and activity-change views for individual neurons
- Exact population contributions to the decoder's decision
- A shared timeline of neural activity, flap signal, applied flaps, and velocity
- Trained, untrained, and saved decoder checkpoints
- Live supervised adaptation and checkpoint saving
- Interventions: pause, single-step, slow observation, and output disconnection

## How the controller works

Seven measurements of the game state become 14 paired channels assigned to 3,377 R1–R6 neurons. They encode relative gap height, vertical speed, gate distance, fly height, the next gap, wind, and gap width.

The full retained graph then advances with a simplified recurrent rate model:

```text
drive = 0.06 + 0.85 × W × activity + sensory_input
activity_next = 0.12 × activity + 0.88 × tanh(max(drive, 0))
```

A logistic decoder reads 64 population averages and their first differences. A probability above 0.5 requests a flap, subject to a short wing cooldown. No raw game measurement bypasses the neural state to enter the decoder.

Training changes the decoder weights. The connectome weights remain fixed.

## Recorded results

The included evaluation uses course seeds kept separate from training:

| Condition | Result |
| --- | --- |
| Trained decoder | 6/6 standard courses completed |
| Wind and narrow gaps | 4/4 courses completed |
| Untrained decoder | 0 gates cleared |
| Neural activity silenced | 0 gates cleared |
| Presynaptic IDs shuffled | 3/3 courses completed |

Each completed run was capped at 15 gates. The shuffled result is important: this experiment does **not** establish that the original biological topology is better. A fair topology comparison would need matched retraining and more evaluation seeds.

The full runs and termination reasons are in [`reports/evaluation.json`](reports/evaluation.json). Training history is in [`reports/training.json`](reports/training.json).

## Run the experiment

You need Python 3.12+, Node.js 22+, [uv](https://docs.astral.sh/uv/), and a WebGL2 browser. No API key or paid service is required.

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

Open `http://127.0.0.1:8765`. The public MaleCNS download is about 1.1 GB. Raw files and the prepared 205 MB graph are excluded from Git and recreated by the setup scripts. Trained and untrained decoder checkpoints are included.

On macOS, `Launch Flybrain.command` starts the experiment after setup.

## Train and test

Stop the live simulator before offline training:

```sh
OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 VECLIB_MAXIMUM_THREADS=1 \
  nice -n 15 .venv/bin/python -m scripts.train --demos 4 --dagger 4 --eval 6 --gates 15
.venv/bin/python -m pytest -q
```

Training begins with coach demonstrations, then collects corrections on states the controller visits using DAgger. Evaluation freezes the decoder and performs no teacher actions or weight updates.

## Runtime design

Flybrain uses one low-priority CPU worker and one numerical-library thread. The worker targets a 45% compute duty cycle, the simulator runs at up to 10 decisions per wall-clock second, and rendering is capped at 30 FPS. The simulation idles when nobody is connected. There is no GPU training.

## Scientific boundary

The connectome wiring and soma coordinates come from biological data. The sensory encoding, rate dynamics, decoder, game body, and training procedure are engineered.

This is not a complete biological fly simulation, a pixel-based retina, the published Shiu spiking model, or evidence that a living fly learned the game. The project is an inspectable experiment in routing a game-control problem through connectome-derived structure.

## Data and credits

The [MaleCNS project](https://male-cns.janelia.org/) provides the connectome under CC BY 4.0. Source URLs and hashes are recorded in [`data/sources.json`](data/sources.json). The fly and landscape are original procedural meshes. See [`THIRD_PARTY.md`](THIRD_PARTY.md) for dataset, software, and research credits.
