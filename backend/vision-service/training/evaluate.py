import argparse
import json

from ultralytics import YOLO


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate an EcoAlert YOLO detector")
    parser.add_argument("--data", default="training/data.yaml")
    parser.add_argument("--model", required=True)
    parser.add_argument("--device", default="0")
    args = parser.parse_args()
    metrics = YOLO(args.model).val(data=args.data, device=args.device, split="test")
    print(json.dumps({
        "map50": float(metrics.box.map50),
        "map50_95": float(metrics.box.map),
        "precision": float(metrics.box.mp),
        "recall": float(metrics.box.mr),
    }, indent=2))


if __name__ == "__main__":
    main()
