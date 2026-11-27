#!/usr/bin/env bash
# One local installation, one private workshop. Provider keys stay with NemoClaw.
set -euo pipefail
SANTA_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
command -v node >/dev/null || { echo 'Install Node.js 22.19+.' >&2; exit 1; }
command -v nemoclaw >/dev/null || { echo 'Set up NemoClaw on this host first: https://docs.nvidia.com/nemoclaw/'; exit 1; }
if [ -r /etc/nemoclaw/gateway-management.env ]; then set -a; . /etc/nemoclaw/gateway-management.env; set +a; fi
if [ -z "${SANTA_SANDBOX:-}" ]; then
 SANTA_SANDBOX="$(nemoclaw list --json | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{try{const v=JSON.parse(s.slice(s.indexOf("{")));if(v.sandboxes?.length===1)process.stdout.write(v.sandboxes[0].name||v.sandboxes[0].sandboxName);}catch{console.error("Native JSON inventory is unavailable. Run npm run check:gb10 and use a supported NemoClaw toolchain.");process.exit(1);}});')"
fi
if [ -z "${SANTA_SANDBOX:-}" ]; then
 echo 'Choose this installation’s NemoClaw sandbox: export SANTA_SANDBOX=your-sandbox'
 echo 'For a fresh Spark with a running local model: export SANTA_SANDBOX=santa-claw-gb10; npm run onboard:gb10'
 echo 'Then rerun this script. Keep credentials in the native setup.'
 exit 1
fi
export SANTA_NETWORK_GUARD=1
export SANTA_SANDBOX
export SANTA_DATA="${SANTA_DATA:-$SANTA_ROOT/data}"
mkdir -p "$SANTA_DATA"
chmod 700 "$SANTA_DATA"
cd "$SANTA_ROOT"
if [ -n "${SANTA_GB10_BOOT_STATE:-}" ]; then
 bash "$SANTA_ROOT/deploy/gb10-sandbox-boot.sh" start
fi
node "$SANTA_ROOT/deploy/check-gb10.mjs" --stage runtime
if [ ! -d node_modules ]; then npm ci --ignore-scripts; fi
if [ ! -f dist/index.html ]; then npm run build; fi
echo "Open http://127.0.0.1:${PORT:-4310}/santa/ on this Spark, or forward the loopback port over SSH."
echo 'This trusted local workshop has no application accounts. Keep it on loopback or behind your authenticated proxy or SSH tunnel to this Spark.'
exec node server/private-index.mjs
