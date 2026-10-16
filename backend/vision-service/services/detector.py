from dataclasses import dataclass, field, replace
import hashlib
import logging
import math
from threading import Lock
from time import perf_counter
from typing import Callable

import numpy as np
import torch
from ultralytics import YOLO

from services.settings import ModelConfig, VisionSettings

logger = logging.getLogger(__name__)


class DetectorUnavailableError(RuntimeError):
    pass


class DetectorBusyError(RuntimeError):
    pass


@dataclass(frozen=True)
class Detection:
    class_id: int
    class_name: str
    confidence: float
    x1: float
    y1: float
    x2: float
    y2: float
    model_id: str = ""
    original_class_name: str = ""
    original_class_id: int = -1
    needs_review: bool = False
    sources: list[dict] = field(default_factory=list)


@dataclass(frozen=True)
class DetectionBatch:
    width: int
    height: int
    detections: list[Detection]
    inference_ms: float
    model_timings_ms: dict[str, float] = field(default_factory=dict)
    model_errors: dict[str, str] = field(default_factory=dict)
    degraded: bool = False


@dataclass
class ModelRunner:
    config: ModelConfig
    model: object | None = None
    classes: dict[int, str] = field(default_factory=dict)
    load_error: str | None = None
    last_error: str | None = None
    load_ms: float = 0
    last_inference_ms: float | None = None


