#!/usr/bin/env python3
"""
Dev server for Coastal Aircraft Maintenance investor package.
Serves static files + handles POST /__dev/save to write config back into scene.js.

Usage:  python3 server.py
        (serves on http://localhost:8080)
"""

import http.server
import json
import os
import re
import sys

PORT = 8080
ROOT = os.path.dirname(os.path.abspath(__file__))
SCENE_JS = os.path.join(ROOT, 'scene.js')


class DevHandler(http.server.SimpleHTTPRequestHandler):
    """Extends SimpleHTTPRequestHandler with a save-config endpoint."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_POST(self):
        if self.path == '/__dev/save':
            self._handle_save()
        else:
            self.send_error(404, 'Not Found')

    def _handle_save(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            config = json.loads(body)

            with open(SCENE_JS, 'r', encoding='utf-8') as f:
                src = f.read()

            # ── Mesh groups ──────────────────────────────
            mg = config.get('meshGroups', {})
            if 'ramp' in mg:
                ramp_str = f'const RAMP_MESH_NAMES   = {json.dumps(mg["ramp"])};'
                src = re.sub(
                    r'const RAMP_MESH_NAMES\s*=\s*\[.*?\];',
                    ramp_str, src, count=1
                )
            if 'office' in mg:
                office_str = f'const OFFICE_MESH_NAMES = {json.dumps(mg["office"])};'
                src = re.sub(
                    r'const OFFICE_MESH_NAMES\s*=\s*\[.*?\];',
                    office_str, src, count=1
                )

            # ── Camera presets ───────────────────────────
            cp = config.get('cameraPresets', {})
            if cp:
                entries = []
                for view in ['home', 'ramp', 'office']:
                    data = cp.get(view)
                    if data:
                        entries.append(
                            f'{view}: {{ posX: {data["posX"]}, posY: {data["posY"]}, posZ: {data["posZ"]}, '
                            f'targetX: {data["targetX"]}, targetY: {data["targetY"]}, targetZ: {data["targetZ"]} }}'
                        )
                    else:
                        entries.append(f'{view}: null')
                presets_str = f'const CAMERA_PRESETS = {{ {", ".join(entries)} }};'
                src = re.sub(
                    r'const CAMERA_PRESETS\s*=\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\};',
                    presets_str, src, count=1
                )

            # ── Lighting ─────────────────────────────────
            lt = config.get('lighting', {})
            if 'sunIntensity' in lt:
                src = re.sub(
                    r"const sunLight = new THREE\.DirectionalLight\(0xfff4e6,\s*[\d.]+\)",
                    f"const sunLight = new THREE.DirectionalLight(0xfff4e6, {lt['sunIntensity']})",
                    src, count=1
                )
            if 'ambientIntensity' in lt:
                src = re.sub(
                    r"const ambientLight = new THREE\.AmbientLight\(0xffffff,\s*[\d.]+\)",
                    f"const ambientLight = new THREE.AmbientLight(0xffffff, {lt['ambientIntensity']})",
                    src, count=1
                )
            if 'exposure' in lt:
                src = re.sub(
                    r"renderer\.toneMappingExposure\s*=\s*[\d.]+;",
                    f"renderer.toneMappingExposure = {lt['exposure']};",
                    src, count=1
                )
            if 'envIntensity' in lt:
                src = re.sub(
                    r"scene\.environmentIntensity\s*=\s*[\d.]+;",
                    f"scene.environmentIntensity = {lt['envIntensity']};",
                    src, count=1
                )

            with open(SCENE_JS, 'w', encoding='utf-8') as f:
                f.write(src)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': True}).encode())
            print(f'  ✅ Config saved to scene.js')

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())
            print(f'  ❌ Save error: {e}')

    def do_OPTIONS(self):
        """Handle CORS preflight for the save endpoint."""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    with http.server.HTTPServer(('', port), DevHandler) as httpd:
        print(f'🚀 Dev server running at http://localhost:{port}')
        print(f'   Static root: {ROOT}')
        print(f'   Save endpoint: POST /__dev/save → scene.js')
        print(f'   Press Ctrl+C to stop\n')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\n👋 Server stopped.')
