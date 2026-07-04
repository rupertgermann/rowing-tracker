from __future__ import annotations

import importlib
import importlib.metadata
import importlib.util
import itertools
import json
import math
import os
import pathlib
from dataclasses import dataclass
from typing import Protocol

from .contract import KEYPOINT_COUNT, KEYPOINT_SCHEMA_VERSION, SidecarFrame, SourceHealth


@dataclass(frozen=True)
class RecordedFrame:
    keypoints: list[list[float]]
    reprojection_error_mm: float | None = None


@dataclass(frozen=True)
class SourceSession:
    session_id: str
    calibration_id: str | None


@dataclass(frozen=True)
class RuntimeFrame:
    keypoints: list[list[float]]
    timestamp_ms: int | None
    reprojection_error_mm: float | None = None
    camera_count: int | None = None


class FrameSource(Protocol):
    @property
    def fps(self) -> float: ...

    @property
    def camera_count(self) -> int: ...

    @property
    def calibration_id(self) -> str | None: ...

    def health(self) -> SourceHealth: ...

    def start_session(self, session_id: str) -> SourceSession: ...

    def stop_session(self, session_id: str) -> None: ...

    def frame(self, frame_index: int, timestamp_ms: int) -> SidecarFrame: ...


class FreeMocapRuntimeProvider(Protocol):
    def health(self) -> SourceHealth: ...

    def start_session(self, session_id: str) -> SourceSession: ...

    def stop_session(self, session_id: str) -> None: ...

    def frame(self) -> RuntimeFrame: ...


