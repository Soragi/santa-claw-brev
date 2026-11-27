#!/usr/bin/env bash
set -euo pipefail
umask 077
SANTA_CHECKOUT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
SANTA_MODE=install
SANTA_ACCEPT=0
SANTA_REUSE=0
SANTA_NAME=santa-claw-gb10
SANTA_ORIGINAL_ARGS=("$@")
fail(){ echo "Santa Claw: $*" >&2; exit 1; }
while [ "$#" -gt 0 ]; do
 case "$1" in
 --help|-h) cat <<'HELP'
Usage: bash install.sh [--check | --plan] [--yes] [--sandbox NAME] [--reuse-existing]

Default: inspect a supported GB10, confirm once, install pinned user tools and
native local inference, build Santa Claw and install its background service.
--check             Read-only hardware/dependency report; never installs anything.
--plan              Print the pinned installation steps without modifying the host.
--yes               Accept software/image/model downloads without the initial prompt.
--sandbox NAME      Dedicated sandbox name (default santa-claw-gb10; max 19 chars).
--reuse-existing    Verify and use that exact existing local sandbox. Never upgrade it.

A supported DGX OS/OEM driver and Python 3 must already work. Missing Ubuntu
utilities/Docker/toolkit can require sudo. No driver, firmware or OS upgrade is run.
Existing services and models are never stopped/replaced. Rerun an interrupted
owned installation to resume. Keep this checkout at its release path.
HELP
 exit 0;;
 --check) SANTA_MODE=check;;
 --plan) SANTA_MODE=plan;;
 --yes) SANTA_ACCEPT=1;;
 --reuse-existing) SANTA_REUSE=1;;
 --sandbox) [ "$#" -gt 1 ] || fail 'Missing sandbox name'; SANTA_NAME="$2"; shift;;
 *) fail "Unknown option $1; use --help";;
 esac
 shift
