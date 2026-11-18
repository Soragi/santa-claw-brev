#!/bin/bash
set -euo pipefail
umask 077
owner=$(id -un)
[[ $owner != root ]] || owner=ubuntu
uid=$(id -u "$owner")
owner_home=$(getent passwd "$owner" | cut -d: -f6)
# Earlier Launchables created these two parent directories as root.
for parent in "$owner_home/.local" "$owner_home/.local/share"; do
  if [[ -d $parent && ! -L $parent && $(stat -c %u "$parent") == 0 ]]; then
    sudo chown --no-dereference "$owner" "$parent"
  fi
done
base="$owner_home/.local/share/santa-claw-onboarding"
sudo -Hu "$owner" mkdir -p "$base"
sudo -Hu "$owner" chmod 700 "$base"
# A fresh VM can fetch the public, pinned release without credentials.
if [[ -z ${SANTA_SOURCE_URL:-} && -z ${SANTA_RELEASE_TOKEN:-} ]]; then
  SANTA_SOURCE_URL=https://github.com/Soragi/santa-claw-brev/releases/download/workshop-source-7bfa654/santa-claw-launchable-source.tar.gz
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
      https://api.github.com/repos/Soragi/santa-claw-brev/releases/assets/764085703 \
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

PAGE = """<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="5;url=/"><title>Santa Claw Village</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;background:#101b20;color:#f5f8f6;font:16px/1.55 system-ui}
main{width:min(100%,590px);overflow:hidden;border:1px solid #3e5752;border-radius:22px;background:#192b2a}
.scene{height:clamp(138px,32vw,234px);display:flex;align-items:end;justify-content:center;gap:9%;padding-bottom:28px;overflow:hidden;
background:radial-gradient(circle at 74% 22%,#f8edcc 0 15px,transparent 16px),radial-gradient(ellipse at 18% 108%,#e9f2ee 0 41%,transparent 42%),radial-gradient(ellipse at 86% 106%,#cbdfdb 0 46%,transparent 47%),linear-gradient(#133341,#527971)}
.house{width:67px;height:96px;flex-shrink:0;clip-path:polygon(50% 0,100% 40%,92% 40%,92% 100%,8% 100%,8% 40%,0 40%);background:linear-gradient(#faf8ea 40%,transparent 41%),linear-gradient(#ffd986 0 0) 29% 67%/12px 14px no-repeat,linear-gradient(#ffd986 0 0) 71% 67%/12px 14px no-repeat,#8f3432}
.house:first-child{transform:scale(.72);transform-origin:bottom}.house:last-child{transform:scale(.84);transform-origin:bottom}
section{padding:clamp(22px,6vw,40px)}small{color:#b8ea84;letter-spacing:.09em;font-weight:700}h1{font-size:clamp(2rem,7vw,3rem);line-height:1.08;margin:.25em 0}p{margin:.75em 0 0;color:#d5e4df}
progress{width:100%;height:12px;margin-top:18px;accent-color:#a8dc61}
</style>
<main><div class="scene" aria-hidden="true"><i class="house"></i><i class="house"></i><i class="house"></i></div>
<section><small>WORKSHOP PREVIEW</small><h1>Santa Claw Village</h1>%s</section></main></html>"""

class Waiting(BaseHTTPRequestHandler):
    def do_GET(self):
        state = subprocess.run(
            ["systemctl", "--user", "show", "-p", "ActiveState", "--value", "santa-claw-launchable.service"],
            capture_output=True, text=True,
        ).stdout.strip()
        if state == "failed":
            status = "<p><strong>Installation stopped.</strong> Open Santa Claw Setup in Brev for recovery.</p>"
        elif state in ("activating", "active"):
            status = ('<progress aria-label="Preparing your village"></progress>'
                      '<p><strong>Preparing your village.</strong> First setup can take six minutes or longer. '
                      'This preview refreshes automatically and opens the village when ready.</p>')
        else:
            status = ("<p>Open <strong>Santa Claw Setup</strong> in Brev to get started. "
                      "First setup takes several minutes.</p>")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(PAGE.replace("%s", status).encode())

ThreadingHTTPServer(("0.0.0.0", 4311), Waiting).serve_forever()
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
