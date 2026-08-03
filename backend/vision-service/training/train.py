import argparse

from ultralytics import YOLO


def main() -> None:
    parser = argparse.ArgumentParser(description="Fine-tune a YOLO26 EcoAlert waste detector")
    parser.add_argument("--data", default="training/data.yaml")
    parser.add_argument("--model", default="yolo26n.pt")
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--patience", type=int, default=15)
    parser.add_argument("--image-size", type=int, default=640)
    parser.add_argument("--device", default="0")
    args = parser.parse_args()
    YOLO(args.model).train(
        data=args.data,
        epochs=args.epochs,
        patience=args.patience,
        imgsz=args.image_size,
        device=args.device,
        project="runs/ecoalert",
        name="waste-detector",
    )


if __name__ == "__main__":
    main()
