#!/usr/bin/env bash
set -euo pipefail
name="${1:?Usage: bash deploy.sh NEW_SANDBOX_NAME}"
[[ "$name" =~ ^[a-z][a-z0-9-]{1,18}$ ]] || { echo 'Choose a fresh 2–19 character sandbox name.' >&2; exit 1; }
command -v nemoclaw >/dev/null || { echo 'Install NemoClaw with Hermes support first.' >&2; exit 1; }
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
nemoclaw list --json | python3 -c 'import json,sys;s=sys.stdin.read();v=json.loads(s[s.index("{"):]);assert not any((r.get("name")or r.get("sandboxName"))==sys.argv[1] for r in v["sandboxes"]),"Existing sandbox preserved"' "$name"
NEMOCLAW_AGENT=hermes nemoclaw onboard --name "$name" --agent hermes
for file in AGENTS.md SOUL.md KNOWLEDGE.md; do
 nemoclaw "$name" upload "$root/hermes/$file" "/sandbox/.hermes/$file"
done
if [ -d "$root/skills" ]; then nemoclaw "$name" upload "$root/skills" /sandbox/.hermes/skills; fi
echo 'Review native tool permissions against hermes/permissions.json, configure your own integrations, and run acceptance-prompts.json before use.'
nemoclaw "$name" dashboard-url --quiet
