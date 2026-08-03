# EcoAlert Vision Service

Internal FastAPI service for Phase 1 YOLO26 detection, optional SAM 2.1 box-prompt segmentation, exact object counting, union-mask coverage, and annotated-image generation. It has no OpenRouter, AWS, JWT, MongoDB, or RabbitMQ credentials.

The production contract, model honesty notes, security controls, scoring, rollout, and validation instructions are documented in [`../../docs/phase-1-vision-ai.md`](../../docs/phase-1-vision-ai.md).

Quick validation:

```powershell
docker build --target test -t ecoalert-vision-test backend/vision-service
docker run --rm ecoalert-vision-test
docker compose up -d --build vision-service
```

Model downloads are explicit. Run `python /app/scripts/download_models.py --yolo --sam2` inside the runtime image with `/models` mounted. No pretrained checkpoint or custom dataset is stored in Git.
