# EcoAlert custom waste detector training contract

This directory contains reproducible entry points, not a dataset or a trained custom model. The shipped `yolo26n.pt` is pretrained on COCO and must not be reported as an EcoAlert waste detector.

The V1 contract contains six classes in `data.yaml`: `plastic_bottle`, `plastic_bag`, `plastic_cup`, `metal_can`, `cardboard`, and `glass_bottle`. Prepare independently licensed images and YOLO-format bounding-box labels following [`../../../docs/ecoalert-waste-dataset-guide.md`](../../../docs/ecoalert-waste-dataset-guide.md).

Do not run the training entry points on the EcoAlert Windows development machine. The supported workflow for this phase is the Google Colab GPU notebook:

[`../../../docs/notebooks/ecoalert-yolo26-training.ipynb`](../../../docs/notebooks/ecoalert-yolo26-training.ipynb)

`train.py` and `evaluate.py` remain portable helpers for a remote GPU environment. Their defaults match the initial Colab run: YOLO26n, 640px images, 50 epochs, patience 15, and CUDA device 0.

Do not deploy solely from aggregate mAP. Review per-class precision/recall, confusion matrix, empty-scene false positives, small-object performance, geography/device slices, severity calibration, and end-to-end CPU/GPU latency. Promote weights only after recording their immutable checksum, dataset version, code revision, thresholds, and approval owner.
