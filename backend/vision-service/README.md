# EcoAlert Vision Service

Internal FastAPI service for Phase 1A custom YOLO26 detection, exact object counting, and annotated-image generation. It has no OpenRouter, AWS, JWT, MongoDB, or RabbitMQ credentials.

The deployed model is `/models/ecoalert-waste-yolo26n-v1.pt`. Startup rejects any detector whose embedded ID-to-name mapping differs from the six-class EcoAlert V1 taxonomy. The production contract, security controls, evaluation metrics, and failure behavior are documented in [`../../docs/phase-1a-multimodal-vision.md`](../../docs/phase-1a-multimodal-vision.md).

Quick validation:

```powershell
docker compose up -d --no-build --force-recreate vision-service
docker compose exec vision-service python -c "import urllib.request; print(urllib.request.urlopen('http://localhost:3007/health').read().decode())"
```

The model is provisioned explicitly into the named `/models` volume. Phase 1B and SAM2 remain disabled; do not download or enable segmentation artifacts as part of Phase 1A.
