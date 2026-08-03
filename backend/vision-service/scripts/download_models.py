"""Explicit model bootstrap; never runs during application startup unless requested."""

import argparse
import hashlib
import shutil
import urllib.request
from pathlib import Path

SAM2_TINY_URL = "https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_tiny.pt"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download_sam2(destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(".download")
    print(f"Downloading official SAM 2.1 tiny checkpoint to {destination}")
    with urllib.request.urlopen(SAM2_TINY_URL, timeout=60) as response, temporary.open("wb") as output:
        shutil.copyfileobj(response, output)
    temporary.replace(destination)
    print(f"sha256={sha256(destination)}")


def download_yolo(destination: Path) -> None:
    from ultralytics import YOLO

    destination.mkdir(parents=True, exist_ok=True)
    print("Requesting the official yolo26n.pt pretrained checkpoint through Ultralytics")
    model = YOLO("yolo26n.pt")
    source = Path(model.ckpt_path)
    target = destination / source.name
    if source.resolve() != target.resolve():
        shutil.copy2(source, target)
    print(f"Saved {target}; sha256={sha256(target)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", type=Path, default=Path("/models"))
    parser.add_argument("--yolo", action="store_true")
    parser.add_argument("--sam2", action="store_true")
    args = parser.parse_args()
    if not args.yolo and not args.sam2:
        parser.error("Select at least one explicit download: --yolo and/or --sam2")
    if args.yolo:
        download_yolo(args.model_dir)
    if args.sam2:
        download_sam2(args.model_dir / "sam2.1_hiera_tiny.pt")
