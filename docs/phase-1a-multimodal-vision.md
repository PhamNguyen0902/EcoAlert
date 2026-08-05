# EcoAlert Phase 1A: Multimodal Vision Intelligence

## Status and scope

Phase 1A combines backend semantic analysis and object detection for incident triage:

```text
Alert Service -> alert.created -> RabbitMQ -> AI Service
AI Service -> OpenRouter GPT-4o-mini + Vision Service Custom YOLO26n V1
AI Service -> deterministic Fusion -> image.analyzed -> RabbitMQ
Alert Service -> additive MongoDB persistence -> Web / Mobile
```

The semantic and Vision branches run concurrently. A Vision failure retains a successful semantic result as `SEMANTIC_ONLY`; annotation-upload failure retains the structured detections. Both branches must fail before the AI Service rejects the analysis event.

## Runtime configuration

- Semantic provider/model: OpenRouter, `openai/gpt-4o-mini`
- Detector: `ecoalert-waste-yolo26n-v1.pt`
- Detector path: `/models/ecoalert-waste-yolo26n-v1.pt`
- Ultralytics: `8.4.102`
- Confidence threshold: `0.40`
- Vision concurrency: `1`
- Device: `auto` (CPU on the current deployment)
- Vision timeout: `45000` ms
- Vision Service is internal-only on the Compose network.

Required flags:

```dotenv
VISION_AI_ENABLED=true
VISION_SEGMENTATION_ENABLED=false
```

SAM2 and all Phase 1B segmentation outputs remain disabled. `visibleWasteCoverage` and `segmentationConfidence` remain `null` without segmentation evidence.

## Custom detector taxonomy

| ID | Class |
|---:|---|
| 0 | `plastic_bottle` |
| 1 | `plastic_bag` |
| 2 | `plastic_cup` |
| 3 | `metal_can` |
| 4 | `cardboard` |
| 5 | `glass_bottle` |

Vision startup validates this exact ID-to-name mapping. The AI and Alert event boundaries also reject generic COCO models or conflicting class labels.

## Dataset and evaluation

The cleaned V1 dataset contains 4,240 images:

- Train: 3,391
- Validation: 412
- Independent test: 437

Recorded independent test metrics:

- Precision: `0.771`
- Recall: `0.668`
- mAP@0.5: `0.735`
- mAP@0.5:0.95: `0.516`

The correct release statement is: **mAP@0.5 = 73.5% and mAP@0.5:0.95 = 51.6% on an independent 437-image test set.** mAP@0.5 is not described as generic accuracy.

| Class | Precision | Recall | mAP@0.5 | mAP@0.5:0.95 |
|---|---:|---:|---:|---:|
| `plastic_bottle` | 0.564 | 0.417 | 0.485 | 0.309 |
| `plastic_bag` | 0.736 | 0.516 | 0.561 | 0.342 |
| `plastic_cup` | 0.823 | 0.652 | 0.753 | 0.573 |
| `metal_can` | 0.852 | 0.804 | 0.877 | 0.602 |
| `cardboard` | 0.908 | 0.867 | 0.929 | 0.701 |
| `glass_bottle` | 0.744 | 0.750 | 0.801 | 0.567 |

## Result and persistence contract

Vision returns the detector model, image dimensions, exact detections, pixel and normalized bounding boxes, per-object confidence, object counts, mean detector confidence, latency, and an internal base64 annotated JPEG. The AI Service uploads the annotation through Media Service and publishes only the resulting URL.

Fusion persists:

- mode: `FULL_MULTIMODAL`, `SEMANTIC_ONLY`, or cautious `VISION_ONLY`
- semantic, detector, and fusion confidence as separate values
- severity and deterministic severity score/factors
- summary, category, detected objects, model version, warnings, and timing

`analysisId` is derived from the source `alert.created` event ID. Alert Service ignores a replay of an already-persisted analysis ID, preventing duplicate AI persistence for event retries.

## Failure behavior

- Vision unavailable, timeout, invalid image, or rejected detector contract: semantic result can persist as `SEMANTIC_ONLY`.
- No detections: a valid completed Vision result with empty counts and `detectorConfidence=null`.
- OpenRouter failure with healthy Vision: cautious `VISION_ONLY` output requiring human review.
- Annotation upload failure: detections and Fusion still persist without `annotatedImageUrl`.
- Duplicate `image.analyzed`: existing `analysisId` is returned without another database update.
- Historical Alert without Vision/Fusion fields: Web and Mobile omit or safely degrade the Vision evidence card.

## Known limitations

- `plastic_bottle` recall (`0.417`) is the weakest class result.
- `plastic_bag` recall (`0.516`) also needs improvement.
- `plastic_cup` is the least represented V1 class by object count.
- Detection does not prove that an object is illegally discarded or determine physical waste area.
- Bounding boxes and model confidence are triage evidence, not legal or safety conclusions.

## Phase 1B

Phase 1B is not implemented or enabled. Do not enable SAM2, download its weights, calculate masks, or claim physical waste coverage as part of Phase 1A.
