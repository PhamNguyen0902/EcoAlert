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
    model_id: str = ""
    original_class_name: str = ""
    original_class_id: int = -1
    needs_review: bool = False
    sources: list[dict] = Field(default_factory=list)


class ImageMetadata(BaseModel):
    width: int
    height: int


class DetectionResponse(BaseModel):
    success: bool = True
    image: ImageMetadata
    count: int
    detections: list[DetectionResult]
    degraded: bool = False
    model_errors: dict[str, str] = Field(default_factory=dict)
    model_timings_ms: dict[str, float] = Field(default_factory=dict)
    inference_ms: float = 0
