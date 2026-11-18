#!/usr/bin/env bash
# Linux staging smoke check; the existing private village must already be running.
set -euo pipefail
setup=${1:-$(dirname "$0")/../deploy/brev/setup.sh}
bash -n "$setup"
SANTA_RUNTIME=hermes bash "$setup" --plan
SANTA_RUNTIME=openclaw SANTA_MODEL=example/custom bash "$setup" --plan
if SANTA_RUNTIME=invalid bash "$setup" --plan 2>/dev/null; then exit 1; fi
if SANTA_MODEL='model;echo' bash "$setup" --plan 2>/dev/null; then exit 1; fi
tmp=$(mktemp -d); pid=''
cleanup() { if [[ -n $pid ]]; then kill "$pid" 2>/dev/null || true; fi; rm -rf -- "$tmp"; }
trap cleanup EXIT
sed -n "/<<'RELAY'/,/^RELAY$/{ /<<'RELAY'/d; /^RELAY$/d; p; }" "$setup" | sed "s/server.listen(4311,'127.0.0.1');/server.listen(0,'127.0.0.1',()=>console.log(server.address().port));/" > "$tmp/welcome.cjs"
nodebin=$(command -v node || find "$HOME/.nvm/versions/node" -name node -type f | head -1)
"$nodebin" "$tmp/welcome.cjs" > "$tmp/port" & pid=$!
for attempt in {1..30}; do [[ -s $tmp/port ]] && break; sleep 0.2; done
base="http://127.0.0.1:$(cat "$tmp/port")"
curl -fsS -H 'Sec-Fetch-Site: cross-site' "$base/" | grep -q 'Enter Santa Claw Village'
curl -fsS "$base/santa/api/ready" | python3 -c 'import json,sys; assert json.load(sys.stdin)["ok"] is True'
status=$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H 'Origin: https://unrelated.invalid' "$base/santa/api/ready")
[[ $status == 403 ]]
status=$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H 'Host: village.example' -H 'Origin: https://village.example' -H 'Content-Type: application/json' -d '{}' "$base/santa/api/nonexistent-smoke-test")
[[ $status == 404 ]]
echo 'Passed: CPU plans, selection guards, welcome page, real village readiness, allowed and denied origins.'
