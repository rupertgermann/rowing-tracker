# Rowing Tracker Sidecar

Local sidecar service for Rowing Tracker multi-camera mocap capture. It exposes
the ADR-0005 localhost contract expected by the app and streams schema-v2
`sidecar-3d` pose frames.

Install from this repository:

```bash
python3 -m venv .venv-sidecar
source .venv-sidecar/bin/activate
python -m pip install -e sidecar
```

Run the deterministic hardware-free source:

```bash
rowing-tracker-sidecar --source synthetic --port 8765
```

Run recorded FreeMoCap-style output through the same live contract:

```bash
rowing-tracker-sidecar \
  --source freemocap \
  --freemocap-data /path/to/mediapipe_body_3d_xyz.npy \
  --camera-count 3 \
  --fps 30 \
  --port 8765
```

The service binds to `127.0.0.1` by default and exposes:

- `GET /health`
- `POST /session/start`
- `POST /session/stop`
- `ws://localhost:<port>/pose-stream`

Synthetic mode is hardware-free and intended for development and CI. FreeMoCap
recorded-data mode supports JSON, JSONL, and NPY `(frames, 33, 4)` sources.
Selecting `--source freemocap` without `--freemocap-data` fails readiness with a
clear diagnostic instead of pretending the camera rig is ready.

The sidecar makes no cloud calls and is local-only by default.
