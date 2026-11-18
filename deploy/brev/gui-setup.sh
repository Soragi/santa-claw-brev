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
