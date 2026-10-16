# EcoAlert multi-model implementation — 2026-10-15

## Delivery state

Implemented and verified both locally and in Docker with both real, unchanged weights. Live HTTP smoke tests pass for `/health`, `/detect`, `/predict`; Model 2-only results reach the legacy response. Vision container is **healthy** on CPU with 2 loaded models, 15 canonical labels and no model errors. Actual Media Service forwarding and the running Alert container's source-preserving schema were verified.

The first Docker build failed during unpacking with `EOF`; Docker host logs showed containerd `SIGBUS`/panic, and a disk check found C had only 69,632 bytes free. After free space recovered to about 3 GB, Docker Desktop was restarted successfully and the final source was rebuilt from cache. All EcoAlert containers that were running before the failure were restored and reported healthy. No broad cleanup, Docker reset, volume deletion or WSL shutdown was performed. Only Vision was rebuilt; Alert already mounts local `dist` read-only, so its rebuilt TypeScript output was picked up when its container restarted. No database migration or change to Officer business logic was needed.

Final Vision image size reported by Docker: 2,501,767,575 bytes (about 2.33 GiB, including CPU PyTorch and native dependencies). Build context was about 76 KB; weight files are excluded. Both `/app/models` and `/app/config` mounts were confirmed `rw=false`. Container startup loaded Model 1 in 534.8 ms and Model 2 in 702.0 ms, total registry startup 1,236.8 ms; startup process RSS was 322.9 MiB.

## Actual classes and mapping

Both `.pt` files were opened using `ultralytics.YOLO(...).names` before refactoring.

Model 1: `0 plastic_bottle`, `1 plastic_bag`, `2 plastic_cup`, `3 metal_can`, `4 cardboard`, `5 glass_bottle`.

Model 2: `0 Animal Waste`, `1 Construction Waste`, `2 Garbage Bag`, `3 Glass`, `4 Metal`, `5 Organic`, `6 Paper`, `7 Plastic`, `8 waste`.

The exact mapping table is in `../README.md` and `../config/models.json`. There are 15 canonical labels with both models loaded, 6 when only Model 1 loads, and zero verified equivalent cross-model labels. All nine Model 2 labels extend the vocabulary. No broad material label was collapsed into an object label; Garbage Bag remains separate from plastic_bag. Metadata alone cannot prove dataset-level equivalence. Broad labels require taxonomy review. Unknown labels are namespaced and flagged. Counts describe retained detection regions, not guaranteed unique physical objects.

## Behavior and compatibility

Registry-driven sequential inference, one decoded image, bounded admission, CPU device fallback, isolated model failures, per-model latency, startup time/RSS, and health model inventory are implemented. Models remain resident. Disabled entries never load. Adding another model requires only weight/configuration and an exact mapping where verified. No directory auto-discovery or fixed model/class count exists in production inference.

Global IDs come from explicit canonical configuration; original Model 1 IDs 0–5 remain intact. Unknown labels receive stable hash IDs, checked for collisions at load. Source model, original name/ID, bbox and confidence survive serialization. Equivalent cross-model boxes use configurable class-aware IoU and registry priority; scores never add or compete across models. One source model can contribute at most one original box per retained region. Within-model YOLO NMS is preserved. Material/detail/nested classes remain distinct.

Legacy routes/fields are retained with additive metadata. Partial nonempty legacy results keep `status: ok`, set `degraded` and manual review. Partial empty results use `status: error`, avoiding a false definitive Mobile rejection. Zero available/successful models return 503. Busy requests return 503; timeout returns 504 while the admission gate stays closed until native work ends. This avoids queued/overlapping inference, but a truly hung native call requires a service restart. Default timeout remains below Media's existing timeout.

Consumer audit: Mobile pre-submit API → gateway `/v1/media/analyze-url` → Media controller → Vision `/predict`; asynchronous AI also calls Media, then sends evidence through Alert RabbitMQ validation/storage. Axios and Mobile adapters already forward arbitrary string labels and arrays. Optional source/degraded fields were added to typed contracts, Alert DTO/event schema and nested storage schema to prevent stripping. No database migration is required. Mobile has Vietnamese names and fallback, preserves prediction metadata in analysis drafts, and still uses its existing original-image bbox transform. Semantic AI, incident categories, camera, GPS, watermark, navigation, Citizen Stitch UI and Admin Web were not redesigned or modified by this work.

## Validation

- 20 Python tests passed, including opt-in real-weight loading/inference. Covers missing/corrupt/disabled models, original names/IDs, independent thresholds, one/both/no detections, runtime error/recovery/all failed, low confidence, invalid boxes, same image array, equivalent/different/nested classes, synonyms, one-to-one merge matching, API contracts, file validation, concurrency and timeout gate retention.
- The same 20 tests also passed inside the actual pinned Docker CPU runtime (2.371 seconds).
- Original `scripts/test_model.py` passed, scoped to the six-class Model 1 regression.
- 13 Mobile tests passed, including actual ReportFlow component logic with mocked native transports, Model 2-only/new labels, bbox/confidence/provenance preservation, manual review, retry, semantic analysis and online/offline flow.
- 1 Media forwarding contract test and 2 Alert validation/persistence contract tests passed. Persistence test validates Mongoose casting without connecting to or changing the database.
- TypeScript checks/builds passed for Mobile, shared, Media and Alert. `git diff --check` passed.
- Real local Uvicorn HTTP smoke: health + 4 successful POST requests (two images × `/detect` and `/predict`). Results saved in `api-smoke-local.json`; server log in `api-smoke-local.server.log`. Both models loaded; all requests reported both model timings and preserved sources. The temporary server was stopped after the smoke run.
- Real Docker HTTP smoke: health + 4 successful POST requests, saved in `api-smoke-docker.json`. Container logs confirmed both original class lists and successful inference. Media's existing compiled `VisionService.predict` was called inside its running container with `test_000016.jpg`: it returned `status: ok`, 4 `garbage_bag` detections, original scores/boxes, `asian_waste` provenance, `degraded: false` and manual review. No Media rebuild was required. Alert's running schema accepted/cast the metadata without a database write.

