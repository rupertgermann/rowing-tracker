from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, TypedDict

KEYPOINT_SCHEMA_VERSION = 2
KEYPOINT_COUNT = 33


class Keypoint(TypedDict):
    index: int
    x: float
    y: float
    z: float
    confidence: float


class FrameQuality(TypedDict):
    tracked_count: int
    mean_confidence: float
    reprojection_error_mm: float
    camera_count: int


class SidecarFrame(TypedDict):
    schema_version: int
    frame_index: int
    timestamp_ms: int
    source: Literal["sidecar-3d"]
    keypoints: list[Keypoint]
    quality: FrameQuality


@dataclass(frozen=True)
class SourceHealth:
    status: Literal["ready", "initializing", "error"]
    fps: float
    camera_count: int
    schema_version: int = KEYPOINT_SCHEMA_VERSION
    source: str = "synthetic"
    calibration_id: str | None = None
    diagnostics: tuple[str, ...] = ()

    def to_json(self) -> dict[str, object]:
        return {
            "status": self.status,
            "fps": self.fps,
            "cameras": self.camera_count,
            "schemaVersion": self.schema_version,
            "source": self.source,
            "calibrationId": self.calibration_id,
            "diagnostics": list(self.diagnostics),
        }
