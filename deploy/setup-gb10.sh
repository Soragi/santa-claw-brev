#!/usr/bin/env bash
# GB10 setup is explicit: never install/replace native tooling or model weights here.
set -euo pipefail
SANTA_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SANTA_ROOT"
command -v node >/dev/null || { echo "Install Node.js 22.19+ and npm on this Spark first; see docs/gb10-setup.md." >&2; exit 1; }
command -v npm >/dev/null || { echo "npm is required to prepare this Spark checkout." >&2; exit 1; }
if [ -r /etc/nemoclaw/gateway-management.env ]; then set -a; . /etc/nemoclaw/gateway-management.env; set +a; fi
case "${1:-check}" in
 check) exec node deploy/check-gb10.mjs ;;
 prepare)
  node deploy/check-gb10.mjs --stage host
  npm ci --ignore-scripts
  npm run browser:prepare
  npm run build
  echo 'ARM64 app prepared. Complete the local model/native setup next; no weights or native runtime were installed.'
  ;;
 onboard)
  node deploy/check-gb10.mjs --stage server --smoke
  SANTA_NAME="${SANTA_SANDBOX:-santa-claw-gb10}"
  [[ "$SANTA_NAME" =~ ^[a-z][a-z0-9-]{1,40}$ ]] || exit 1
  nemoclaw list --json | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const v=JSON.parse(s.slice(s.indexOf("{")));if(!Array.isArray(v.sandboxes)||v.sandboxes.some(r=>(r.name||r.sandboxName)===process.argv[1])){console.error("Choose a fresh sandbox name. Existing sandboxes are preserved.");process.exit(1);}})' "$SANTA_NAME"
  export NEMOCLAW_PROVIDER=vllm
  if [ -n "${SANTA_LOCAL_MODEL:-}" ]; then export NEMOCLAW_MODEL="$SANTA_LOCAL_MODEL"; fi
  nemoclaw onboard --name "$SANTA_NAME" --agent openclaw
  echo "Next: export SANTA_SANDBOX=$SANTA_NAME and run npm start."
  ;;
 start) exec bash deploy/start-workshop.sh ;;
 *) echo 'Usage: bash deploy/setup-gb10.sh [check|prepare|onboard|start]' >&2; exit 2 ;;
esac
