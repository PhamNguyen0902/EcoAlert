# EcoAlert Vision Service

FastAPI service for configurable multi-model YOLO waste-object detection on port `8001`.

## Verified weights and taxonomy

Both weights were loaded with `ultralytics.YOLO(...).names` on 2026-10-15. Model 1 (`ecoalert_general`, `models/BEST_ECOALERT_YOLO11N.pt`) has these original IDs, unchanged:

`plastic_bottle`, `plastic_bag`, `plastic_cup`, `metal_can`, `cardboard`, and `glass_bottle`.

Model 2 (`asian_waste`, `models/BEST_ASIAN_WASTE_YOLO11S.pt`) has:

| Local ID | Original label | Canonical label | Global ID | Vietnamese |
|---|---|---|---|---|
| 0 | Animal Waste | animal_waste | 6 | Chất thải động vật |
| 1 | Construction Waste | construction_waste | 7 | Phế thải xây dựng |
| 2 | Garbage Bag | garbage_bag | 8 | Túi rác |
| 3 | Glass | glass | 9 | Thủy tinh |
| 4 | Metal | metal | 10 | Kim loại |
| 5 | Organic | organic_waste | 11 | Rác hữu cơ |
| 6 | Paper | paper | 12 | Giấy |
| 7 | Plastic | plastic | 13 | Nhựa |
| 8 | waste | waste | 14 | Rác (chưa phân loại) |

Model 1 canonical IDs remain 0–5 in the order above. These IDs are configured, never inferred from another model's local ID. There are **15 distinct canonical labels and zero verified equivalent labels across these two weights** under the conservative mapping. All nine Model 2 labels extend the original label set. This is a label vocabulary, not 15 mutually exclusive types or evidence of improved accuracy.

The mapping only standardizes spelling/translation. Weight metadata alone does not establish detailed dataset annotation semantics. `Garbage Bag` is kept separate from `plastic_bag`; `Plastic`, `Metal`, `Glass`, `Paper` and `waste` are not equivalent to bottles, cans or cardboard. Broad/ambiguous labels appear in `review_classes` and set `needs_review`; they are retained and require taxonomy review. Different labels can describe the same physical object: the final count is **retained detection regions**, not a guaranteed physical object count. No incident type, severity or mass is inferred from new labels (`suggestedCategory: other`); semantic AI continues separately. Original six category suggestions remain unchanged for compatibility.

## Registry and inference

`config/models.json` is the explicit registry. Each entry has a unique `id`, `enabled`, `path`, per-model `confidence`, `image_size`, and exact `label_map`. Paths are relative to the service root. Classes and counts are read from successfully loaded weights; configured but unloaded classes are excluded from health totals. Only enabled entries are loaded. Weights are loaded once, models run sequentially, and one request at a time is admitted per process. Run one Uvicorn worker; multiple workers would duplicate all weights and admission limits.

Unknown labels are returned as `model_id:original_label`, with deterministic SHA-256-derived numeric fallback IDs and `needs_review: true`. ID collisions fail that model's load with a clear error. IDs registered in `canonical_ids` are stable; never renumber existing ones. `/detect?confidence=...` explicitly overrides thresholds for every model; without it, registry thresholds apply. `YOLO_CONFIDENCE`/`YOLO_IMAGE_SIZE` supply defaults for entries that omit those values, and control legacy single-model mode.

Deduplication uses canonical class equality and configurable IoU (`YOLO_MERGE_IOU`, default 0.6) across different models only. Registry order has priority; within one model, higher confidence is visited first. A source model can match at most one prediction into a retained region. The selected bbox and confidence remain unchanged; `sources` preserves every suppressed original prediction, including its bbox and score. Scores are never summed or ranked across models. Labels of different meaning, broad/detail labels and nested objects remain separate. Within-model NMS stays with YOLO.

An enabled model load/inference failure is isolated, logged and included in health/results. Partial results set `degraded: true` and `requiresManualReview: true`; no successful models returns HTTP 503. An empty partial legacy result uses `status: error` so Mobile does not mark evidence definitively invalid. Empty successful results retain `status: no_detection`. Runtime errors are retried on the next request and clear after success; missing/broken weights require restart after repair.

Upload validation checks MIME, extension, file bytes, image signature, decoded dimensions and a 25-million-pixel limit. The image is decoded once in a worker thread and the same array is passed to all models. CPU work stays off FastAPI's event loop. Busy requests return HTTP 503 with Retry-After; inference timeout defaults to 8 seconds (HTTP 504), below Media's existing 10-second timeout. A timed-out native CPU call cannot be safely killed: admission remains closed until it finishes, avoiding overlapping work or unbounded queued inference. Restart the service if native inference hangs indefinitely.

