# EcoAlert waste dataset guide

This guide defines the first custom EcoAlert object-detection dataset. It is a YOLO bounding-box dataset, not a segmentation dataset. The current production `yolo26n.pt` remains a general COCO baseline until a separately evaluated custom checkpoint is approved and deployed.

## Dataset layout

```text
ecoalert-waste/
  images/
    train/
    val/
    test/
  labels/
    train/
    val/
    test/
  data.yaml
```

Use an 80/10/10 train/validation/test split. Group related photos before splitting: frames from the same video, burst photos, the same waste pile, or the same collection visit must stay in one split. This prevents near-duplicate leakage and overly optimistic evaluation.

The canonical configuration is [`../backend/vision-service/training/data.yaml`](../backend/vision-service/training/data.yaml). Copy it to the dataset root in Google Drive.

## V1 classes

| ID | Class | Include | Do not include |
|---:|---|---|---|
| 0 | `plastic_bottle` | Bottles visibly identifiable as plastic, including crushed bottles | Glass bottles, metal cans, ambiguous containers |
| 1 | `plastic_bag` | Flexible plastic shopping, produce, or refuse bags | Fabric bags, paper bags, rigid plastic wrappers/containers |
| 2 | `plastic_cup` | Disposable or reusable cups visibly identifiable as plastic | Paper cups, glassware, bowls, ambiguous cups |
| 3 | `metal_can` | Metal beverage and food cans, crushed or intact | Aerosol/hazardous containers, generic scrap metal |
| 4 | `cardboard` | Corrugated cardboard and clearly identifiable cardboard cartons/boxes | Loose paper, plastic-coated packaging when material is unclear |
| 5 | `glass_bottle` | Bottles visibly identifiable as glass, intact or substantially visible | Plastic bottles, drinking glasses, unidentifiable shards |

Material must be visually supportable. If a bottle or cup cannot reliably be distinguished as plastic or glass, do not force a class. Record it for taxonomy review instead.

## What to collect

- Realistic EcoAlert scenes: roadsides, canals, parks, markets, alleys, vacant lots, drainage areas, and mixed urban/rural backgrounds.
- Variation in daylight, shade, rain, low light, camera quality, distance, viewing angle, object size, occlusion, dirt, crushing, and partial visibility.
- Both isolated objects and crowded piles, while keeping each target object individually labelable.
- Geographic and device diversity that reflects expected deployment conditions.
- Hard negatives: clean scenes and visually confusing objects such as sports balls, leaves, stones, toys, food, reflections, reusable containers, and non-waste household objects.
- Images with no target classes. Give each negative image a matching empty label file so missing annotations are distinguishable from reviewed negatives.

Use only images with documented ownership or a compatible license. Remove unnecessary EXIF metadata and address faces, license plates, homes, minors, and location privacy before annotation or training.

## Bounding-box rules

Each image has a same-stem `.txt` file under the matching labels split. Every object row uses:

```text
class_id x_center y_center width height
```

Coordinates are normalized to 0–1 using image width and height.

- Draw one tight box around each visible target object; include the complete visible extent without excessive background.
- Label separate objects separately. Do not use one large box around a pile when individual objects are distinguishable.
- For an occluded object, box the estimated full object only when its extent is reasonably clear; otherwise box the visible extent and apply one consistent policy across the dataset.
- Label truncated objects touching the image boundary when their class is still reliable.
- Skip objects that are too small or blurred to classify consistently. Define and record a minimum labeling size during the pilot audit.
- Do not label a target merely because the surrounding report text says it exists. Labels must be supported by the image.
- Use zero-byte label files for verified negative images.

## Common mistakes

- Calling every COCO-style `bottle` a plastic bottle.
- Confusing plastic cups with paper cups or glassware.
- Labeling cardboard and generic paper as the same material.
- Missing small objects in crowded scenes or labeling only the easiest examples.
- Boxes that include multiple objects, large margins, shadows, or unrelated background.
- Duplicate/near-duplicate scenes placed across train, validation, and test.
- Treating a missing label file as a negative without human review.
- Severe class imbalance, inconsistent class IDs, or changing class definitions midway through labeling.
- Augmenting validation/test data or tuning repeatedly against the test set.

## Dataset progression

- **V1 — 200–300 images:** validate taxonomy, annotation consistency, Colab workflow, and obvious false positives. This is a pilot, not a production claim.
- **V2 — 600–800 images:** add class balance, hard negatives, more sites/devices, difficult lighting, and small/occluded objects.
- **V3 — 1,000–1,500+ images:** broaden geographic/seasonal coverage and reserve a stable test set for release comparisons.

Image totals alone are insufficient. Track object instances per class, negative-scene count, source/location groups, labeling agreement, and error slices.

## Quality-control checklist

1. Freeze the six-class ID mapping before annotation begins.
2. Review a shared 30–50 image pilot with at least two annotators.
3. Resolve disagreements and update the written rules before scaling.
4. Run automated checks for invalid class IDs, coordinates outside 0–1, unmatched files, corrupt images, and split leakage.
5. Manually inspect random samples and every low-frequency class.
6. Version the dataset and retain its provenance/license manifest outside the image labels.

The Colab notebook performs structural and label-range checks before training; it does not replace human annotation review.
