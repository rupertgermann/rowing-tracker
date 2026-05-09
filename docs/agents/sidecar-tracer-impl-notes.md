# Sidecar tracer — implementation notes for AFK agent

Goal: build a minimal but end-to-end working freemocap sidecar integration. "Minimal tracer" means: the app can connect to a running sidecar, receive pose frames, store them as v2 blobs, and run the existing analysis pipeline on them.

## Prerequisites (must exist before this work starts)

- Phase 1 (browser path) is complete and merged.
- `PoseFrameStream` v1 blob reader/writer is in production.
- Camera readiness gate (`/api/mocap/sessions/:id/readiness`) is implemented.
- All v1 fault rules pass their test suite.

## Scope of this tracer

1. Sidecar connection (WebSocket + health poll)
2. `PoseFrameStream` v2 blob format (extend existing writer)
3. Coordinate-space adapter (world-mm-3d → pipeline-compatible units)
4. The three new sidecar-3d faults wired up (detection logic deferred — wire the rule slot, emit "detection pending" if rule not implemented)
5. `MocapSession.source = "sidecar"` flow through existing UI

Out of scope for tracer: Charuco calibration UI, multi-camera setup wizard, 3D skeleton overlay in replay.

## File locations to touch

```
src/lib/mocap/
  pose-frame-stream.ts        # blob reader/writer — add v2 support
  pose-capture-source.ts      # add FreemocapSidecarSource class
  posture-metrics.ts          # add coordinateSpaceAdapter(), sidecar-3d branch
  posture-fault-detector.ts   # add 3 new fault rule stubs
  sidecar-client.ts           # NEW: WebSocket client + health poller

src/app/api/mocap/
  sessions/[id]/sidecar/
    connect/route.ts          # NEW: POST to trigger sidecar connection
    status/route.ts           # NEW: GET sidecar health → proxied to localhost:8765/health

prisma/schema.prisma          # add calibrationId String? to MocapSession
src/app/(app)/mocap/
  capture/page.tsx            # add "Use sidecar" toggle; show sidecar-3d quality fields
```

## Step-by-step

### Step 1 — Extend blob format to v2

In `pose-frame-stream.ts`:
- Blob header struct: add `coordinateSpace: u8` (0 = normalized-2d, 1 = world-mm-3d), `cameraCount: u8`, `calibrationIdLength: u8 + bytes`.
- Frame struct: add optional `z: float32` per keypoint when `coordinateSpace === 1`. Flag bit in per-frame flags byte (bit 3, currently unused).
- Reader: branch on `keypointSchemaVersion`. v1 readers get `z = undefined` for every keypoint.
- Writer: accept optional `coordinateSpace` param; default `normalized-2d` keeps v1 behavior.

### Step 2 — Sidecar WebSocket client

New file `src/lib/mocap/sidecar-client.ts`:

```typescript
const DEFAULT_PORT = 8765;

export async function checkSidecarHealth(port = DEFAULT_PORT): Promise<SidecarHealth> {
  const res = await fetch(`http://localhost:${port}/health`);
  if (!res.ok) throw new Error("sidecar not reachable");
  return res.json();
}

