# Running the sidecar tracer locally

This guide covers how to run the minimal freemocap sidecar integration for local development and testing.

## Prerequisites

- Python 3.10+ with pip
- `rowing-tracker-sidecar` PyPI package (or the mock server below)
- The app running locally (`npm run dev`)

## Option A — real freemocap sidecar

```bash
pip install rowing-tracker-sidecar
rowing-tracker-sidecar --port 8765
```

The sidecar exposes:
- `ws://localhost:8765/pose-stream` — streams `KeypointFrame` JSON
- `GET http://localhost:8765/health` — returns `{ status, fps, cameras, schemaVersion }`
- `POST http://localhost:8765/session/start` — arms capture
- `POST http://localhost:8765/session/stop` — flushes and closes

## Option B — minimal mock server (for UI/API dev without hardware)

```python
#!/usr/bin/env python3
"""Minimal sidecar mock — runs without freemocap or cameras."""
import asyncio, json, math, random, time
import websockets
from http.server import BaseHTTPRequestHandler, HTTPServer
import threading

PORT = 8765
FPS = 30

def health():
    return {"status": "ready", "fps": FPS, "cameras": 3, "schemaVersion": 2}

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            body = json.dumps(health()).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)
    def do_POST(self):
        body = json.dumps({"sessionId": "mock-session", "calibrationId": "mock-calib"}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body)
    def log_message(self, *a): pass

async def pose_stream(websocket):
    frame_index = 0
    while True:
        ts = time.time() * 1000
        keypoints = [
            {"index": i, "x": 50 + math.sin(i * 0.5) * 200,
             "y": 500 + math.cos(i * 0.3 + frame_index * 0.05) * 300,
             "z": 1000 + random.gauss(0, 20),
             "confidence": 0.85 + random.gauss(0, 0.05)}
            for i in range(33)
        ]
        frame = {"frameIndex": frame_index, "timestampMs": ts,
                 "keypoints": keypoints,
                 "quality": {"trackedCount": 33, "meanConfidence": 0.85,
                             "reprojectionErrorMm": 1.2, "cameraCount": 3}}
        try:
            await websocket.send(json.dumps(frame))
        except websockets.exceptions.ConnectionClosed:
            break
        frame_index += 1
        await asyncio.sleep(1 / FPS)

async def main():
    http = HTTPServer(("", PORT), Handler)
    threading.Thread(target=http.serve_forever, daemon=True).start()
    print(f"Sidecar mock running on port {PORT}")
    async with websockets.serve(pose_stream, "localhost", PORT, path="/pose-stream"):
        await asyncio.Future()

asyncio.run(main())
```

Save as `scripts/sidecar-mock.py` and run:

```bash
pip install websockets
python scripts/sidecar-mock.py
```

## Using the sidecar in the app

1. Start the sidecar (real or mock) on port 8765.
2. Open the app at `http://localhost:3000/mocap`.
3. Check **Multi-camera sidecar** — the UI polls health and shows "Sidecar ready — 3 cameras, 30 fps".
4. Click **Start mocap session** — the app creates a session with `source=sidecar`, `capturePerspective=sidecar-3d`.
5. The session detail page opens as normal. Posture faults from sidecar-3D will appear with `severity=pending` for the three new fault types until thresholds are defined.

## API endpoints added

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/mocap/sessions/:id/sidecar/connect` | Verify sidecar health and arm capture |
| `GET`  | `/api/mocap/sessions/:id/sidecar/status` | Proxy to `localhost:8765/health` |

Both require an authenticated session and a MocapSession in `capturing` status.

## PoseFrameStream v2 blob format

v2 blobs are written when `source=sidecar`. Key differences from v1:

- `keypointSchemaVersion = 2` in header
- Each keypoint is `[x, y, z, confidence]` (4 × Float32 per keypoint, vs 3 × Float32 in v1)
- Header byte 20: `coordinateSpace` (0 = normalized-2d, 1 = world-mm-3d)
- Header byte 21: `cameraCount`
- v1 blobs are unchanged and remain readable

## Running the new tests

```bash
npx tsx --test tests/sidecarTracer.test.ts
```

Expected: 13 tests pass.
