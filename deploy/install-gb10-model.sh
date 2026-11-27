#!/usr/bin/env bash
set -euo pipefail
umask 077

checkout=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
name=santa-claw-qwen38
readarray -t model_spec < <(python3 - "$checkout/config/installer.json" <<'PY'
import json, sys
with open(sys.argv[1]) as source:
    config = json.load(source)
model = config['managedModel']
print(*[model['repository'], model['revision'], model['image'], *config['serveArguments']], sep='\n')
PY
)
repo=${model_spec[0]}
revision=${model_spec[1]}
image=${model_spec[2]}
[[ "$repo" =~ ^[a-zA-Z0-9_-]+/[a-zA-Z0-9_.-]+$ && "$revision" =~ ^[0-9a-f]{40}$ && "$image" =~ @sha256:[0-9a-f]{64}$ ]]
cache="$HOME/.cache/huggingface"
snapshot="hub/models--${repo//\//--}/snapshots/$revision"
owner_label=io.santa-claw.gb10.model-revision

if docker container inspect "$name" >/dev/null 2>&1; then
 existing=$(docker inspect --format '{{index .Config.Labels "io.santa-claw.gb10.model-revision"}} {{.Config.Image}}' "$name")
 if [ "$existing" != "$revision $image" ]; then
  echo "Santa Claw: $name already exists with a different image or revision. Its configuration was preserved." >&2
  exit 1
 fi
 docker start "$name" >/dev/null
else
 if [ -n "$(ss -H -ltn 'sport = :8000')" ]; then
  echo 'Santa Claw: port 8000 is already in use. The other service was preserved.' >&2
  exit 1
 fi
 # Match the pinned OpenShell Docker driver's bridge setup and host gateway alias.
 if ! docker network inspect openshell-docker >/dev/null 2>&1; then
  docker network create --driver bridge --attachable --label openshell.ai/managed-by=openshell openshell-docker >/dev/null
 fi
 [ "$(docker network inspect openshell-docker --format '{{.Driver}}')" = bridge ]
 bridge=$(docker network inspect openshell-docker --format '{{range .IPAM.Config}}{{println .Gateway}}{{end}}' | awk '/^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/ {print;exit}')
 [[ "$bridge" =~ ^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.) ]] || { echo 'Santa Claw: could not identify a private Docker bridge gateway.' >&2; exit 1; }
 docker image inspect "$image" >/dev/null 2>&1 || docker pull "$image"
 mkdir -p "$cache"
 echo "Checking the pinned $repo snapshot in the Hugging Face cache."
 docker run --rm --pull=never --user "$(id -u):$(id -g)" -e HF_HOME=/cache \
  -v "$cache:/cache" --entrypoint python3 "$image" \
  -c 'import sys; from huggingface_hub import snapshot_download; snapshot_download(sys.argv[1], revision=sys.argv[2])' "$repo" "$revision"
 docker run -d --init --pull=never --name "$name" --label "$owner_label=$revision" --restart unless-stopped \
  --gpus all --ipc=host --ulimit memlock=-1 --ulimit stack=67108864 \
  -p 127.0.0.1:8000:8000 -p "$bridge:8000:8000" \
  -v "$cache:/root/.cache/huggingface:ro" -e HF_HUB_OFFLINE=1 "$image" \
  "/root/.cache/huggingface/$snapshot" --served-model-name "$repo" "${model_spec[@]:3}" \
  --kv-cache-dtype fp8 --enable-auto-tool-choice --tool-call-parser qwen3_coder \
  --reasoning-parser qwen3 --mm-encoder-tp-mode data >/dev/null
fi
echo "Waiting for $repo on vLLM. First startup can take several minutes."
for ((attempt=0; attempt<180; attempt++)); do
 if curl --noproxy '*' -fs --max-time 4 http://127.0.0.1:8000/v1/models | python3 -c '
import json, sys
try:
    sys.exit(not any(row.get("id") == sys.argv[1] for row in json.load(sys.stdin)["data"]))
except (ValueError, KeyError, TypeError):
    sys.exit(1)
' "$repo"; then exit 0; fi
 if [ "$(docker inspect --format '{{.State.Status}}' "$name")" = exited ] ||
    [ "$(docker inspect --format '{{.RestartCount}}' "$name")" -ge 3 ]; then break; fi
 if (( attempt % 6 == 0 )); then echo "Still waiting for Qwen ($((attempt * 5))s)"; fi
 sleep 5
done
echo "Santa Claw: Qwen did not become ready. Inspect docker logs $name." >&2
exit 1
