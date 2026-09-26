from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float


class DetectionResult(BaseModel):
    class_id: int
    class_name: str
    confidence: float = Field(ge=0, le=1)
    bounding_box: BoundingBox


class ImageMetadata(BaseModel):
    width: int
    height: int


class DetectionResponse(BaseModel):
    success: bool = True
    image: ImageMetadata
    count: int
    detections: list[DetectionResult]
