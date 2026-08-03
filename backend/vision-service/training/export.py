import argparse

from ultralytics import YOLO


def main() -> None:
    parser = argparse.ArgumentParser(description="Export an evaluated EcoAlert detector")
    parser.add_argument("--model", required=True)
    parser.add_argument("--format", choices=["onnx", "torchscript"], default="onnx")
    args = parser.parse_args()
    YOLO(args.model).export(format=args.format, dynamic=True, simplify=True)


if __name__ == "__main__":
    main()
