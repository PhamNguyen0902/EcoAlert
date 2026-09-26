from dataclasses import dataclass
import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class VisionSettings:
    model_path: Path
    confidence: float
    image_size: int
    device: str
    max_upload_bytes: int

    @classmethod
    def from_environment(cls) -> "VisionSettings":
        raw_path = Path(os.getenv("YOLO_MODEL_PATH", "models/BEST_ECOALERT_YOLO11N.pt"))
        model_path = raw_path if raw_path.is_absolute() else BASE_DIR / raw_path
        confidence = float(os.getenv("YOLO_CONFIDENCE", "0.25"))
        image_size = int(os.getenv("YOLO_IMAGE_SIZE", "640"))
        max_upload_mb = int(os.getenv("YOLO_MAX_UPLOAD_MB", "10"))

        if not 0 < confidence <= 1:
            raise ValueError("YOLO_CONFIDENCE must be greater than 0 and at most 1")
        if image_size <= 0:
            raise ValueError("YOLO_IMAGE_SIZE must be positive")
        if max_upload_mb <= 0:
            raise ValueError("YOLO_MAX_UPLOAD_MB must be positive")

        return cls(
            model_path=model_path,
            confidence=confidence,
            image_size=image_size,
            device=os.getenv("YOLO_DEVICE", "auto").strip().lower(),
            max_upload_bytes=max_upload_mb * 1024 * 1024,
        )
