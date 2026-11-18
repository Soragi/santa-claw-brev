#!/usr/bin/env bash
# Explicit foreground launch; never stop/adopt another service or install packages.
set -euo pipefail
SANTA_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SANTA_ROOT"
node deploy/check-gb10.mjs --stage host
command -v ss >/dev/null || { echo "Install the host iproute2 tools for a safe port-ownership check." >&2; exit 1; }
SANTA_PORT="${NEMOCLAW_VLLM_PORT:-8000}"
[[ "$SANTA_PORT" =~ ^[0-9]+$ ]] && [ "$SANTA_PORT" -ge 1024 ] && [ "$SANTA_PORT" -le 65535 ] || exit 1
if [ -n "$(ss -H -ltn "sport = :$SANTA_PORT")" ]; then
 echo "Port $SANTA_PORT is already occupied. Reuse it only after check:gb10 validates its model and native route. This launcher will not stop or replace it." >&2
 exit 1
fi
SANTA_VLLM="${SANTA_VLLM_BIN:-$SANTA_ROOT/.venv-vllm/bin/vllm}"
[ -x "$SANTA_VLLM" ] || { echo 'Install the pinned GB10 environment first; see docs/vllm-setup.md.' >&2; exit 1; }
SANTA_MODEL="${SANTA_LOCAL_MODEL:-santa-qwen}"
[[ "$SANTA_MODEL" =~ ^[a-zA-Z0-9][a-zA-Z0-9._/:+-]{0,199}$ ]] || exit 1
export CUTE_DSL_ARCH=sm_121a MAX_JOBS=8
export HF_HOME="${HF_HOME:-$SANTA_ROOT/models/huggingface}"
echo 'Starting the pinned GB10 Qwen model on loopback. First launch may download weights. Keep this terminal open; Ctrl-C stops this foreground process only.'
exec "$SANTA_VLLM" serve nvidia/Qwen3.6-35B-A3B-NVFP4 \
 --revision 1355db6a052410cfd62085d94b58866fd0f2c3c5 \
 --served-model-name "$SANTA_MODEL" --host 127.0.0.1 --port "$SANTA_PORT" \
 --tensor-parallel-size 1 --moe-backend flashinfer_b12x --attention-backend flashinfer \
 --kv-cache-dtype fp8 --enable-auto-tool-choice --tool-call-parser qwen3_coder \
 --reasoning-parser qwen3 --default-chat-template-kwargs '{"enable_thinking":false}' \
 --gpu-memory-utilization 0.6 --max-model-len 32768 --max-num-seqs 1 \
 --max-num-batched-tokens 8192 --enable-chunked-prefill --async-scheduling \
 --enable-prefix-caching --load-format fastsafetensors --trust-remote-code
