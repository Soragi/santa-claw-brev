#!/bin/bash
set -euo pipefail
umask 077
owner=$(id -un)
[[ $owner != root ]] || owner=ubuntu
uid=$(id -u "$owner")
base=$(getent passwd "$owner" | cut -d: -f6)/.local/share/santa-claw-onboarding
sudo install -d -o "$owner" -m 700 "$base"
sudo -Hu "$owner" tee "$base/install.sh" >/dev/null <<'SANTA_PAYLOAD'
#!/bin/bash
# Paste this complete script into a Brev VM Mode Launchable.
set +x
set -euo pipefail
umask 077
revision=1f960e386199e7f816b276fdfa233237e8411f6a
agent=${SANTA_RUNTIME:-hermes}
model=${SANTA_MODEL:-nvidia/nemotron-3.5-super-vl-120b-a12b}
case "$agent" in hermes|openclaw) ;; *) echo 'Choose Hermes or OpenClaw.' >&2; exit 2;; esac
[[ $model =~ ^[a-zA-Z0-9][a-zA-Z0-9._/:+-]{0,199}$ ]] || { echo 'Invalid model ID.' >&2; exit 2; }
[[ $(uname -s) == Linux ]] || { echo 'Run in a Linux Brev CPU VM.' >&2; exit 2; }
for vendor in /sys/bus/pci/devices/*/vendor; do
  [[ -f $vendor ]] || continue
  if [[ $(cat "$vendor") == 0x10de ]] && [[ $(cat "${vendor%/vendor}/class") == 0x03* ]]; then
    echo 'GPU detected. Select CPU hardware in Brev before deploying Santa Claw.' >&2; exit 2
  fi
done
if [[ ${1:-} == --plan ]]; then
  printf 'Santa Claw · %s · NVIDIA Build · %s · CPU · port 4310 · factory enabled\n' "$agent" "$model"
  exit 0
fi
[[ -n ${NVIDIA_INFERENCE_API_KEY:-} ]] || { echo 'Select your NVIDIA Build key in Brev Setup values.' >&2; exit 2; }
key=$NVIDIA_INFERENCE_API_KEY
unset NVIDIA_INFERENCE_API_KEY
owner=$(id -un); [[ $owner != root ]] || owner=ubuntu
uid=$(id -u "$owner"); owner_home=$(getent passwd "$owner" | cut -d: -f6)
as_owner() { if [[ $(id -u) == "$uid" ]]; then "$@"; else sudo -Hu "$owner" "$@"; fi; }
userctl() { as_owner env XDG_RUNTIME_DIR="/run/user/$uid" DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$uid/bus" systemctl --user "$@"; }
root="$owner_home/santa-claw-launchable"; conf="$owner_home/.config/santa-claw-launchable"
unitdir="$owner_home/.config/systemd/user"; service=santa-claw-launchable.service
sudo -n loginctl enable-linger "$owner"
sudo -n systemctl start "user@$uid.service"
as_owner mkdir -p "$conf" "$unitdir"
if ! as_owner test -d "$root"; then
  echo '1/3 · Unpacking the North Pole workshop…'
  as_owner git clone --quiet https://github.com/Soragi/santa-claw.git "$root"
  as_owner git -C "$root" checkout -q --detach "$revision"
fi
[[ $(as_owner git -C "$root" rev-parse HEAD) == "$revision" ]] || { echo 'Existing checkout differs; preserving it.' >&2; exit 1; }
if as_owner test -e "$conf/options" && ! printf '%s\n%s\n' "$agent" "$model" | as_owner cmp -s - "$conf/options"; then
  echo 'This instance already has a different runtime or model. Create a new instance or reconfigure it explicitly.' >&2; exit 1
fi
printf '%s\n%s\n' "$agent" "$model" | as_owner tee "$conf/options" >/dev/null
as_owner tee "$conf/start" >/dev/null <<'START'
#!/bin/bash
set -eu
umask 077
mapfile -t options < "$HOME/.config/santa-claw-launchable/options"
keyfile="$XDG_RUNTIME_DIR/santa-claw-launch.key"
if [[ -f $keyfile ]]; then
  NVIDIA_INFERENCE_API_KEY=$(cat "$keyfile"); export NVIDIA_INFERENCE_API_KEY
  rm -f -- "$keyfile"
fi
cd "$HOME/santa-claw-launchable"
args=(up --agent "${options[0]}" --provider build --model "${options[1]}" --port 4310 --factory --yes)
diagnostic="$HOME/.config/santa-claw-launchable/install.stderr"
if ! ./santa-claw "${args[@]}" >/dev/null 2>"$diagnostic"; then
  if grep -Fq 'Named sandbox was not provisioned.' "$diagnostic"; then
    ./santa-claw "${args[@]}" >/dev/null 2>>"$diagnostic"
  else
    exit 1
  fi
fi
START
as_owner tee "$unitdir/$service" >/dev/null <<'UNIT'
[Unit]
Description=Santa Claw CPU workshop with NVIDIA hosted inference
After=nemoclaw-openshell-gateway.service

[Service]
Type=oneshot
RemainAfterExit=yes
TimeoutStartSec=2h
UMask=0077
ExecStart=/bin/bash %h/.config/santa-claw-launchable/start
StandardOutput=null
StandardError=null

[Install]
WantedBy=default.target
UNIT
as_owner tee "$conf/village.cjs" >/dev/null <<'RELAY'
const http = require('node:http');
const net = require('node:net');
const target = 4310;
function headers(req) {
  const host = req.headers.host;
  const landing = req.method === 'GET' && req.url === '/';
  if (!host || !/^[a-z0-9.-]+(:\d+)?$/i.test(host) || (!landing && req.headers['sec-fetch-site'] === 'cross-site')) return null;
  if (req.headers.origin && req.headers.origin !== `https://${host}`) return null;
  const result = {...req.headers, host:`127.0.0.1:${target}`, 'x-forwarded-proto':'http'};
  for (const key of ['authorization','cookie','forwarded','x-forwarded-host','x-forwarded-for']) delete result[key];
  if (result.origin) result.origin = `http://127.0.0.1:${target}`;
  return result;
}
const server = http.createServer((req,res) => {
  const checked = headers(req);
  if (!checked) {res.writeHead(403).end(); return;}
  if (req.url === '/') {res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"}).end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Santa Claw · North Pole</title><style>body{margin:0;background:#102722;color:#fff;font:18px/1.6 system-ui}main{max-width:680px;margin:14vh auto;padding:32px}small{color:#bbe98a;font-weight:700;letter-spacing:.12em}h1{font-size:clamp(38px,7vw,72px);line-height:1.04}a{display:inline-block;background:#bded82;color:#15271e;padding:12px 24px;border-radius:8px;font-weight:bold}</style><main><small>NORTH POLE  /  DEVELOPER WORKSHOP</small><h1>Your village is ready.</h1><p>Build a Claw, give it a job, and put your team to work in Santa’s workshop. Your agents run on this CPU instance; NVIDIA hosts the model.</p><a href="/santa/">Enter Santa Claw Village →</a></main>`);return;}
  if (!req.url.startsWith('/santa/')) {res.writeHead(404).end(); return;}
  const upstream = http.request({hostname:'127.0.0.1',port:target,method:req.method,path:req.url,headers:checked},reply=>{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);});
  upstream.on('error',()=>{if(!res.headersSent)res.writeHead(503);res.end();});req.pipe(upstream);
});
server.on('upgrade',(req,socket,head)=>{
  const checked=headers(req);
  if (!checked || !req.headers.origin || !req.url.startsWith('/santa/') || req.headers.upgrade?.toLowerCase()!=='websocket') return socket.destroy();
  const upstream=net.connect(target,'127.0.0.1',()=>{
    upstream.write(`${req.method} ${req.url} HTTP/1.1\r\n`+Object.entries(checked).map(([k,v])=>`${k}: ${v}\r\n`).join('')+'\r\n');
    if(head.length)upstream.write(head);socket.pipe(upstream).pipe(socket);
  });
  socket.on('error',()=>upstream.destroy());upstream.on('error',()=>socket.destroy());socket.on('close',()=>upstream.destroy());upstream.on('close',()=>socket.destroy());
});
server.listen(4311,'0.0.0.0');
RELAY
as_owner tee "$conf/welcome" >/dev/null <<'WELCOME'
#!/bin/bash
set -eu
cd "$HOME/santa-claw-launchable/deploy"
node=$(python3 -c 'import launcher,os;print(launcher.ensure_node(dict(os.environ)))')
exec "$node" "$HOME/.config/santa-claw-launchable/village.cjs"
WELCOME
as_owner tee "$unitdir/santa-claw-welcome.service" >/dev/null <<'UNIT'
[Unit]
Description=Santa Claw authenticated Brev link destination
After=santa-claw-launchable.service
Requires=santa-claw-launchable.service
[Service]
ExecStart=/bin/bash %h/.config/santa-claw-launchable/welcome
Restart=on-failure
[Install]
WantedBy=default.target
UNIT
userctl daemon-reload
userctl enable "$service" santa-claw-welcome.service
ready() { curl --silent --fail --max-time 40 http://127.0.0.1:4310/santa/api/ready | python3 -c 'import json,sys;sys.exit(json.load(sys.stdin).get("ok") is not True)' 2>/dev/null; }
if ! userctl is-active --quiet "$service" || ! ready; then
  echo '2/3 · Starting agents, connecting inference and building the village…'
  keyfile="/run/user/$uid/santa-claw-launch.key"
  trap 'as_owner rm -f -- "$keyfile"' EXIT
  as_owner install -m 600 /dev/null "$keyfile"
  printf '%s' "$key" | as_owner tee "$keyfile" >/dev/null; unset key
  userctl restart "$service" || { echo 'Installation failed. See the recovery instructions and private native diagnostics.' >&2; exit 1; }
fi
ready || { echo 'Village readiness check failed.' >&2; exit 1; }
userctl start santa-claw-welcome.service
curl --fail --silent --retry 8 --retry-connrefused --retry-delay 1 http://127.0.0.1:4311/santa/api/ready >/dev/null
echo '3/3 · Village ready. Select Enter Santa Claw Village on the Brev instance page.'

SANTA_PAYLOAD
sudo -Hu "$owner" tee "$base/onboarding.py" >/dev/null <<'SANTA_PAYLOAD'
import html
import os
import re
import secrets
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

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
    except (OSError, subprocess.SubprocessError):
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
        body = {"setup":form, "failed":"<p>Setup failed. Check the key and model, then retry.</p>"+form,
                "installing":"<p>Preparing your agents and connecting inference. This page refreshes automatically.</p>",
                "ready":"<p>Your workshop is ready. Open <strong>Enter Santa Claw Village</strong> on your Brev instance page.</p>"}[phase]
        refresh = '<meta http-equiv="refresh" content="5">' if phase == "installing" else ""
        page = f"""<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">{refresh}
        <title>Santa Claw Workshop</title><style>*{{box-sizing:border-box}}body{{margin:0;background:#113d33;color:#fff9ea;font:18px/1.5 system-ui}}
        main{{max-width:560px;margin:6vh auto;padding:32px}}h1{{font: bold 3rem Georgia;margin:.3em 0}}label{{display:block;margin:18px 0}}
        input,select,button{{display:block;width:100%;margin-top:5px;border:0;border-radius:8px;padding:13px;font:inherit}}
        button{{background:#ffd59b;color:#372610;cursor:pointer;font-weight:bold}}a{{color:#ffe0ae}}</style><main>
        <span aria-hidden="true">🎄 ❄</span><h1>Santa Claw Workshop</h1>{body}</main></html>"""
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
            if state in ("setup","failed"):
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
"${ctl[@]}" daemon-reload
"${ctl[@]}" enable --now santa-claw-onboarding.service
