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
elif [[ -n ${SANTA_RELEASE_TOKEN:-} ]]; then
  set +x
  printf 'Authorization: Bearer %s\n' "$SANTA_RELEASE_TOKEN" |
    sudo -Hu "$owner" curl -fsSL --proto '=https' --proto-redir '=https' --retry 3 \
      --header @- --header 'Accept: application/octet-stream' \
      https://api.github.com/repos/Soragi/santa-claw-brev/releases/assets/763493895 \
      -o "$base/source.tar.gz"
  unset SANTA_RELEASE_TOKEN
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
docker_gid=$(getent group docker | cut -d: -f3)
manager_pid=$(systemctl show "user@$uid.service" -p MainPID --value)
if [[ -n $docker_gid ]] && id -G "$owner" | tr ' ' '\n' | grep -Fxq "$docker_gid" && ! awk '/^Groups:/{for(i=2;i<=NF;i++) if($i==g) found=1} END{exit !found}' g="$docker_gid" "/proc/$manager_pid/status"; then
  sudo systemctl restart "user@$uid.service"
fi
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
