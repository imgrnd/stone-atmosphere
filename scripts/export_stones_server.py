#!/usr/bin/env python3
"""Локальный dev-сервер: статика, экспорт партнёров, админка мини-каталога."""

from __future__ import annotations

import base64
import json
import os
import secrets
import socket
import subprocess
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
CLI = ROOT / "scripts" / "catalog-mini-cli.mjs"

try:
    from partner_export import export_himacs, export_interstone_brand, export_staron_collection, load_catalog
except ImportError:  # pragma: no cover
    from scripts.partner_export import export_himacs, export_interstone_brand, export_staron_collection, load_catalog

DEFAULT_PORT = 43124
AUTH_REALM = "AcrylicGoose Admin"
MIN_PASSWORD_LEN = 20


def server_config():
    password = os.environ.get("ADMIN_PASSWORD", "")
    user = os.environ.get("ADMIN_USER", "").strip()
    auth_enabled = bool(password)

    if auth_enabled and not user:
        print("ADMIN_PASSWORD задан, но ADMIN_USER пуст.", file=sys.stderr)
        sys.exit(1)

    if auth_enabled and len(password) < MIN_PASSWORD_LEN:
        print(
            f"ADMIN_PASSWORD короче {MIN_PASSWORD_LEN} символов — задайте более длинный пароль.",
            file=sys.stderr,
        )
        sys.exit(1)

    port_raw = os.environ.get("ADMIN_PORT", "").strip()
    port = int(port_raw) if port_raw else DEFAULT_PORT

    bind = os.environ.get("ADMIN_BIND", "").strip()
    if not bind:
        bind = "127.0.0.1" if auth_enabled else "0.0.0.0"

    return {
        "auth_enabled": auth_enabled,
        "user": user,
        "password": password,
        "bind": bind,
        "port": port,
    }


def run_node_cli(command, payload=None):
    args = ["node", str(CLI), command]

    try:
        completed = subprocess.run(
            args,
            cwd=ROOT,
            input=None if payload is None else json.dumps(payload, ensure_ascii=False),
            capture_output=True,
            text=True,
            check=False,
        )
    except OSError as error:
        raise RuntimeError(str(error)) from error

    if completed.returncode != 0:
        message = completed.stderr.strip() or completed.stdout.strip() or "Ошибка Node"
        raise RuntimeError(message)

    if not completed.stdout.strip():
        return {}

    return json.loads(completed.stdout)


class ExportHandler(SimpleHTTPRequestHandler):
    auth_enabled = False
    auth_user = ""
    auth_password = ""
    server_port = DEFAULT_PORT

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _send_unauthorized(self):
        self.send_response(401)
        self.send_header("WWW-Authenticate", f'Basic realm="{AUTH_REALM}"')
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write("Требуется авторизация".encode("utf-8"))

    def _authorized(self):
        if not self.auth_enabled:
            return True

        header = self.headers.get("Authorization")
        if not header or not header.startswith("Basic "):
            self._send_unauthorized()
            return False

        try:
            decoded = base64.b64decode(header[6:].strip(), validate=True).decode("utf-8")
        except (ValueError, UnicodeDecodeError):
            self._send_unauthorized()
            return False

        user, separator, password = decoded.partition(":")
        if not separator:
            self._send_unauthorized()
            return False

        user_ok = secrets.compare_digest(user, self.auth_user)
        pass_ok = secrets.compare_digest(password, self.auth_password)
        if not (user_ok and pass_ok):
            self._send_unauthorized()
            return False

        return True

    def log_message(self, format, *args):
        if args and str(args[0]).startswith("GET /api/"):
            return
        super().log_message(format, *args)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if not self._authorized():
            return

        path = urlparse(self.path).path
        if path == "/api/catalog":
            self._json_response(load_catalog())
            return
        if path == "/api/health":
            self._json_response({
                "ok": True,
                "port": self.server_port,
                "features": ["export", "catalog-mini"],
                "auth": self.auth_enabled,
            })
            return
        if path == "/api/catalog-mini/state":
            try:
                self._json_response(run_node_cli("state"))
            except RuntimeError as error:
                self._json_response({"error": str(error)}, status=502)
            return
        if path == "/api/catalog-mini/candidates":
            try:
                self._json_response(run_node_cli("candidates"))
            except RuntimeError as error:
                self._json_response({"error": str(error)}, status=502)
            return
        super().do_GET()

    def do_PUT(self):
        if not self._authorized():
            return

        path = urlparse(self.path).path
        if path == "/api/catalog-mini/config":
            self._save_catalog_config()
            return
        self.send_error(404)

    def do_POST(self):
        if not self._authorized():
            return

        path = urlparse(self.path).path

        if path == "/api/catalog-mini/config":
            self._save_catalog_config()
            return

        if path == "/api/catalog-mini/rebuild":
            try:
                self._json_response(run_node_cli("rebuild"))
            except RuntimeError as error:
                self._json_response({"error": str(error)}, status=400)
            return

        if path != "/api/export":
            self.send_error(404)
            return

        payload = self._read_json_body()
        if payload is None:
            return

        source = payload.get("source")
        brand_id = payload.get("brandId")
        collection_id = payload.get("collectionId") or None
        data = load_catalog()

        try:
            if source == "interstone":
                if not brand_id:
                    raise ValueError("Нужен brandId")
                if collection_id:
                    result = export_interstone_brand(data, brand_id, collection_id)
                else:
                    result = export_interstone_brand(data, brand_id)
            elif source == "staron":
                if not collection_id:
                    raise ValueError("Нужен collectionId")
                result = export_staron_collection(data, collection_id)
            elif source == "himacs":
                result = export_himacs(data, collection_id)
            else:
                raise ValueError("source: interstone, staron или himacs")
        except ValueError as error:
            self._json_response({"error": str(error)}, status=400)
            return
        except Exception as error:  # noqa: BLE001
            self._json_response({"error": str(error)}, status=502)
            return

        self._json_response(result)

    def _save_catalog_config(self):
        payload = self._read_json_body()
        if payload is None:
            return

        try:
            self._json_response(run_node_cli("save", payload))
        except RuntimeError as error:
            self._json_response({"error": str(error)}, status=400)

    def _read_json_body(self):
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length) if length else b"{}"

        try:
            return json.loads(body.decode("utf-8"))
        except json.JSONDecodeError:
            self.send_error(400, "Некорректный JSON")
            return None

    def _json_response(self, payload, status=200):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def lan_address():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("192.168.0.1", 80))
        return sock.getsockname()[0]
    except OSError:
        return None
    finally:
        sock.close()


def run():
    config = server_config()

    ExportHandler.auth_enabled = config["auth_enabled"]
    ExportHandler.auth_user = config["user"]
    ExportHandler.auth_password = config["password"]
    ExportHandler.server_port = config["port"]

    server = ThreadingHTTPServer((config["bind"], config["port"]), ExportHandler)

    if config["auth_enabled"]:
        print(
            f"Auth включён, bind={config['bind']}:{config['port']} (откройте через HTTPS reverse proxy)",
            flush=True,
        )
    else:
        print(f"На этом компьютере: http://127.0.0.1:{config['port']}/", flush=True)
        if config["bind"] == "0.0.0.0":
            address = lan_address()
            if address and not address.startswith("127."):
                print(f"С телефона в той же сети: http://{address}:{config['port']}/", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nОстановлено.", flush=True)


if __name__ == "__main__":
    run()
