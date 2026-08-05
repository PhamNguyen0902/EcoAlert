from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from threading import Lock

import numpy as np
from PIL import Image

from .config import Settings
from .schemas import BoundingBox, Detection, ObjectCount


ECOALERT_CLASS_NAMES = (
    "plastic_bottle",
    "plastic_bag",
    "plastic_cup",
    "metal_can",
    "cardboard",
    "glass_bottle",
)
EXPECTED_ECOALERT_TAXONOMY = dict(enumerate(ECOALERT_CLASS_NAMES))

CUSTOM_WASTE_LABELS = {
    "plastic_bottle": "PLASTIC_WASTE",
    "plastic_bag": "PLASTIC_WASTE",
    "plastic_cup": "PLASTIC_WASTE",
    "cardboard": "PAPER_WASTE",
    "glass_bottle": "GLASS_WASTE",
    "metal_can": "METAL_WASTE",
}


class DetectorTaxonomyError(RuntimeError):
    pass


def validate_detector_taxonomy(names: dict[int, str] | list[str]) -> dict[int, str]:
    normalized = (
        {int(class_id): str(label) for class_id, label in names.items()}
        if isinstance(names, dict)
        else {class_id: str(label) for class_id, label in enumerate(names)}
    )
    if normalized != EXPECTED_ECOALERT_TAXONOMY:
        raise DetectorTaxonomyError(
            "Detector must expose the EcoAlert Waste YOLO26n V1 six-class taxonomy"
        )
    return normalized


def map_waste_type(label: str) -> str | None:
    normalized = label.strip().lower().replace(" ", "_")
    return CUSTOM_WASTE_LABELS.get(normalized)


def boxes_from_xyxy(
    xyxy: list[float], image_width: int, image_height: int
) -> tuple[BoundingBox, BoundingBox]:
    x1, y1, x2, y2 = [float(value) for value in xyxy]
    box = BoundingBox(x=x1, y=y1, width=max(0.0, x2 - x1), height=max(0.0, y2 - y1))
    normalized = BoundingBox(
        x=x1 / image_width,
        y=y1 / image_height,
        width=box.width / image_width,
        height=box.height / image_height,
    )
    return box, normalized


def resolve_device(configured: str) -> str:
    import torch

    if configured == "auto":
        return "cuda" if torch.cuda.is_available() else "cpu"
    if configured == "cuda" and not torch.cuda.is_available():
        return "cpu"
    return configured


class YoloDetector:
    def __init__(
        self,
        model_path: str,
        confidence: float,
        iou: float,
        max_detections: int,
        device: str,
    ) -> None:
        from ultralytics import YOLO

        self.model_path = model_path
        self.confidence = confidence
        self.iou = iou
        self.max_detections = max_detections
        self.model = YOLO(model_path)
        self.class_names = validate_detector_taxonomy(self.model.names)
        self.device = device

    def detect(self, image: Image.Image) -> list[Detection]:
        width, height = image.size
        result = self.model.predict(
            source=np.asarray(image),
            conf=self.confidence,
            iou=self.iou,
            max_det=self.max_detections,
            device=self.device,
            verbose=False,
        )[0]
        detections: list[Detection] = []
        if result.boxes is None:
            return detections
        for xyxy, confidence, class_id in zip(
            result.boxes.xyxy.cpu().tolist(),
            result.boxes.conf.cpu().tolist(),
            result.boxes.cls.cpu().tolist(),
        ):
            numeric_class_id = int(class_id)
            label = self.class_names[numeric_class_id]
            box, normalized = boxes_from_xyxy(xyxy, width, height)
            detections.append(
                Detection(
                    class_id=numeric_class_id,
                    label=label,
                    confidence=float(confidence),
                    bbox=box,
                    normalized_bbox=normalized,
                    waste_type=map_waste_type(label),
                )
            )
        return detections


class Sam2Segmenter:
    def __init__(self, config: str, checkpoint_path: str, device: str) -> None:
        import torch
        from sam2.build_sam import build_sam2
        from sam2.sam2_image_predictor import SAM2ImagePredictor

        self.model_name = Path(checkpoint_path).name
        model = build_sam2(config, checkpoint_path, device=device)
        self.predictor = SAM2ImagePredictor(model)
        self.torch = torch

    def segment(self, image: Image.Image, detections: list[Detection]) -> list[np.ndarray]:
        self.predictor.set_image(np.asarray(image))
        masks: list[np.ndarray] = []
        for detection in detections:
            if not detection.waste_type:
                masks.append(np.zeros((image.height, image.width), dtype=bool))
                continue
            box = detection.bbox
            prompt = np.array([box.x, box.y, box.x + box.width, box.y + box.height])
            predicted, _, _ = self.predictor.predict(
                point_coords=None, point_labels=None, box=prompt, multimask_output=False
            )
            masks.append(np.asarray(predicted[0], dtype=bool))
        return masks


@dataclass
class ModelHealth:
    detector_loaded: bool
    segmenter_loaded: bool
    detector_error: str | None = None
    segmenter_error: str | None = None


class ModelRegistry:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.detector: YoloDetector | None = None
        self.segmenter: Sam2Segmenter | None = None
        self.detector_error: str | None = None
        self.segmenter_error: str | None = None
        self.device = resolve_device(settings.device)
        self._load_lock = Lock()

    def load_once(self) -> ModelHealth:
        with self._load_lock:
            if self.detector is None and self.detector_error is None:
                try:
                    self.detector = YoloDetector(
                        self.settings.detector_model_path,
                        self.settings.detector_confidence,
                        self.settings.detector_iou,
                        self.settings.max_detections,
                        self.device,
                    )
                except Exception as exc:  # surfaced through health without leaking details
                    self.detector_error = type(exc).__name__
            if (
                self.settings.segmentation_enabled
                and self.segmenter is None
                and self.segmenter_error is None
            ):
                checkpoint = Path(self.settings.sam2_checkpoint_path)
                if not checkpoint.is_file():
                    self.segmenter_error = "CheckpointMissing"
                else:
                    try:
                        self.segmenter = Sam2Segmenter(
                            self.settings.sam2_config, str(checkpoint), self.device
                        )
                    except Exception as exc:
                        self.segmenter_error = type(exc).__name__
        return self.health()

    def health(self) -> ModelHealth:
        return ModelHealth(
            detector_loaded=self.detector is not None,
            segmenter_loaded=self.segmenter is not None,
            detector_error=self.detector_error,
            segmenter_error=self.segmenter_error,
        )


def object_counts(detections: list[Detection]) -> list[ObjectCount]:
    counts = Counter(item.label for item in detections)
    return [ObjectCount(label=label, count=counts[label]) for label in sorted(counts)]
