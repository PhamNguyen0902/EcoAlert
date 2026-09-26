from dataclasses import dataclass
import logging
from pathlib import Path
from threading import Lock
from time import perf_counter

import numpy as np
import torch
from ultralytics import YOLO

from services.settings import VisionSettings

logger = logging.getLogger(__name__)


class DetectorUnavailableError(RuntimeError):
    """Raised when inference is requested before the model is available."""


@dataclass(frozen=True)
class Detection:
    class_id: int
    class_name: str
    confidence: float
    x1: float
    y1: float
    x2: float
    y2: float


@dataclass(frozen=True)
class DetectionBatch:
    width: int
    height: int
    detections: list[Detection]
    inference_ms: float


class WasteDetector:
    """Keeps a single YOLO model in memory for the lifetime of the service."""

    def __init__(self, settings: VisionSettings):
        self.settings = settings
        self._model: YOLO | None = None
        self._device = self._resolve_device(settings.device)
        self._lock = Lock()

    @staticmethod
    def _resolve_device(requested_device: str) -> str:
        if requested_device == "auto":
            return "cuda:0" if torch.cuda.is_available() else "cpu"
        if requested_device.startswith("cuda") and not torch.cuda.is_available():
            logger.warning("CUDA was requested but is unavailable; falling back to CPU")
            return "cpu"
        return requested_device

    def load_model(self) -> None:
        if self._model is not None:
            return

        with self._lock:
            if self._model is not None:
                return
            model_path: Path = self.settings.model_path
            if not model_path.is_file():
                raise FileNotFoundError(f"YOLO model was not found: {model_path}")

            logger.info("Loading YOLO model from %s on %s", model_path, self._device)
            self._model = YOLO(str(model_path))
            logger.info("YOLO model loaded successfully with classes: %s", self.get_classes())

    def is_ready(self) -> bool:
        return self._model is not None

    @property
    def device(self) -> str:
        return self._device

    def get_classes(self) -> dict[int, str]:
        if self._model is None:
            return {}
        names = self._model.names
        return {int(class_id): str(name) for class_id, name in names.items()}

    def detect_image(self, image: np.ndarray, confidence: float | None = None) -> DetectionBatch:
        if self._model is None:
            raise DetectorUnavailableError("YOLO model is not loaded")

        if image.size == 0:
            raise ValueError("Decoded image is empty")

        height, width = image.shape[:2]

        threshold = confidence if confidence is not None else self.settings.confidence
        started_at = perf_counter()
        with self._lock:
            results = self._model.predict(
                source=image,
                conf=threshold,
                imgsz=self.settings.image_size,
                device=self._device,
                verbose=False,
            )
        inference_ms = (perf_counter() - started_at) * 1000

        detections: list[Detection] = []
        for box in results[0].boxes:
            class_id = int(box.cls.item())
            x1, y1, x2, y2 = (float(value) for value in box.xyxy[0].tolist())
            detections.append(
                Detection(
                    class_id=class_id,
                    class_name=self.get_classes().get(class_id, str(class_id)),
                    confidence=float(box.conf.item()),
                    x1=x1,
                    y1=y1,
                    x2=x2,
                    y2=y2,
                )
            )

        summary = [f"{detection.class_name}:{detection.confidence:.3f}" for detection in detections]
        logger.info(
            "YOLO inference completed in %.1fms with %d detections: %s",
            inference_ms,
            len(detections),
            ", ".join(summary) if summary else "none",
        )
        return DetectionBatch(width=width, height=height, detections=detections, inference_ms=inference_ms)


__all__ = [
    "Detection",
    "DetectionBatch",
    "DetectorUnavailableError",
    "WasteDetector",
]
