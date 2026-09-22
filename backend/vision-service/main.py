from fastapi import FastAPI, File, UploadFile
from ultralytics import YOLO
import io
from PIL import Image

app = FastAPI(title="EcoAlert Vision Service")
model = YOLO('model/best.pt')

MATERIAL_TO_CATEGORY = {
    'bag': 'illegal_dumping',
    'cardboard': 'illegal_dumping',
    'furniture': 'illegal_construction_waste',
    'glass': 'illegal_dumping',
    'metal': 'illegal_dumping',
    'paper': 'illegal_dumping',
    'plastic': 'illegal_dumping',
    'yard': 'illegal_dumping',
}

CONFIDENCE_THRESHOLD = 0.4

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    image_bytes = await file.read()
    image = Image.open(io.BytesIO(image_bytes))
    results = model(image)

    detections = []
    for box in results[0].boxes:
        cls_name = model.names[int(box.cls[0])]
        confidence = float(box.conf[0])
        detections.append({
            'materialClass': cls_name,
            'suggestedCategory': MATERIAL_TO_CATEGORY.get(cls_name, 'OTHER'),
            'confidence': confidence,
            'bbox': box.xyxy[0].tolist(),
        })

    if not detections:
        return {'status': 'no_detection', 'detections': [], 'requiresManualReview': True}

    max_conf = max(d['confidence'] for d in detections)
    return {
        'status': 'ok',
        'detections': detections,
        'requiresManualReview': max_conf < CONFIDENCE_THRESHOLD,
    }