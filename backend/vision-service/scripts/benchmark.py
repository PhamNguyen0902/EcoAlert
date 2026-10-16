"""Real, sequential CPU benchmarks; no accuracy metrics without unified ground truth.

python scripts/benchmark.py path/to/image.jpg --runs 3 --output reports/benchmark.json
Each mode runs in a separate process so peak RSS does not accumulate other modes' weights.
"""
import argparse
from dataclasses import asdict, replace
import hashlib
import json
from pathlib import Path
import platform
import subprocess
import sys
from time import perf_counter

import cv2
import numpy as np
import psutil
import torch
import ultralytics

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))
from services.detector import MultiModelDetector
from services.settings import VisionSettings


def worker(args):
    settings = VisionSettings.from_environment()
    if args.mode != 'all':
        settings = replace(settings, models=tuple(replace(m, enabled=m.id == args.mode) for m in settings.models))
    detector = MultiModelDetector(settings)
    detector.load_model()
    if not detector.is_ready(): raise RuntimeError('No benchmark models loaded')
    detector.detect_image(np.zeros((640, 640, 3), np.uint8))  # Explicit warmup, excluded from samples.
    images = []
    for path in args.images:
        raw = Path(path).read_bytes()
        samples = []
        for _ in range(args.runs):
            started = perf_counter()
            image = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
            if image is None: raise ValueError(f'Cannot decode {path}')
            batch = detector.detect_image(image)
            samples.append({'total_ms_including_decode': (perf_counter() - started) * 1000, **asdict(batch)})
        images.append({'path': str(Path(path).resolve()), 'sha256': hashlib.sha256(raw).hexdigest(), 'samples': samples})
    memory = psutil.Process().memory_info()
    peak = getattr(memory, 'peak_wset', None)
    if peak is None:
        import resource
        peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * (1 if sys.platform == 'darwin' else 1024)
    return {'mode': args.mode, 'health': detector.health_details(), 'images': images,
            'peak_process_rss_mb': peak / 1024 ** 2,
            'weights': {r.config.id: {'bytes': r.config.path.stat().st_size,
                        'sha256': hashlib.sha256(r.config.path.read_bytes()).hexdigest()} for r in detector.runners if r.model is not None}}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('images', nargs='+')
    parser.add_argument('--runs', type=int, default=3)
    parser.add_argument('--output', default='reports/benchmark.json')
    parser.add_argument('--mode', help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.runs <= 0: parser.error('--runs must be positive')
    if args.mode:
        print(json.dumps(worker(args)))
        return
    settings = VisionSettings.from_environment()
    modes = [m.id for m in settings.models if m.enabled] + ['all']
    results = []
    for mode in modes:
        process = subprocess.run([sys.executable, str(Path(__file__).resolve()), *args.images,
                                  '--runs', str(args.runs), '--mode', mode], capture_output=True, text=True)
        if process.returncode: raise RuntimeError(process.stderr + process.stdout)
        # YOLO can emit informational messages before the final JSON line.
        results.append(json.loads(process.stdout.strip().splitlines()[-1]))
    all_models = results[-1]['health']['models']
    supported = [set(m['normalized_classes'].values()) for m in all_models if m['loaded']]
    union = set().union(*supported)
    report = {'environment': {'python': platform.python_version(), 'torch': torch.__version__,
              'ultralytics': ultralytics.__version__, 'platform': platform.platform(), 'cpu_threads': torch.get_num_threads()},
              'unique_class_count': len(union), 'shared_canonical_class_count': sum(sum(c in s for s in supported) > 1 for c in union),
              'accuracy_metrics': None, 'accuracy_note': 'No unified ground truth; no mAP/precision/recall claim.', 'results': results}
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(f'Saved {output.resolve()}')
    for result in results:
        latencies = [s['total_ms_including_decode'] for image in result['images'] for s in image['samples']]
        print(f"{result['mode']}: mean={np.mean(latencies):.1f}ms peak RSS={result['peak_process_rss_mb']:.1f}MiB")


if __name__ == '__main__': main()
