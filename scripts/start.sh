#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -x .venv/bin/python ] || [ ! -f data/processed/connectome.npz ]; then
  echo 'Run the setup steps in README.md first.'
  exit 1
fi
if [ ! -f dist/index.html ]; then
  npm run build
fi
export OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 VECLIB_MAXIMUM_THREADS=1 MKL_NUM_THREADS=1
echo 'Flybrain is available at http://127.0.0.1:8765'
echo 'Open that address in your browser. Press Ctrl-C here to stop.'
exec nice -n 15 .venv/bin/python -m uvicorn backend.server:app --host 127.0.0.1 --port 8765
