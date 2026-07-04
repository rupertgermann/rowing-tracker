# FreeMoCap sidecar hardware smoke test

This is a manual, opt-in smoke test for a real FreeMoCap camera rig connected
through the Rowing Tracker sidecar. It is hardware-gated and must not block
normal CI when a camera rig, calibration, or live provider is unavailable.

The repository does not yet bundle a built-in live FreeMoCap camera provider.
The current live hardware path is an injected provider loaded with
`--freemocap-provider`. Synthetic mode and recorded-data mode are useful for
contract checks, but they do not count as the real camera-rig smoke test.

## Pass criteria

- The sidecar is installed from this repository, not public PyPI.
- A live FreeMoCap provider reports a ready rig on localhost with
  `schemaVersion = 2`, `contractVersion = 1`, a nonzero fps, the expected camera
  count, and a real calibration id.
- Rowing Tracker records a short session from `/mocap` with **Multi-camera
  sidecar** enabled.
- The stored capture is a sidecar capture: `source = sidecar`,
  `capturePerspective = sidecar-3d`, `coordinateSpace = world-mm-3d`, and it has
  pose frames.
- Replay opens from **View replay** and renders the captured sidecar session.
- Post-session analysis completes. `analysisMode` should be `pose-segmented`
  for an unlinked mocap capture or `csv-aligned` after linking to a rowing
  session. `strokeMetricCount` should be greater than zero; `faultCount` may be
  zero for a clean or short smoke capture.
- Raw video, raw 3D keypoints, and reconstructed body geometry stay local unless
  the operator explicitly uses a separate Rowing Tracker sharing/export path.

## Preconditions

- Python 3.10+.
- Rowing Tracker dependencies installed and the app able to run locally.
- A calibrated FreeMoCap-compatible camera rig.
- An operator-provided provider factory for the sidecar, for example
  `my_runtime_module:create_provider`. The provider owns camera discovery,
  calibration readiness, `start_session`, `stop_session`, and frame capture
  behind the stable ADR-0005 sidecar contract.
- Local port `8765` available, or `UserSettings.sidecarPort` configured to the
  port used by the sidecar.

## Install

Install the repo-local sidecar package from the repository root:

```bash
python3 -m venv .venv-sidecar
source .venv-sidecar/bin/activate
python -m pip install --upgrade pip
python -m pip install -e "sidecar[freemocap]"
rowing-tracker-sidecar --help
```

Do not use `pip install rowing-tracker-sidecar` unless a release note explicitly
says public publishing has happened.

## Start the live sidecar

Start the sidecar with the injected live provider:

```bash
rowing-tracker-sidecar \
  --source freemocap \
  --freemocap-provider my_runtime_module:create_provider \
  --port 8765
```

Leave the default local-only binding in place. Do not expose the sidecar port to
the network for this smoke test.

Verify health from another shell:

```bash
curl -s http://localhost:8765/health
```

Expected health shape:

```json
{
  "status": "ready",
  "fps": 30,
  "cameras": 3,
  "schemaVersion": 2,
  "contractVersion": 1,
  "sidecarVersion": "0.1.0",
  "source": "freemocap",
  "calibrationId": "rig-calibration-id"
}
```

Do not proceed if `status` is not `ready`, fps is zero, the camera count is
wrong, schema or contract versions are missing, or the calibration id is absent.

## Record through Rowing Tracker

1. Start the app locally:

   ```bash
   npm run dev
   ```

2. Open `http://localhost:3000/mocap` and sign in if needed.
3. Enable **Multi-camera sidecar**.
4. Wait for the app to show `Sidecar ready`.
5. Click **Start sidecar capture**.
6. Row a short controlled segment, usually 15 to 30 seconds.
7. Click **Stop**.
8. Open **View replay**.

The capture must go through Rowing Tracker. A sidecar-only recording, a
FreeMoCap GUI recording, or a recorded-data replay is not enough to pass this
hardware smoke test.

## Verify replay and analysis

Use the replay page and session details to verify:

- The replay opens without sidecar connection errors.
- The capture is not `record-only`.
- Session metadata identifies a sidecar capture with `sidecar-3d` perspective,
  schema v2, the expected camera count, and the provider calibration id.
- The pose stream contains frames for the rowed interval.
- Analysis completes with `analysisMode = pose-segmented` for an unlinked
  capture, or `analysisMode = csv-aligned` if the capture is linked to a rowing
  session.
- `strokeMetricCount > 0`. `faultCount = 0` is acceptable if no posture fault is
  detected.
- Reanalysis, if manually triggered from the session page, completes without
  changing the capture out of sidecar mode.

Record the sidecar command, provider identifier, sanitized `/health` response,
Rowing Tracker session id, replay result, and analysis summary in the issue or
release checklist. Do not attach raw video, raw frame dumps, or full 3D pose
streams to public issues.

## Privacy expectations

- The sidecar should bind to `127.0.0.1` by default.
- The sidecar should make no cloud calls.
- Rowing Tracker capture and replay should keep raw video and raw 3D pose frames
  local to the app storage configured for the operator.
- Cloud AI is not part of this smoke test. Do not enable or verify cloud AI with
  raw frames or reconstructable body geometry.
- If an operator later enables detailed AI sharing, only the documented Rowing
  Tracker AI payload tiers apply; that is separate from this hardware smoke
  procedure.

## CI status

This procedure is not an automated CI gate. CI should continue to use synthetic
and deterministic contract tests for hardware-free coverage. Mark the hardware
smoke test as skipped when no real rig and provider are available; do not fail a
normal PR or release check solely because the hardware smoke test was skipped.

An opt-in Playwright helper exercises the same Rowing Tracker UI path when a
ready sidecar is already running on port `8765`:

```bash
ROWING_TRACKER_SIDECAR_HARDWARE_SMOKE=1 npm run test:e2e:sidecar-smoke
```

By default the helper is skipped. For local wiring checks without hardware, it
can be run against the synthetic sidecar with
`ROWING_TRACKER_SIDECAR_HARDWARE_ALLOW_SYNTHETIC=1`; that does not count as the
real camera-rig smoke result.
