import asyncio
import logging
import time
from pathlib import Path
from uuid import uuid4
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from .analysis import InvalidImageError, analyze_image
from .config import Settings, get_settings
from .models import ModelRegistry
from .schemas import AnalyzeRequest, HealthResponse, VisionResponse
from .security import fetch_image, require_internal_token

logger = logging.getLogger("ecoalert.vision")


def create_app(settings: Settings | None = None, registry: ModelRegistry | None = None) -> FastAPI:
    configured = settings or get_settings()
    models = registry or ModelRegistry(configured)
    concurrency = asyncio.Semaphore(configured.max_concurrency)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        if configured.eager_load:
            await asyncio.to_thread(models.load_once)
        yield

    app = FastAPI(title="EcoAlert Vision Service", version="1.0.0", lifespan=lifespan)
    app.state.settings = configured
    app.state.models = models
    app.state.fetch_image = fetch_image

    def internal_auth(request: Request) -> None:
        require_internal_token(request, configured)

    @app.exception_handler(InvalidImageError)
    async def invalid_image_handler(_: Request, exc: InvalidImageError):
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    @app.get("/health", response_model=HealthResponse, response_model_by_alias=True)
    async def health() -> HealthResponse:
        model_health = models.health()
        return HealthResponse(
            status="ok" if model_health.detector_loaded else "degraded",
            service=configured.service_name,
            detector_loaded=model_health.detector_loaded,
            segmenter_loaded=model_health.segmenter_loaded,
            segmentation_enabled=configured.segmentation_enabled,
            device=models.device,
            detector_model=Path(configured.detector_model_path).name,
            segmenter_model=(
                models.segmenter.model_name if model_health.segmenter_loaded and models.segmenter else None
            ),
        )

    @app.post(
        "/internal/v1/analyze",
        response_model=VisionResponse,
        response_model_by_alias=True,
        dependencies=[Depends(internal_auth)],
    )
    async def analyze(request: AnalyzeRequest, http_request: Request) -> VisionResponse:
        request_id = http_request.headers.get("x-request-id", str(uuid4()))[:128]
        started = time.perf_counter()
        segmentation_requested = bool(
            configured.segmentation_enabled
            and request.segmentation_enabled is not False
        )
        async with concurrency:
            payload = await http_request.app.state.fetch_image(
                str(request.image_url), configured
            )
            try:
                result = await asyncio.to_thread(
                    analyze_image, payload, configured, models, segmentation_requested
                )
                logger.info(
                    "vision_analysis_completed requestId=%s model=%s device=%s objectCount=%s processingTimeMs=%s",
                    request_id,
                    Path(configured.detector_model_path).name,
                    models.device,
                    result.total_detected_objects,
                    round((time.perf_counter() - started) * 1000),
                )
                return result
            except RuntimeError as exc:
                raise HTTPException(status_code=503, detail="Vision model unavailable") from exc

    return app


app = create_app()
