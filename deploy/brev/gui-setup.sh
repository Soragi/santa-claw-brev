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
