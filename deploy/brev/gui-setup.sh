#!/bin/bash
set -euo pipefail
umask 077
owner=$(id -un)
[[ $owner != root ]] || owner=ubuntu
uid=$(id -u "$owner")
base=$(getent passwd "$owner" | cut -d: -f6)/.local/share/santa-claw-onboarding
sudo install -d -o "$owner" -m 700 "$base"
if [[ -n ${SANTA_SOURCE_URL:-} ]]; then
  case "$SANTA_SOURCE_URL" in https://*) ;; *) exit 41;; esac
  sudo -Hu "$owner" curl -fsSL --proto '=https' --proto-redir '=https' --retry 3 "$SANTA_SOURCE_URL" -o "$base/source.tar.gz"
  unset SANTA_SOURCE_URL
fi
base64 -d <<'INSTALLER' | gzip -dc | sudo -Hu "$owner" tee "$base/install.sh" >/dev/null
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
INSTALLER
sudo -Hu "$owner" tee "$base/onboarding.py" >/dev/null <<'SANTA_PAYLOAD'
import os
import re
import secrets
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs

directory = Path(__file__).resolve().parent
completed = directory / "complete"
state = "ready" if completed.exists() else "setup"
lock = threading.Lock()
nonce = secrets.token_urlsafe(32)
model_default = "nvidia/nemotron-3.5-super-vl-120b-a12b"


