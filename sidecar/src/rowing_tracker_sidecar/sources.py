from __future__ import annotations

import itertools
import json
import math
import os
import pathlib
from typing import Protocol

from .contract import KEYPOINT_COUNT, KEYPOINT_SCHEMA_VERSION, SidecarFrame, SourceHealth


class FrameSource(Protocol):
    @property
    def fps(self) -> float: ...

    @property
    def camera_count(self) -> int: ...

    @property
    def calibration_id(self) -> str | None: ...

    def health(self) -> SourceHealth: ...

    def frame(self, frame_index: int, timestamp_ms: int) -> SidecarFrame: ...


def build_frame_source(
    *,
    source: str,
    fps: float,
    camera_count: int,
    calibration_id: str | None,
    freemocap_data: str | None,
) -> FrameSource:
    if source == "synthetic":
        return SyntheticFrameSource(
            fps=fps,
            camera_count=camera_count,
            calibration_id=calibration_id or "synthetic-calibration",
        )
    if source == "freemocap":
        return FreeMocapRecordedSource(
            data_path=freemocap_data,
            fps=fps,
            camera_count=camera_count,
            calibration_id=calibration_id,
        )
    raise ValueError(f"Unsupported sidecar source: {source}")


class SyntheticFrameSource:
    source_name = "synthetic"

    def __init__(
        self,
        *,
        fps: float = 30.0,
        camera_count: int = 3,
        calibration_id: str = "synthetic-calibration",
    ) -> None:
        self._fps = fps
        self._camera_count = camera_count
        self._calibration_id = calibration_id

    @property
    def fps(self) -> float:
        return self._fps

    @property
    def camera_count(self) -> int:
        return self._camera_count

    @property
    def calibration_id(self) -> str:
        return self._calibration_id

    def health(self) -> SourceHealth:
        invalid = _invalid_runtime_diagnostics(self.fps, self.camera_count)
        if invalid:
            return SourceHealth(
                status="error",
                fps=self.fps,
                camera_count=max(0, self.camera_count),
                source=self.source_name,
                calibration_id=self.calibration_id,
                diagnostics=invalid,
            )
        return SourceHealth(
            status="ready",
            fps=self.fps,
            camera_count=self.camera_count,
            source=self.source_name,
            calibration_id=self.calibration_id,
            diagnostics=("synthetic source ready",),
        )

    def frame(self, frame_index: int, timestamp_ms: int) -> SidecarFrame:
        hip_knee_depth = _stroke_depth(frame_index)
        keypoints = [_untracked_point(index) for index in range(KEYPOINT_COUNT)]

        keypoints[11] = _point(11, -180, 700, 160)
        keypoints[12] = _point(12, 180, 700, 160)
        keypoints[13] = _point(13, -210, 850, 180)
        keypoints[14] = _point(14, 210, 850, 180)
        keypoints[15] = _point(15, -220, 1000, 210)
        keypoints[16] = _point(16, 220, 1000, 210)
        keypoints[23] = _point(23, -120, 1000, 0)
        keypoints[24] = _point(24, 120, 1000, 0)
        keypoints[25] = _point(25, -120, 1000, hip_knee_depth)
        keypoints[26] = _point(26, 120, 1000, hip_knee_depth)
        keypoints[27] = _point(27, -120, 1100, hip_knee_depth + 0.1)
        keypoints[28] = _point(28, 120, 1100, hip_knee_depth + 0.1)

        # Keep every frame deterministic while still giving the app changing
        # 3D coordinates to encode and analyze.
        phase = frame_index * 0.05
        for kp in keypoints:
            if kp["confidence"] > 0:
                kp["y"] = float(kp["y"] + math.sin(phase) * 8)

        return {
            "schema_version": KEYPOINT_SCHEMA_VERSION,
            "frame_index": frame_index,
            "timestamp_ms": timestamp_ms,
            "source": "sidecar-3d",
            "keypoints": keypoints,
            "quality": {
                "tracked_count": 13,
                "mean_confidence": 0.92,
                "reprojection_error_mm": 1.2,
                "camera_count": self.camera_count,
            },
        }