def build_frame_source(
    *,
    source: str,
    fps: float,
    camera_count: int,
    calibration_id: str | None,
    freemocap_data: str | None,
    freemocap_recording: str | None = None,
    freemocap_calibration_toml: str | None = None,
    freemocap_provider: str | None = None,
) -> FrameSource:
    if source == "synthetic":
        return SyntheticFrameSource(
            fps=fps,
            camera_count=camera_count,
            calibration_id=calibration_id or "synthetic-calibration",
        )
    if source == "freemocap":
        if freemocap_data:
            return FreeMocapRecordedSource(
                data_path=freemocap_data,
                fps=fps,
                camera_count=camera_count,
                calibration_id=calibration_id,
            )
        if freemocap_recording:
            return FreeMocapProcessedRecordingSource(
                recording_path=freemocap_recording,
                calibration_toml_path=freemocap_calibration_toml,
                fps=fps,
                camera_count=camera_count,
                calibration_id=calibration_id,
            )
        return FreeMocapRuntimeSource(
            provider=_load_freemocap_runtime_provider(
                freemocap_provider,
                fps=fps,
                calibration_id=calibration_id,
            ),
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

    def start_session(self, session_id: str) -> SourceSession:
        return SourceSession(
            session_id=session_id,
            calibration_id=self.calibration_id,
        )

    def stop_session(self, session_id: str) -> None:
        return None

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
        self._frames: list[RecordedFrame] = []
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

    def start_session(self, session_id: str) -> SourceSession:
        return SourceSession(
            session_id=session_id,
            calibration_id=self.calibration_id,
        )

    def stop_session(self, session_id: str) -> None:
        return None

    def frame(self, frame_index: int, timestamp_ms: int) -> SidecarFrame:
        if not self._frames:
            raise RuntimeError("FreeMoCap source is not ready")
        raw = self._frames[frame_index % len(self._frames)]
        return _sidecar_frame_from_keypoints(
            raw,
            frame_index=frame_index,
            timestamp_ms=timestamp_ms,
            camera_count=self.camera_count,
        )

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
        reprojection_error_path = _resolve_freemocap_reprojection_path(
            requested_path=self._data_path,
            resolved_data_path=path,
        )
        try:
            if path.suffix.lower() in {".json", ".jsonl"}:
                frames = _load_json_frames(path)
            elif path.suffix.lower() == ".npy":
                frames = _load_npy_frames(path)
            else:
                raise ValueError(f"Unsupported FreeMoCap data file: {path}")
            if reprojection_error_path is not None:
                frames = _attach_reprojection_errors(frames, reprojection_error_path)
            _validate_recorded_frames(frames)
            self._frames = frames
            self._calibration_id = self._calibration_id or f"freemocap-{path.stem}"
            diagnostics = [f"loaded FreeMoCap data from {path}"]
            if reprojection_error_path is not None:
                diagnostics.append(
                    f"loaded FreeMoCap reprojection quality from {reprojection_error_path}",
                )
            self._diagnostics = tuple(diagnostics)
        except Exception as exc:
            self._frames = []
            self._diagnostics = (f"Failed to load FreeMoCap data: {exc}",)


class FreeMocapProcessedRecordingSource(FreeMocapRecordedSource):
    def __init__(
        self,
        *,
        recording_path: str,
        calibration_toml_path: str | None,
        fps: float,
        camera_count: int,
        calibration_id: str | None,
    ) -> None:
        self._recording_path = pathlib.Path(recording_path).expanduser()
        self._calibration_toml_path = (
            pathlib.Path(calibration_toml_path).expanduser()
            if calibration_toml_path
            else None
        )
        super().__init__(
            data_path=os.fspath(_freemocap_output_data_path(self._recording_path)),
            fps=fps,
            camera_count=camera_count,
            calibration_id=calibration_id
            or _processed_recording_calibration_id(
                self._recording_path,
                self._calibration_toml_path,
            ),
        )

    def _load(self) -> None:
        if not self._recording_path.exists():
            self._frames = []
            self._diagnostics = (
                f"FreeMoCap recording path not found: {self._recording_path}",
            )
            return
        if not self._recording_path.is_dir():
            self._frames = []
            self._diagnostics = (
                f"FreeMoCap recording path must be a directory: {self._recording_path}",
            )
            return
        if self._calibration_toml_path and not self._calibration_toml_path.exists():
            self._frames = []
            self._diagnostics = (
                f"FreeMoCap calibration TOML not found: {self._calibration_toml_path}",
            )
            return
        try:
            _process_freemocap_recording(
                recording_path=self._recording_path,
                calibration_toml_path=self._calibration_toml_path,
            )
        except Exception as exc:
            self._frames = []
            self._diagnostics = (
                f"Failed to process FreeMoCap recording {self._recording_path}: {exc}",
                'install with python -m pip install -e "sidecar[freemocap]" on Python 3.10-3.12, '
                "or pass --freemocap-data with an already processed FreeMoCap output directory",
            )
            return

        super()._load()
        if self._frames:
            self._diagnostics = (
                f"processed FreeMoCap recording {self._recording_path}",
                *self._diagnostics,
            )


class FreeMocapRuntimeSource:
    source_name = "freemocap"

    def __init__(self, *, provider: FreeMocapRuntimeProvider) -> None:
        self._provider = provider

    @property
    def fps(self) -> float:
        return self.health().fps

    @property
    def camera_count(self) -> int:
        return self.health().camera_count

    @property
    def calibration_id(self) -> str | None:
        return self.health().calibration_id

    def health(self) -> SourceHealth:
        health = self._provider.health()
        return SourceHealth(
            status=health.status,
            fps=health.fps,
            camera_count=health.camera_count,
            schema_version=health.schema_version,
            contract_version=health.contract_version,
            sidecar_version=health.sidecar_version,
            source=self.source_name,
            calibration_id=health.calibration_id,
            diagnostics=health.diagnostics,
        )

    def start_session(self, session_id: str) -> SourceSession:
        return self._provider.start_session(session_id)

    def stop_session(self, session_id: str) -> None:
        self._provider.stop_session(session_id)

    def frame(self, frame_index: int, timestamp_ms: int) -> SidecarFrame:
        raw = self._provider.frame()
        if not isinstance(raw.timestamp_ms, int):
            raise ValueError("runtime frame timestamp_ms must be an integer")
        return _sidecar_frame_from_keypoints(
            RecordedFrame(
                keypoints=raw.keypoints,
                reprojection_error_mm=raw.reprojection_error_mm,
            ),
            frame_index=frame_index,
            timestamp_ms=raw.timestamp_ms,
            camera_count=raw.camera_count or self.camera_count,
        )


class UnavailableFreeMocapRuntimeProvider:
    def __init__(
        self,
        *,
        fps: float,
        calibration_id: str | None,
        diagnostics: tuple[str, ...] | None = None,
    ) -> None:
        self._fps = fps
        self._calibration_id = calibration_id
        self._diagnostics = diagnostics or (
            "FreeMoCap live camera runtime is not configured in this build",
            "pass --freemocap-provider module:factory for a live runtime adapter or --freemocap-data for recorded output",
        )

    def health(self) -> SourceHealth:
        return SourceHealth(
            status="error",
            fps=self._fps,
            camera_count=0,
            source="freemocap",
            calibration_id=self._calibration_id,
            diagnostics=self._diagnostics,
        )

    def start_session(self, session_id: str) -> SourceSession:
        raise RuntimeError(self._diagnostics[0])

    def stop_session(self, session_id: str) -> None:
        return None

    def frame(self) -> RuntimeFrame:
        raise RuntimeError(self._diagnostics[0])


class FreeMocapPackageRuntimeProvider(UnavailableFreeMocapRuntimeProvider):
    def __init__(
        self,
        *,
        fps: float,
        calibration_id: str | None,
    ) -> None:
        super().__init__(
            fps=fps,
            calibration_id=calibration_id,
            diagnostics=_detect_freemocap_package_runtime_diagnostics(),
        )


def _load_freemocap_runtime_provider(
    provider_spec: str | None,
    *,
    fps: float,
    calibration_id: str | None,
) -> FreeMocapRuntimeProvider:
    if provider_spec is None:
        return FreeMocapPackageRuntimeProvider(
            fps=fps,
            calibration_id=calibration_id,
        )
    module_name, separator, factory_name = provider_spec.partition(":")
    if not separator or not module_name or not factory_name:
        return UnavailableFreeMocapRuntimeProvider(
            fps=fps,
            calibration_id=calibration_id,
            diagnostics=(
                "FreeMoCap runtime provider must be formatted as module:factory",
            ),
        )
    try:
        module = importlib.import_module(module_name)
        factory = getattr(module, factory_name)
        provider = factory()
    except Exception as exc:
        return UnavailableFreeMocapRuntimeProvider(
            fps=fps,
            calibration_id=calibration_id,
            diagnostics=(f"Failed to load FreeMoCap runtime provider {provider_spec}: {exc}",),
        )
    return provider


def _detect_freemocap_package_runtime_diagnostics() -> tuple[str, ...]:
    package_spec = importlib.util.find_spec("freemocap")
    if package_spec is None:
        return (
            "FreeMoCap package is not installed in this sidecar environment",
            'install with python -m pip install -e "sidecar[freemocap]" on Python 3.10-3.12, '
            "or pass --freemocap-provider module:factory for an operator-owned live runtime adapter",
            "pass --freemocap-recording to process a FreeMoCap recording folder headlessly",
            "pass --freemocap-data to stream recorded FreeMoCap output through the ADR-0005 contract",
        )

    try:
        version = importlib.metadata.version("freemocap")
    except importlib.metadata.PackageNotFoundError:
        version = "unknown version"

    return (
        f"FreeMoCap package {version} is installed, but it does not expose a supported headless live camera API",
        "upstream FreeMoCap exposes stable batch/headless processing and recorded outputs; "
        "live calibrated camera frames require an injected --freemocap-provider adapter",
        "pass --freemocap-recording to process a FreeMoCap recording folder headlessly",
        "pass --freemocap-data to stream recorded FreeMoCap output through the ADR-0005 contract",
    )


def _process_freemocap_recording(
    *,
    recording_path: pathlib.Path,
    calibration_toml_path: pathlib.Path | None,
) -> None:
    try:
        from freemocap.core_processes.process_motion_capture_videos.process_recording_headless import (  # type: ignore
            process_recording_headless,
        )
    except Exception as exc:
        raise RuntimeError(
            "FreeMoCap headless recording processing requires the optional freemocap package",
        ) from exc

    process_recording_headless(
        recording_path=os.fspath(recording_path),
        path_to_camera_calibration_toml=(
            os.fspath(calibration_toml_path) if calibration_toml_path else None
        ),
        run_blender=False,
        make_jupyter_notebook=False,
        use_tqdm=False,
    )


def _freemocap_output_data_path(recording_path: pathlib.Path) -> pathlib.Path:
    return recording_path / "output_data"


def _processed_recording_calibration_id(
    recording_path: pathlib.Path,
    calibration_toml_path: pathlib.Path | None,
) -> str:
    if calibration_toml_path is not None:
        return f"freemocap-{calibration_toml_path.stem}"
    return f"freemocap-{recording_path.name}"


def _resolve_freemocap_path(path: pathlib.Path) -> pathlib.Path | None:
    if path.is_file():
        return path
    if not path.is_dir():
        return path
    candidates = [
        "skeleton_3d.npy",
        "3dData_numFrames_numTrackedPoints_spatialXYZ.npy",
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


def _resolve_freemocap_reprojection_path(
    *,
    requested_path: pathlib.Path,
    resolved_data_path: pathlib.Path,
) -> pathlib.Path | None:
    search_dir = requested_path if requested_path.is_dir() else resolved_data_path.parent
    candidates = [
        "3dData_numFrames_numTrackedPoints_reprojectionError.npy",
        "3dData_numCams_numFrames_numTrackedPoints_reprojectionError.npy",
    ]
    for relative in candidates:
        candidate = search_dir / relative
        if candidate.exists() and candidate != resolved_data_path:
            return candidate
    return None


def _load_json_frames(path: pathlib.Path) -> list[RecordedFrame]:
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


def _extract_frame_values(frame: object) -> RecordedFrame:
    if isinstance(frame, dict) and "keypoints" in frame:
        keypoints = frame["keypoints"]
        if not isinstance(keypoints, list):
            raise ValueError("frame keypoints must be a list")
        indexed: list[tuple[int, dict[str, object]]] = []
        for position, item in enumerate(keypoints):
            if not isinstance(item, dict):
                raise ValueError(f"frame keypoint {position} must be an object")
            if "index" not in item:
                raise ValueError(f"frame keypoint {position} is missing index")
            indexed.append((int(item["index"]), item))
        indexes = sorted(index for index, _item in indexed)
        if indexes != list(range(KEYPOINT_COUNT)):
            raise ValueError(
                f"keypoint indexes must contain 0 through {KEYPOINT_COUNT - 1} exactly once",
            )
        ordered = [
            item for _index, item in sorted(indexed, key=lambda entry: entry[0])
        ]
        quality = frame.get("quality")
        reprojection_error_mm = None
        if isinstance(quality, dict) and quality.get("reprojection_error_mm") is not None:
            reprojection_error_mm = float(quality["reprojection_error_mm"])
        return RecordedFrame(
            keypoints=[
                [
                    float(item["x"]),
                    float(item["y"]),
                    float(item["z"]),
                    float(item.get("confidence", 1.0)),
                ]
                for item in ordered
            ],
            reprojection_error_mm=reprojection_error_mm,
        )
    if isinstance(frame, list):
        return RecordedFrame(keypoints=[[float(value) for value in point] for point in frame])
    raise ValueError("frame must be a keypoint frame object or a 33x4 array")


def _load_npy_frames(path: pathlib.Path) -> list[RecordedFrame]:
    try:
        import numpy as np  # type: ignore
    except Exception as exc:
        raise ValueError("reading .npy FreeMoCap data requires numpy") from exc
    array = np.load(os.fspath(path))
    if array.ndim != 3:
        raise ValueError(f"expected NPY array with shape (frames, 33, 4), got {array.shape}")
    if array.shape[1] != KEYPOINT_COUNT or array.shape[2] < 3:
        raise ValueError(f"expected NPY array with shape (frames, 33, 4), got {array.shape}")
    frames: list[RecordedFrame] = []
    for frame in array:
        converted = []
        for point in frame:
            confidence = float(point[3]) if len(point) > 3 else 1.0
            converted.append([float(point[0]), float(point[1]), float(point[2]), confidence])
        frames.append(RecordedFrame(keypoints=converted))
    return frames


def _attach_reprojection_errors(
    frames: list[RecordedFrame],
    path: pathlib.Path,
) -> list[RecordedFrame]:
    errors = _load_reprojection_errors(path, frame_count=len(frames))
    return [
        RecordedFrame(
            keypoints=frame.keypoints,
            reprojection_error_mm=frame.reprojection_error_mm
            if frame.reprojection_error_mm is not None
            else errors[index],
        )
        for index, frame in enumerate(frames)
    ]


def _load_reprojection_errors(
    path: pathlib.Path,
    *,
    frame_count: int,
) -> list[float | None]:
    try:
        import numpy as np  # type: ignore
    except Exception as exc:
        raise ValueError("reading FreeMoCap reprojection data requires numpy") from exc
    array = np.load(os.fspath(path))
    shape = tuple(getattr(array, "shape", ()))
    if not shape:
        raise ValueError(f"expected reprojection NPY array with frames, got {shape}")
    if shape[0] == frame_count:
        frame_values = [array[index] for index in range(frame_count)]
    elif len(shape) >= 2 and shape[1] == frame_count:
        frame_values = [
            [camera_values[index] for camera_values in array]
            for index in range(frame_count)
        ]
    else:
        raise ValueError(
            f"expected reprojection NPY to include {frame_count} frames, got {shape}",
        )
    return [_mean_finite_values(values) for values in frame_values]


def _mean_finite_values(value: object) -> float | None:
    values = list(_iter_finite_numbers(value))
    if not values:
        return None
    return sum(values) / len(values)


def _iter_finite_numbers(value: object):
    if isinstance(value, (int, float)):
        number = float(value)
        if math.isfinite(number):
            yield number
        return
    if isinstance(value, (str, bytes)):
        return
    tolist = getattr(value, "tolist", None)
    if callable(tolist):
        yield from _iter_finite_numbers(tolist())
        return
    try:
        iterator = iter(value)  # type: ignore[arg-type]
    except TypeError:
        return
    for item in iterator:
        yield from _iter_finite_numbers(item)


def _validate_recorded_frames(frames: list[RecordedFrame]) -> None:
    if not frames:
        raise ValueError("no frames found")
    for frame_index, recorded_frame in enumerate(frames):
        _validate_recorded_frame(recorded_frame, frame_index)


def _sidecar_frame_from_keypoints(
    recorded_frame: RecordedFrame,
    *,
    frame_index: int,
    timestamp_ms: int,
    camera_count: int,
) -> SidecarFrame:
    _validate_recorded_frame(recorded_frame, frame_index)
    keypoints = []
    confidences = []
    for index, values in enumerate(recorded_frame.keypoints):
        x, y, z, confidence = values[:4]
        x_value = float(x)
        y_value = float(y)
        z_value = float(z)
        confidence_value = float(confidence)
        confidences.append(confidence_value)
        keypoints.append(
            {
                "index": index,
                "x": x_value,
                "y": y_value,
                "z": z_value,
                "confidence": confidence_value,
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
            "reprojection_error_mm": recorded_frame.reprojection_error_mm
            if recorded_frame.reprojection_error_mm is not None
            else 0.0,
            "camera_count": camera_count,
        },
    }


def _validate_recorded_frame(recorded_frame: RecordedFrame, frame_index: int) -> None:
    frame = recorded_frame.keypoints
    if len(frame) != KEYPOINT_COUNT:
        raise ValueError(
            f"frame {frame_index} has {len(frame)} keypoints; expected 33",
        )
    for point_index, point in enumerate(frame):
        if len(point) < 4:
            raise ValueError(
                f"frame {frame_index} keypoint {point_index} has {len(point)} values; expected 4",
            )
        for value_index, value in enumerate(point[:4]):
            if not math.isfinite(float(value)):
                raise ValueError(
                    f"frame {frame_index} keypoint {point_index} value {value_index} must be finite",
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
