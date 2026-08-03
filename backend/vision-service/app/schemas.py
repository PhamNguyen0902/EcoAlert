from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


def to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(word.capitalize() for word in rest)


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class AnalyzeRequest(ApiModel):
    image_url: HttpUrl
    incident_id: str | None = Field(default=None, max_length=128)
    segmentation_enabled: bool | None = None


class BoundingBox(ApiModel):
    x: float
    y: float
    width: float
    height: float


WasteType = Literal[
    "PLASTIC_WASTE",
    "ORGANIC_WASTE",
    "CONSTRUCTION_WASTE",
    "HAZARDOUS_WASTE",
    "METAL_WASTE",
    "GLASS_WASTE",
    "PAPER_WASTE",
    "E_WASTE",
    "MIXED_WASTE",
    "OTHER",
]


class Detection(ApiModel):
    class_id: int
    label: str
    confidence: float = Field(ge=0, le=1)
    bbox: BoundingBox
    normalized_bbox: BoundingBox
    waste_type: WasteType | None = None
    mask_area_pixels: int | None = None
    mask_coverage: float | None = Field(default=None, ge=0, le=1)


class ObjectCount(ApiModel):
    label: str
    count: int = Field(ge=0)


class VisionResponse(ApiModel):
    status: Literal["COMPLETED"] = "COMPLETED"
    detector_model: str
    segmenter_model: str | None = None
    image_width: int
    image_height: int
    detections: list[Detection]
    object_counts: list[ObjectCount]
    total_detected_objects: int
    visible_waste_coverage: float | None = Field(default=None, ge=0, le=1)
    detector_confidence: float | None = Field(default=None, ge=0, le=1)
    segmentation_confidence: None = None
    annotated_image_base64: str | None = None
    annotated_image_content_type: Literal["image/jpeg"] | None = None
    processing_time_ms: int
    detection_time_ms: int
    segmentation_time_ms: int
    annotation_time_ms: int
    warnings: list[str]


class HealthResponse(ApiModel):
    status: Literal["ok", "degraded"]
    service: str
    detector_loaded: bool
    segmenter_loaded: bool
    segmentation_enabled: bool
    device: str
    detector_model: str
    segmenter_model: str | None
