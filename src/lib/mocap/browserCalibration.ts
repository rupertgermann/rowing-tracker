import { BYTES_PER_FRAME_V1, decodeFrame } from "./poseFrameStream";
import { keypointTripletsToPosePoints } from "./analysis/poseFrameStreamAdapter";
import type { Calibration, CapturePerspective, PoseAnalysisFrame } from "./analysis/types";

export function decodeBrowserCalibration(
  capturePerspective: CapturePerspective,
  catchFrame: unknown,
  finishFrame: unknown,
): Calibration | undefined {
  if (capturePerspective === "sidecar-3d") return undefined;
  function decode(value: unknown): PoseAnalysisFrame | undefined {
    if (
      !value || typeof value !== "object" ||
      !("poseFrameBase64" in value) || typeof value.poseFrameBase64 !== "string" ||
      !("capturePerspective" in value) || value.capturePerspective !== capturePerspective
    ) return undefined;
    try {
      const binary = atob(value.poseFrameBase64);
      if (binary.length !== BYTES_PER_FRAME_V1) return undefined;
      const decoded = decodeFrame(Uint8Array.from(binary, c => c.charCodeAt(0)));
      return {
        timestampMs: decoded.timestampMs,
        keypoints: keypointTripletsToPosePoints(decoded.keypoints),
        qualityFlags: decoded.qualityFlags,
      };
    } catch {
      return undefined;
    }
  }
  return { capturePerspective, catchFrame: decode(catchFrame), finishFrame: decode(finishFrame) };
}
