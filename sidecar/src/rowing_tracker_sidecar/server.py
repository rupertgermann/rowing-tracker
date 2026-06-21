from __future__ import annotations

import base64
import hashlib
import json
import logging
import struct
import threading
import time
import uuid
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from .contract import KEYPOINT_SCHEMA_VERSION, SourceHealth
from .sources import FrameSource

LOGGER = logging.getLogger(__name__)
WEBSOCKET_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"


class SidecarState:
    def __init__(self, source: FrameSource) -> None:
        self.source = source
        self.lock = threading.RLock()
        self.active = False
        self.session_id: str | None = None

    def health(self) -> SourceHealth:
        return self.source.health()

    def start(self) -> tuple[int, dict[str, object]]:
        with self.lock:
            health = self.health()
            if health.status != "ready":
                return (
                    HTTPStatus.CONFLICT,
                    {
                        "status": health.status,
                        "schemaVersion": health.schema_version,
                        "diagnostics": list(health.diagnostics),
                    },
                )
            if health.schema_version != KEYPOINT_SCHEMA_VERSION:
                return (
                    HTTPStatus.CONFLICT,
                    {
                        "status": "incompatible-schema",
                        "schemaVersion": health.schema_version,
                        "expectedSchemaVersion": KEYPOINT_SCHEMA_VERSION,
                    },
                )
            self.session_id = str(uuid.uuid4())
            self.active = True
            LOGGER.info("sidecar session started: %s", self.session_id)
            return (
                HTTPStatus.OK,
                {
                    "sessionId": self.session_id,
                    "calibrationId": self.source.calibration_id,
                },
            )

    def stop(self) -> dict[str, object]:
        with self.lock:
            stopped_id = self.session_id
            self.active = False
            self.session_id = None
            LOGGER.info("sidecar session stopped: %s", stopped_id)
            return {"status": "stopped", "sessionId": stopped_id}

    def is_active(self) -> bool:
        with self.lock:
            return self.active


class _ThreadingHTTPServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


class SidecarServer:
    def __init__(self, host: str, port: int, source: FrameSource) -> None:
        self.state = SidecarState(source)
        self._shutdown = threading.Event()

        state = self.state
        shutdown_event = self._shutdown

        class Handler(SidecarRequestHandler):
            sidecar_state = state
            shutdown_event_ref = shutdown_event

        self._server = _ThreadingHTTPServer((host, port), Handler)
        self.host = host
        self.port = port

    def serve_forever(self) -> None:
        LOGGER.info("rowing-tracker-sidecar listening on http://%s:%s", self.host, self.port)
        self._server.serve_forever(poll_interval=0.2)

    def shutdown(self) -> None:
        self._shutdown.set()
        self._server.shutdown()
        self._server.server_close()


class SidecarRequestHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "RowingTrackerSidecar/0.1"
    sidecar_state: SidecarState
    shutdown_event_ref: threading.Event

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self._send_cors_headers()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self) -> None:
        if self.path == "/health":
            self._send_json(HTTPStatus.OK, self.sidecar_state.health().to_json())
            return
        if self.path == "/pose-stream":
            self._handle_pose_stream()
            return
        self._send_json(HTTPStatus.NOT_FOUND, {"error": f"Unknown path: {self.path}"})

    def do_POST(self) -> None:
        self._drain_request_body()
        if self.path == "/session/start":
            status, body = self.sidecar_state.start()
            self._send_json(status, body)
            return
        if self.path == "/session/stop":
            body = self.sidecar_state.stop()
            self._send_json(HTTPStatus.OK, body)
            return
        self._send_json(HTTPStatus.NOT_FOUND, {"error": f"Unknown path: {self.path}"})

    def log_message(self, format: str, *args: Any) -> None:
        LOGGER.debug("%s - %s", self.address_string(), format % args)

    def _drain_request_body(self) -> None:
        length = int(self.headers.get("Content-Length") or "0")
        if length:
            self.rfile.read(length)

    def _send_json(self, status: int, body: dict[str, object]) -> None:
        payload = json.dumps(body, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _send_cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _handle_pose_stream(self) -> None:
        key = self.headers.get("Sec-WebSocket-Key")
        if self.headers.get("Upgrade", "").lower() != "websocket" or not key:
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": "Expected WebSocket upgrade"})
            return

        accept = base64.b64encode(
            hashlib.sha1((key + WEBSOCKET_GUID).encode("ascii")).digest(),
        ).decode("ascii")
        self.send_response_only(HTTPStatus.SWITCHING_PROTOCOLS)
        self.send_header("Upgrade", "websocket")
        self.send_header("Connection", "Upgrade")
        self.send_header("Sec-WebSocket-Accept", accept)
        self.end_headers()

        LOGGER.info("pose-stream websocket connected")
        frame_index = 0
        frame_interval = 1.0 / max(1.0, float(self.sidecar_state.source.fps))
        try:
            while not self.shutdown_event_ref.is_set():
                if not self.sidecar_state.is_active():
                    time.sleep(0.05)
                    continue
                timestamp_ms = int(time.time() * 1000)
                frame = self.sidecar_state.source.frame(frame_index, timestamp_ms)
                _send_websocket_text(self.request, json.dumps(frame, separators=(",", ":")))
                frame_index += 1
                time.sleep(frame_interval)
        except OSError:
            LOGGER.info("pose-stream websocket disconnected")


def _send_websocket_text(sock: Any, message: str) -> None:
    payload = message.encode("utf-8")
    length = len(payload)
    if length <= 125:
        header = struct.pack("!BB", 0x81, length)
    elif length <= 65535:
        header = struct.pack("!BBH", 0x81, 126, length)
    else:
        header = struct.pack("!BBQ", 0x81, 127, length)
    sock.sendall(header + payload)
