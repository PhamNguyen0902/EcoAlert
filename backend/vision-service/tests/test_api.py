import io

from fastapi.testclient import TestClient
from PIL import Image

from app.config import Settings
from app.main import create_app
from app.models import ModelHealth
from app.schemas import BoundingBox, Detection


class FakeDetector:
    def detect(self, image):
        return [
            Detection(
                class_id=0,
                label="plastic_bottle",
                confidence=0.91,
                bbox=BoundingBox(x=1, y=1, width=3, height=3),
                normalized_bbox=BoundingBox(x=0.1, y=0.1, width=0.3, height=0.3),
                waste_type="PLASTIC_WASTE",
            )
        ]


class FakeRegistry:
    detector = FakeDetector()
    segmenter = None
    device = "cpu"

    def load_once(self):
        return ModelHealth(detector_loaded=True, segmenter_loaded=False)

    def health(self):
        return self.load_once()


def image_bytes():
    output = io.BytesIO()
    Image.new("RGB", (10, 10), "white").save(output, "JPEG")
    return output.getvalue()


def test_internal_endpoint_requires_token_and_returns_camel_case_contract():
    settings = Settings(
        VISION_INTERNAL_TOKEN="test-secret",
        VISION_ALLOWED_IMAGE_HOSTS="images.example.test",
        VISION_MODEL_EAGER_LOAD=False,
    )
    app = create_app(settings, FakeRegistry())

    async def fake_fetch(url, configured):
        return image_bytes()

    app.state.fetch_image = fake_fetch
    with TestClient(app) as client:
        unauthorized = client.post(
            "/internal/v1/analyze",
            json={"imageUrl": "https://images.example.test/a.jpg"},
        )
        assert unauthorized.status_code == 401
        response = client.post(
            "/internal/v1/analyze",
            json={"imageUrl": "https://images.example.test/a.jpg"},
            headers={"x-internal-service-token": "test-secret"},
        )
    assert response.status_code == 200
    body = response.json()
    assert body["totalDetectedObjects"] == 1
    assert body["detections"][0]["label"] == "plastic_bottle"
    assert body["visibleWasteCoverage"] is None
    assert body["detectionTimeMs"] >= 0
