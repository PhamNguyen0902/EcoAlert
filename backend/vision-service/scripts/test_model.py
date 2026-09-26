"""Minimal smoke test for the configured EcoAlert YOLO model."""
from pathlib import Path
import sys

import cv2
import numpy as np

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from services.detector import WasteDetector
from services.settings import VisionSettings

EXPECTED_CLASSES = {
    0: "plastic_bottle",
    1: "plastic_bag",
    2: "plastic_cup",
    3: "metal_can",
    4: "cardboard",
    5: "glass_bottle",
}


def main() -> int:
    settings = VisionSettings.from_environment()
    detector = WasteDetector(settings)

    print(f"Model path: {settings.model_path}")
    print(f"Model exists: {settings.model_path.is_file()}")
    detector.load_model()
    print(f"Device: {detector.device}")
    print(f"Model loaded: {detector.is_ready()}")
    print(f"Classes: {detector.get_classes()}")

    if detector.get_classes() != EXPECTED_CLASSES:
        print("Model classes do not match the six expected EcoAlert waste classes.")
        return 1

    if len(sys.argv) > 1:
        image_path = Path(sys.argv[1]).resolve()
        if not image_path.is_file():
            print(f"Test image does not exist: {image_path}")
            return 1
        image = cv2.imdecode(np.fromfile(image_path, dtype=np.uint8), cv2.IMREAD_COLOR)
        if image is None:
            print(f"Test image cannot be decoded: {image_path}")
            return 1
        batch = detector.detect_image(image)
        print(f"Image: {image_path}")
        print(f"Inference: {batch.inference_ms:.1f}ms")
        print(f"Detections: {len(batch.detections)}")
        for detection in batch.detections:
            print(
                f"- {detection.class_name} ({detection.confidence:.3f}) "
                f"[{detection.x1:.1f}, {detection.y1:.1f}, {detection.x2:.1f}, {detection.y2:.1f}]"
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