Health includes all configured/enabled/loaded models, per-model original/normalized classes, errors, device, startup time/RSS and last inference latency. `model_loaded`, `classes`, `device`, `service` and the old routes remain available. Health uses HTTP 200 for inspection; Docker readiness checks that at least one model is loaded and accepts degraded operation.

## Run locally

```bash
cd backend/vision-service
python -m pip install -r requirements-dev.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8001
```

Use the registry by default, or set `YOLO_MODELS_CONFIG` to another JSON file. `.env.example` documents environment variables; plain Python does not automatically load `.env` (export variables or use Uvicorn `--env-file .env`). `YOLO_DEVICE=auto` falls back to CPU. `YOLO_MAX_UPLOAD_MB`, `YOLO_MAX_IMAGE_PIXELS` and `YOLO_INFERENCE_TIMEOUT_SECONDS` control resource limits.

For legacy single-model mode, **unset `YOLO_MODELS_CONFIG`** and set `YOLO_MODEL_PATH=models/BEST_ECOALERT_YOLO11N.pt`. Alternatively set `asian_waste.enabled=false` in the registry. Model 1 retains original IDs, labels, thresholds and legacy response values, with additive metadata.

## Docker

From the repository root:

```bash
docker compose build vision-service
docker compose up -d --no-deps vision-service
docker compose logs --tail 80 vision-service
curl http://127.0.0.1:8001/health
```

Service name and port are unchanged. Compose mounts both `models/` and `config/` read-only. Weights are excluded from build context and never copied into the image or pushed. `.gitignore` already ignores `.pt`/`.pth`. There is no CUDA requirement. Configuration/weight changes require only a Vision restart; adding source changes requires its build. Optional provenance fields also extend Alert DTO/event/storage schemas. Local Compose already mounts Alert/shared `dist`: compile Alert (`npm --prefix backend/alert-service run build`) and restart only Alert to load those schemas; deployments without that mount need its updated image. No data migration is needed; old evidence remains valid. Media's existing forwarding implementation accepts added fields without a runtime rebuild.

## Add Model 3

1. Put its weight file in `models/` (keep it ignored by Git).
2. Inspect `YOLO(path).names`; add an explicit unique registry entry with enabled flag and thresholds.
3. Add new stable IDs to `canonical_ids` and exact mappings to `label_map`. Map to an existing class only with verified equivalence; otherwise keep a separate label, or omit the mapping to use namespaced fallback/review. Add Vietnamese labels to Mobile where verified.
4. Restart only Vision (`docker compose restart vision-service`) and inspect `/health`/logs. No inference code changes are needed. Registry order determines overlap priority.

## Test

```bash
python scripts/test_model.py
python -m unittest discover -s tests -v
# PowerShell: $env:VISION_REAL_MODELS='1'
# POSIX: VISION_REAL_MODELS=1 python -m unittest discover -s tests -v
python scripts/benchmark.py path/to/image.jpg --runs 3 --output reports/benchmark.json
curl http://127.0.0.1:8001/health
curl -X POST "http://127.0.0.1:8001/detect?confidence=0.4" -F "file=@path/to/image.jpg"
```

Interactive Swagger documentation is available at `http://127.0.0.1:8001/docs`.

`scripts/test_model.py` preserves the original six-class regression check. Unit tests mock weight loads/inference; the opt-in integration test uses the real local files when present. Benchmarks warm up each mode and run each in a separate process, reporting individual model time, total including decode, detections and process peak RSS. RSS includes Python/PyTorch, not just weights. No mAP, precision or recall is calculated without unified test ground truth.

`POST /predict` keeps `status`, `detections`, `requiresManualReview` and per-detection `materialClass`, `suggestedCategory`, `confidence`, `bbox`. Both endpoints add `model_id`, `original_class_name`, `original_class_id`, `sources`, `needs_review`, `degraded`, model errors and timings. `/detect` preserves `success`, image dimensions, `count`, global `class_id`, `class_name` and `bounding_box`. Legacy single-model review still uses the original highest-confidence rule; multi-model review conservatively checks individual low-confidence detections so one model cannot clear another's uncertainty.

The audited report route is Mobile `alertService.analyzeUploadedImage` → Gateway `/v1/media/analyze-url` → Media `UploadController.analyzeRemoteImage` → `VisionService.predict` → Vision `/predict`. Async report analysis also calls Media `/analyze-url`, then stores vision evidence through the Alert RabbitMQ validator. Mobile uses dynamic class groups and original-image contain coordinates; new labels/source metadata are retained in its analysis draft. Citizen UI, GPS, camera, watermark, navigation and semantic AI behavior remain intact. `/detect` is used by smoke/manual callers; `/health` by Compose and diagnostics.

Local validation and measurements are recorded in `reports/implementation.md` and `reports/benchmark-local.json`. Device UI and a fully authenticated report submission require the user's running Mobile session; contract tests exercise the real ReportFlow component with mocked native transports.
