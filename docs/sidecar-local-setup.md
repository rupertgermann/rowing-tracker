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

The optional `sidecar[freemocap]` extra follows current FreeMoCap releases and
requires Python 3.10 through 3.12. Synthetic mode and recorded-data mode can run
without that extra.

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
  "contractVersion": 1,
  "sidecarVersion": "0.1.0",
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
  --freemocap-data /path/to/freemocap/output/skeleton_3d.npy \
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
  `skeleton_3d.npy`, `3dData_numFrames_numTrackedPoints_spatialXYZ.npy`, or
  `mediapipe_body_3d_xyz.npy`

When a directory also contains
`3dData_numFrames_numTrackedPoints_reprojectionError.npy` or
`3dData_numCams_numFrames_numTrackedPoints_reprojectionError.npy`, the sidecar
maps the per-frame finite mean into `quality.reprojection_error_mm`.
Rowing Tracker preserves that signal in captured v2 frame quality flags as
`high-reprojection-error` when it exceeds 50 mm.

If you select `--source freemocap` without `--freemocap-data` or
`--freemocap-provider`, the sidecar probes for the optional FreeMoCap Python
package and then fails closed with `status: "error"`. Missing-package
diagnostics explain how to install `sidecar[freemocap]`; installed-package
diagnostics explain that upstream FreeMoCap exposes batch/headless processing
and recorded outputs, but not a supported one-call live calibrated camera API
for this sidecar to invoke directly.

## FreeMoCap live-runtime provider hook

The sidecar can load a live runtime adapter with `--freemocap-provider`:

```bash
rowing-tracker-sidecar \
  --source freemocap \
  --freemocap-provider my_runtime_module:create_provider \
  --port 8765
```

The provider factory must return an object that owns real rig health,
`start_session`, `stop_session`, and frame capture. The sidecar keeps the
localhost HTTP/WebSocket contract stable while the provider owns camera/runtime
details. If the provider cannot be loaded or the runtime cannot start/stop, the
sidecar reports structured diagnostics instead of pretending capture is ready.

The repository includes fake-provider contract coverage for this boundary.
Treat SkellyCam, SkellyTracker, calibration, and live triangulation glue as
provider-owned runtime code until upstream exposes a stable live API.

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

If `/session/start` refuses capture with `409`, the response repeats the
readiness fields from `/health`: `status`, `fps`, `cameras`, `schemaVersion`,
`contractVersion`, `sidecarVersion`, `source`, `calibrationId`, and
`diagnostics`. Use that body in logs and bug reports; it is the source of truth
for why the sidecar would not arm capture.

The app also proxies lifecycle calls through:

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/mocap/sessions/:id/sidecar/connect` | Verify sidecar health and arm capture |
| `GET` | `/api/mocap/sessions/:id/sidecar/status` | Proxy sidecar health |
| `POST` | `/api/mocap/sessions/:id/sidecar/stop` | Stop the sidecar session |

All app routes require an authenticated session and an owned `MocapSession`.
`connect` also requires the app-side session to be in `capturing` status, the
sidecar schema to match `keypointSchemaVersion = 2`, and the sidecar contract to
match `contractVersion = 1`.

## Version compatibility

`/health` reports both the frame schema and sidecar package contract:

- `schemaVersion`: pose-frame payload schema. Rowing Tracker currently accepts
  only `2` for `sidecar-3d`.
- `contractVersion`: HTTP/WebSocket contract version. Rowing Tracker currently
  accepts only `1`.
- `sidecarVersion`: installed Python package version, stored in new app-side
  captures as part of `captureModelVersion`.

If any of these fields are missing or incompatible, the app refuses capture
before the Start button is enabled.

## Troubleshooting

- **`pip install rowing-tracker-sidecar` cannot find a package**: install from
  this repository with `python -m pip install -e sidecar`.
- **`Sidecar not reachable on port 8765`**: start the sidecar, check the port,
  and confirm `curl http://localhost:8765/health` works.
- **Wrong port**: run the sidecar with `--port <port>` and configure
  `UserSettings.sidecarPort` to the same value.
- **`status: "error"` with FreeMoCap diagnostics**: read the first diagnostic
  line. The optional package may be missing, the installed package may not
  expose a supported live API, or the data path may be unreadable. Use
  `--freemocap-data` for recorded output or `--freemocap-provider` for a live
  camera adapter.
- **Incompatible schema**: Rowing Tracker expects schema version `2`.
- **Missing cameras or calibration**: health should remain `initializing` or
  `error`; do not start capture until it is `ready`.
- **`/session/start` returns `409`**: inspect the response body. It mirrors the
  health payload so camera count, fps, source, version, calibration, and
  diagnostic details are still visible even when capture cannot arm.
- **Low or zero fps**: reduce camera load, check USB bandwidth, and verify the
  source reports a stable fps before recording.
- **Stream errors during capture**: stop the app capture, stop the sidecar, and
  restart both. The sidecar logs include session start/stop and WebSocket
  connect/disconnect events.

## Hardware-gated smoke test

For the manual, opt-in real camera-rig procedure, see
[FreeMoCap sidecar hardware smoke test](sidecar-hardware-smoke.md). It uses the
current injected `--freemocap-provider` live path, records through Rowing
Tracker, verifies replay and analysis output, and must not block normal CI when
hardware is unavailable.

## Privacy and licensing

The sidecar binds to `127.0.0.1` by default and makes no cloud calls. Raw video,
raw keypoints, and reconstructed body geometry stay local unless the user later
chooses separate Rowing Tracker sharing settings.

FreeMoCap is AGPL-licensed. Keep it as a separate local process and document the
dependency boundary before distributing bundled artifacts.

## Tests

```bash
npm run test:sidecar
npx tsx --test tests/sidecarCliContract.test.ts
npx tsx --test tests/sidecarPackageInstall.test.ts
npx tsx --test tests/sidecarTracer.test.ts
npx tsx --test tests/freemocapSidecarSource.test.ts
npx tsx --test tests/sidecarMockContract.test.ts
npm run test:e2e -- tests/e2e/mocap-capture.spec.ts
```

The GitHub Actions `Sidecar release gate` workflow runs the install/startup
check and `npm run test:sidecar` for PRs that touch the sidecar contract,
package, app-side sidecar client, or focused sidecar tests.
