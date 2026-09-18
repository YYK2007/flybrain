"""Build a sparse, whole annotated CNS graph from the official versioned files."""
from pathlib import Path
import json
import time
import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.ipc as ipc
from scipy import sparse


def main():
    started = time.time()
    root = Path("data/processed")
    root.mkdir(parents=True, exist_ok=True)
    ann = pd.read_feather("data/raw/annotations.feather")
    nodes = ann.loc[ann.superclass.notna() & ann.superclass.ne("") & ann.status.ne("Glia")].sort_values("bodyId").reset_index(drop=True)
    ids = nodes.bodyId.to_numpy(np.int64)
    assert len(np.unique(ids)) == len(ids)
    nt = pd.read_feather("data/raw/neurotransmitters.feather").set_index("body").consensus_nt
    nodes["nt"] = nodes.bodyId.map(nt).fillna("unknown")
    # This uniform sign assumption is an engineering approximation. Receptor and
    # neuromodulatory dynamics are not provided by the connectome.
    sign = np.where(nodes.nt.isin(["gaba", "glutamate"]), -1, 1).astype(np.float32)
    source = ipc.open_file(pa.memory_map("data/raw/connections.feather", "r"))
    rows, cols, vals = [], [], []
    total_rows, total_contacts, retained_contacts = 0, 0, 0
    for b in range(source.num_record_batches):
        batch = source.get_batch(b)
        pre, post, w = (batch.column(batch.schema.get_field_index(c)).to_numpy() for c in ["body_pre", "body_post", "weight"])
        i, j = np.searchsorted(ids, pre), np.searchsorted(ids, post)
        keep = (i < len(ids)) & (j < len(ids))
        keep &= (ids[np.minimum(i, len(ids)-1)] == pre) & (ids[np.minimum(j, len(ids)-1)] == post)
        keep &= w > 0
        rows.append(j[keep].astype(np.int32))
        cols.append(i[keep].astype(np.int32))
        vals.append(w[keep].astype(np.float32))
        total_rows += len(w)
        total_contacts += int(w.sum())
        retained_contacts += int(w[keep].sum())
        if b % 200 == 0:
            print(f"Import batch {b}/{source.num_record_batches}", flush=True)
    row, col, weight = np.concatenate(rows), np.concatenate(cols), np.concatenate(vals)
    del rows, cols, vals
    graph = sparse.csr_matrix((weight, (row, col)), shape=(len(ids), len(ids)), dtype=np.float32)
    incoming = np.asarray(graph.sum(axis=1)).ravel()
    graph.data *= sign[graph.indices]
    graph.data /= np.repeat(np.maximum(incoming, 1), np.diff(graph.indptr))
    graph.sort_indices()
    sparse.save_npz(root / "connectome.npz", graph, compressed=False)
    np.save(root / "ids.npy", ids)

    # Fourteen opponent-coded channels in existing retinal neurons. The mapping
    # encodes game state, not a claim of a measured fly retina.
    retina = np.flatnonzero(nodes.type.eq("R1-R6").to_numpy())
    rng = np.random.default_rng(42)
    rng.shuffle(retina)
    channels = np.array_split(retina, 14)
    pools = list(channels)
    pool_names = [f"sensory-{i}" for i in range(14)]
    for group, count in [("ol_intrinsic", 10), ("visual_projection", 8), ("cb_intrinsic", 16), ("descending_neuron", 8), ("vnc_intrinsic", 6), ("vnc_motor", 2)]:
        indices = np.flatnonzero(nodes.superclass.eq(group).to_numpy())
        rng.shuffle(indices)
        for k, part in enumerate(np.array_split(indices, count)):
            pools.append(part)
            pool_names.append(f"{group}-{k}")
    pool_rows, pool_cols, pool_vals = [], [], []
    for k, indices in enumerate(pools):
        pool_rows.extend([k] * len(indices))
        pool_cols.extend(indices.tolist())
        pool_vals.extend([1.0 / len(indices)] * len(indices))
    sparse.save_npz(root / "pool.npz", sparse.csr_matrix((pool_vals, (pool_rows, pool_cols)), shape=(len(pools), len(ids)), dtype=np.float32))
    np.savez(root / "channels.npz", **{f"c{i}": a for i, a in enumerate(channels)})

    positions = []
    available = [i for i, loc in enumerate(nodes.somaLocation) if loc is not None and len(loc) == 3]
    chosen = np.sort(rng.choice(available, size=min(1800, len(available)), replace=False))
    locs = np.array([nodes.somaLocation[i] for i in chosen], dtype=float)
    # Source axes, centered and uniformly scaled. Shape is not invented.
    center = (np.quantile(locs, .01, axis=0) + np.quantile(locs, .99, axis=0)) / 2
    extent = float(np.max(np.ptp(locs, axis=0))) / 2
    xyz = (locs - center) / extent
    for i, p in zip(chosen, xyz):
        positions.append({"id": str(ids[i]), "xyz": p.round(5).tolist(), "group": nodes.superclass[i]})
    np.save(root / "display_indices.npy", chosen)
    Path("public/brain.json").write_text(json.dumps(positions, separators=(",", ":")))
    report = {"dataset": "MaleCNS v1.0", "neurons": len(ids), "edges": graph.nnz,
              "synapticContacts": retained_contacts, "sourceRows": total_rows,
              "excludedRows": total_rows - len(weight), "sourceContacts": total_contacts,
              "inputNeurons": len(retina), "pools": len(pools), "poolNames": pool_names,
              "neurotransmitters": nodes.nt.value_counts().to_dict(),
              "superclasses": nodes.superclass.value_counts().to_dict(),
              "nodePolicy": "Nonempty neuronal superclass, excluding explicit Glia; all retained nodes updated.",
              "edgePolicy": "All positive-weight source edges between retained nodes; no additional threshold.",
              "dynamics": "Rectified tanh rate reservoir; absolute incoming-weight normalization; uniform inhibitory GABA/glutamate sign.",
              "training": "Coach-supervised decoder fitting and DAgger. Biological edge weights fixed.",
              "displaySample": len(chosen), "secondsToPrepare": round(time.time()-started, 2)}
    (root / "manifest.json").write_text(json.dumps(report, indent=2)+"\n")
    print(json.dumps({k: report[k] for k in ["neurons", "edges", "synapticContacts", "inputNeurons", "secondsToPrepare"]}, indent=2), flush=True)


if __name__ == "__main__":
    main()
