#!/usr/bin/env bash
# Import authored assets only. Native credentials and network policy stay with the destination.
set -euo pipefail
id="${1:?Usage: bash install-hermes.sh NEW_PROFILE}"
[[ "$id" =~ ^[a-z][a-z0-9-]{1,40}$ ]] || { echo 'Choose a fresh lowercase profile name.' >&2; exit 1; }
base="${HERMES_HOME:-$HOME/.hermes}/profiles/$id"
[ ! -e "$base" ] || { echo 'Existing profile preserved.' >&2; exit 1; }
command -v hermes >/dev/null || { echo 'Install Hermes at the destination first.' >&2; exit 1; }
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
hermes profile create "$id"
[ -d "$base" ] && [ ! -L "$base" ] || { echo 'Unexpected native profile directory; nothing was copied.' >&2; exit 1; }
cp "$root/hermes/AGENTS.md" "$base/AGENTS.md"
cp "$root/hermes/SOUL.md" "$base/SOUL.md"
cp "$root/hermes/KNOWLEDGE.md" "$base/KNOWLEDGE.md"
mkdir -p "$base/skills"
if [ -d "$root/skills" ]; then cp -R "$root/skills/." "$base/skills/"; fi
echo "Authored assets copied to $id. Run hermes -p $id setup, review enabled tools against hermes/permissions.json, then test the acceptance prompts."
