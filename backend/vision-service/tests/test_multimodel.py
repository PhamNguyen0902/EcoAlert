import asyncio
from dataclasses import replace
from io import BytesIO
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.testclient import TestClient
from starlette.datastructures import Headers

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from routers.detection import infer, router
from services.detector import Detection, MultiModelDetector, DetectorUnavailableError, merge_detections
from services.settings import VisionSettings, ModelConfig


class Scalar:
    def __init__(self, value): self.value = value
    def item(self): return self.value


class Box:
    def __init__(self, class_id=0, confidence=0.9, coords=(0, 0, 20, 20)):
        self.cls, self.conf = Scalar(class_id), Scalar(confidence)
        self.xyxy = np.array([coords])


class FakeModel:
    def __init__(self, names, boxes=(), error=None):
        self.names, self.boxes, self.error, self.calls = names, boxes, error, []
    def predict(self, **kwargs):
        self.calls.append(kwargs)
        if self.error: raise self.error
        return [type('Result', (), {'boxes': self.boxes})()]


class DetectorTests(unittest.TestCase):
    def setUp(self):
        self.paths = [Path(__file__).resolve().parent / f'mock-{i}.pt' for i in range(2)]
        self.missing = set()
        original_is_file = Path.is_file
        file_check = patch.object(Path, 'is_file', lambda path: path not in self.missing if path in self.paths else original_is_file(path))
        file_check.start()
        self.addCleanup(file_check.stop)
        self.models = [FakeModel({0: 'plastic_bottle'}, [Box()]), FakeModel({0: 'Plastic'}, [Box()])]
        self.configs = (ModelConfig('first', self.paths[0], label_map={'plastic_bottle': 'plastic_bottle'}),
                        ModelConfig('second', self.paths[1], label_map={'Plastic': 'plastic'}))
        self.settings = VisionSettings(self.paths[0], .25, 640, 'cpu', 1_000_000, self.configs,
                                       {'plastic_bottle': 0, 'plastic': 13}, ('plastic',))
        self.image = np.zeros((40, 60, 3), np.uint8)

    def detector(self, settings=None):
        factory = lambda path: self.models[self.paths.index(Path(path))]
        detector = MultiModelDetector(settings or self.settings, factory)
        detector.load_model()
        return detector

    def test_load_once_and_global_ids(self):
        detector = self.detector()
        first = detector.runners[0].model
        detector.load_model()
        self.assertIs(detector.runners[0].model, first)
        self.assertEqual(detector.get_classes(), {0: 'plastic_bottle', 13: 'plastic'})
        self.assertEqual([r.classes for r in detector.runners], [{0: 'plastic_bottle'}, {0: 'Plastic'}])

    def test_missing_and_corrupt_weights_preserve_other_model(self):
        self.missing.add(self.paths[1])
        detector = self.detector()
        self.assertTrue(detector.is_ready())
        self.assertIn('FileNotFoundError', detector.runners[1].load_error)
        self.missing.clear()
        def factory(path):
            if Path(path) == self.paths[1]: raise RuntimeError('corrupt weight')
            return self.models[0]
        detector = MultiModelDetector(self.settings, factory)
        detector.load_model()
        self.assertTrue(detector.detect_image(self.image).degraded)
        self.assertIn('corrupt weight', detector.runners[1].load_error)

    def test_disabled_model_and_empty_registry(self):
        detector = self.detector(replace(self.settings, models=(self.configs[0], replace(self.configs[1], enabled=False))))
        self.assertEqual(detector.get_classes(), {0: 'plastic_bottle'})
        self.assertFalse(detector.detect_image(self.image).degraded)
        self.assertFalse(self.models[1].calls)
        detector = self.detector(replace(self.settings, models=()))
        self.assertFalse(detector.is_ready())
        with self.assertRaises(DetectorUnavailableError): detector.detect_image(self.image)

    def test_only_first_only_second_both_and_empty(self):
        detector = self.detector()
        for first, second, count in [(True, False, 1), (False, True, 1), (True, True, 2), (False, False, 0)]:
            with self.subTest(first=first, second=second):
                self.models[0].boxes = [Box()] if first else []
                self.models[1].boxes = [Box()] if second else []
                batch = detector.detect_image(self.image)
                self.assertEqual(len(batch.detections), count)
                self.assertEqual(set(batch.model_timings_ms), {'first', 'second'})
                self.assertEqual((batch.width, batch.height), (60, 40))

    def test_failure_during_inference_and_recovery(self):
        detector = self.detector()
        self.models[1].error = RuntimeError('failed')
        batch = detector.detect_image(self.image)
        self.assertTrue(batch.degraded)
        self.assertEqual(len(batch.detections), 1)
        self.assertEqual(detector.health_details()['status'], 'degraded')
        self.models[1].error = None
        self.assertFalse(detector.detect_image(self.image).degraded)
        self.models[0].error = self.models[1].error = RuntimeError('failed')
        with self.assertRaises(DetectorUnavailableError): detector.detect_image(self.image)

    def test_invalid_boxes_low_scores_and_many_objects(self):
        self.models[0].boxes = [Box(coords=(0, 0, 15, 15)), Box(coords=(25, 25, 35, 35)),
                                Box(confidence=.1), Box(coords=(10, 10, 5, 5)),
                                Box(coords=(float('nan'), 0, 10, 10)), Box(coords=(70, 50, 80, 60)),
                                Box(confidence=1.2), Box(coords=(-10, -10, 15, 15))]
        self.models[1].boxes = []
        batch = self.detector().detect_image(self.image)
        self.assertEqual(len(batch.detections), 3)
        self.assertEqual(batch.detections[-1].x1, 0)

    def test_thresholds_and_same_decoded_array(self):
        detector = self.detector(replace(self.settings, models=(self.configs[0], replace(self.configs[1], confidence=.7, image_size=320))))
        detector.detect_image(self.image)
        self.assertEqual([m.calls[-1]['conf'] for m in self.models], [.25, .7])
        self.assertEqual(self.models[1].calls[-1]['imgsz'], 320)
        self.assertIs(self.models[0].calls[-1]['source'], self.models[1].calls[-1]['source'])
        detector.detect_image(self.image, .8)
        self.assertEqual([m.calls[-1]['conf'] for m in self.models], [.8, .8])

    def test_merge_matches_at_most_one_instance_per_source_model(self):
        configs = (self.configs[0], replace(self.configs[1], label_map={'Plastic': 'plastic_bottle'}))
        self.models[1].boxes = [Box(coords=(0, 0, 20, 20)), Box(coords=(1, 0, 21, 20))]
        batch = self.detector(replace(self.settings, models=configs)).detect_image(self.image)
        self.assertEqual(len(batch.detections), 2)
        self.assertEqual(len(batch.detections[0].sources), 2)

    def test_synonym_mapping_dedup_keeps_priority_not_cross_model_score(self):
        configs = (self.configs[0], replace(self.configs[1], label_map={'Plastic': 'plastic_bottle'}))
        self.models[0].boxes = [Box(confidence=.5)]
        self.models[1].boxes = [Box(confidence=.99)]
        detector = self.detector(replace(self.settings, models=configs))
        batch = detector.detect_image(self.image)
        self.assertEqual(len(batch.detections), 1)
        self.assertEqual(batch.detections[0].confidence, .5)
        self.assertEqual(len(batch.detections[0].sources), 2)

    def test_unknown_labels_namespaced_and_stable(self):
        detector = self.detector(replace(self.settings, models=tuple(replace(c, label_map={}) for c in self.configs)))
        batch = detector.detect_image(self.image)
        self.assertTrue(all(d.needs_review for d in batch.detections))
        self.assertEqual(batch.detections[1].class_name, 'second:Plastic')
        self.assertNotEqual(batch.detections[0].class_id, batch.detections[1].class_id)

    def test_merge_preserves_distinct_nested_and_separate_instances(self):
        def d(model, name='bottle', coords=(0, 0, 20, 20)):
            return Detection(0, name, .9, *coords, model_id=model)
        a = d('a')
        for other in [d('b', 'cap', (0, 0, 5, 5)), d('b', 'plastic'), d('b', coords=(25, 25, 35, 35)), d('a')]:
            self.assertEqual(len(merge_detections([a, other], .6)), 2)
        self.assertEqual(len(merge_detections([a, d('b', coords=(5, 0, 25, 20))], .7)), 2)
        self.assertEqual(len(merge_detections([a, d('b', coords=(5, 0, 25, 20))], .5)), 1)

    def client(self, detector):
        app = FastAPI()
        app.state.detector = detector
        app.include_router(router)
        return TestClient(app)

    def upload(self, client, endpoint='/predict', data=None, mime='image/png', name='test.png'):
        return client.post(endpoint, files={'file': (name, data if data is not None else cv2.imencode('.png', self.image)[1].tobytes(), mime)})

    def test_api_contract_and_model2_reaches_legacy(self):
        self.models[0].boxes = []
        with self.client(self.detector()) as client:
            health = client.get('/health').json()
            self.assertEqual(health['unique_class_count'], 2)
            self.assertTrue(health['model_loaded'])
            result = self.upload(client).json()
            self.assertEqual(result['status'], 'ok')
            self.assertTrue(result['requiresManualReview'])
            self.assertEqual(result['detections'][0]['materialClass'], 'plastic')
            self.assertEqual(result['detections'][0]['model_id'], 'second')
            self.assertEqual(result['detections'][0]['suggestedCategory'], 'other')
            modern = self.upload(client, '/detect').json()
            self.assertTrue(modern['success'])
            self.assertEqual(modern['count'], 1)
            self.assertEqual(modern['detections'][0]['class_id'], 13)
            self.assertEqual(modern['detections'][0]['bounding_box']['x2'], 20)

    def test_single_model_legacy_values(self):
        with self.client(self.detector(replace(self.settings, models=(self.configs[0],)))) as client:
            result = self.upload(client).json()
            self.assertEqual(result['status'], 'ok')
            self.assertFalse(result['requiresManualReview'])
            self.assertEqual(result['detections'][0]['materialClass'], 'plastic_bottle')
            self.assertEqual(result['detections'][0]['suggestedCategory'], 'illegal_dumping')
            self.assertEqual(self.upload(client, '/detect').json()['detections'][0]['class_id'], 0)

    def test_partial_empty_requires_error_and_all_failed_503(self):
        self.models[0].boxes = []
        self.models[1].error = RuntimeError('failed')
        with self.client(self.detector()) as client:
            result = self.upload(client).json()
            self.assertEqual(result['status'], 'error')
            self.assertTrue(result['degraded'])
            self.models[0].error = RuntimeError('failed')
            self.assertEqual(self.upload(client).status_code, 503)

    def test_empty_success_no_detection(self):
        for model in self.models: model.boxes = []
        with self.client(self.detector()) as client:
            self.assertEqual(self.upload(client).json()['status'], 'no_detection')

    def test_image_validation_and_query(self):
        detector = self.detector()
        with self.client(detector) as client:
            self.assertEqual(self.upload(client, data=b'').status_code, 400)
            self.assertEqual(self.upload(client, data=b'bad').status_code, 400)
            self.assertEqual(self.upload(client, mime='text/plain').status_code, 415)
            self.assertEqual(self.upload(client, '/detect?confidence=2').status_code, 422)
            detector.settings = replace(detector.settings, max_upload_bytes=1)
            self.assertEqual(self.upload(client).status_code, 413)
            detector.settings = replace(detector.settings, max_upload_bytes=1_000_000, max_image_pixels=10)
            self.assertEqual(self.upload(client).status_code, 413)

    def test_timeout_retains_admission_and_health_responds(self):
        detector = self.detector(replace(self.settings, inference_timeout=.01))
        gate = threading.Event()
        original = self.models[0].predict
        def slow(**kwargs):
            gate.wait(2)
            return original(**kwargs)
        self.models[0].predict = slow
        async def scenario():
            def upload():
                return UploadFile(BytesIO(cv2.imencode('.png', self.image)[1].tobytes()), filename='x.png', headers=Headers({'content-type': 'image/png'}))
            try:
                with self.assertRaises(HTTPException) as timed:
                    await infer(upload(), None, detector)
                self.assertEqual(timed.exception.status_code, 504)
                with self.assertRaises(HTTPException) as busy:
                    await infer(upload(), None, detector)
                self.assertEqual(busy.exception.status_code, 503)
                self.assertTrue(detector.is_ready())
            finally:
                gate.set()
                for _ in range(100):
                    if not detector.admission.locked(): break
                    await asyncio.sleep(.01)
            self.assertFalse(detector.admission.locked())
        asyncio.run(scenario())


