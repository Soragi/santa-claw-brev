#!/bin/bash
set -euo pipefail
umask 077
owner=$(id -un)
[[ $owner != root ]] || owner=ubuntu
uid=$(id -u "$owner")
base=$(getent passwd "$owner" | cut -d: -f6)/.local/share/santa-claw-onboarding
sudo install -d -o "$owner" -m 700 "$base"
# A fresh VM can fetch the public, pinned release without credentials.
if [[ -z ${SANTA_SOURCE_URL:-} && -z ${SANTA_RELEASE_TOKEN:-} ]]; then
  SANTA_SOURCE_URL=https://github.com/Soragi/santa-claw-brev/releases/download/workshop-source-1f960e3/santa-claw-launchable-source.tar.gz
fi
if [[ -n ${SANTA_SOURCE_URL:-} ]]; then
  if [[ $SANTA_SOURCE_URL == https://* ]]; then
  sudo -Hu "$owner" curl -fsSL --proto '=https' --proto-redir '=https' --retry 3 "$SANTA_SOURCE_URL" -o "$base/source.download" && sudo -Hu "$owner" mv "$base/source.download" "$base/source.tar.gz" || echo "Use the workshop archive upload in Setup."
  fi
  unset SANTA_SOURCE_URL
elif [[ -n ${SANTA_RELEASE_TOKEN:-} ]]; then
  set +x
  printf 'Authorization: Bearer %s\n' "$SANTA_RELEASE_TOKEN" |
    sudo -Hu "$owner" curl -fsSL --proto '=https' --proto-redir '=https' --retry 3 \
      --header @- --header 'Accept: application/octet-stream' \
      https://api.github.com/repos/Soragi/santa-claw-brev/releases/assets/763493895 \
      -o "$base/source.download" && sudo -Hu "$owner" mv "$base/source.download" "$base/source.tar.gz" || echo "Use the workshop archive upload in Setup."
  unset SANTA_RELEASE_TOKEN
fi
base64 -d <<'INSTALLER' | gzip -dc | sudo -Hu "$owner" tee "$base/install.sh" >/dev/null
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
INSTALLER
base64 -d <<'SANTA_PAYLOAD' | gzip -dc | sudo -Hu "$owner" tee "$base/onboarding.py" >/dev/null
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
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
