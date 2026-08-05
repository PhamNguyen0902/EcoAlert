# Deploying a trained EcoAlert YOLO26 checkpoint

V1 training and held-out evaluation are complete. Use this procedure when provisioning or replacing the approved `ecoalert-waste-yolo26n-v1.pt` artifact. Keep `/models/yolo26n.pt` available as a rollback artifact, but do not configure it as the primary detector.

## Prepare the artifact

In the Colab run directory, locate:

```text
weights/best.pt
```

Download that file from Google Drive and rename it locally:

```text
ecoalert-waste-yolo26n-v1.pt
```

Keep a model record containing the dataset version, six-class mapping, Ultralytics version `8.4.102`, training settings, validation/test metrics, Colab run path, Git revision, artifact size, and SHA-256 checksum. Metrics must come from the completed run; do not enter estimates.

## Copy into the persistent model volume

With the existing Vision container running, copy the artifact into its mounted `/models` directory without deleting the baseline:

```powershell
docker compose cp .\models\ecoalert-waste-yolo26n-v1.pt vision-service:/models/ecoalert-waste-yolo26n-v1.pt
docker compose exec -T vision-service python -c "import hashlib,os; p='/models/ecoalert-waste-yolo26n-v1.pt'; print({'exists':os.path.isfile(p),'bytes':os.path.getsize(p) if os.path.isfile(p) else None,'sha256':hashlib.sha256(open(p,'rb').read()).hexdigest() if os.path.isfile(p) else None})"
```

Compare the container checksum with the downloaded artifact. A plausible file size alone is not sufficient.

## Pre-activation checks

- Confirm the model exposes exactly IDs 0–5 in the order defined by `training/data.yaml`.
- Confirm the Vision mapping layer recognizes all six custom labels; specifically verify `plastic_cup` before activation.
- Re-run the approved evaluation set and false-positive hard negatives.
- Keep the approved `0.40` confidence threshold unless a later validation run supports a change.
- Preserve `/models/yolo26n.pt` and record the rollback command.

## Active runtime configuration

The active Vision environment is:

```dotenv
VISION_DETECTION_MODEL_PATH=/models/ecoalert-waste-yolo26n-v1.pt
```

Then recreate only Vision without building an image:

```powershell
docker compose up -d --no-build --force-recreate vision-service
```

Verify `/health`, inspect startup logs for the exact model path and absence of downloads, and run a controlled smoke image. If loading or validation fails, restore:

```dotenv
VISION_DETECTION_MODEL_PATH=/models/yolo26n.pt
```

and recreate only Vision again with `--no-build`.

The V1 runtime switch is complete. This procedure does not enable SAM2.