class SettingsTests(unittest.TestCase):
    def test_registry_and_legacy_mode(self):
        with patch.dict(os.environ, {}, clear=True):
            settings = VisionSettings.from_environment()
            self.assertEqual(len(settings.models), 2)
        with patch.dict(os.environ, {'YOLO_MODEL_PATH': 'models/BEST_ECOALERT_YOLO11N.pt'}, clear=True):
            self.assertEqual(len(VisionSettings.from_environment().models), 1)

    def test_bad_configuration(self):
        for data in [
                {'canonical_ids': {'a': 0, 'b': 0}, 'models': []},
                {'models': [{'id': 'same', 'path': 'x'}, {'id': 'same', 'path': 'y'}]},
                {'models': [{'id': 'x', 'path': 'x', 'confidence': 0}]},
                {'models': [{'id': 'x', 'path': 'x', 'label_map': {'a': 'unknown'}}]},
        ]:
            with patch.object(Path, 'read_text', return_value=json.dumps(data)), patch.dict(os.environ, {}, clear=True):
                with self.assertRaises(ValueError): VisionSettings.from_environment()


@unittest.skipUnless(os.getenv('VISION_REAL_MODELS') == '1', 'Set VISION_REAL_MODELS=1 for actual weight smoke test')
class RealModelsTests(unittest.TestCase):
    def test_real_weights_and_inference(self):
        with patch.dict(os.environ, {}, clear=True):
            settings = VisionSettings.from_environment()
        if not all(m.path.is_file() for m in settings.models): self.skipTest('Local weights are absent')
        detector = MultiModelDetector(settings)
        detector.load_model()
        self.assertTrue(all(r.model is not None for r in detector.runners))
        self.assertEqual(list(detector.runners[0].classes.values()),
                         ['plastic_bottle', 'plastic_bag', 'plastic_cup', 'metal_can', 'cardboard', 'glass_bottle'])
        self.assertEqual(list(detector.runners[1].classes.values()),
                         ['Animal Waste', 'Construction Waste', 'Garbage Bag', 'Glass', 'Metal', 'Organic', 'Paper', 'Plastic', 'waste'])
        self.assertEqual(len(detector.get_classes()), 15)
        batch = detector.detect_image(np.zeros((320, 480, 3), np.uint8))
        self.assertEqual(set(batch.model_timings_ms), {'ecoalert_general', 'asian_waste'})
        self.assertFalse(batch.degraded)


if __name__ == '__main__':
    unittest.main()