done
[[ "$SANTA_NAME" =~ ^[a-z][a-z0-9-]{1,18}$ ]] || fail 'Use a sandbox name of 2–19 lowercase letters, digits or hyphens.'
command -v python3 >/dev/null || fail 'Python 3 is missing. Install the supported DGX OS/OEM prerequisites first.'
pin(){ python3 -c 'import json,sys;v=json.load(open(sys.argv[1]));
for k in sys.argv[2].split("."):v=v[k]
print(json.dumps(v,separators=(",",":")) if isinstance(v,(list,dict)) else v)' "$SANTA_CHECKOUT/config/installer.json" "$1"; }
SANTA_NODE_VERSION="$(pin node.version)"
SANTA_NATIVE_REF="$(pin native.commit)"
SANTA_DATA_BASE="${XDG_DATA_HOME:-$HOME/.local/share}/santa-claw"
SANTA_STATE_BASE="${XDG_STATE_HOME:-$HOME/.local/state}/santa-claw"
SANTA_NODE_ROOT="$SANTA_DATA_BASE/toolchains/node-v$SANTA_NODE_VERSION-linux-arm64"
export PATH="$SANTA_NODE_ROOT/bin:$HOME/.local/bin:$HOME/.npm-global/bin:$PATH"
SANTA_NATIVE_ARGS="$(pin serveArguments)"
print_access_links(){
 local dashboard_url dashboard_port
 printf '\nSanta Claw Village: http://127.0.0.1:4310/santa/\n'
 dashboard_url="$(nemoclaw "$SANTA_NAME" dashboard-url --quiet 2>/dev/null)" || dashboard_url=''
 if [[ "$dashboard_url" =~ ^http://(127\.0\.0\.1|localhost):([0-9]{1,5})(/[^[:space:]]*)?$ ]]; then
  dashboard_port="${BASH_REMATCH[2]}"
  printf 'OpenClaw Dashboard: %s\n' "$dashboard_url"
  printf '\nFrom a laptop, forward both ports:\n  ssh -N -L 4310:127.0.0.1:4310 -L %s:127.0.0.1:%s %s@YOUR_SPARK\n' "$dashboard_port" "$dashboard_port" "$(id -un)"
  printf 'Then open the same two links on your laptop. Keep the dashboard link private.\n'
 else
  printf 'OpenClaw Dashboard: run nemoclaw %s dashboard-url --quiet to get your private link.\n' "$SANTA_NAME"
  printf 'From a laptop, forward the Village port:\n  ssh -N -L 4310:127.0.0.1:4310 %s@YOUR_SPARK\n' "$(id -un)"
 fi
}
if [ "$SANTA_MODE" = plan ]; then
 echo "Santa Claw installation plan: $SANTA_CHECKOUT"
 echo "1. Check Linux ARM64 GB10, driver, memory, disk, Docker and existing services."
 echo "2. Prepare missing Ubuntu utilities; install verified Node $SANTA_NODE_VERSION in the user's toolchain directory."
 echo "3. Install NemoClaw $(pin native.version) from commit $SANTA_NATIVE_REF and its pinned OpenShell."
 echo "4. Provision $SANTA_NAME using local managed $(pin managedModel.slug), immutable image and model revision."
 echo "5. npm ci; prepare isolated browser image; build; verify local inference and native execution."
 echo "6. Install santa-claw-gb10 user service with private data at $SANTA_DATA_BASE/data."
 echo "7. Verify HTTP readiness; print dashboard, SSH forwarding and secure credential setup."
 echo 'No changes made.'
 exit 0
fi
[ "$(uname -s)" = Linux ] && [ "$(uname -m)" = aarch64 ] || fail 'This installer targets Linux ARM64 on GB10.'
SANTA_GPU="$(nvidia-smi --query-gpu=name,compute_cap --format=csv,noheader 2>/dev/null || true)"
[[ "$SANTA_GPU" == *GB10* && "$SANTA_GPU" == *12.1* ]] || fail 'A working GB10 driver (compute capability 12.1) is required. No driver changes were made.'
python3 - "$(pin minimumMemoryGiB)" "$(pin minimumDiskGiB)" "$SANTA_CHECKOUT" <<'PY'
import sys,shutil
m=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemTotal:')))*1024
if m<int(sys.argv[1])*2**30:raise SystemExit('This pinned 128 GB-class profile needs at least '+sys.argv[1]+' GiB detected memory. Use a separately qualified smaller profile.')
if shutil.disk_usage(sys.argv[3]).free<int(sys.argv[2])*2**30:raise SystemExit('At least '+sys.argv[2]+' GiB free space is required for this installation.')
PY
if [ "$SANTA_MODE" = check ]; then
 echo "GB10 host detected: $SANTA_GPU"
 command -v docker >/dev/null && docker info --format '{{.Architecture}}' || fail 'Docker is unavailable to this user.'
 command -v node >/dev/null || fail 'Node is not installed yet; run bash install.sh.'
 export SANTA_SANDBOX="$SANTA_NAME"
 exec node "$SANTA_CHECKOUT/deploy/check-gb10.mjs" --stage runtime --smoke
fi
[ "$(id -u)" != 0 ] || fail 'Run as the workshop user, with sudo available when needed; do not run the installer as root.'
[ -r /etc/os-release ] || fail 'Cannot identify the host operating system.'
. /etc/os-release
[[ "${ID:-}" = ubuntu || "${ID_LIKE:-}" == *ubuntu* || "${ID_LIKE:-}" == *debian* ]] || fail 'Use the supported Ubuntu/DGX OS baseline.'
systemctl --user show-environment >/dev/null 2>&1 || fail 'A working systemd user session is required. Log in normally as the workshop user, then retry.'
SANTA_UNIT="$HOME/.config/systemd/user/santa-claw-gb10.service"
SANTA_RECEIPT="$SANTA_STATE_BASE/installation.json"
SANTA_OWNED=0
if [ "$SANTA_REUSE" != 1 ]; then export SANTA_GB10_BOOT_STATE="$SANTA_STATE_BASE"; fi
if [ -f "$SANTA_RECEIPT" ]; then
 python3 "$SANTA_CHECKOUT/deploy/install-receipt.py" verify "$SANTA_RECEIPT" "$SANTA_CHECKOUT" "$SANTA_NAME" "$SANTA_REUSE"
 SANTA_OWNED=1
fi
if [ -e "$SANTA_UNIT" ]; then
 [ "$SANTA_OWNED" = 1 ] || fail 'An existing Santa service is not owned by this installer. Use --check; its files were not changed.'
 if systemctl --user is-active --quiet santa-claw-gb10; then
  echo 'The owned workshop is already running. Verifying it without rebuilding or restarting.'
  export SANTA_SANDBOX="$SANTA_NAME"
  export SANTA_DATA="$SANTA_DATA_BASE/data" SANTA_ALLOW_CLOUD_INFERENCE=0 PORT=4310
  if [ "$SANTA_REUSE" != 1 ]; then
   sudo loginctl enable-linger "$(id -un)"
   node "$SANTA_CHECKOUT/deploy/install-user-service.mjs"
  fi
  node "$SANTA_CHECKOUT/deploy/check-gb10.mjs" --stage runtime --smoke
  node "$SANTA_CHECKOUT/deploy/installer-verify.mjs"
  print_access_links
  exit 0
 fi
fi
if command -v nemoclaw >/dev/null && [ "$SANTA_OWNED" != 1 ] && [ "$SANTA_REUSE" != 1 ]; then
 fail 'NemoClaw is already installed. Use --check or explicitly select --reuse-existing --sandbox NAME. It was not upgraded.'
fi
if command -v openshell >/dev/null && ! command -v nemoclaw >/dev/null; then
 fail 'An existing standalone OpenShell installation needs operator qualification. It was not adopted or changed.'
fi
if [ "$SANTA_REUSE" = 1 ]; then command -v nemoclaw >/dev/null || fail '--reuse-existing needs an installed native runtime.'; fi
if [ "$SANTA_ACCEPT" != 1 ]; then
 echo "Install the pinned Santa stack for $SANTA_NAME? This may install Ubuntu utilities, configure Docker on an empty host, and download model weights/images."
 echo 'NVIDIA/third-party software notices and model terms apply. Existing services/models will not be replaced.'
 read -r -p 'Continue? [y/N] ' SANTA_REPLY
 [[ "$SANTA_REPLY" = y || "$SANTA_REPLY" = Y || "$SANTA_REPLY" = yes ]] || fail 'Cancelled; no installation changes made.'
fi
command -v flock >/dev/null || fail 'Install util-linux first (flock is required).'
mkdir -p "$SANTA_STATE_BASE" "$SANTA_DATA_BASE/toolchains"
chmod 700 "$SANTA_STATE_BASE" "$SANTA_DATA_BASE"
exec 9>"$SANTA_STATE_BASE/install.lock"
flock -n 9 || fail 'Another Santa installer is already running.'
SANTA_TMP=''
cleanup(){ if [ -n "$SANTA_TMP" ]; then rm -rf -- "$SANTA_TMP"; fi; flock -u 9 || true; }
trap cleanup EXIT
# Refuse symlinked receipt/tool directories rather than following an unexpected target.
[ ! -L "$SANTA_RECEIPT" ] && [ ! -L "$SANTA_NODE_ROOT" ] || fail 'Unexpected symlink in installer-owned paths.'
record(){ python3 "$SANTA_CHECKOUT/deploy/install-receipt.py" write "$SANTA_RECEIPT" "$SANTA_CHECKOUT" "$SANTA_NAME" "$SANTA_REUSE" "$1"; }

SANTA_PACKAGES=()
for pair in 'curl:curl' 'git:git' 'tar:tar' 'xz:xz-utils' 'make:build-essential' 'g++:build-essential' 'ss:iproute2'; do
 SANTA_CMD="${pair%%:*}"; command -v "$SANTA_CMD" >/dev/null || SANTA_PACKAGES+=("${pair#*:}")
done
[ -f /etc/ssl/certs/ca-certificates.crt ] || SANTA_PACKAGES+=(ca-certificates)
if [ "${#SANTA_PACKAGES[@]}" -gt 0 ]; then sudo apt-get update; sudo apt-get install -y --no-install-recommends "${SANTA_PACKAGES[@]}"; fi
if ! command -v docker >/dev/null; then
 sudo apt-get update
 sudo apt-get install -y docker.io
 sudo systemctl enable --now docker
fi
if ! docker info >/dev/null 2>&1; then
 sudo docker info >/dev/null 2>&1 || fail 'Docker daemon is unavailable. Repair it using the platform guide, then rerun.'
 SANTA_LOGIN_USER="$(id -un)"
 if ! id -nG "$SANTA_LOGIN_USER" | tr ' ' '\n' | grep -qx docker; then sudo usermod -aG docker "$SANTA_LOGIN_USER"; fi
 # Activate the newly granted group only for this installer; quote every argument.
 printf -v SANTA_REEXEC '%q ' bash "$SANTA_CHECKOUT/install.sh" "${SANTA_ORIGINAL_ARGS[@]}" --yes
 flock -u 9; exec 9>&-
 exec sg docker -c "$SANTA_REEXEC"
fi
if ! docker info --format '{{json .Runtimes}}' | grep -q 'nvidia'; then
 [ -z "$(docker ps -q)" ] || fail 'GPU container runtime needs configuration but containers are running. They were not stopped.'
 command -v nvidia-ctk >/dev/null || { sudo apt-get update; sudo apt-get install -y nvidia-container-toolkit; }
 sudo nvidia-ctk runtime configure --runtime=docker
 sudo systemctl restart docker
fi
if ss -H -ltn 'sport = :4310' | grep -q .; then fail 'Port 4310 already has an application. It was not stopped or adopted.'; fi
if [ ! -x "$SANTA_NODE_ROOT/bin/node" ]; then
 SANTA_TMP="$(mktemp -d "$SANTA_DATA_BASE/toolchains/.node-download.XXXXXX")"
 SANTA_ARCHIVE="node-v$SANTA_NODE_VERSION-linux-arm64.tar.xz"
 curl --fail --location --proto '=https' --tlsv1.2 --connect-timeout 20 --max-time 900 --retry 3 "https://nodejs.org/dist/v$SANTA_NODE_VERSION/$SANTA_ARCHIVE" -o "$SANTA_TMP/$SANTA_ARCHIVE"
 echo "$(pin node.sha256)  $SANTA_TMP/$SANTA_ARCHIVE" | sha256sum --check --status || fail 'Node download checksum mismatch.'
 tar -xJf "$SANTA_TMP/$SANTA_ARCHIVE" -C "$SANTA_TMP"
 mv "$SANTA_TMP/node-v$SANTA_NODE_VERSION-linux-arm64" "$SANTA_NODE_ROOT"
 rm -rf -- "$SANTA_TMP"; SANTA_TMP=''
fi
[ "$(node --version)" = "v$SANTA_NODE_VERSION" ] || fail 'The installer-owned Node toolchain does not match the lock. Inspect it before retrying.'
export SANTA_SANDBOX="$SANTA_NAME" SANTA_ALLOW_CLOUD_INFERENCE=0 PORT=4310
export SANTA_DATA="$SANTA_DATA_BASE/data"
mkdir -p "$SANTA_DATA"; chmod 700 "$SANTA_DATA"
if [ "$SANTA_REUSE" != 1 ]; then
 if ss -H -ltn 'sport = :8000' | grep -q . && [ "$SANTA_OWNED" != 1 ]; then fail 'Port 8000 already serves another model. Use --reuse-existing for its qualified sandbox; no model was stopped.'; fi
 record native
 unset NEMOCLAW_FRESH NEMOCLAW_RECREATE_SANDBOX NEMOCLAW_FORCE_FRESH_INSTALL NEMOCLAW_FORCE_STATION_INSTALL NEMOCLAW_CONFIRM_LEGACY_MANAGED_RECREATE NEMOCLAW_ACCEPT_EXPERIMENTAL_OPENSHELL_UPGRADE NEMOCLAW_OPENSHELL_UPGRADE_PREPARED NEMOCLAW_SERVING_PRESET NEMOCLAW_MODEL
 export SANTA_LOCAL_MODEL="$(pin managedModel.repository)" NEMOCLAW_VLLM_PORT=8000
 export NEMOCLAW_AGENT=openclaw NEMOCLAW_NO_EXPRESS=1 NEMOCLAW_PROVIDER=install-vllm
 export NEMOCLAW_VLLM_MODEL="$(pin managedModel.slug)" NEMOCLAW_CONTEXT_WINDOW=32768
 export NEMOCLAW_VLLM_EXTRA_ARGS_JSON="$SANTA_NATIVE_ARGS" NEMOCLAW_SANDBOX_NAME="$SANTA_NAME"
 export NEMOCLAW_SINGLE_SESSION=1 NEMOCLAW_NON_INTERACTIVE=1 NEMOCLAW_NON_INTERACTIVE_SUDO_MODE=prompt NEMOCLAW_ACCEPT_THIRD_PARTY_SOFTWARE=1
 if ! command -v nemoclaw >/dev/null; then
  SANTA_NATIVE_SOURCE="$SANTA_DATA_BASE/native-$SANTA_NATIVE_REF"
  [ ! -L "$SANTA_NATIVE_SOURCE" ] && [ ! -L "$SANTA_NATIVE_SOURCE/.git" ] || fail 'Unexpected symlink in native source cache.'
  if [ -d "$SANTA_NATIVE_SOURCE/.git" ] &&
     [ "$(git -C "$SANTA_NATIVE_SOURCE" rev-parse --verify HEAD 2>/dev/null || true)" = "$SANTA_NATIVE_REF" ] &&
     [ "$(git -C "$SANTA_NATIVE_SOURCE" remote get-url origin 2>/dev/null || true)" = https://github.com/NVIDIA/NemoClaw.git ] &&
     ! git -C "$SANTA_NATIVE_SOURCE" diff --quiet HEAD --; then
   echo "Preserving the modified native source at $SANTA_NATIVE_SOURCE. Fetching the pinned revision in a separate directory."
   SANTA_NATIVE_SOURCE="$(mktemp -d "$SANTA_DATA_BASE/native-$SANTA_NATIVE_REF.retry.XXXXXX")"
  fi
  if [ ! -d "$SANTA_NATIVE_SOURCE/.git" ]; then (umask 022; git init -q "$SANTA_NATIVE_SOURCE"); fi
  if ! git -C "$SANTA_NATIVE_SOURCE" rev-parse --verify HEAD >/dev/null 2>&1; then
   SANTA_REMOTE="$(git -C "$SANTA_NATIVE_SOURCE" remote get-url origin 2>/dev/null || true)"
   if [ -z "$SANTA_REMOTE" ]; then git -C "$SANTA_NATIVE_SOURCE" remote add origin https://github.com/NVIDIA/NemoClaw.git; else [ "$SANTA_REMOTE" = https://github.com/NVIDIA/NemoClaw.git ] || fail 'Unexpected native source remote.'; fi
   (umask 022; git -C "$SANTA_NATIVE_SOURCE" -c http.lowSpeedLimit=1024 -c http.lowSpeedTime=120 fetch --depth 1 origin "$SANTA_NATIVE_REF"; git -C "$SANTA_NATIVE_SOURCE" checkout --detach FETCH_HEAD)
  fi
  [ "$(git -C "$SANTA_NATIVE_SOURCE" rev-parse HEAD)" = "$SANTA_NATIVE_REF" ] || fail 'Native source revision differs from the lock.'
  git -C "$SANTA_NATIVE_SOURCE" diff --quiet && git -C "$SANTA_NATIVE_SOURCE" diff --cached --quiet || fail 'Pinned native source has local changes.'
  python3 - "$SANTA_CHECKOUT/config/installer.json" "$SANTA_NATIVE_SOURCE" <<'PYLOCK'
import json,re,sys
from pathlib import Path
p=json.load(open(sys.argv[1]));base=Path(sys.argv[2])/'managed-inference'
m=(base/'models/vllm.qwen3-6-35b-a3b-nvfp4.v1.yaml').read_text()
r=(base/'recipes/vllm.qwen3-6-35b-a3b-nvfp4.spark-single.v1.yaml').read_text()
if re.search(r'^  revision: (.+)$',m,re.M).group(1)!=p['managedModel']['revision'] or p['managedModel']['image'] not in r:raise SystemExit('Pinned native catalog differs from the declared installer model/image. No native installer was executed.')
PYLOCK
  NEMOCLAW_INSTALL_REF="$SANTA_NATIVE_REF" bash "$SANTA_NATIVE_SOURCE/install.sh" --non-interactive --yes-i-accept-third-party-software 9>&-
 else
  # A commit-pinned source build can report the package version instead of the release tag.
  # Host probe includes provenance even when a readiness finding gives it a nonzero exit.
  if ! (nemoclaw host probe --json 2>/dev/null || true) | node -e '
const fs = require("node:fs");
try {
  const report = JSON.parse(fs.readFileSync(0, "utf8"));
  process.exitCode = report.provenance?.sourceRevision === process.argv[1] ? 0 : 1;
} catch {
  process.exitCode = 1;
}' "$SANTA_NATIVE_REF"; then
   fail 'Could not verify that the active NemoClaw CLI matches this installer’s pinned source commit. No shared runtime was changed.'
  fi
  # Native onboarding can finish before the app's first smoke check passes.
  if nemoclaw list --json | node -e '
const fs = require("node:fs");
const [name, model] = process.argv.slice(1);
const inventory = JSON.parse(fs.readFileSync(0, "utf8"));
const complete = inventory.incompleteOnboarding?.sandboxName !== name &&
  inventory.sandboxes?.some(row => row.name === name && row.agent === "openclaw" &&
    row.model === model && row.provider === "vllm-local" && !row.recoveredFromGateway);
process.exitCode = complete ? 0 : 1;' "$SANTA_NAME" "$SANTA_LOCAL_MODEL"; then
   echo 'Native onboarding is complete for this sandbox. Checking the running local route and continuing Santa Claw setup.'
  else
   # Resume only this installer's target. Never use --fresh or --recreate.
   nemoclaw onboard --name "$SANTA_NAME" --agent openclaw --non-interactive --resume 9>&-
  fi
 fi
fi
# Existing native tools are accepted only after local-route and tool-call verification.
node "$SANTA_CHECKOUT/deploy/check-gb10.mjs" --stage runtime --smoke
record app
cd "$SANTA_CHECKOUT"
npm ci --ignore-scripts --no-audit --no-fund
npm run browser:prepare
npm run build
# Verify actual sandbox execution separately from the model's tool-call format.
nemoclaw "$SANTA_NAME" exec --no-tty --timeout 20 -- node -e 'console.log("SANTA_SANDBOX_OK")' | grep -q SANTA_SANDBOX_OK || fail 'Native sandbox execution failed.'
record service
sudo loginctl enable-linger "$(id -un)"
npm run service:install
# Readiness must succeed through an authenticated managed local route as well.
node deploy/installer-verify.mjs
record completed
echo 'Santa Claw is ready.'
print_access_links
cat <<DONE
Private workshop data: $SANTA_DATA
Native credentials remain on this Spark. Configure Telegram through the secure UI.
First installation needs internet; model weights and image caches are reused on reruns.
DONE
