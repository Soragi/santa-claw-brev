#!/usr/bin/env bash
set -euo pipefail
umask 077

checkout=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
name=santa-claw-qwen38
mode=${1:-start}
[[ $# -le 1 && ( "$mode" = start || "$mode" = --prefetch ) ]] || {
 echo 'Usage: install-gb10-model.sh [--prefetch]' >&2
 exit 2
}
model_spec=()
while IFS= read -r value; do
 model_spec+=("$value")
done < <(python3 - "$checkout/config/installer.json" <<'PY'
import json, sys
with open(sys.argv[1]) as source:
    config = json.load(source)
model = config['managedModel']
args = config['serveArguments']
context = args[args.index('--max-model-len') + 1]
print(model['repository'], model['revision'], model['image'], context, *args, sep='\n')
PY
)
repo=${model_spec[0]}
revision=${model_spec[1]}
image=${model_spec[2]}
context=${model_spec[3]}
[[ "$repo" =~ ^[a-zA-Z0-9_-]+/[a-zA-Z0-9_.-]+$ && "$revision" =~ ^[0-9a-f]{40}$ && "$image" =~ @sha256:[0-9a-f]{64}$ ]]
cache="$HOME/.cache/huggingface"
snapshot="hub/models--${repo//\//--}/snapshots/$revision"
owner_label=io.santa-claw.gb10.model-revision

cached_weights_ready(){
 python3 - "$cache/$snapshot" <<'CACHE'
import json
import sys
from pathlib import Path

snapshot = Path(sys.argv[1])
try:
    index = json.loads((snapshot / "model.safetensors.index.json").read_text())
    shards = set(index["weight_map"].values())
    if not shards or any(Path(name).name != name or not name.endswith(".safetensors") for name in shards):
        raise ValueError("Invalid weight map")
    files = shards | {
        "model.safetensors.index.json",
        "chat_template.jinja",
        "config.json",
        "generation_config.json",
        "hf_quant_config.json",
        "merges.txt",
        "preprocessor_config.json",
        "processor_config.json",
        "tokenizer.json",
        "tokenizer_config.json",
        "video_preprocessor_config.json",
        "vocab.json",
    }
    sys.exit(not all((snapshot / name).is_file() and (snapshot / name).stat().st_size > 0 for name in files))
except (OSError, ValueError, KeyError, AttributeError, TypeError):
    sys.exit(1)
CACHE
}

prepare_model(){
 if docker image inspect "$image" >/dev/null 2>&1; then
  echo 'Reusing the pinned vLLM image from the Docker cache.'
 else
  docker pull "$image"
 fi
 if cached_weights_ready; then
  echo "Reusing the pinned $repo weights from $cache."
  return
 fi
 mkdir -p "$cache"
 echo "Downloading missing files for the pinned $repo snapshot."
 docker run --rm --pull=never --user "$(id -u):$(id -g)" -e HF_HOME=/cache \
  -v "$cache:/cache" --entrypoint python3 "$image" \
  -c 'import sys; from huggingface_hub import snapshot_download; snapshot_download(sys.argv[1], revision=sys.argv[2])' "$repo" "$revision"
 cached_weights_ready || { echo 'Santa Claw: The pinned Qwen snapshot is incomplete.' >&2; return 1; }
}

if [ "$mode" = --prefetch ]; then
 prepare_model
 echo 'The pinned Qwen model and vLLM image are staged. Run bash install.sh to start Santa Claw.'
 exit 0
fi

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
 prepare_model
 docker run -d --init --pull=never --name "$name" --label "$owner_label=$revision" --restart unless-stopped \
  --gpus all --ipc=host --ulimit memlock=-1 --ulimit stack=67108864 \
  -p 127.0.0.1:8000:8000 -p "$bridge:8000:8000" \
  -v "$cache:/root/.cache/huggingface:ro" -e HF_HUB_OFFLINE=1 "$image" \
  "/root/.cache/huggingface/$snapshot" --served-model-name "$repo" "${model_spec[@]:4}" \
  --kv-cache-dtype fp8 --enable-auto-tool-choice --tool-call-parser qwen3_coder \
  --reasoning-parser qwen3 --mm-encoder-tp-mode data >/dev/null
fi
echo "Waiting for $repo on vLLM. First startup can take several minutes."
for ((attempt=0; attempt<180; attempt++)); do
 if curl --noproxy '*' -fs --max-time 4 http://127.0.0.1:8000/v1/models | python3 -c '
import json, sys
try:
    sys.exit(not any(row.get("id") == sys.argv[1] and row.get("max_model_len") == int(sys.argv[2])
                     for row in json.load(sys.stdin)["data"]))
except (ValueError, KeyError, TypeError):
    sys.exit(1)
' "$repo" "$context"; then exit 0; fi
 if [ "$(docker inspect --format '{{.State.Status}}' "$name")" = exited ] ||
    [ "$(docker inspect --format '{{.RestartCount}}' "$name")" -ge 3 ]; then break; fi
 if (( attempt % 6 == 0 )); then echo "Still waiting for Qwen ($((attempt * 5))s)"; fi
 sleep 5
done
echo "Santa Claw: Qwen did not become ready. Inspect docker logs $name." >&2
exit 1
