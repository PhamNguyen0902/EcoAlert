from dataclasses import dataclass, field
import json
import math
import os
from pathlib import Path
import re

BASE_DIR = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class ModelConfig:
    id: str
    path: Path
    enabled: bool = True
    confidence: float = 0.25
    image_size: int = 640
    label_map: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class VisionSettings:
    model_path: Path
    confidence: float
    image_size: int
    device: str
    max_upload_bytes: int
    models: tuple[ModelConfig, ...] | None = None
    canonical_ids: dict[str, int] = field(default_factory=dict)
    review_classes: tuple[str, ...] = ()
    merge_iou: float = 0.6
    inference_timeout: float = 8.0
    max_image_pixels: int = 25_000_000

    @classmethod
    def from_environment(cls) -> "VisionSettings":
        confidence = float(os.getenv("YOLO_CONFIDENCE", "0.25"))
        image_size = int(os.getenv("YOLO_IMAGE_SIZE", "640"))
        max_upload_mb = int(os.getenv("YOLO_MAX_UPLOAD_MB", "10"))
        merge_iou = float(os.getenv("YOLO_MERGE_IOU", "0.6"))
        timeout = float(os.getenv("YOLO_INFERENCE_TIMEOUT_SECONDS", "8"))
        max_pixels = int(os.getenv("YOLO_MAX_IMAGE_PIXELS", "25000000"))
        if not 0 < confidence <= 1 or image_size <= 0 or max_upload_mb <= 0:
            raise ValueError("Invalid YOLO confidence, image size or upload limit")
        if not 0 < merge_iou <= 1 or not math.isfinite(timeout) or timeout <= 0 or max_pixels <= 0:
            raise ValueError("Invalid YOLO merge IoU, timeout or image pixel limit")
        raw_path = Path(os.getenv("YOLO_MODEL_PATH", "models/BEST_ECOALERT_YOLO11N.pt"))
        model_path = raw_path if raw_path.is_absolute() else BASE_DIR / raw_path
        config_path = os.getenv("YOLO_MODELS_CONFIG")
        registry_path = Path(config_path) if config_path else BASE_DIR / "config/models.json"
        if not registry_path.is_absolute():
            registry_path = BASE_DIR / registry_path
        registry = json.loads(registry_path.read_text(encoding="utf-8"))
        ids = registry.get("canonical_ids", {})
        if any(not isinstance(k, str) or type(v) is not int or v < 0 for k, v in ids.items()):
            raise ValueError("canonical_ids must map names to nonnegative integer IDs")
        if len(set(ids.values())) != len(ids):
            raise ValueError("canonical_ids must be unique")
        configs = []
        # Explicit old-style path selects single-model mode unless a registry is specified.
        if "YOLO_MODEL_PATH" in os.environ and not config_path:
            configs.append(ModelConfig("ecoalert_general", model_path, confidence=confidence,
                                       image_size=image_size, label_map={k: k for k in ids}))
        else:
            for entry in registry["models"]:
                path = Path(entry["path"])
                model = ModelConfig(
                    id=entry["id"], path=path if path.is_absolute() else BASE_DIR / path,
                    enabled=entry.get("enabled", True),
                    confidence=float(entry.get("confidence", confidence)),
                    image_size=int(entry.get("image_size", image_size)),
                    label_map=entry.get("label_map", {}),
                )
                if not re.fullmatch(r"[a-zA-Z0-9_-]+", model.id) or type(model.enabled) is not bool:
                    raise ValueError("Model IDs must be safe identifiers; enabled must be boolean")
                if not 0 < model.confidence <= 1 or model.image_size <= 0:
                    raise ValueError(f"Invalid confidence/image_size for {model.id}")
                if any(not isinstance(k, str) or v not in ids for k, v in model.label_map.items()):
                    raise ValueError(f"Label mapping for {model.id} must reference canonical_ids")
                configs.append(model)
        if len({m.id for m in configs}) != len(configs):
            raise ValueError("Model IDs must be unique")
        return cls(model_path, confidence, image_size, os.getenv("YOLO_DEVICE", "auto").strip().lower(),
                   max_upload_mb * 1024 * 1024, tuple(configs), ids,
                   tuple(registry.get("review_classes", [])), merge_iou, timeout, max_pixels)
