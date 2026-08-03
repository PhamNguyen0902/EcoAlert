from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    service_name: str = "vision-service"
    port: int = Field(default=3007, alias="VISION_SERVICE_PORT")
    internal_token: str = Field(default="", alias="VISION_INTERNAL_TOKEN")
    allowed_image_hosts: str = Field(default="", alias="VISION_ALLOWED_IMAGE_HOSTS")
    allow_private_hosts: bool = Field(default=False, alias="VISION_ALLOW_PRIVATE_HOSTS")
    max_image_bytes: int = Field(default=10 * 1024 * 1024, alias="VISION_MAX_IMAGE_BYTES")
    max_image_pixels: int = Field(default=25_000_000, alias="VISION_MAX_IMAGE_PIXELS")
    max_inference_side: int = Field(default=1280, alias="VISION_MAX_INFERENCE_SIDE")
    request_timeout_seconds: float = Field(default=12.0, alias="VISION_REQUEST_TIMEOUT_SECONDS")
    max_concurrency: int = Field(default=1, alias="VISION_MAX_CONCURRENCY")
    detector_model_path: str = Field(default="yolo26n.pt", alias="VISION_DETECTION_MODEL_PATH")
    detector_confidence: float = Field(default=0.25, alias="VISION_CONFIDENCE_THRESHOLD")
    detector_iou: float = Field(default=0.45, alias="VISION_IOU_THRESHOLD")
    max_detections: int = Field(default=100, alias="VISION_MAX_DETECTIONS")
    device: str = Field(default="auto", alias="VISION_DEVICE")
    segmentation_enabled: bool = Field(default=False, alias="VISION_SEGMENTATION_ENABLED")
    sam2_checkpoint_path: str = Field(
        default="/models/sam2.1_hiera_tiny.pt", alias="VISION_SAM2_CHECKPOINT_PATH"
    )
    sam2_config: str = Field(
        default="configs/sam2.1/sam2.1_hiera_t.yaml", alias="VISION_SAM2_CONFIG"
    )
    eager_load: bool = Field(default=True, alias="VISION_MODEL_EAGER_LOAD")

    @field_validator(
        "max_image_bytes", "max_image_pixels", "max_inference_side",
        "max_concurrency", "max_detections",
    )
    @classmethod
    def positive_integer(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("must be positive")
        return value

    @field_validator("detector_confidence", "detector_iou")
    @classmethod
    def probability(cls, value: float) -> float:
        if not 0 < value <= 1:
            raise ValueError("must be within (0, 1]")
        return value

    @field_validator("device")
    @classmethod
    def supported_device(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"auto", "cpu", "cuda"}:
            raise ValueError("must be auto, cpu, or cuda")
        return normalized

    @property
    def allowed_hosts(self) -> frozenset[str]:
        return frozenset(
            host.strip().lower().rstrip(".")
            for host in self.allowed_image_hosts.split(",")
            if host.strip()
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
