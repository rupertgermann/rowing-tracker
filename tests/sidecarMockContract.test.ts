import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { finalizePoseStreamBlob, initializePoseStreamBlob, appendPoseFrames } from "../src/lib/mocap/capturePersistence";
import { FreemocapSidecarSource } from "../src/lib/mocap/freemocapSidecarSource";
import { adaptPoseFrameStreamBlob, analyzePoseFrameStream } from "../src/lib/mocap/analysis";
import {
  BYTES_PER_FRAME_V2,
  HEADER_SIZE,
  KEYPOINT_SCHEMA_V2,
  decodeHeader,
} from "../src/lib/mocap/poseFrameStream";
import { checkSidecarHealth, startSidecarSession, stopSidecarSession } from "../src/lib/mocap/sidecarClient";
import { LocalDiskStorage } from "../src/lib/mocap/storage";
import { withTestSidecarMock } from "./helpers/testSidecarMock";

test("test sidecar mock captures, persists, finalizes, and analyzes v2 pose streams", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sidecar-mock-"));
  const storage = new LocalDiskStorage(root);
  const userId = "user-1";
  const sessionId = "mocap-sidecar-1";
  const posePath = storage.poseStreamPath(userId, sessionId);

  try {
    await initializePoseStreamBlob(storage, posePath, 30, {
      keypointSchemaVersion: KEYPOINT_SCHEMA_V2,
      coordinateSpace: "world-mm-3d",
      cameraCount: 3,
    });

    await withTestSidecarMock(
      {
        onPoseUpload: async (bytes) => {
          await appendPoseFrames(storage, posePath, bytes);
        },
      },
      async (mock) => {
        const health = await checkSidecarHealth(mock.port);
        assert.equal(health.status, "ready");
        assert.equal(health.cameras, 3);
        assert.equal(health.schemaVersion, 2);

        const sidecarSession = await startSidecarSession(mock.port);
        assert.equal(sidecarSession.sessionId, "test-sidecar-session");
        await stopSidecarSession(mock.port);

        const source = new FreemocapSidecarSource({
          sessionId,
          port: mock.port,
          cameraCount: health.cameras,
          flushBytes: BYTES_PER_FRAME_V2 * 20,
        });

        await source.init();
        await source.start();
        mock.emitPoseFrames();
        await source.stop();

        assert.equal(source.framesCaptured, mock.frames.length);
        assert.equal(mock.sessionStarted, true);
        assert.equal(mock.sessionStopped, true);
        assert.equal(mock.healthCalls, 1);
        assert.equal(mock.poseUploads, 2);
      },
    );

    const finalized = await finalizePoseStreamBlob(storage, posePath);
    assert.equal(finalized.frameCount, 25);
    assert.equal(
      finalized.poseStreamBytes,
      HEADER_SIZE + 25 * BYTES_PER_FRAME_V2,
    );

    const blob = await storage.read(posePath);
    const header = decodeHeader(blob.subarray(0, HEADER_SIZE));
    assert.equal(header.keypointSchemaVersion, KEYPOINT_SCHEMA_V2);
    assert.equal(header.coordinateSpace, "world-mm-3d");
    assert.equal(header.cameraCount, 3);
    assert.equal(header.frameCount, 25);

    const stream = adaptPoseFrameStreamBlob(blob, "sidecar-3d");
    const analysis = analyzePoseFrameStream(stream);
    assert.equal(stream.coordinateSpace, "world-mm-3d");
    assert.equal(stream.cameraCount, 3);
    assert.ok(analysis.metrics.length > 0);
    assert.equal(analysis.metrics[0]?.segmentationSource, "pose-segmented");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
