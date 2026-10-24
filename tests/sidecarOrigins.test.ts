import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { test } from "node:test";

test("sidecar rejects hostile HTTP and WebSocket origins while allowing the app", () => {
  const output = execFileSync("python3", ["-c", `
import io, threading
from email.message import Message
from rowing_tracker_sidecar.server import SidecarRequestHandler

class State:
    source = type('Source', (), {'fps': 30})()
    starts = 0
    def start(self):
        self.starts += 1
        return 200, {'sessionId': 'test'}

def request(origin, method, route, app_origin='http://localhost:3000'):
    handler = object.__new__(SidecarRequestHandler)
    handler.headers = Message()
    if origin is not None:
        handler.headers['Origin'] = origin
    handler.headers['Upgrade'] = 'websocket'
    handler.headers['Sec-WebSocket-Key'] = 'dGhlIHNhbXBsZSBub25jZQ=='
    handler.path = route
    handler.allowed_origin = app_origin
    handler.sidecar_state = State()
    handler.shutdown_event_ref = threading.Event()
    handler.shutdown_event_ref.set()
    handler.wfile = io.BytesIO()
    handler.rfile = io.BytesIO()
    statuses, headers = [], {}
    handler.send_response = lambda status: statuses.append(status)
    handler.send_response_only = handler.send_response
    handler.send_header = lambda key, value: headers.update({key: value})
    handler.end_headers = lambda: None
    getattr(handler, method)()
    return statuses[0], handler.sidecar_state.starts, headers

for method, route in [('do_POST', '/session/start'), ('do_GET', '/pose-stream'), ('do_OPTIONS', '/session/start')]:
    status, starts, headers = request('http://untrusted.example', method, route)
    assert status == 403, (method, status)
    assert starts == 0
    assert 'Access-Control-Allow-Origin' not in headers
    status, _, headers = request('http://localhost:3000', method, route)
    assert status in (200, 101, 204), (method, status)
    if method != 'do_GET':
        assert headers['Access-Control-Allow-Origin'] == 'http://localhost:3000'
assert request(None, 'do_POST', '/session/start')[0] == 200
assert request('null', 'do_POST', '/session/start')[0] == 403
assert request('http://localhost:3000.untrusted.example', 'do_GET', '/pose-stream')[0] == 403
assert request('http://127.0.0.1:3001', 'do_POST', '/session/start', 'http://127.0.0.1:3001')[0] == 200
from rowing_tracker_sidecar.cli import build_parser
assert build_parser().parse_args(['--app-origin', 'http://127.0.0.1:3001']).app_origin == 'http://127.0.0.1:3001'
print('hostile origins rejected; app and server requests allowed')
`], { env: { ...process.env, PYTHONPATH: path.resolve("sidecar/src"), PYTHONDONTWRITEBYTECODE: "1" }, encoding: "utf8" });
  assert.match(output, /hostile origins rejected/);
});
