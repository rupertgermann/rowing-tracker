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
  --freemocap-data /path/to/skeleton_3d.npy \
  --camera-count 3 \
  --fps 30 \
  --port 8765
```

Process an existing FreeMoCap recording folder headlessly, then stream the
generated `output_data` through the same contract:

```bash
python -m pip install -e "sidecar[freemocap]"
rowing-tracker-sidecar \
  --source freemocap \
  --freemocap-recording /path/to/freemocap/recording-folder \
  --freemocap-calibration-toml /path/to/calibration.toml \
  --camera-count 3 \
  --fps 30 \
  --port 8765
```

This uses FreeMoCap's batch/headless recording processor with Blender export,
notebook generation, and tqdm progress disabled. It does not claim live
camera-runtime support; use `--freemocap-provider` for operator-owned live
camera adapters.

The service binds to `127.0.0.1` by default and exposes:

- `GET /health`
- `POST /session/start`
- `POST /session/stop`
- `ws://localhost:<port>/pose-stream`

`GET /health` includes `schemaVersion`, `contractVersion`, and
`sidecarVersion`. The app currently accepts schema version `2` and contract
version `1`; missing or incompatible versions are rejected before capture
starts.
When `POST /session/start` returns `409`, its JSON body repeats the same health
fields plus diagnostics so operators can see the camera count, fps, source,
calibration id, and version state that blocked capture.

Synthetic mode is hardware-free and intended for development and CI. FreeMoCap
recorded-data mode supports JSON, JSONL, and NPY `(frames, 33, 4)` sources.
Directory mode also loads known FreeMoCap reprojection-error NPY files and maps
finite per-frame means into `quality.reprojection_error_mm` when present.
Rowing Tracker records values above 50 mm as `high-reprojection-error` quality
flags on the captured v2 frames.
Selecting `--source freemocap` without `--freemocap-data`,
`--freemocap-recording`, or `--freemocap-provider` fails readiness with a clear
diagnostic instead of pretending the camera rig is ready. The default FreeMoCap
runtime path probes for the optional `freemocap` package, but current upstream
FreeMoCap releases expose stable batch/headless processing and recorded outputs,
not a supported one-call live calibrated camera API for this sidecar to invoke
directly.

Advanced live runtime adapters can be loaded with:

```bash
rowing-tracker-sidecar \
  --source freemocap \
  --freemocap-provider my_runtime_module:create_provider
```

The provider owns real camera health, session start/stop, calibration ids, and
frame capture behind the stable ADR-0005 sidecar contract. Treat SkellyCam,
SkellyTracker, calibration, and live triangulation glue as provider-owned
runtime code until upstream exposes a stable live API.

Run the focused release gate before changing package or contract behavior:

```bash
npm run test:sidecar
```

The sidecar makes no cloud calls and is local-only by default. Keep FreeMoCap as
a separate local process when adding live camera runtime support.
