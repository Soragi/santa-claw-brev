#!/usr/bin/env bash
# Import the customized worker into an existing OpenClaw environment.
# Existing inference and global tool-approval policies stay authoritative.
set -euo pipefail
CLAW_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
command -v node >/dev/null || { echo 'Node.js is required.' >&2; exit 1; }
command -v openclaw >/dev/null || { echo 'Run this on the computer with your existing OpenClaw installation.' >&2; exit 1; }
node "$CLAW_ROOT/verify-package.mjs"
CLAW_AGENT="${1:-}"
if [ -z "$CLAW_AGENT" ]; then read -r -p 'Fresh OpenClaw agent ID: ' CLAW_AGENT; fi
[[ "$CLAW_AGENT" =~ ^[a-z][a-z0-9-]{1,30}$ ]] || { echo 'Use 2–31 lowercase letters, digits or hyphens.' >&2; exit 1; }
CLAW_WORKSPACE="${2:-$CLAW_ROOT/openclaw-workspace-$CLAW_AGENT}"
[[ "$CLAW_WORKSPACE" = /* ]] || { echo 'Choose an absolute workspace path.' >&2; exit 1; }
[ ! -e "$CLAW_WORKSPACE" ] || { echo 'Workspace already exists. Choose a fresh path.' >&2; exit 1; }
CLAW_INVENTORY="$(openclaw agents list --json)"
printf '%s' "$CLAW_INVENTORY" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const v=JSON.parse(s.slice(Math.min(...[s.indexOf("["),s.indexOf("{")].filter(n=>n>=0)))),a=Array.isArray(v)?v:v.agents;if(!Array.isArray(a))throw Error("Unknown agent inventory");if(a.some(x=>x.id===process.argv[1])){console.error("Agent already exists. Choose a fresh ID.");process.exit(1);}})' "$CLAW_AGENT"
node - "$CLAW_ROOT" "$CLAW_WORKSPACE" <<'COPY'
const fs=require('fs'),path=require('path');const [root,workspace]=process.argv.slice(2);fs.mkdirSync(workspace,{mode:0o700});for(const file of ['AGENTS.md','IDENTITY.md','SOUL.md','USER.md','TOOLS.md','KNOWLEDGE.md','SKILLS.md'])fs.copyFileSync(path.join(root,'agents/specialist',file),path.join(workspace,file));for(const name of Object.keys(JSON.parse(fs.readFileSync(path.join(root,'checksums.json'),'utf8')))){if(!name.startsWith('skills/')&&!name.startsWith('outputs/')&&!name.startsWith('model/')&&name!=='appearance.json')continue;const rel=name.startsWith('outputs/')?'output/imported/'+name.slice(8):name.startsWith('model/')?'character/'+name.slice(6):name==='appearance.json'?'character/appearance.json':name;const target=path.join(workspace,rel);fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});fs.copyFileSync(path.join(root,name),target);}
COPY
openclaw agents add "$CLAW_AGENT" --workspace "$CLAW_WORKSPACE" --non-interactive --json
node - "$CLAW_ROOT" "$CLAW_AGENT" <<'PATCH' | openclaw config patch --stdin
const fs=require('fs'),path=require('path');const [root,id]=process.argv.slice(2),m=JSON.parse(fs.readFileSync(path.join(root,'agents.json'),'utf8'));const worker=m.agents.find(a=>a.id==='specialist');process.stdout.write(JSON.stringify({agents:{entries:{[id]:{tools:worker.tools}}}}));
PATCH
echo "Imported agent: $CLAW_AGENT"
echo "Workspace: $CLAW_WORKSPACE"
echo 'Open your existing OpenClaw interface and start a NEW conversation with this agent.'
echo 'Its selected capabilities are subject to your existing OpenClaw approval and runtime policies.'
