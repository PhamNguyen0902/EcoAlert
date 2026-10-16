"""Exercise actual HTTP health/detect/predict with real weights, optionally on a temporary local server."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import time

import httpx

BASE_DIR = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('images', nargs='+')
    parser.add_argument('--url', default='http://127.0.0.1:8001')
    parser.add_argument('--spawn-local', action='store_true')
    parser.add_argument('--output', default='reports/api-smoke.json')
    args = parser.parse_args()
    process, log = None, None
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    try:
        if args.spawn_local:
            args.url = 'http://127.0.0.1:18001'
            log = output.with_suffix('.server.log').open('w', encoding='utf-8')
            env = {k: v for k, v in os.environ.items() if k not in {'YOLO_MODEL_PATH', 'YOLO_MODELS_CONFIG'}}
            process = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '18001'],
                cwd=BASE_DIR, env=env, stdout=log, stderr=log,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
            deadline = time.monotonic() + 30
            while time.monotonic() < deadline:
                if process.poll() is not None: raise RuntimeError('Local server failed; inspect server log')
                try:
                    if httpx.get(args.url + '/health', timeout=1).status_code == 200: break
                except httpx.HTTPError:
                    pass
                time.sleep(.2)
            else: raise RuntimeError('Local server startup timed out')
        health = httpx.get(args.url + '/health', timeout=10).json()
        assert health['loaded_model_count'] == health['enabled_model_count'] == 2, health
        assert health['unique_class_count'] == 15, health
        requests = []
        for image in args.images:
            raw = Path(image).read_bytes()
            for endpoint in ['/detect', '/predict']:
                response = httpx.post(args.url + endpoint, files={'file': (Path(image).name, raw, 'image/jpeg')}, timeout=12)
                response.raise_for_status()
                result = response.json()
                assert not result['degraded'], result
                assert set(result['model_timings_ms']) == {'ecoalert_general', 'asian_waste'}
                for detection in result['detections']:
                    assert detection['model_id'] in {'ecoalert_general', 'asian_waste'}
                    assert detection['original_class_name'] and detection['sources']
                requests.append({'image': str(Path(image).resolve()), 'endpoint': endpoint, 'result': result})
        output.write_text(json.dumps({'url': args.url, 'health': health, 'requests': requests}, indent=2), encoding='utf-8')
        print(f'HTTP smoke passed: {len(requests)} requests; saved {output.resolve()}')
    finally:
        if process is not None:
            process.terminate()
            try: process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
        if log: log.close()


if __name__ == '__main__': main()