class FreeMocapRecordedSource:
    source_name = "freemocap"

    def __init__(
        self,
        *,
        data_path: str | None,
        fps: float,
        camera_count: int,
        calibration_id: str | None,
    ) -> None:
        self._fps = fps
        self._camera_count = camera_count
        self._data_path = pathlib.Path(data_path).expanduser() if data_path else None
        self._frames: list[list[list[float]]] = []
        self._diagnostics: tuple[str, ...] = ()
        self._calibration_id = calibration_id
        self._load()

    @property
    def fps(self) -> float:
        return self._fps

    @property
    def camera_count(self) -> int:
        return self._camera_count

    @property
    def calibration_id(self) -> str | None:
        return self._calibration_id

    def health(self) -> SourceHealth:
        invalid = _invalid_runtime_diagnostics(self.fps, self.camera_count)
        if invalid:
            return SourceHealth(
                status="error",
                fps=self.fps,
                camera_count=max(0, self.camera_count),
                source=self.source_name,
                calibration_id=self.calibration_id,
                diagnostics=invalid,
            )
        if not self._frames:
            return SourceHealth(
                status="error",
                fps=self.fps,
                camera_count=0,
                source=self.source_name,
                calibration_id=self.calibration_id,
                diagnostics=self._diagnostics
                or (
                    "FreeMoCap source requires --freemocap-data with JSON, JSONL, or NPY output",
                ),
            )
        return SourceHealth(
            status="ready",
            fps=self.fps,
            camera_count=self.camera_count,
            source=self.source_name,
            calibration_id=self.calibration_id,
            diagnostics=self._diagnostics,
        )

    def frame(self, frame_index: int, timestamp_ms: int) -> SidecarFrame:
        if not self._frames:
            raise RuntimeError("FreeMoCap source is not ready")
        raw = self._frames[frame_index % len(self._frames)]
        keypoints = []
        confidences = []
        for index, values in enumerate(raw):
            x, y, z, confidence = values
            confidences.append(confidence)
            keypoints.append(
                {
                    "index": index,
                    "x": float(x),
                    "y": float(y),
                    "z": float(z),
                    "confidence": float(confidence),
                },
            )
        tracked = sum(1 for confidence in confidences if confidence >= 0.5)
        mean_confidence = sum(confidences) / len(confidences)
        return {
            "schema_version": KEYPOINT_SCHEMA_VERSION,
            "frame_index": frame_index,
            "timestamp_ms": timestamp_ms,
            "source": "sidecar-3d",
            "keypoints": keypoints,
            "quality": {
                "tracked_count": tracked,
                "mean_confidence": mean_confidence,
                "reprojection_error_mm": 0.0,
                "camera_count": self.camera_count,
            },
        }

    def _load(self) -> None:
        if self._data_path is None:
            self._diagnostics = (
                "FreeMoCap live camera runtime is not configured in this build",
                "pass --freemocap-data to stream recorded FreeMoCap output through the ADR-0005 contract",
            )
            return
        path = _resolve_freemocap_path(self._data_path)
        if path is None or not path.exists():
            self._diagnostics = (f"FreeMoCap data path not found: {self._data_path}",)
            return
        try:
            if path.suffix.lower() in {".json", ".jsonl"}:
                frames = _load_json_frames(path)
            elif path.suffix.lower() == ".npy":
                frames = _load_npy_frames(path)
            else:
                raise ValueError(f"Unsupported FreeMoCap data file: {path}")
            _validate_recorded_frames(frames)
            self._frames = frames
            self._calibration_id = self._calibration_id or f"freemocap-{path.stem}"
            self._diagnostics = (f"loaded FreeMoCap data from {path}",)
        except Exception as exc:
            self._frames = []
            self._diagnostics = (f"Failed to load FreeMoCap data: {exc}",)


