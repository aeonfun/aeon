#!/usr/bin/env python3
"""A post-run guard must preserve push auth without trusting checkout includes."""

import base64
import http.server
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import unittest


class GitConfigAuthTest(unittest.TestCase):
    def test_guard_restores_auth_for_real_http_push(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve()
            remote, client = root / "remote.git", root / "client"
            env = {
                **os.environ,
                "GIT_CONFIG_GLOBAL": os.devnull,
                "GIT_CONFIG_SYSTEM": os.devnull,
                "GIT_TERMINAL_PROMPT": "0",
                "NO_PROXY": "127.0.0.1",
            }

            def git(*args, cwd=client):
                return subprocess.run(
                    ["git", *args], cwd=cwd, env=env, text=True,
                    capture_output=True, check=True,
                )

            git("init", "--bare", str(remote), cwd=root)
            git("config", "http.receivepack", "true", cwd=remote)
            git("init", "-b", "main", str(client), cwd=root)
            git("config", "user.name", "test")
            git("config", "user.email", "test@example.invalid")
            git("commit", "--allow-empty", "-m", "seed")
            backend = Path(git("--exec-path").stdout.strip()) / "git-http-backend"
            auth = "basic " + base64.b64encode(b"x-access-token:test-token").decode()

            class Handler(http.server.BaseHTTPRequestHandler):
                def log_message(self, *_args):
                    pass

                def serve_git(self):
                    if self.headers.get("Authorization", "").lower() != auth.lower():
                        self.send_response(401)
                        self.send_header("WWW-Authenticate", 'Basic realm="test"')
                        self.end_headers()
                        return
                    path, _, query = self.path.partition("?")
                    cgi_env = {
                        **env, "GIT_PROJECT_ROOT": str(root),
                        "GIT_HTTP_EXPORT_ALL": "1", "PATH_INFO": path,
                        "QUERY_STRING": query, "REQUEST_METHOD": self.command,
                        "CONTENT_TYPE": self.headers.get("Content-Type", ""),
                        "CONTENT_LENGTH": self.headers.get("Content-Length", "0"),
                        "REMOTE_USER": "test",
                    }
                    response = subprocess.run(
                        [str(backend)], env=cgi_env, capture_output=True, check=True,
                        input=self.rfile.read(int(cgi_env["CONTENT_LENGTH"])),
                    )
                    headers, body = response.stdout.split(b"\r\n\r\n", 1)
                    self.send_response(200)
                    for line in headers.decode().split("\r\n"):
                        key, value = line.split(":", 1)
                        self.send_header(key, value.strip())
                    self.end_headers()
                    self.wfile.write(body)

                do_GET = serve_git
                do_POST = serve_git

            with http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler) as server:
                thread = threading.Thread(target=server.serve_forever, daemon=True)
                thread.start()
                try:
                    origin = f"http://127.0.0.1:{server.server_port}"
                    git("remote", "add", "origin", origin + "/remote.git")
                    credentials = root / "checkout.config"
                    credentials.write_text(
                        f'[http "{origin}/"]\n\textraheader = AUTHORIZATION: {auth}\n'
                    )
                    git("config", f"includeIf.gitdir:{client}/.git.path", str(credentials))
                    git("push", "origin", "HEAD:main")
                    git("commit", "--allow-empty", "-m", "post-run result")
                    guard = Path(__file__).resolve().parents[1] / "git-config-guard.sh"
                    # The include becomes untrusted after the run. Its old
                    # credential must not be used to restore authentication.
                    credentials.write_text(
                        f'[http "{origin}/"]\n\textraheader = AUTHORIZATION: basic invalid\n'
                    )
                    subprocess.run(
                        ["bash", str(guard)], cwd=client, env={
                            **env, "AEON_GIT_TOKEN": "test-token",
                            "GITHUB_SERVER_URL": origin,
                        }, capture_output=True, text=True, check=True,
                    )
                    git("push", "origin", "HEAD:main")
                    self.assertEqual(
                        git("rev-parse", "main", cwd=remote).stdout,
                        git("rev-parse", "HEAD").stdout,
                    )
                finally:
                    server.shutdown()
                    thread.join()


if __name__ == "__main__":
    unittest.main()
