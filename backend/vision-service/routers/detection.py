import urllib.request
from typing import Annotated
import asyncio
from io import BytesIO

import cv2
import numpy as np
from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile, status
from PIL import Image, UnidentifiedImageError
import logging

from schemas.detection import (
    BoundingBox,
    DetectionResponse,
    DetectionResult,
    ImageMetadata,
    VerifyResolutionResponse,
    VerifyResolutionUrlRequest,
)
from services.detector import (
    DetectionBatch,
    DetectorBusyError,
    DetectorUnavailableError,
    WasteDetector,
    is_clean_scene,
)

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


# lấy thể hiện bộ nhận diện yolo từ trạng thái ứng dụng
def get_detector(request: Request) -> WasteDetector:
    return request.app.state.detector


# đọc và kiểm tra tính hợp lệ về định dạng và kích thước của tập tin ảnh tải lên
async def read_valid_image(file: UploadFile, detector: WasteDetector) -> bytes:
    extension = f".{file.filename.rsplit('.', 1)[-1].lower()}" if file.filename and "." in file.filename else ""
    if file.content_type not in {"image/jpeg", "image/png", "image/webp"} or extension not in ALLOWED_EXTENSIONS:
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


# giải mã mảng byte hình ảnh sang ma trận bằng thư viện xử lý ảnh
def decode_image(image_bytes: bytes, max_pixels: int = 25_000_000) -> np.ndarray:
    if not (image_bytes.startswith(b'\xff\xd8\xff') or image_bytes.startswith(b'\x89PNG\r\n\x1a\n')
            or (image_bytes.startswith(b'RIFF') and image_bytes[8:12] == b'WEBP')):
        raise HTTPException(status_code=400, detail="Uploaded file could not be decoded as an image")
    try:
        with Image.open(BytesIO(image_bytes)) as header:
            if header.format not in {"JPEG", "PNG", "WEBP"}:
                raise HTTPException(status_code=415, detail="Unsupported image encoding")
            if header.width * header.height > max_pixels:
                raise HTTPException(status_code=413, detail="Image exceeds the configured pixel limit")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise HTTPException(status_code=400, detail="Uploaded file could not be decoded as an image") from None
    image = cv2.imdecode(np.frombuffer(image_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None or image.size == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file could not be decoded as an image")
    return image


# chuyển đổi kết quả phát hiện hàng loạt sang định dạng phản hồi chuẩn
def serialize_detection_response(batch: DetectionBatch) -> DetectionResponse:
    return DetectionResponse(
        image=ImageMetadata(width=batch.width, height=batch.height),
        count=len(batch.detections),
        detections=[
            DetectionResult(
                class_id=detection.class_id,
                class_name=detection.class_name,
                confidence=detection.confidence,
                model_id=detection.model_id,
                original_class_name=detection.original_class_name,
                original_class_id=detection.original_class_id,
                needs_review=detection.needs_review,
                sources=detection.sources,
                bounding_box=BoundingBox(
                    x1=detection.x1,
                    y1=detection.y1,
                    x2=detection.x2,
                    y2=detection.y2,
                ),
            )
            for detection in batch.detections
        ],
        degraded=batch.degraded,
        model_errors=batch.model_errors,
        model_timings_ms=batch.model_timings_ms,
        inference_ms=batch.inference_ms,
    )


# thực hiện suy luận nhận diện vật thể từ ảnh tải lên
async def infer(file: UploadFile, confidence: float | None, detector: WasteDetector) -> DetectionBatch:
    if not detector.is_ready():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Vision model is not ready")

    if not detector.admission.acquire(blocking=False):
        raise HTTPException(status_code=503, detail="Vision inference is busy; retry later", headers={"Retry-After": "1"})
    future = None
    try:
        image_bytes = await read_valid_image(file, detector)
        def work():
            image = decode_image(image_bytes, detector.settings.max_image_pixels)
            return detector.detect_image(image, confidence)
        future = asyncio.get_running_loop().run_in_executor(None, work)
        # A timed-out CPU call cannot safely be killed. Keep the gate closed until it ends.
        def finished(done):
            detector.admission.release()
            if not done.cancelled():
                done.exception()  # Consume late failures after timeout/client disconnect.
        future.add_done_callback(finished)
        return await asyncio.wait_for(asyncio.shield(future), detector.settings.inference_timeout)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Vision inference exceeded its time budget") from None
    except DetectorBusyError:
        raise HTTPException(status_code=503, detail="Vision inference is busy; retry later") from None
    except (cv2.error, OSError, ValueError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The uploaded file is not a valid image") from None
    except DetectorUnavailableError:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Vision model is not ready") from None
    except HTTPException:
        raise
    except Exception:
        logger.exception("Image inference failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Image inference failed") from None
    finally:
        if future is None:
            detector.admission.release()


# kiểm tra trạng thái hoạt động của dịch vụ và mô hình nhận diện
@router.get("/health")
async def health(request: Request):
    detector = get_detector(request)
    return {
        "status": "ok" if detector.is_ready() else "degraded",
        "service": "vision-service",
        "model_loaded": detector.is_ready(),
        "device": detector.device,
        "classes": detector.get_classes(),
        **detector.health_details(),
    }


# nhận diện đối tượng từ hình ảnh và trả về danh sách bounding box
@router.post("/detect", response_model=DetectionResponse)
async def detect(
    request: Request,
    file: Annotated[UploadFile, File(description="JPG, JPEG, PNG, or WEBP image")],
    confidence: Annotated[float | None, Query(gt=0, le=1)] = None,
) -> DetectionResponse:
    batch = await infer(file, confidence, get_detector(request))
    return serialize_detection_response(batch)


# định dạng phản hồi cũ duy trì tính tương thích với media-service
@router.post("/predict")
async def predict_legacy(
    request: Request,
    file: Annotated[UploadFile, File(description="JPG, JPEG, PNG, or WEBP image")],
):
    detector = get_detector(request)
    batch = await infer(file, None, detector)
    detections = [
        {
            "materialClass": detection.class_name,
            "suggestedCategory": MATERIAL_TO_CATEGORY.get(detection.class_name, "other"),
            "confidence": detection.confidence,
            "bbox": [detection.x1, detection.y1, detection.x2, detection.y2],
            "model_id": detection.model_id,
            "original_class_name": detection.original_class_name,
            "original_class_id": detection.original_class_id,
            "needs_review": detection.needs_review,
            "sources": detection.sources,
        }
        for detection in batch.detections
    ]

    metadata = {"degraded": batch.degraded, "model_errors": batch.model_errors,
                "model_timings_ms": batch.model_timings_ms, "inference_ms": batch.inference_ms}
    if not detections:
        # A partial empty result must not make the mobile mark the evidence definitively invalid.
        return {"status": "error" if batch.degraded else "no_detection", "detections": [],
                "requiresManualReview": True, **metadata}

    # Preserve the original single-model rule. Multi-model review is conservative per
    # detection and never uses one model's score to clear another model's uncertainty.
    if len(batch.model_timings_ms) <= 1:
        low_confidence = max(detection["confidence"] for detection in detections) < 0.4
    else:
        low_confidence = any(detection["confidence"] < 0.4 for detection in detections)
    return {
        "status": "ok",
        "detections": detections,
        "requiresManualReview": batch.degraded or any(d.needs_review for d in batch.detections) or low_confidence,
        **metadata,
    }


# Tự động kiểm định nghiệm thu sau xử lý qua tập tin ảnh tải lên
@router.post("/verify-resolution", response_model=VerifyResolutionResponse)
async def verify_resolution_file(
    request: Request,
    file: Annotated[UploadFile, File(description="Ảnh kết quả sau xử lý")],
    confidence: Annotated[float, Query(gt=0, le=1)] = 0.5,
) -> VerifyResolutionResponse:
    detector = get_detector(request)
    batch = await infer(file, confidence, detector)
    is_clean, wastes = is_clean_scene(batch, confidence_threshold=confidence)
    serialized = serialize_detection_response(batch)
    waste_serialized = [d for d in serialized.detections if d.confidence > confidence]
    if is_clean:
        return VerifyResolutionResponse(
            is_clean=True,
            status="clean",
            remaining_waste_count=0,
            detections=[],
            message="Hiện trường đã được dọn sạch thành công.",
        )
    return VerifyResolutionResponse(
        is_clean=False,
        status="waste_detected",
        remaining_waste_count=len(waste_serialized),
        detections=waste_serialized,
        message="AI vẫn phát hiện rác thải tại vị trí này. Vui lòng kiểm tra lại hiện trường.",
    )


# Tự động kiểm định nghiệm thu sau xử lý qua đường dẫn ảnh (URL)
@router.post("/verify-resolution-url", response_model=VerifyResolutionResponse)
async def verify_resolution_url(
    request: Request,
    payload: VerifyResolutionUrlRequest,
) -> VerifyResolutionResponse:
    detector = get_detector(request)
    if not detector.is_ready():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Vision model is not ready")

    if not detector.admission.acquire(blocking=False):
        raise HTTPException(status_code=503, detail="Vision inference is busy; retry later", headers={"Retry-After": "1"})

    future = None
    try:
        req = urllib.request.Request(
            payload.imageUrl,
            headers={"User-Agent": "EcoAlert-Vision/1.0"}
        )
        try:
            with urllib.request.urlopen(req, timeout=detector.settings.inference_timeout) as resp:
                image_bytes = resp.read()
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Could not download image from URL: {exc}")

        def work():
            image = decode_image(image_bytes, detector.settings.max_image_pixels)
            return detector.detect_image(image, payload.confidence)

        future = asyncio.get_running_loop().run_in_executor(None, work)
        def finished(done):
            detector.admission.release()
            if not done.cancelled():
                done.exception()
        future.add_done_callback(finished)
        batch = await asyncio.wait_for(asyncio.shield(future), detector.settings.inference_timeout)

        is_clean, wastes = is_clean_scene(batch, confidence_threshold=payload.confidence)
        serialized = serialize_detection_response(batch)
        waste_serialized = [d for d in serialized.detections if d.confidence > payload.confidence]
        if is_clean:
            return VerifyResolutionResponse(
                is_clean=True,
                status="clean",
                remaining_waste_count=0,
                detections=[],
                message="Hiện trường đã được dọn sạch thành công.",
            )
        return VerifyResolutionResponse(
            is_clean=False,
            status="waste_detected",
            remaining_waste_count=len(waste_serialized),
            detections=waste_serialized,
            message="AI vẫn phát hiện rác thải tại vị trí này. Vui lòng kiểm tra lại hiện trường.",
        )
    finally:
        if future is None:
            detector.admission.release()

