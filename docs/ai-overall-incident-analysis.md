# AI overall incident analysis

## Purpose

EcoAlert AI is decision support. It suggests an incident category and severity but never verifies, assigns, resolves, or closes an incident. Citizens and Admins retain the confirmation/correction workflow.

## Multimodal v2 flow

```text
Citizen image + title + description
  -> Custom EcoAlert YOLO object detection
  -> Compact Vision evidence
  -> OpenRouter semantic incident synthesis (openai/gpt-4o-mini)
  -> AI overall analysis + evidence-aware fusion
  -> image.analyzed event
  -> Alert persistence and human confirmation UI
```

Vision runs first so semantic synthesis receives a compact evidence object: detector availability/model, total object count, per-class count, per-class maximum confidence, and detector confidence. Bounding boxes remain in `aiVision` for the UI and are not sent to the semantic provider.

## Responsibilities

- Vision: object-level evidence only.
- Semantic AI: incident-level interpretation, canonical category, calibrated category/severity confidence, concise `overallSummary`, and `shortReason`.
- Fusion: preserves semantic category authority and records whether custom waste evidence is `STRONG`, `PARTIAL`, `NONE`, or `NOT_APPLICABLE`; it does not convert a flood into waste merely because a bottle is present.

## Custom detector boundary

The preserved custom detector is `ecoalert-waste-yolo26n-v1.pt` with exactly these classes: `plastic_bottle`, `plastic_bag`, `plastic_cup`, `metal_can`, `cardboard`, and `glass_bottle`. Generic COCO YOLO is rejected by AI and Alert validation. SAM2 remains disabled (`VISION_SEGMENTATION_ENABLED=false`).

Zero EcoAlert waste detections is a valid successful Vision result. It does not disprove flooding, air/water pollution, or another environmental incident.

## Canonical taxonomy and confidence policy

The source of truth is the existing `AlertCategory` enum: lowercase canonical codes such as `illegal_dumping`, `water_pollution`, and `flooding`. Semantic display-name aliases such as `Waste` are normalized to their existing code (`illegal_dumping`); unsupported output becomes `UNCLASSIFIED`.

- `AI_CATEGORY_SUGGESTION_THRESHOLD=0.80`: high-confidence suggestion.
- `AI_CATEGORY_UNCLASSIFIED_THRESHOLD=0.50`: below this, or if unsupported/not an incident, no category suggestion is stored.
- From 0.50 to below 0.80, an advisory suggestion is shown as requiring confirmation.

`aiOverallAnalysis` is written only for semantic synthesis. A `VISION_ONLY` fallback preserves Vision evidence but deliberately has no invented overall interpretation and uses `UNCLASSIFIED`.

## Confidence-state policy

EcoAlert stores confidences on a `0..1` scale. `0` is retained when a model actually produced zero confidence; `null` means that source was unavailable and must not be rendered as `0%`.

- `incidentConfidence`: semantic confidence that the report is an environmental incident.
- `categoryConfidence`: semantic confidence in the candidate category; it remains measurable even when the effective category is `UNCLASSIFIED` for being below threshold.
- `severityConfidence`: semantic confidence in severity.
- `detectorConfidence`: YOLO object-detection evidence only; it is displayed only in the Vision section.
- `fusionConfidence`: present only if fusion calculates a real cross-signal confidence metric. The current fusion implementation does not, so it stores `null`.

The server is the single confidence resolver for new results: `FULL_MULTIMODAL` uses a real fusion confidence when present, then category confidence, then incident confidence. `SEMANTIC_ONLY` uses category/incident confidence. `VISION_ONLY` and `FAILED` always resolve top-level confidence to `null` with source `NONE`; detector confidence remains separate.

In `VISION_ONLY`, semantic severity and semantic text are also `null`. The application renders a local semantic-unavailable status and keeps deterministic Vision evidence (counts and detector confidence) separate. Historical `VISION_ONLY` records with a legacy stored `0` are rendered as unavailable by the detail views without rewriting MongoDB.

## Failure modes

- Vision succeeded + semantic succeeded: `FULL_MULTIMODAL` (including zero detections).
- Vision failed + semantic succeeded: `SEMANTIC_ONLY`.
- Semantic failed + Vision succeeded: `VISION_ONLY`, `UNCLASSIFIED`, no fabricated overall summary.
- Both failed: the AI consumer fails safely and does not publish a fabricated result.

## UI

Web and mobile render **AI phân tích tổng quan** separately from **Vision nhận diện vật thể**. Older alerts have no `aiOverallAnalysis`; the new component returns no content and existing alert views continue to render safely.
