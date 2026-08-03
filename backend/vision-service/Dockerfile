FROM python:3.11-slim AS base

ARG SAM2_COMMIT=2b90b9f5ceec907a1c18123530e92e794ad901a4
ARG TORCH_INDEX_URL=https://download.pytorch.org/whl/cpu

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    SAM2_BUILD_CUDA=0 \
    YOLO_CONFIG_DIR=/models/ultralytics \
    PYTHONPATH=/app

RUN apt-get update \
    && apt-get install -y --no-install-recommends git libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt ./
RUN pip install --index-url "${TORCH_INDEX_URL}" \
      torch==2.5.1 torchvision==0.20.1 \
    && pip install -r requirements.txt \
    && pip install --no-deps "git+https://github.com/facebookresearch/sam2.git@${SAM2_COMMIT}"

COPY app ./app
COPY scripts ./scripts
RUN mkdir -p /models/ultralytics

FROM base AS test
COPY requirements-dev.txt ./
RUN pip install -r requirements-dev.txt
COPY tests ./tests
CMD ["pytest", "-q"]

FROM base AS runtime
WORKDIR /models
EXPOSE 3007
CMD ["python", "-m", "app"]