def _resolve_freemocap_path(path: pathlib.Path) -> pathlib.Path | None:
    if path.is_file():
        return path
    if not path.is_dir():
        return path
    candidates = [
        "mediapipe_body_3d_xyz.npy",
        "mediapipe_body_3d_xyz_confidence.npy",
        "body_3d_xyz.npy",
        "sidecar_frames.jsonl",
        "sidecar_frames.json",
    ]
    for relative in candidates:
        candidate = path / relative
        if candidate.exists():
            return candidate
    for candidate in itertools.chain(path.glob("*.jsonl"), path.glob("*.json"), path.glob("*.npy")):
        return candidate
    return None


def _load_json_frames(path: pathlib.Path) -> list[list[list[float]]]:
    if path.suffix.lower() == ".jsonl":
        frames = []
        for line in path.read_text().splitlines():
            if not line.strip():
                continue
            frames.append(_extract_frame_values(json.loads(line)))
        return frames
    body = json.loads(path.read_text())
    if isinstance(body, dict) and "frames" in body:
        body = body["frames"]
    if not isinstance(body, list):
        raise ValueError("JSON FreeMoCap data must be a list or {frames: [...]}")
    return [_extract_frame_values(frame) for frame in body]


def _extract_frame_values(frame: object) -> list[list[float]]:
    if isinstance(frame, dict) and "keypoints" in frame:
        keypoints = frame["keypoints"]
        if not isinstance(keypoints, list):
            raise ValueError("frame keypoints must be a list")
        ordered = sorted(keypoints, key=lambda item: int(item["index"]))
        return [
            [
                float(item["x"]),
                float(item["y"]),
                float(item["z"]),
                float(item.get("confidence", 1.0)),
            ]
            for item in ordered
        ]
    if isinstance(frame, list):
        return [[float(value) for value in point] for point in frame]
    raise ValueError("frame must be a keypoint frame object or a 33x4 array")


def _load_npy_frames(path: pathlib.Path) -> list[list[list[float]]]:
    try:
        import numpy as np  # type: ignore
    except Exception as exc:
        raise ValueError("reading .npy FreeMoCap data requires numpy") from exc
    array = np.load(os.fspath(path))
    if array.ndim != 3:
        raise ValueError(f"expected NPY array with shape (frames, 33, 4), got {array.shape}")
    if array.shape[1] != KEYPOINT_COUNT or array.shape[2] < 3:
        raise ValueError(f"expected NPY array with shape (frames, 33, 4), got {array.shape}")
    frames: list[list[list[float]]] = []
    for frame in array:
        converted = []
        for point in frame:
            confidence = float(point[3]) if len(point) > 3 else 1.0
            converted.append([float(point[0]), float(point[1]), float(point[2]), confidence])
        frames.append(converted)
    return frames


def _validate_recorded_frames(frames: list[list[list[float]]]) -> None:
    if not frames:
        raise ValueError("no frames found")
    for frame_index, frame in enumerate(frames):
        if len(frame) != KEYPOINT_COUNT:
            raise ValueError(f"frame {frame_index} has {len(frame)} keypoints; expected 33")
        for point_index, point in enumerate(frame):
            if len(point) < 4:
                raise ValueError(
                    f"frame {frame_index} keypoint {point_index} has {len(point)} values; expected 4",
                )


def _stroke_depth(frame_index: int) -> float:
    cycle = [20, 80, 150, 240, 320, 240, 150, 80]
    return float(cycle[frame_index % len(cycle)])


def _invalid_runtime_diagnostics(fps: float, camera_count: int) -> tuple[str, ...]:
    diagnostics = []
    if camera_count <= 0:
        diagnostics.append("No cameras available")
    if fps <= 0:
        diagnostics.append("FPS must be greater than zero")
    return tuple(diagnostics)


def _point(index: int, x: float, y: float, z: float) -> dict[str, float | int]:
    return {"index": index, "x": float(x), "y": float(y), "z": float(z), "confidence": 0.92}


def _untracked_point(index: int) -> dict[str, float | int]:
    return {"index": index, "x": 0.0, "y": 1000.0, "z": 0.0, "confidence": 0.0}
