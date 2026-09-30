from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI

from routers.detection import router as detection_router
from services.detector import WasteDetector
from services.settings import VisionSettings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [vision-service] %(message)s",
)
logger = logging.getLogger(__name__)


# quản lý vòng đời ứng dụng khởi tạo cấu hình và nạp mô hình yolo khi khởi động
@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = VisionSettings.from_environment()
    logger.info(
        "Vision startup model_path=%s exists=%s requested_device=%s",
        settings.model_path,
        settings.model_path.is_file(),
        settings.device,
    )
    detector = WasteDetector(settings)
    app.state.detector = detector

    try:
        detector.load_model()
    except Exception:
        # giữ endpoint health khả dụng để báo trạng thái suy giảm trong khi các endpoint detect trả về mã 503 đến khi nạp mô hình thành công
        logger.exception("Vision model could not be loaded during startup")

    yield


app = FastAPI(
    title="EcoAlert Vision Service",
    version="1.0.0",
    description="YOLO11n waste-object detection for EcoAlert.",
    lifespan=lifespan,
)

app.include_router(detection_router)
