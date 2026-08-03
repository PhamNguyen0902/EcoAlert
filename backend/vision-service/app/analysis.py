import base64
import io
import time
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps, UnidentifiedImageError

from .config import Settings
from .models import ModelRegistry, object_counts
from .schemas import Detection, VisionResponse


class InvalidImageError(ValueError):
    pass


def decode_image(payload: bytes, settings: Settings) -> Image.Image:
    Image.MAX_IMAGE_PIXELS = settings.max_image_pixels
    try:
        image = Image.open(io.BytesIO(payload))
        image.load()
        image = ImageOps.exif_transpose(image).convert("RGB")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise InvalidImageError("Invalid or unsafe image") from exc
    if image.width * image.height > settings.max_image_pixels:
        raise InvalidImageError("Image pixel count exceeds limit")
    if max(image.size) > settings.max_inference_side:
        image.thumbnail(
            (settings.max_inference_side, settings.max_inference_side),
            Image.Resampling.LANCZOS,
        )
    return image


def apply_masks(detections: list[Detection], masks: list[np.ndarray], size: tuple[int, int]) -> float:
    width, height = size
    union = np.zeros((height, width), dtype=bool)
    for detection, mask in zip(detections, masks):
        if not detection.waste_type or mask.shape != union.shape:
            continue
        area = int(mask.sum())
        detection.mask_area_pixels = area
        detection.mask_coverage = area / (width * height)
        union |= mask
    return float(union.sum() / (width * height))


def annotate(image: Image.Image, detections: list[Detection], masks: list[np.ndarray] | None) -> bytes:
    canvas = np.asarray(image).copy()
    if masks:
        overlay = np.zeros_like(canvas)
        overlay[:, :, 1] = 180
        union = np.zeros((image.height, image.width), dtype=bool)
        for detection, mask in zip(detections, masks):
            if detection.waste_type and mask.shape == union.shape:
                union |= mask
        canvas[union] = (canvas[union] * 0.55 + overlay[union] * 0.45).astype(np.uint8)
    annotated = Image.fromarray(canvas)
    draw = ImageDraw.Draw(annotated)
    font = ImageFont.load_default()
    for detection in detections:
        box = detection.bbox
        xy = (box.x, box.y, box.x + box.width, box.y + box.height)
        color = "#16a34a" if detection.waste_type else "#f59e0b"
        draw.rectangle(xy, outline=color, width=3)
        label = f"{detection.label} {detection.confidence:.2f}"
        draw.text((box.x + 3, max(0, box.y - 12)), label, fill=color, font=font)
    output = io.BytesIO()
    annotated.save(output, format="JPEG", quality=88, optimize=True)
    return output.getvalue()


def analyze_image(
    payload: bytes,
    settings: Settings,
    registry: ModelRegistry,
    segmentation_requested: bool,
) -> VisionResponse:
    started = time.perf_counter()
    image = decode_image(payload, settings)
    health = registry.load_once()
    if not health.detector_loaded or registry.detector is None:
        raise RuntimeError("Detector is unavailable")

    detection_started = time.perf_counter()
    detections = registry.detector.detect(image)
    detection_time_ms = round((time.perf_counter() - detection_started) * 1000)
    warnings: list[str] = [
        "YOLO26 COCO baseline is not a custom waste classifier; potential litter mappings are conservative."
    ]
    masks: list[np.ndarray] | None = None
    coverage: float | None = None
    segmenter_model: str | None = None
    segmentation_time_ms = 0
    if segmentation_requested:
        if registry.segmenter is None:
            warnings.append("SAM 2 segmentation unavailable; visible waste coverage was not estimated.")
        elif any(item.waste_type for item in detections):
            segmentation_started = time.perf_counter()
            masks = registry.segmenter.segment(image, detections)
            coverage = apply_masks(detections, masks, image.size)
            segmentation_time_ms = round((time.perf_counter() - segmentation_started) * 1000)
            segmenter_model = registry.segmenter.model_name
        else:
            coverage = 0.0
            segmenter_model = registry.segmenter.model_name
            warnings.append(
                "No mapped potential-waste detections were available for SAM prompts; coverage is zero for prompted classes only."
            )

    annotation_started = time.perf_counter()
    annotated = annotate(image, detections, masks)
    annotation_time_ms = round((time.perf_counter() - annotation_started) * 1000)
    detector_confidence = (
        sum(item.confidence for item in detections) / len(detections) if detections else None
    )
    return VisionResponse(
        detector_model=Path(settings.detector_model_path).name,
        segmenter_model=segmenter_model,
        image_width=image.width,
        image_height=image.height,
        detections=detections,
        object_counts=object_counts(detections),
        total_detected_objects=len(detections),
        visible_waste_coverage=coverage,
        detector_confidence=detector_confidence,
        annotated_image_base64=base64.b64encode(annotated).decode("ascii"),
        annotated_image_content_type="image/jpeg",
        processing_time_ms=round((time.perf_counter() - started) * 1000),
        detection_time_ms=detection_time_ms,
        segmentation_time_ms=segmentation_time_ms,
        annotation_time_ms=annotation_time_ms,
        warnings=warnings,
    )