def box_iou(a: Detection, b: Detection) -> float:
    intersection = max(0, min(a.x2, b.x2) - max(a.x1, b.x1)) * max(0, min(a.y2, b.y2) - max(a.y1, b.y1))
    union = (a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - intersection
    return intersection / union if union > 0 else 0


def merge_detections(detections: list[Detection], iou: float) -> list[Detection]:
    """Registry order wins across models; confidence ranks only within a model.

    Suppress equivalent canonical labels from DIFFERENT models only. Preserve per-model
    YOLO NMS and distinct/nested labels. Suppressed sources remain traceable.
    """
    kept: list[Detection] = []
    model_order = list(dict.fromkeys(d.model_id for d in detections))
    for model_id in model_order:
        for detection in sorted((d for d in detections if d.model_id == model_id), key=lambda d: -d.confidence):
            match = next((i for i, d in enumerate(kept) if d.model_id != model_id
                          and not any(s['model_id'] == model_id for s in d.sources)
                          and d.class_name == detection.class_name and box_iou(d, detection) >= iou), None)
            if match is None:
                kept.append(detection)
            else:
                kept[match] = replace(kept[match], sources=kept[match].sources + detection.sources)
    return kept if len(model_order) > 1 else detections


class MultiModelDetector:
    def __init__(self, settings: VisionSettings, model_factory: Callable = YOLO):
        self.settings = settings
        self._factory = model_factory
        self._device = self._resolve_device(settings.device)
        self._lock = Lock()
        # Held until the HTTP worker actually finishes, including after timeout.
        self.admission = Lock()
        configs = settings.models if settings.models is not None else (ModelConfig("ecoalert_general", settings.model_path,
                    confidence=settings.confidence, image_size=settings.image_size),)
        self.runners = [ModelRunner(config) for config in configs]
        self._classes: dict[int, str] = {}
        self.startup_ms = 0.0
        self.startup_rss_mb: float | None = None

    @staticmethod
    def _resolve_device(requested_device: str) -> str:
        if requested_device == "auto":
            return "cuda:0" if torch.cuda.is_available() else "cpu"
        if requested_device.startswith("cuda") and not torch.cuda.is_available():
            logger.warning("CUDA unavailable; falling back to CPU")
            return "cpu"
        return requested_device

    def canonical(self, runner: ModelRunner, original: str) -> tuple[int, str, bool]:
        name = runner.config.label_map.get(original)
        if name is None and self.settings.models is None:
            return next(k for k, v in runner.classes.items() if v == original), original, False
        review = name is None or name in self.settings.review_classes
        name = name or f"{runner.config.id}:{original}"
        class_id = self.settings.canonical_ids.get(name)
        if class_id is None:
            class_id = 1_000_000 + int.from_bytes(hashlib.sha256(name.encode()).digest()[:4], "big")
        return class_id, name, review

    def load_model(self) -> None:
        started = perf_counter()
        with self._lock:
            for runner in self.runners:
                if not runner.config.enabled or runner.model is not None:
                    continue
                tick = perf_counter()
                try:
                    if not runner.config.path.is_file():
                        raise FileNotFoundError(f"YOLO model was not found: {runner.config.path}")
                    model = self._factory(str(runner.config.path))
                    names = model.names
                    runner.classes = {int(k): str(v) for k, v in (names.items() if isinstance(names, dict) else enumerate(names))}
                    if not runner.classes:
                        raise ValueError("Model has no classes")
                    new_classes = {}
                    for original in runner.classes.values():
                        class_id, name, review = self.canonical(runner, original)
                        existing = self._classes.get(class_id, new_classes.get(class_id))
                        if existing is not None and existing != name:
                            raise ValueError(f"Canonical ID collision: {existing} / {name}")
                        new_classes[class_id] = name
                        if review:
                            logger.warning("Taxonomy review: %s / %s -> %s", runner.config.id, original, name)
                    self._classes.update(new_classes)
                    runner.model, runner.load_error, runner.last_error = model, None, None
                    logger.info("Loaded %s on %s: %s", runner.config.id, self.device, runner.classes)
                except Exception as exc:
                    runner.load_error = f"{type(exc).__name__}: {exc}"
                    runner.classes = {}
                    logger.exception("Model %s failed to load", runner.config.id)
                finally:
                    runner.load_ms = (perf_counter() - tick) * 1000
        self.startup_ms = (perf_counter() - started) * 1000
        try:
            import psutil
            self.startup_rss_mb = psutil.Process().memory_info().rss / 1024 ** 2
        except ImportError:
            pass
        logger.info("Registry startup %.1fms RSS=%s MiB", self.startup_ms, self.startup_rss_mb)

    def is_ready(self) -> bool:
        return any(r.model is not None for r in self.runners)

    @property
    def device(self) -> str:
        return self._device

    def get_classes(self) -> dict[int, str]:
        return dict(self._classes)

    def health_details(self) -> dict:
        enabled = [r for r in self.runners if r.config.enabled]
        degraded = not self.is_ready() or any(r.load_error or r.last_error for r in enabled)
        return {
            "status": "degraded" if degraded else "ok",
            "configured_model_count": len(self.runners), "enabled_model_count": len(enabled),
            "loaded_model_count": sum(r.model is not None for r in enabled),
            "unique_class_count": len(self._classes), "startup_ms": self.startup_ms,
            "startup_rss_mb": self.startup_rss_mb,
            "models": [{"id": r.config.id, "enabled": r.config.enabled, "loaded": r.model is not None,
                        "error": r.load_error or r.last_error, "device": self.device,
                        "classes": r.classes, "class_count": len(r.classes),
                        "normalized_classes": {k: self.canonical(r, v)[1] for k, v in r.classes.items()},
                        "review_classes": [v for v in r.classes.values() if self.canonical(r, v)[2]],
                        "load_ms": r.load_ms, "last_inference_ms": r.last_inference_ms} for r in self.runners],
        }

    def detect_image(self, image: np.ndarray, confidence: float | None = None) -> DetectionBatch:
        if not self.is_ready():
            raise DetectorUnavailableError("No configured YOLO model is loaded")
        if image.size == 0:
            raise ValueError("Decoded image is empty")
        if not self._lock.acquire(blocking=False):
            raise DetectorBusyError("Inference is already running")
        started = perf_counter()
        height, width = image.shape[:2]
        detections, timings, errors = [], {}, {}
        succeeded = 0
        try:
            for runner in self.runners:
                if not runner.config.enabled:
                    continue
                if runner.model is None:
                    errors[runner.config.id] = runner.load_error or "Model is not loaded"
                    continue
                tick = perf_counter()
                threshold = confidence if confidence is not None else runner.config.confidence
                try:
                    results = runner.model.predict(source=image, conf=threshold, imgsz=runner.config.image_size,
                                                   device=self.device, verbose=False)
                    model_detections = []
                    for box in results[0].boxes:
                        original_id = int(box.cls.item())
                        original_name = runner.classes[original_id]
                        score = float(box.conf.item())
                        coords = [float(value) for value in box.xyxy[0].tolist()]
                        if len(coords) != 4 or not all(math.isfinite(v) for v in coords + [score]):
                            continue
                        if not threshold <= score <= 1:
                            continue
                        x1, y1, x2, y2 = coords
                        x1, x2 = max(0, min(width, x1)), max(0, min(width, x2))
                        y1, y2 = max(0, min(height, y1)), max(0, min(height, y2))
                        if x2 <= x1 or y2 <= y1:
                            continue
                        class_id, name, review = self.canonical(runner, original_name)
                        source = {"model_id": runner.config.id, "original_class_name": original_name,
                                  "original_class_id": original_id, "confidence": score,
                                  "bbox": [x1, y1, x2, y2]}
                        model_detections.append(Detection(class_id, name, score, x1, y1, x2, y2,
                                                    runner.config.id, original_name, original_id, review, [source]))
                    detections.extend(model_detections)
                    runner.last_error = None
                    succeeded += 1
                except Exception as exc:
                    runner.last_error = f"{type(exc).__name__}: {exc}"
                    errors[runner.config.id] = runner.last_error
                    logger.exception("Inference failed for %s", runner.config.id)
                finally:
                    runner.last_inference_ms = timings[runner.config.id] = (perf_counter() - tick) * 1000
            if not succeeded:
                raise DetectorUnavailableError("All enabled models failed: " + str(errors))
            merged = merge_detections(detections, self.settings.merge_iou)
            elapsed = (perf_counter() - started) * 1000
            logger.info("Inference %.1fms models=%s raw=%d merged=%d errors=%s", elapsed, timings,
                        len(detections), len(merged), errors)
            return DetectionBatch(width, height, merged, elapsed, timings, errors, bool(errors))
        finally:
            self._lock.release()


WasteDetector = MultiModelDetector
