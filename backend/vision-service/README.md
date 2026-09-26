# EcoAlert Vision Service

FastAPI service for YOLO11n waste-object detection on port `8001`.

## Model and classes

The model is loaded once at startup from `models/BEST_ECOALERT_YOLO11N.pt` by default. It detects:

`plastic_bottle`, `plastic_bag`, `plastic_cup`, `metal_can`, `cardboard`, and `glass_bottle`.

## Run locally

```bash
cd backend/vision-service
python -m pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

Copy `.env.example` to `.env` to customize `YOLO_MODEL_PATH`, `YOLO_CONFIDENCE`, `YOLO_IMAGE_SIZE`, `YOLO_DEVICE` (`auto`, `cpu`, or a CUDA device), and `YOLO_MAX_UPLOAD_MB`.

## Test

```bash
python scripts/test_model.py
curl http://127.0.0.1:8001/health
curl -X POST "http://127.0.0.1:8001/detect?confidence=0.4" -F "file=@path/to/image.jpg"
```

Interactive Swagger documentation is available at `http://127.0.0.1:8001/docs`.

`POST /predict` remains available with its legacy response for `media-service` compatibility. Use `POST /detect` for the typed detection response.
