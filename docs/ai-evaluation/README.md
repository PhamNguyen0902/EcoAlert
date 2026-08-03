# Multimodal evaluation protocol

Copy the CSV template per immutable dataset/model release. Keep raw incident media outside Git and use opaque sample IDs. Report detection precision, recall, mAP50 and mAP50-95; per-class and macro results; false positives on empty environmental scenes; SAM mask IoU and coverage error; semantic and fused severity confusion matrices; calibration error; and p50/p95/p99 end-to-end latency by CPU/GPU profile.

The acceptance gate must be set by product, environmental-domain, privacy, and operations owners using representative data. This repository intentionally does not invent a production threshold without a dataset.
