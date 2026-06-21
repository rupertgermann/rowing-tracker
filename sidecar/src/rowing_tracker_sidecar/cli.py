from __future__ import annotations

import argparse
import logging

from .server import SidecarServer
from .sources import build_frame_source


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="rowing-tracker-sidecar",
        description="Run the Rowing Tracker local mocap sidecar.",
    )
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument(
        "--source",
        choices=["synthetic", "freemocap"],
        default="synthetic",
        help="Frame source. synthetic is deterministic and hardware-free.",
    )
    parser.add_argument("--fps", type=float, default=30.0)
    parser.add_argument("--camera-count", type=int, default=3)
    parser.add_argument("--calibration-id")
    parser.add_argument(
        "--freemocap-data",
        help="FreeMoCap-style JSON/JSONL/NPY data file or output directory.",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    source = build_frame_source(
        source=args.source,
        fps=args.fps,
        camera_count=args.camera_count,
        calibration_id=args.calibration_id,
        freemocap_data=args.freemocap_data,
    )
    server = SidecarServer(args.host, args.port, source)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
    return 0
