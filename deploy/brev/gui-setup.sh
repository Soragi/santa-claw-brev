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
H4sIAAAAAAAC/61a3VbbyJa+11MUDt2yO5ZkGYcfG3OaBp+EdRJgAemfIQyRpRJWkCVFJRkc4lnnah5g7uYF5hXm/jxKP8n5dpVkywa6M+tMshLs0q5d+39/u8SLNWsYRNbQESPtBTt1RMZZNgoEc+NxEnJ8E24aJBkLoixmDvsp5RP28zv2LvY4e+vkkTtyhiE3NcEz9vJe/jB4HrMkSLjvBKGWjx1xy1pbWxq2BiKIo77t72y2+Mb2pr2zw7f8bXtz2N7a9D3faW9stDe2+HbHtv1NR3NueJT11x/O948v9q/P3h9fHL0bdI0RT8dczLQxhAjnj9+dHA7edo1oEniBY0V8HGdpHBkb5itD5AlPjUlo2O3W0HDs9nCmuY7grLYuj6hBPaa4fo0THrmhc9dgvR77ocG4O4qZfjCKY9C/kTQsTtkJyA5AZups7/t2j/H7IGNtbOHCcbXLS7YupWP9/2D/fukYX/aNf2sZO1eLj+a11X1pXD20mrDCbJ1dXbGvX9lDcd5RNHHCwGOKydHhyjFsJo+o55Ez5swQDdbvs7dBlN+v8DnLI9LNKR5K9x2cvocLH3P0odaERx5+YIslpsIa5sJK3MDy4DqXC+sHSxH0mBdrjEEGw2frxSZ1shtHGc7ieBz4TErpOhksrahqUtTWvd1CAGHH999XaR4U0XfFMTMLnhCi3NPa+AFbeghQHoE9K3R8DX08hKqbcc9k5zzEJ6nkyEm9OyflpI7UfMihIwdxEsbTILph506UOeyxH8HdDzQvjrhWKPFgd40ZiWEYSehEVTmSFMnhM33BjP3jf9l3gv4//vno8Gif/ZQHobdYJeHwI4nTjHU27BZ98R03i9Mp4xEllPch0hfRWVPBVMNhUr6WBunI+BEEU0dcHx3/dXA2OD4YXO+fHl3/bfAbybscDIVppnGeLgt2y6dzG53zLE8Yoi/n4nGMgLK//tyJWh5R/j/7OL6LeNpfryOujTxq9KRh5SJb67M0jrNCYEWYD/Moy7U88Mo9MIR8VMNe+eF6FI85nt7A/VHGEgTLnTenYojGHPXI6yJMNxuaI67lg3oDJimDUzKWAVZbx1G1uWfx/ccadA+R9yL3Yma8WQhQPPQDMkoueOpmoWRbngE/Ttivh6/LqnV9eHTWr1lpHllEbqmzDn96f359Pjg/Pzo5vqbP+4eHZ/jar+VRcN9NnGzUX95DKVljyM2Mj3EmwpEeFeLMNDJivxBSGscSFJUGVTQjnNdr0CJP/WVKk5aCm2d2wLlB5gXpM3ukQJ6UE8zxPxWM/pOszOKppqwasTC+CSJSRsW+ESI1pU7K1nO6hdYic5A6NTrtR7JKybI29zEb30JYZiRgQzKSxwoNapTTa4wcH72uBkuWMp3+Uu59ZTcpT5jx1/vPqHXuLU/n+a6S6WLE2V2c3opRnKhgZBHnnmBjPh7yVIyChHIKe9ih3A+GcZ6olCoT2aZEdlJ3FEz4imHD2HVCS6CGLfkwjoYxyhosZAnksctNmMK8+VIoNVc/44IiH+pRSNTmwoNqhcanOqNEqFVqa1nVULFQtcgk+laHbzib2x3X227Zm9uu3Wm/cmx7Z8Pf2dj2fM5b29vDTX/YcTsdvtXZ7Oxwe2PHt1vbO0OPb3t65SQYeC4HlGy/2hT5GNHsjrh7i5/wcJYLKgbSUB1bCoXVG8r3ipcREYlStGo9ZbHCQr/KP7WGZLHQ3kF43H+pqs+MA3yTh9RWiOPcHZXPLHPC08APuGf8qyZZOWY8YcbFXITSeRQtqELLpFRfXh9dXF8Mzt4dHe+/vT49O3l3etFvsRvYyw3Ru2DGz3mAijzKskR0LQtPRvkQOTu2zuPUuQkqkWXStuLAVbPPDyUaaSNFJp0VU4n9jLPQgx1ppBLo1VQbpRB/HHLE4f/TkCSzLOjPCQupjMRJCcUN9g+Lij8Xteg8pdYvGOV3HiELJkHIb7gHdn5myGwniOMEdASws2eMY/QpoWBzkg/DwF0UBoWezYUB3BFaOWttdjqlDRQasYIImIcQgEG1jKdmMpU5vWI6XtQzK04yyI1eAAS1VsnWD5HK1kfgoZpxLuWMYMYqs0c1DioFEaIxcjlzwpQ73hSwSgBQeoHv85S6LvpTFgCGAgLKk0x2AEKMDg4q4t1iP56nXPWLnEBZBmsnsFaQhdMlpCGr4v9Ro4w/tswe4VYrysNQe4pONpEqFdvd1c8v9s8udO1FZS4qZprKJDN2Eh9RwYyMFYexXXB9c/Ju8MdddC4bASligaK/AhIebzRBWytwKMHtYmsVgj4HufolsC72EHCC0Ql3PovSGEvHdI5hVPaRR1yv1PEZhOCkN6JfB3o0DOkpAvSFwpetq1mNsHMaYz6jzJHA0zDUgFMhtAvCOTY2jBIaG8aUi4aG8e4mikUWuP1vsrkMwDA0RYaDy+5vVojpeJL98kc6uxIP7b3a+uK0pSZaoIPPTD/GCOYxcPOG8T27Q3JEALJSUaosmEkodJ9iw75VimUxqu2gyJeyzsroXS02W63WcsivZkOBi6z1EkWt5MT74yOkxOV7kF1ph1zVNBrkKxMPjTTzqneHPlNOGCMIDfsEkawWQH37fgZwT/O5AjQYpMWIh6Fxg5px50zn8FC7PFefrrSLacL7sCW4Z9oZH6P6SjYDqN9HUGgXKEBoROek3zl3++2R9v4d0rXfonwd3HNXPuoDoKYys8VNAeuY4bLvRn8SQtJuGlhEHsDXSZ4ledaXhaVcG6RpnKol7fJIRdyV9gu4ce+nad/jvpOHGYE1zCoaWfTJmoRmEyJ3TPeTWPXC2eDt/m+6BjKhOjrDzMTR4FNe1yOkUZcW9UavIIlQtlYpsLYgULKAhtKsp/nQlrzKRqjyALB1bMVEg9gqjoQjFUOzoDBpqTcnwFhMuLSgGfNshODro83qrwcXOvUpWs/TUC1aek+lUn1Nskb3XbPkXQndjhhXL+vdD97Lxl/WrcCk3lcnqgaR1dfKowqehTyXuuCu4fPMHRkiyLh+pU5y01gItdJoYEOWpxEjs5YCVHWK0wDTyArncnUN7D6WaGr9gSSafXzEUpkj5QIehzUeTNOs8GpKS3Y/2u0ts4W/dnf9Qbli9rHJ9HvDj9M7RBRAEYpIFutdXTp2Rqzpjqau+NPQHqMp6E4OS6fBF4e8pzd1N45vA44Pc0b4XGVL568s4ZN+1WCoxXTnp0S/xAlXCxPRUmGHBlv6ygqjwCZPKUUsCgupbT1tVoSggjrYT9tNV8KGc7lWJ6c0QQ+gtleJQgk5UU/6S2E6j6TiMeIWW827FD5/A7p6p7XRMHnk1dEAlSy9WcX5laB8tLXdajUf9ANgPrQ0gyoRPJLx+8waZeMQg/SIQGXWzzPf2IZZS0qUoRxMpsZpDJAz1bu1oggYInUZ8jHiOiblbIqJV67kkXB8bgQR5l96BPDBDbCY0/opWo1BWEqgH4pivTZTmn3cXUNFyyAfI8H2dpGBQGDY0q9NAn5HHbUmsStdqtbuAi8b9dXFniG/NAMU+MAJDYHJk/ft2t5uBmzG95Yvto7BZ8SgFN+11PNdqcTeMPamD2M4PYi6rd7QcW9p4o287gu71d5qt3tuHMZp94Xv+z0fYnTt7eTess3NYrA38mBGlR087pVE3c3tVnLfK3jancmIIdjjXuJ4lP7djXZyPxNjlNqHgvdwyHe2HcneuOPBzSjrov31ENXoFoZIHJf2mXabj2cj+0HSieAL76Lij5P6BiRqbk3umlvg3OiRI4yRYmObrc7MefACkYTOtKu8ZAwxpt8u6YppxNue62q/am/ZfC6wDbas3YFOwxh5lxqp4wW56OLYJZmHcejNdi1l110yCoxMeu4dn5xdvGGnJ28HjFmMHQ5+Hrw9OR2csV9Ozv52/ubkFLsk4e7I3vuNbvqKlsIA5SV+N3ctPNpN9tTdn3JsE+PNRGJyh32Kh02GAothprgszLgzxggsGzxdasiA+P3v/y3mLd9k8iwJ+wRNBCyO1EREwKAcAXpVUCDk3YiaGHatZG/XYaOU+/2a6sFWbW+AUE0rd7Ts50KV3//zv3YtZ2/Xkpb52OitpPRakdOm7NviF8CRul6wpRbwqDh0nioOquDkichS0r8oUtRQqRvJ4k/Z1dXnRU9vUpJ1VeFrqg7YXTTDJt3ndQvZmkX96hYla4Zil4TT/t6KcHLVVNchBzCWIiubCalOX+l1C9XoRm8mi2EptRlHdZ0TNtGb9QaYBz5ZR5T7z+GvxvKBr1Aqe7SkLDKjL5/VASVXHEHHFIMqHZEnNwhlNB1ZtgUhq0xqSGeuFu/+H5VuiQOeaL3l8rNuJYrqvkKkv5hZ/Da+4+kBymm9gQ6u3/GhklCft2713fTg2TSe1hu9R/4HYs0IJEbczeqFh6uerxeaVmwvbVr/uP6wCIEZU9+gxYy9ubg4Rf2zP6Qfoo8vT4afwBpWz9KAi3rZyUwMm/X65W1zcoUTwOx21gWTyUzuapif4gD21xsvdVrQpeRk0TrZwQx5dJONGisiScf0Cp2XPau+qkeSl4qngnYlmuZs53Zr9J6LvFULz88nOjeMBf9GnhXaxzyrcRkG6CpRHejWbuot6acW2UcC6SfR9x0P3Xj8aP75ZfD2AGPm07cCfzIVF9c7NY3wN8bxZIowiDZo6tCDsZxyFTFPm7HoyVuPermCYBB5yq9pb90LEHgxpeUkSOOo0WjoDY1jssH5RFD7thuI6oShFZo9NxBWOBSmMf+FEZFwKqI7cB0aCOXLJvTQW0buCyKJXovh8I9fG5ypkUb8CdlieqyMf6X7/nzkKxTGabLaYPo06H023PGt813xWoh5DmbdyEh5GDvefFW966C73tKiz1tbk41bvl9yCaoawCwhXbAYUia6RgFkkpdwnRZ7BMVpvivKpJMElrrF+8qeCMVPIo6aQGM9/DPpbqFOKyYJXqclgbCIGiZUrNfi21qDQAXddlykOW/orL0ICnoZJS9aSn0DYTiYLyeLW+mK6lTcFTpZuYFsWxuEOaX3aOBTAKPJikJMS/ObBYlZ5L0SLRO4KGL997//jw6O8yu3lTdqz1y4MZalTsL0eW48cS2ms8Gv8HTlhry4bGLGmG22WmyRJJW7tOrLFV09eOIusyRnVaOqN6x4RD2+sGzKi9dhS/Zc/CaBFEimF6NoUS/JuTQQ3ceiVE6l2GnuqrtMif3SYEJ3uJSX8Nni+mn5pbAtf3Eg0IqYWhxbQjV6AKAshGr+pQSPeJTKYLJJljLBCbIyDarxRWdBYl7ZSDb4gxwqMqdImHkCAQBA/+3yk0GRBRgKtt58DRDVmTL7ycyyH2VW5dpZ2WJDBXHVJNP5Lyo8C3Jj9fJQ1sn5HXpCpVvX/glpOjHttyMAAA==
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
