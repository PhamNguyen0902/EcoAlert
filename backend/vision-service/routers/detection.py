from typing import Annotated

import cv2
import numpy as np
from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile, status
from fastapi.concurrency import run_in_threadpool
import logging

from schemas.detection import BoundingBox, DetectionResponse, DetectionResult, ImageMetadata
from services.detector import DetectionBatch, DetectorUnavailableError, WasteDetector

router = APIRouter(tags=["detection"])
logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MATERIAL_TO_CATEGORY = {
    "plastic_bottle": "illegal_dumping",
    "plastic_bag": "illegal_dumping",
    "plastic_cup": "illegal_dumping",
    "metal_can": "illegal_dumping",
    "cardboard": "illegal_dumping",
    "glass_bottle": "illegal_dumping",
}


def get_detector(request: Request) -> WasteDetector:
    return request.app.state.detector


async def read_valid_image(file: UploadFile, detector: WasteDetector) -> bytes:
    extension = f".{file.filename.rsplit('.', 1)[-1].lower()}" if file.filename and "." in file.filename else ""
    if not file.content_type or not file.content_type.startswith("image/") or extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Only JPG, JPEG, PNG, and WEBP images are supported")

    image_bytes = await file.read(detector.settings.max_upload_bytes + 1)
    if not image_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image file must not be empty")
    if len(image_bytes) > detector.settings.max_upload_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Image file exceeds the configured size limit")
    logger.info(
        "Vision request filename=%s mime=%s bytes=%d",
        file.filename,
        file.content_type,
        len(image_bytes),
    )
    return image_bytes


def decode_image(image_bytes: bytes) -> np.ndarray:
    image = cv2.imdecode(np.frombuffer(image_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None or image.size == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file could not be decoded as an image")
    return image


def serialize_detection_response(batch: DetectionBatch) -> DetectionResponse:
    return DetectionResponse(
        image=ImageMetadata(width=batch.width, height=batch.height),
        count=len(batch.detections),
        detections=[
            DetectionResult(
                class_id=detection.class_id,
                class_name=detection.class_name,
                confidence=detection.confidence,
                bounding_box=BoundingBox(
                    x1=detection.x1,
                    y1=detection.y1,
                    x2=detection.x2,
                    y2=detection.y2,
                ),
            )
            for detection in batch.detections
        ],
    )


async def infer(file: UploadFile, confidence: float | None, detector: WasteDetector) -> DetectionBatch:
    if not detector.is_ready():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Vision model is not ready")

    image_bytes = await read_valid_image(file, detector)
    image = decode_image(image_bytes)
    threshold = confidence if confidence is not None else detector.settings.confidence
    logger.info("Decoded image shape=%s confidence=%.2f", image.shape, threshold)
    try:
        return await run_in_threadpool(detector.detect_image, image, confidence)
    except (cv2.error, OSError, ValueError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The uploaded file is not a valid image") from None
    except DetectorUnavailableError:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Vision model is not ready") from None
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Image inference failed") from None


@router.get("/health")
async def health(request: Request):
    detector = get_detector(request)
    return {
        "status": "ok" if detector.is_ready() else "degraded",
        "service": "vision-service",
        "model_loaded": detector.is_ready(),
        "device": detector.device,
        "classes": detector.get_classes(),
    }


@router.post("/detect", response_model=DetectionResponse)
async def detect(
    request: Request,
    file: Annotated[UploadFile, File(description="JPG, JPEG, PNG, or WEBP image")],
    confidence: Annotated[float | None, Query(gt=0, le=1)] = None,
) -> DetectionResponse:
    batch = await infer(file, confidence, get_detector(request))
    return serialize_detection_response(batch)


@router.post("/predict")
async def predict_legacy(
    request: Request,
    file: Annotated[UploadFile, File(description="JPG, JPEG, PNG, or WEBP image")],
):
    """Legacy response retained for media-service compatibility."""
    detector = get_detector(request)
    batch = await infer(file, None, detector)
    detections = [
        {
            "materialClass": detection.class_name,
            "suggestedCategory": MATERIAL_TO_CATEGORY.get(detection.class_name, "other"),
            "confidence": detection.confidence,
            "bbox": [detection.x1, detection.y1, detection.x2, detection.y2],
        }
        for detection in batch.detections
    ]

    if not detections:
        return {"status": "no_detection", "detections": [], "requiresManualReview": True}

    highest_confidence = max(detection["confidence"] for detection in detections)
    return {
        "status": "ok",
        "detections": detections,
        "requiresManualReview": highest_confidence < 0.4,
    }
