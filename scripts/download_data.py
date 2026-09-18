"""Download public MaleCNS inputs; no token or account is needed."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import urllib.request
import json
import hashlib

BASE = "https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/"
FILES = {
    "annotations.feather": "body-annotations-male-cns-v1.0-minconf-0.5.feather",
    "neurotransmitters.feather": "body-neurotransmitters-male-cns-v1.0.feather",
    "connections.feather": "connectome-weights-male-cns-v1.0-minconf-0.5.feather",
}


def main():
    root = Path("data/raw")
    root.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for name, remote in FILES.items():
        url = BASE + remote
        size = int(urllib.request.urlopen(urllib.request.Request(url, method="HEAD")).headers["Content-Length"])
        target = root / name
        if not target.exists() or target.stat().st_size != size:
            chunk = 32 * 1024 * 1024
            parts = [(i, start, min(start + chunk, size) - 1) for i, start in enumerate(range(0, size, chunk))]
            def download(part):
                i, start, end = part
                p = root / f"{name}.part{i}"
                if p.exists() and p.stat().st_size == end - start + 1:
                    return p
                request = urllib.request.Request(url, headers={"Range": f"bytes={start}-{end}"})
                with urllib.request.urlopen(request, timeout=120) as response, p.open("wb") as out:
                    if response.status != 206:
                        raise RuntimeError("Range download was not honored")
                    while block := response.read(1024 * 1024):
                        out.write(block)
                if p.stat().st_size != end - start + 1:
                    raise RuntimeError("Incomplete data download")
                print(f"{name}: chunk {i+1}/{len(parts)}", flush=True)
                return p
            with ThreadPoolExecutor(max_workers=8) as pool:
                downloaded = list(pool.map(download, parts))
            with target.with_suffix(".partial").open("wb") as out:
                for part in downloaded:
                    with part.open("rb") as inp:
                        while block := inp.read(1024 * 1024):
                            out.write(block)
            target.with_suffix(".partial").replace(target)
            for part in downloaded:
                part.unlink()
        with target.open("rb") as stream:
            digest = hashlib.file_digest(stream, "sha256").hexdigest()
        manifest[name] = {"url": url, "bytes": size, "sha256": digest}
        print(name, digest, flush=True)
    Path("data/sources.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
