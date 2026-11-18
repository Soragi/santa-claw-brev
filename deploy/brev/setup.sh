#!/usr/bin/env bash
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
server.listen(4311,'127.0.0.1');
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
