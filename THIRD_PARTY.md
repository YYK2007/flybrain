# Attribution

## MaleCNS v1.0 data

The fly connectome and sampled soma coordinates derive from the Male CNS Connectome Project, a collaboration between FlyEM at HHMI Janelia, the University of Cambridge Department of Zoology, the MRC Laboratory of Molecular Biology, and Google Research.

Berg, Beckett, Costa, Schlegel, Januszewski and colleagues, *Sexual dimorphism in the complete connectome of the Drosophila male central nervous system*. The project links the Cell publication and preprint at https://male-cns.janelia.org/ . Dataset: https://male-cns.janelia.org/download/ . Data license: CC BY 4.0, https://creativecommons.org/licenses/by/4.0/ . Modifications: selection of assigned neuronal superclasses, aggregation into sparse arrays, simplified neurotransmitter signs, incoming-weight normalization, sampling and coordinate transformation for visualization. These are model assumptions, not endorsements by the dataset authors.

Raw source names, URLs and SHA-256 digests are in `data/sources.json`. Import statistics are in `data/processed/manifest.json`.

## Software

- Three.js: MIT, https://github.com/mrdoob/three.js
- Lucide: ISC, https://github.com/lucide-icons/lucide
- Vite: MIT, https://github.com/vitejs/vite
- NumPy and SciPy: BSD-3-Clause.
- pandas: BSD-3-Clause; Apache Arrow: Apache-2.0.
- scikit-learn: BSD-3-Clause.
- FastAPI, Uvicorn: MIT; websockets: BSD-3-Clause.
- DM Sans and Instrument Serif: SIL Open Font License, served by Google Fonts with local system fallbacks.

Dependency distributions retain their own license files. No Flappy Bird game code, trademarks, artwork, sound, or proprietary assets are bundled. The fly, plants, landscape and pipe meshes are procedural original assets.

## Background references

Shiu et al., *A Drosophila computational brain model reveals sensorimotor processing*, Nature 634, 210–219 (2024), https://doi.org/10.1038/s41586-024-07763-9 . This game does not implement its LIF dynamics.

DOOMFLY, https://github.com/nftechie/doomfly, was inspected for source schema, graph retention and experimental framing. No DOOMFLY assets or simulator implementation are vendored.
