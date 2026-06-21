# Sidecar Tracer Implementation Reference

The freemocap sidecar integration lets the app connect to a local sidecar, receive 3D pose frames, store them as v2 `PoseFrameStream` blobs, and run the same analysis pipeline used by browser captures.

## Current Contract

- Browser captures use `keypointSchemaVersion = 1`, `coordinateSpace = "normalized-2d"`, and `capturePerspective = "side-left"` or `"side-right"`.
- Sidecar captures use `keypointSchemaVersion = 2`, `coordinateSpace = "world-mm-3d"`, and `capturePerspective = "sidecar-3d"`.
- The sidecar default port is `8765`; `UserSettings.sidecarPort` overrides it.
- The sidecar provides `GET /health`, `POST /session/start`, `POST /session/stop`, and `ws://localhost:<port>/pose-stream`.
- App routes proxy sidecar lifecycle through `/api/mocap/sessions/:id/sidecar/connect`, `/status`, and `/stop`.
- Finalize, reanalyze, link, and unlink return normalized lifecycle results with `ok`, `analysisMode`, `strokeMetricCount`, and `faultCount`.

## Relevant Files

```text
src/lib/mocap/
  poseFrameStream.ts             # v1/v2 blob reader and writer
  sidecarClient.ts               # localhost HTTP/WebSocket sidecar client
  sidecarPoseSource.ts           # sidecar frame source used by capture UI
  lifecycle.ts                   # finalize/link/unlink/reanalyze orchestration
  lifecyclePrisma.ts             # guarded Prisma status transitions
  lifecycleResponse.ts           # normalized client response parsing
  analysis/
    projection.ts                # world-mm-3d projection for v1-compatible rules
    postureMetrics.ts            # side-view and sidecar-3d metric calculation
    postureFaultDetector.ts      # thresholded side-view faults and pending sidecar slots

src/app/api/mocap/sessions/
  route.ts                       # session creation/list
  [id]/finalize/route.ts         # guarded finalize
  [id]/reanalyze/route.ts        # guarded reanalysis
  [id]/link/[rowingSessionId]/route.ts
  [id]/unlink/route.ts
  [id]/sidecar/connect/route.ts
  [id]/sidecar/status/route.ts
  [id]/sidecar/stop/route.ts

src/app/mocap/page.tsx           # browser/sidecar capture UI
```

## Behavior Notes

- Sidecar sessions create `MocapSession` rows with `source = "sidecar"`, `capturePerspective = "sidecar-3d"`, and `captureModelVersion = "freemocap-sidecar@schemaV2"` style metadata.
- `connect` requires a `capturing` session, checks sidecar health, requires schema v2, starts the sidecar session, and stores `calibrationId` plus `cameraCount`.
- Sidecar frames are uploaded into the same `PoseFrameStream` storage path used by browser capture.
- The analysis pipeline projects sidecar world coordinates into a 2D side-view plane for the five established side-view rules.
- Sidecar-specific metrics populate `sidecar3D`; `left_right_asymmetry`, `knee_track_deviation`, and `shin_not_vertical_at_catch` emit `severity: "pending"` until tuned thresholds exist.
- Record-only mode is browser-only and finalizes as `analysisMode: "record-only"` without pose metrics or faults.

## Focused Validation

```bash
npx tsx --test tests/sidecarTracer.test.ts
npx tsx --test tests/freemocapSidecarSource.test.ts
npx tsx --test tests/sidecarMockContract.test.ts
npm run test:e2e -- tests/e2e/mocap-capture.spec.ts
```

`tests/helpers/testSidecarMock.ts` provides an in-process ADR-0005-compatible sidecar for contract tests without a freemocap install or camera rig.