Sandbox restrictions prevented Node's default isolated test subprocess and Python temporary-file access; the final unit tests mock filesystem checks, and Node tests ran directly via `node path/to/test.js`. Real-weight and HTTP tests still loaded actual files. Existing user-deleted tests were not restored or removed by this work.

## Actual local CPU benchmark

Local benchmark: Python 3.13.13, PyTorch 2.14.0+cpu, Ultralytics 8.4.160, Windows 11, 6 PyTorch CPU threads. Docker's pinned PyTorch 2.5.1+cpu / Ultralytics 8.4.158 runtime separately passed all 20 Vision tests and real HTTP smoke; the table below reports the local benchmark, not container timing.

3 local images × 3 runs per mode, after explicit warmup. Each mode runs in its own process. Total includes image decoding and merging, excludes file reading/HTTP. Full timings, per-box outputs, source paths, image/weight hashes and environment are in `benchmark-local.json`.

| Mode | Loaded labels | Mean total | Per-model mean | Peak process RSS | Weight load time |
|---|---:|---:|---|---:|---:|
| Model 1 | 6 | 108.2 ms | Model 1: 93.3 ms | 394.9 MiB | 42.7 ms |
| Model 2 | 9 | 277.7 ms | Model 2: 266.3 ms | 481.4 MiB | 52.0 ms |
| Both | 15 | 303.8 ms | Model 1: 97.7 ms; Model 2: 202.4 ms | 497.4 MiB | 97.1 ms |

These are small sequential measurements with separate processes, not a controlled claim about speedup. Peak memory includes runtime/native libraries. Weight load excludes initial Python imports and first predictor setup. In the separate HTTP smoke, cold first inference took 3,828.5 ms; warm requests took about 182–204 ms. Resource contention can change timings; benchmark on the deployment machine before increasing concurrency.

Sample observations (predictions, **not confirmed ground truth**):

- `test_000002.jpg`: Model 1 predicted plastic_bag (0.650); Model 2 organic_waste (0.791). Both remain in the merged output because labels differ.
- `test_000016.jpg`: Model 1 returned none; Model 2 returned four garbage_bag regions (about 0.860–0.938). All four are returned by both current endpoints and retain `asian_waste` provenance.
- `0ccffac5-AluCan534_jpg.rf.94e4bd8dea6ad161e9956a156d0e132e.jpg`: Model 1 metal_can (0.833); Model 2 plastic (0.463) and metal (0.336). All three remain because equivalence is unverified. This illustrates why merged count is not a physical object count and broad/detail mappings require dataset review.

No common fully normalized ground truth was available. No accuracy, mAP, precision/recall or combined-model improvement claim was calculated. No image from the sample dataset or weight was copied into tracked source files.

## Files created or changed by this task

Vision:

- `config/models.json` (new)
- `services/settings.py`, `services/detector.py`
- `routers/detection.py`, `schemas/detection.py`, `main.py`
- `Dockerfile`, `.dockerignore`, `.env.example`, `requirements.txt`, `requirements-dev.txt` (new)
- `scripts/test_model.py`, `scripts/benchmark.py` (new), `scripts/smoke_api.py` (new)
- `tests/test_multimodel.py` (new)
- `README.md`
- `reports/implementation.md`, `reports/benchmark-local.json`, `reports/api-smoke-local.json`, `reports/api-smoke-docker.json`, `reports/api-smoke-local.server.log`, `reports/tests-local.log` (new evidence)

Repository integration:

- Root `docker-compose.yml`
- `backend/media-service/src/services/vision.service.ts`
- `backend/media-service/src/tests/vision.service.test.ts` (new)
- `backend/shared/src/interfaces/ai-analysis.interface.ts`
- `backend/alert-service/src/dtos/vision.schema.ts` (new), `dtos/alert.dto.ts`, `models/alert.model.ts`, `services/rabbitmq.service.ts`
- `backend/alert-service/src/tests/vision-provenance.test.ts` (new)
- `mobile/src/shared/utils/visionBoundingBox.ts`, `shared/types/index.ts`
- `mobile/src/citizen/report/types.ts`, `screens/ReportImageValidationScreen.tsx`
- `mobile/tests/report-semantic-flow.test.cjs`

All pre-existing user changes/deletions, including map/Officer/Admin changes, were preserved. No push, reset, merge, weight rewrite, training or unrelated source changes were performed. Mobile does not average confidence across multiple source models; original per-region scores remain available. The shared evidence schema accepts merged arrays beyond the old single-model 300-region cap so multiple models do not cause contract rejection solely by adding regions.

## Remaining steps

1. Validate a real authenticated Mobile capture/report session. Contract tests exercise ReportFlow but do not substitute for physical device UI verification.
2. Review broad label annotation semantics before adding cross-model equivalence or interpreting region counts as object counts. Model 3 instructions are in the README.
3. For another deployment, build Vision and deploy Alert's optional schema update (or compile/restart it when using the local `dist` mount). Media's pass-through implementation requires no runtime change/rebuild.
