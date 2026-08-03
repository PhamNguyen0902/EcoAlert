from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from threading import Lock

import numpy as np
from PIL import Image

from .config import Settings
from .schemas import BoundingBox, Detection, ObjectCount


CUSTOM_WASTE_LABELS = {
    "plastic_waste": "PLASTIC_WASTE",
    "plastic_bottle": "PLASTIC_WASTE",
    "plastic_bag": "PLASTIC_WASTE",
    "plastic_container": "PLASTIC_WASTE",
    "paper": "PAPER_WASTE",
    "cardboard": "PAPER_WASTE",
    "glass_bottle": "GLASS_WASTE",
    "glass": "GLASS_WASTE",
    "metal_can": "METAL_WASTE",
    "metal": "METAL_WASTE",
    "organic_waste": "ORGANIC_WASTE",
    "food_waste": "ORGANIC_WASTE",
    "electronic_waste": "E_WASTE",
    "e_waste": "E_WASTE",
    "construction_waste": "CONSTRUCTION_WASTE",
    "hazardous_waste": "HAZARDOUS_WASTE",
    "metal_waste": "METAL_WASTE",
    "glass_waste": "GLASS_WASTE",
    "paper_waste": "PAPER_WASTE",
    "mixed_waste": "MIXED_WASTE",
    "trash_pile": "MIXED_WASTE",
}

# COCO has no waste classes. These labels are only potential litter objects and
# intentionally map to OTHER rather than guessing their material or disposal state.
COCO_POTENTIAL_LITTER = {"bottle", "cup"}


def map_waste_type(label: str) -> str | None:
    normalized = label.strip().lower().replace(" ", "_")
    if normalized in CUSTOM_WASTE_LABELS:
        return CUSTOM_WASTE_LABELS[normalized]
    if normalized in COCO_POTENTIAL_LITTER:
        return "OTHER"
    return None


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
        names = result.names
        for xyxy, confidence, class_id in zip(
            result.boxes.xyxy.cpu().tolist(),
            result.boxes.conf.cpu().tolist(),
            result.boxes.cls.cpu().tolist(),
        ):
            label = str(names[int(class_id)])
            box, normalized = boxes_from_xyxy(xyxy, width, height)
            detections.append(
                Detection(
                    class_id=int(class_id),
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