def install(runtime, model, key):
    global state
    try:
        subprocess.run(["bash", str(directory / "install.sh")], check=True,
                       env={**os.environ, "SANTA_RUNTIME": runtime, "SANTA_MODEL": model,
                            "NVIDIA_INFERENCE_API_KEY": key}, stdin=subprocess.DEVNULL,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        completed.touch(mode=0o600)
        state = "ready"
    except subprocess.CalledProcessError as error:
        state = "source" if error.returncode == 41 else "failed"
    except OSError:
        state = "failed"


class Page(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path != "/":
            return self.send_error(404)
        form = f"""<form method="post"><input type="hidden" name="nonce" value="{nonce}">
        <label>Agent runtime<select name="runtime"><option value="hermes">Hermes</option><option value="openclaw">OpenClaw</option></select></label>
        <label>NVIDIA Build model<input name="model" required maxlength="200" value="{model_default}"></label>
        <label>NVIDIA Build API key<input name="key" type="password" required autocomplete="off" maxlength="512"></label>
        <p><a href="https://build.nvidia.com/" target="_blank" rel="noreferrer">Get a key from NVIDIA Build ↗</a></p>
        <button>Start my workshop →</button></form>"""
        phase = state
        body = {"setup":form, "source":"<p>Application source unavailable. Ask the organizer to stage the verified workshop archive, then retry.</p>"+form, "failed":"<p>Installation stopped. Check the private installer diagnostics on this VM before retrying.</p>"+form,
                "installing":"<progress aria-label='Installing workshop'></progress><p>Open <strong>Santa Claw Village</strong> from your Brev instance.</p>",
                "ready":"<p>Your workshop is ready. Open <strong>Enter Santa Claw Village</strong> on your Brev instance page.</p>"}[phase]
        refresh = '<meta http-equiv="refresh" content="5">' if phase == "installing" else ""
        page = f"""<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">{refresh}
        <title>Santa Claw Workshop</title><style>*{{box-sizing:border-box}}body{{margin:0;background:radial-gradient(ellipse at top right,#213227,#101310 55%);min-height:100vh;color:#f6f8f4;font:18px/1.5 system-ui}}
        main{{max-width:640px;margin:6vh auto;padding:clamp(20px,5vw,54px);background:#191d19;border:1px solid #394437;border-top:4px solid #76b900;border-radius:12px}}h1{{font: bold clamp(2rem,5vw,3rem) system-ui;margin:.3em 0}}label{{display:block;margin:18px 0}}
        input,select,button{{display:block;width:100%;margin-top:5px;border:0;border-radius:8px;padding:13px;font:inherit}}
        button{{background:#9bda39;color:#372610;cursor:pointer;font-weight:bold}}a{{color:#b6ea63}}</style><main>
        <span style="color:#a8dc61">NVIDIA Build &nbsp; / &nbsp; CPU workshop</span><h1>Santa Claw Village</h1>{body}</main></html>"""
        self.send_response(200)
        self.send_header("Content-Type","text/html; charset=utf-8")
        self.send_header("Cache-Control","no-store")
        self.send_header("Content-Security-Policy","default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'")
        self.end_headers()
        self.wfile.write(page.encode())

    def do_POST(self):
        if self.path != "/" or self.headers.get("Sec-Fetch-Site") == "cross-site":
            return self.send_error(403)
        try:
            size = int(self.headers.get("Content-Length", 0))
            if not 0 < size <= 4096:
                return self.send_error(413)
            values = parse_qs(self.rfile.read(size).decode(), max_num_fields=4)
            runtime, model, key, token = (values[name][0] for name in ("runtime","model","key","nonce"))
            if not secrets.compare_digest(nonce,token) or runtime not in ("hermes","openclaw") or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._/:+-]{0,199}",model) or not re.fullmatch(r"[!-~]{1,512}",key):
                return self.send_error(400)
        except (ValueError, KeyError, TypeError):
            return self.send_error(400)
        global state
        with lock:
            if state in ("setup","source","failed"):
                state = "installing"
                threading.Thread(target=install,args=(runtime,model,key),daemon=True).start()
        self.send_response(303)
        self.send_header("Location","/")
        self.end_headers()


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0",4312),Page).serve_forever()

SANTA_PAYLOAD
sudo loginctl enable-linger "$owner"
sudo systemctl start "user@$uid.service"
unitdir=$(getent passwd "$owner" | cut -d: -f6)/.config/systemd/user
sudo -Hu "$owner" mkdir -p "$unitdir"
sudo -Hu "$owner" tee "$unitdir/santa-claw-onboarding.service" >/dev/null <<'UNIT'
[Unit]
Description=Santa Claw workshop onboarding
[Service]
ExecStart=/usr/bin/python3 %h/.local/share/santa-claw-onboarding/onboarding.py
Restart=on-failure
UMask=0077
[Install]
WantedBy=default.target
UNIT
ctl=(sudo -Hu "$owner" env XDG_RUNTIME_DIR="/run/user/$uid" DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$uid/bus" systemctl --user)
sudo -Hu "$owner" tee "$base/wait.py" >/dev/null <<'PYTHON'
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import subprocess
class Waiting(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type","text/html; charset=utf-8")
        self.send_header("Cache-Control","no-store")
        self.end_headers()
        failed=subprocess.run(['systemctl','--user','is-failed','--quiet','santa-claw-launchable.service']).returncode==0
        self.wfile.write(b'<meta name="viewport" content="width=device-width"><meta http-equiv="refresh" content="5;url=/"><title>Santa Claw Village</title><body style="background:#151815;color:white;font:20px system-ui;padding:10vw"><h1 style="color:#a8dc61">Santa Claw Village</h1><p>'+(b'Installation stopped. Open Santa Claw Setup on your Brev instance for recovery.' if failed else b'<progress aria-label="Workshop setup"></progress> Waiting for setup.')+b'</p>')
ThreadingHTTPServer(("0.0.0.0",4311),Waiting).serve_forever()
PYTHON
sudo -Hu "$owner" tee "$unitdir/santa-claw-wait.service" >/dev/null <<'UNIT'
[Unit]
Conflicts=santa-claw-welcome.service
Before=santa-claw-welcome.service
[Service]
ExecStart=/usr/bin/python3 %h/.local/share/santa-claw-onboarding/wait.py
UNIT
"${ctl[@]}" daemon-reload
"${ctl[@]}" enable --now santa-claw-onboarding.service
if ! "${ctl[@]}" is-active --quiet santa-claw-welcome.service; then "${ctl[@]}" start santa-claw-wait.service; fi