export function connectSidecarStream(
  port: number,
  onFrame: (frame: KeypointFrame) => void,
  onError: (err: Error) => void
): () => void {
  const ws = new WebSocket(`ws://localhost:${port}/pose-stream`);
  ws.onmessage = (e) => onFrame(JSON.parse(e.data) as KeypointFrame);
  ws.onerror = () => onError(new Error("sidecar WebSocket error"));
  return () => ws.close();
}
```

`FreemocapSidecarSource` in `pose-capture-source.ts` wraps this client and emits `KeypointFrame` objects into the existing pipeline. It sets `coordinateSpace = "world-mm-3d"` on the blob writer.

### Step 3 — Coordinate space adapter

In `posture-metrics.ts`, before running any metric calculation:

```typescript
function toNormalizedProjection(keypoint: Keypoint, sessionBounds: SessionBounds): { x: number; y: number } {
  if (keypoint.z === undefined) return { x: keypoint.x, y: keypoint.y }; // v1 pass-through
  // world-mm-3d: project to side-view plane (x ignored, use y and z as the 2D plane)
  // SessionBounds = { yMin, yMax, zMin, zMax } computed from first N frames of the session
  return {
    x: (keypoint.z - sessionBounds.zMin) / (sessionBounds.zMax - sessionBounds.zMin),
    y: (keypoint.y - sessionBounds.yMin) / (sessionBounds.yMax - sessionBounds.yMin),
  };
}
```

All existing v1 metric functions call `toNormalizedProjection()` first — no other changes to metric logic. This keeps v1 correctness and makes sidecar-3d use the same rules on the projected plane.

3D-specific metrics (lateral symmetry, knee track) are computed separately in a `computeSidecar3DMetrics()` function that runs only when `coordinateSpace === "world-mm-3d"`.

### Step 4 — Three new fault rule stubs

In `posture-fault-detector.ts`:

```typescript
// Rule stubs — return null until thresholds are defined in a follow-up issue
function detectLeftRightAsymmetry(metrics: SidecarPostureMetrics, thresholds: FaultThresholds): PostureFault | null {
  if (!metrics.lateralShoulderSymmetryMm) return null; // not available
  // TODO: threshold definition in follow-up
  return null;
}

function detectKneeTrackDeviation(metrics: SidecarPostureMetrics, thresholds: FaultThresholds): PostureFault | null {
  if (!metrics.leftKneeTrackDeviationMm) return null;
  return null;
}

function detectShinNotVertical(metrics: SidecarPostureMetrics, thresholds: FaultThresholds): PostureFault | null {
  if (!metrics.nearShinAngleDeg) return null;
  return null;
}
```

Wire these into the main detector. When `perspective !== "sidecar-3d"`, skip them. When `perspective === "sidecar-3d"` and they return null (threshold not yet defined), emit a `PostureFault` with `severity: "pending"` and `key: "left_right_asymmetry"` / etc. so the UI can show "detection coming soon" rather than silence.

### Step 5 — Database

Add to `MocapSession` in `prisma/schema.prisma`:
```
calibrationId  String?
cameraCount    Int?
```

Run `npx prisma migrate dev --name add-sidecar-fields`.

Update `PostureSessionRepository` to persist/read these fields.

### Step 6 — API routes

`POST /api/mocap/sessions/:id/sidecar/connect`:
- Validates session is in `capturing` state.
- Calls `checkSidecarHealth(port)`.
- Returns `{ status: "connected", fps, cameras, schemaVersion }` or `{ status: "unreachable" }`.

`GET /api/mocap/sessions/:id/sidecar/status`:
- Proxies to `http://localhost:${port}/health`.
- Used by the camera readiness gate polling loop.

### Step 7 — UI

In the capture page, add:
- "Use multi-camera sidecar" toggle (off by default).
- When on: replace browser webcam initialization with sidecar health poll. Show sidecar-specific quality fields (`reprojectionErrorMm`, `cameraCount`) in the quality indicator bar.
- "Sidecar not reachable" error state with setup link.

No changes to replay or fault display — they work on `PostureFault` rows and `StrokePostureMetric` rows which are source-agnostic.

## Test fixtures needed

- `v2-blob-3d.bin` — a synthetic 100-frame v2 blob with world-mm-3d coordinates, one full rowing stroke. Add to `src/lib/mocap/__tests__/fixtures/`.
- Unit tests for `toNormalizedProjection()` covering: y-axis projection, boundary conditions (zMin === zMax), v1 pass-through.
- Unit tests for each new metric function with the synthetic fixture.
- The three fault rule stubs should have tests asserting they return null (pending) until thresholds are set.

## Definition of done

- [ ] v2 blob round-trips (write → read) without data loss.
- [ ] `FreemocapSidecarSource` connects to a locally running sidecar mock (or real freemocap) and writes a valid v2 blob.
- [ ] Existing v1 test suite still passes without modification.
- [ ] Three new fault stubs appear in the detector output as `severity: "pending"` for sidecar sessions.
- [ ] `POST /api/mocap/sessions/:id/sidecar/connect` returns 200 with health info when sidecar mock is running on port 8765.
- [ ] UI shows "Use sidecar" toggle; toggling it changes capture source.
