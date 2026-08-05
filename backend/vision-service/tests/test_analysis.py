import io

import numpy as np
import pytest
from PIL import Image

from app.analysis import InvalidImageError, analyze_image, apply_masks, decode_image
from app.config import Settings
from app.models import (
    DetectorTaxonomyError,
    ModelHealth,
    boxes_from_xyxy,
    map_waste_type,
    object_counts,
    validate_detector_taxonomy,
)
from app.schemas import BoundingBox, Detection


class FakeDetector:
    def detect(self, image: Image.Image):
        return [
            Detection(
                class_id=0,
                label="plastic_bottle",
                confidence=0.8,
                bbox=BoundingBox(x=2, y=2, width=4, height=5),
                normalized_bbox=BoundingBox(x=0.2, y=0.2, width=0.4, height=0.5),
                waste_type="PLASTIC_WASTE",
            )
        ]


class FakeSegmenter:
    model_name = "sam2-test.pt"

    def segment(self, image, detections):
        mask = np.zeros((image.height, image.width), dtype=bool)
        mask[2:7, 2:6] = True
        return [mask]


class FakeRegistry:
    detector = FakeDetector()
    segmenter = FakeSegmenter()

    def load_once(self):
        return ModelHealth(detector_loaded=True, segmenter_loaded=True)


class EmptyDetector:
    def detect(self, image):
        return []


class EmptyRegistry:
    detector = EmptyDetector()
    segmenter = None

    def load_once(self):
        return ModelHealth(detector_loaded=True, segmenter_loaded=False)


class UnavailableRegistry:
    detector = None
    segmenter = None

    def load_once(self):
        return ModelHealth(detector_loaded=False, segmenter_loaded=False)


def jpeg_bytes(width=10, height=10):
    output = io.BytesIO()
    Image.new("RGB", (width, height), "white").save(output, "JPEG")
    return output.getvalue()


def test_analysis_reports_exact_counts_and_union_mask_coverage():
    result = analyze_image(jpeg_bytes(), Settings(), FakeRegistry(), True)
    assert result.total_detected_objects == 1
    assert result.object_counts[0].model_dump() == {"label": "plastic_bottle", "count": 1}
    assert result.visible_waste_coverage == pytest.approx(0.2)
    assert result.detections[0].mask_area_pixels == 20
    assert result.segmentation_confidence is None
    assert result.annotated_image_base64


def test_union_coverage_does_not_double_count_overlap():
    detections = [
        Detection(
            class_id=i,
            label="plastic_waste",
            confidence=0.9,
            bbox=BoundingBox(x=0, y=0, width=2, height=2),
            normalized_bbox=BoundingBox(x=0, y=0, width=0.5, height=0.5),
            waste_type="PLASTIC_WASTE",
        )
        for i in range(2)
    ]
    first = np.zeros((4, 4), dtype=bool)
    second = np.zeros((4, 4), dtype=bool)
    first[0:2, 0:2] = True
    second[1:3, 1:3] = True
    assert apply_masks(detections, [first, second], (4, 4)) == pytest.approx(7 / 16)


def test_bbox_normalization_preserves_detector_geometry():
    box, normalized = boxes_from_xyxy([20, 10, 70, 50], 200, 100)
    assert box.model_dump() == {"x": 20.0, "y": 10.0, "width": 50.0, "height": 40.0}
    assert normalized.model_dump() == {"x": 0.1, "y": 0.1, "width": 0.25, "height": 0.4}


def test_invalid_image_is_rejected():
    with pytest.raises(InvalidImageError):
        decode_image(b"not an image", Settings())


def test_large_image_is_resized_for_inference_without_modifying_source_bytes():
    source = jpeg_bytes(2000, 1000)
    result = decode_image(source, Settings(VISION_MAX_INFERENCE_SIDE=1280))
    assert result.size == (1280, 640)
    assert len(source) > 0


def test_object_counts_are_deterministic_and_sorted():
    detections = [
        Detection(
            class_id=1,
            label=label,
            confidence=0.5,
            bbox=BoundingBox(x=0, y=0, width=1, height=1),
            normalized_bbox=BoundingBox(x=0, y=0, width=1, height=1),
        )
        for label in ["plastic_cup", "plastic_bottle", "plastic_cup"]
    ]
    assert [item.model_dump() for item in object_counts(detections)] == [
        {"label": "plastic_bottle", "count": 1},
        {"label": "plastic_cup", "count": 2},
    ]


def test_custom_taxonomy_is_exact_and_maps_material_types():
    names = {
        0: "plastic_bottle",
        1: "plastic_bag",
        2: "plastic_cup",
        3: "metal_can",
        4: "cardboard",
        5: "glass_bottle",
    }
    assert validate_detector_taxonomy(names) == names
    assert map_waste_type("plastic_cup") == "PLASTIC_WASTE"
    assert map_waste_type("metal_can") == "METAL_WASTE"
    assert map_waste_type("cardboard") == "PAPER_WASTE"
    assert map_waste_type("glass_bottle") == "GLASS_WASTE"


def test_generic_coco_taxonomy_is_rejected():
    with pytest.raises(DetectorTaxonomyError):
        validate_detector_taxonomy({0: "person", 39: "bottle"})


def test_empty_detections_are_reported_without_fabricated_confidence():
    result = analyze_image(jpeg_bytes(), Settings(), EmptyRegistry(), False)
    assert result.total_detected_objects == 0
    assert result.object_counts == []
    assert result.detector_confidence is None
    assert result.visible_waste_coverage is None


def test_model_unavailable_fails_without_a_retry_loop():
    with pytest.raises(RuntimeError, match="Detector is unavailable"):
        analyze_image(jpeg_bytes(), Settings(), UnavailableRegistry(), False)
