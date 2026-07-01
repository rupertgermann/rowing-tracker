# Running the FreeMoCap sidecar locally

This guide covers the Rowing Tracker sidecar used by **Multi-camera sidecar**
capture. The sidecar is a local Python process that exposes the ADR-0005
HTTP/WebSocket contract on localhost.

The package is owned by this repository. It is not currently published on
public PyPI, so do not install it with `pip install rowing-tracker-sidecar`
unless a release note says public publishing has happened.

## Prerequisites

- Python 3.10+ with `venv`
- The app running locally with `npm run dev`

## Install from this repository

```bash
python3 -m venv .venv-sidecar
source .venv-sidecar/bin/activate
python -m pip install --upgrade pip
python -m pip install -e sidecar
```

Verify the command is available:

```bash
rowing-tracker-sidecar --help
```

## Synthetic mode

Synthetic mode runs without cameras or FreeMoCap. Use it for local UI/API
development and CI-style contract checks.

```bash
rowing-tracker-sidecar --source synthetic --port 8765
```

Expected health response:

```bash
curl http://localhost:8765/health
```

```json
{
  "status": "ready",
  "fps": 30.0,
  "cameras": 3,
  "schemaVersion": 2,
  "source": "synthetic",
  "calibrationId": "synthetic-calibration"
}
```

## FreeMoCap recorded-data mode

Recorded-data mode streams FreeMoCap-style 3D output through the same live
sidecar contract. This is useful for validating the Rowing Tracker integration
against real `world-mm-3d` coordinates before a live camera runtime is wired in.

```bash
rowing-tracker-sidecar \
  --source freemocap \
  --freemocap-data /path/to/freemocap/output/mediapipe_body_3d_xyz.npy \
  --camera-count 3 \
  --fps 30 \
  --port 8765
```

Supported input formats:

- `.json` or `.jsonl` containing ADR-0005-style keypoint frames or raw
  `(frames, 33, 4)` arrays
- `.npy` containing `(frames, 33, 4)` FreeMoCap body keypoints; this requires
  `numpy` in the sidecar environment
- a directory containing a known FreeMoCap output file such as
  `mediapipe_body_3d_xyz.npy`

If you select `--source freemocap` without `--freemocap-data`, health reports
`status: "error"` with diagnostics. That failure is intentional: the current
repo-owned sidecar has a stable adapter boundary for FreeMoCap data, while live
camera capture depends on the FreeMoCap runtime available in the user's
environment.

## Using the sidecar in the app

1. Start the sidecar on port `8765`.
2. Start Rowing Tracker with `npm run dev`.
3. Open `http://localhost:3000/mocap`.
4. Check **Multi-camera sidecar**.
5. Wait for `Sidecar ready - 3 cameras, 30 fps`.
6. Click **Start sidecar capture**.
7. Row the session.
8. Click **Stop** and open **View replay**.

Sidecar capture skips browser catch/finish calibration. Calibration traceability
comes from the sidecar's `calibrationId`.

## Local sidecar contract

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Report readiness, fps, camera count, schema version, source, calibration id, and diagnostics |
| `POST` | `/session/start` | Arm capture and return `{ sessionId, calibrationId }` |
| `POST` | `/session/stop` | Stop capture and flush/close the stream |
| `WS` | `/pose-stream` | Stream one schema-v2 `sidecar-3d` keypoint frame per message |

The app also proxies lifecycle calls through:

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/mocap/sessions/:id/sidecar/connect` | Verify sidecar health and arm capture |
| `GET` | `/api/mocap/sessions/:id/sidecar/status` | Proxy sidecar health |
| `POST` | `/api/mocap/sessions/:id/sidecar/stop` | Stop the sidecar session |

All app routes require an authenticated session and an owned `MocapSession`.
`connect` also requires the app-side session to be in `capturing` status and the
sidecar schema to match `keypointSchemaVersion = 2`.

## Troubleshooting

- **`pip install rowing-tracker-sidecar` cannot find a package**: install from
  this repository with `python -m pip install -e sidecar`.
- **`Sidecar not reachable on port 8765`**: start the sidecar, check the port,
  and confirm `curl http://localhost:8765/health` works.
- **Wrong port**: run the sidecar with `--port <port>` and configure
  `UserSettings.sidecarPort` to the same value.
- **`status: "error"` with FreeMoCap diagnostics**: the FreeMoCap source is not
  configured or the data path cannot be read. Pass `--freemocap-data`.
- **Incompatible schema**: Rowing Tracker expects schema version `2`.
- **Missing cameras or calibration**: health should remain `initializing` or
  `error`; do not start capture until it is `ready`.
- **Low or zero fps**: reduce camera load, check USB bandwidth, and verify the
  source reports a stable fps before recording.
- **Stream errors during capture**: stop the app capture, stop the sidecar, and
  restart both. The sidecar logs include session start/stop and WebSocket
  connect/disconnect events.

## Hardware-gated smoke test

Use this manual path when a real camera rig and FreeMoCap output are available:

1. Capture or locate a FreeMoCap `(frames, 33, 4)` output file.
2. Start the sidecar in recorded-data mode with that file.
3. Confirm `/health` is `ready`, `schemaVersion` is `2`, and `cameras` matches
   the rig.
4. Record a Rowing Tracker sidecar session from `/mocap`.
5. Stop capture and open the replay.
6. Confirm the stored session uses `source=sidecar`,
   `capturePerspective=sidecar-3d`, has pose frames, and runs post-session
   analysis.

This smoke test is hardware/data-gated and should not block normal CI.

## Privacy and licensing

The sidecar binds to `127.0.0.1` by default and makes no cloud calls. Raw video,
raw keypoints, and reconstructed body geometry stay local unless the user later
chooses separate Rowing Tracker sharing settings.

FreeMoCap is AGPL-licensed. Keep it as a separate local process and document the
dependency boundary before distributing bundled artifacts.

## Tests

```bash
npx tsx --test tests/sidecarCliContract.test.ts
npx tsx --test tests/sidecarPackageInstall.test.ts
npx tsx --test tests/sidecarTracer.test.ts
npx tsx --test tests/freemocapSidecarSource.test.ts
npx tsx --test tests/sidecarMockContract.test.ts
npm run test:e2e -- tests/e2e/mocap-capture.spec.ts
```
