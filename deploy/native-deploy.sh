#!/usr/bin/env bash
# Creates a fresh native NemoClaw deployment. No workshop service is installed.
set -euo pipefail
CLAW_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
command -v node >/dev/null || { echo 'Install Node.js 22.19+ first.' >&2; exit 1; }
command -v nemoclaw >/dev/null || { echo 'Install NemoClaw on this supported host first: https://docs.nvidia.com/nemoclaw/' >&2; exit 1; }
node "$CLAW_ROOT/verify-package.mjs"
CLAW_NAME="${1:-}"
if [ -z "$CLAW_NAME" ]; then read -r -p 'Name for your new private sandbox: ' CLAW_NAME; fi
[[ "$CLAW_NAME" =~ ^[a-z][a-z0-9-]{1,30}$ ]] || { echo 'Use 2–31 lowercase letters, digits or hyphens, starting with a letter.' >&2; exit 1; }
if [ -r /etc/nemoclaw/gateway-management.env ]; then
 set -a
 . /etc/nemoclaw/gateway-management.env
 set +a
fi
# Fail closed if inventory is unavailable. Never recreate or overwrite a sandbox.
CLAW_LIST="$(nemoclaw list --json)"
printf '%s' "$CLAW_LIST" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const v=JSON.parse(s);if(!Array.isArray(v.sandboxes))throw Error("Unrecognized sandbox inventory");if(v.sandboxes.some(p=>(p.name||p.sandboxName)===process.argv[1])){console.error("Sandbox already exists. Choose a fresh name.");process.exit(1);}})' "$CLAW_NAME"
if [ "${SANTA_ALLOW_CLOUD_INFERENCE:-0}" != 1 ]; then
 node -e 'if(process.platform!=="linux"||process.arch!=="arm64")throw Error("Native deployment targets Linux ARM64 GB10; use the OpenClaw importer for other environments.");const cp=require("child_process"),gpu=cp.execFileSync("nvidia-smi",["--query-gpu=name,compute_cap","--format=csv,noheader"],{encoding:"utf8"});if(!/GB10/.test(gpu)||!/12\.1/.test(gpu))throw Error("Expected GB10 compute capability 12.1");'
fi
export NEMOCLAW_PROVIDER="${NEMOCLAW_PROVIDER:-vllm}"
if [ "${SANTA_ALLOW_CLOUD_INFERENCE:-0}" != 1 ] && [ "$NEMOCLAW_PROVIDER" != vllm ] && [ "$NEMOCLAW_PROVIDER" != ollama ]; then echo 'This GB10 export defaults to local vLLM/Ollama. Configure a local model first.' >&2; exit 1; fi
echo 'Destination: DGX Spark GB10 with local inference. Start the destination model first; the wizard configures your local native route.'
echo 'Use the destination Spark’s already-running local model. No event credentials or weights are included.'
nemoclaw onboard --name "$CLAW_NAME" --agent openclaw --agents "$CLAW_ROOT/agents.json"
printf '%s' '{"tools":{"fs":{"workspaceOnly":true},"exec":{"security":"full","ask":"off"}}}' | nemoclaw "$CLAW_NAME" exec --stdin -- openclaw config patch --stdin
# Resolve actual native workspaces; default main location can differ by runtime version.
CLAW_MAP="$(nemoclaw "$CLAW_NAME" exec -- node -e 'const fs=require("fs"),c=JSON.parse(fs.readFileSync("/sandbox/.openclaw/openclaw.json","utf8"));for(const id of ["main","specialist","reviewer"]){const a=c.agents.list.find(x=>x.id===id);if(!a)throw Error("Missing native identity "+id);const p=a.workspace||(id==="main"?c.agents.defaults.workspace:"");if(!/^\/sandbox\/\.openclaw\/workspace(?:-[a-z0-9_-]+)?$/.test(p))throw Error("Unexpected workspace");fs.mkdirSync(p,{recursive:true});console.log("CLAW_WORKSPACE:"+id+":"+p);}')"
for CLAW_ROLE in main specialist reviewer; do
 CLAW_DEST="$(printf '%s\n' "$CLAW_MAP" | sed -n "s/^CLAW_WORKSPACE:$CLAW_ROLE://p")"
 [[ "$CLAW_DEST" =~ ^/sandbox/\.openclaw/workspace(-[a-z0-9_-]+)?$ ]] || { echo 'Could not resolve the native workspace.' >&2; exit 1; }
 for CLAW_FILE in AGENTS.md IDENTITY.md SOUL.md USER.md TOOLS.md KNOWLEDGE.md SKILLS.md; do
  nemoclaw "$CLAW_NAME" upload "$CLAW_ROOT/agents/$CLAW_ROLE/$CLAW_FILE" "$CLAW_DEST/$CLAW_FILE"
 done
 while IFS= read -r -d '' CLAW_OUTPUT_FILE; do
  CLAW_OUTPUT_REL="${CLAW_OUTPUT_FILE#outputs/}"
  CLAW_OUTPUT_TARGET="$CLAW_DEST/output/imported/$CLAW_OUTPUT_REL"
  nemoclaw "$CLAW_NAME" exec -- node -e 'require("fs").mkdirSync(require("path").dirname(process.argv[1]),{recursive:true})' "$CLAW_OUTPUT_TARGET"
  nemoclaw "$CLAW_NAME" upload "$CLAW_ROOT/$CLAW_OUTPUT_FILE" "$CLAW_OUTPUT_TARGET"
 done < <(node -e 'const fs=require("fs"),c=JSON.parse(fs.readFileSync(process.argv[1]));for(const p of Object.keys(c))if(p.startsWith("outputs/"))process.stdout.write(p+"\0");' "$CLAW_ROOT/checksums.json")
 if [ -d "$CLAW_ROOT/skills" ]; then
  for CLAW_SKILL_DIR in "$CLAW_ROOT"/skills/*; do
   [ -d "$CLAW_SKILL_DIR" ] || continue
   CLAW_SKILL_NAME="$(basename -- "$CLAW_SKILL_DIR")"
   [[ "$CLAW_SKILL_NAME" =~ ^[a-z0-9-]+$ ]] || exit 1
   nemoclaw "$CLAW_NAME" exec -- node -e 'require("fs").mkdirSync(process.argv[1],{recursive:true})' "$CLAW_DEST/skills/$CLAW_SKILL_NAME"
   nemoclaw "$CLAW_NAME" upload "$CLAW_SKILL_DIR/SKILL.md" "$CLAW_DEST/skills/$CLAW_SKILL_NAME/SKILL.md"
  done
 fi
done
echo 'Your native agent is installed. Open a NEW conversation with the default main agent.'
echo 'Try the prompts in acceptance-prompts.json and verify specialist/reviewer handoffs.'
echo 'Native dashboard URL follows. Keep its authentication details private.'
nemoclaw "$CLAW_NAME" dashboard-url
