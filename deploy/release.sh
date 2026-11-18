#!/usr/bin/env bash
# Stage, test and install a Santa Claw release on the Spark. Dry run unless --apply.
# Usage: bash deploy/release.sh [--apply] [--keep-old] [--source DIR]   (DIR defaults to this checkout)
# --keep-old deletes nothing: no pruning and no rsync --delete into the live checkout.
# The live checkout keeps its data/; only santa-claw-gb10 is restarted, and only when idle.
set -euo pipefail
SOURCE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
APPLY=0
KEEP_OLD=0
while [ $# -gt 0 ]; do case "$1" in --apply) APPLY=1;; --keep-old) KEEP_OLD=1;; --source) SOURCE="$(cd -- "$2" && pwd)"; shift;; *) echo "Unknown option $1" >&2; exit 2;; esac; shift; done
LIVE="${SANTA_LIVE:-$HOME/santa-claw}"
RELEASES="${SANTA_RELEASES:-$HOME/santa-claw-releases}"
BACKUPS="${SANTA_BACKUPS:-$HOME/santa-claw-upgrade-backup}"
DATA="${SANTA_DATA:-$LIVE/data}"
VERSION="$(node -p "require('$SOURCE/package.json').version")"
STAMP="$(date +%s)"
STAGE="$RELEASES/$VERSION-$STAMP"
COMMIT="$(git -C "$SOURCE" rev-parse --short HEAD 2>/dev/null || echo unknown)"
run(){ if [ "$APPLY" = 1 ]; then "$@"; else echo "[dry run] $*"; fi; }
[ "$SOURCE" != "$LIVE" ] || { echo 'Build from a separate checkout, not the live app.' >&2; exit 1; }
echo "Release $VERSION ($COMMIT) from $SOURCE -> $LIVE"
SANTA_DATA="$DATA" node "$LIVE/deploy/reload-app.mjs"
mkdir -p "$RELEASES" "$BACKUPS"; chmod 700 "$RELEASES" "$BACKUPS"
run rsync -a --exclude data --exclude work --exclude node_modules --exclude dist --exclude .git "$SOURCE/" "$STAGE/"
if [ "$APPLY" = 1 ]; then
 (cd "$STAGE" && npm ci --ignore-scripts --no-audit --no-fund >/dev/null && rm -rf dist && npm run build >/dev/null && npm test >"$STAGE/test-report.log" 2>&1) || { echo "Build or tests failed; see $STAGE/test-report.log. Live app unchanged." >&2; exit 1; }
 grep -E '^# (pass|fail)' "$STAGE/test-report.log"
 printf '%s\n' "$COMMIT" >"$STAGE/DEPLOYED_COMMIT"; printf '%s\n' "$VERSION" >"$STAGE/VERSION"
 node -e "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1],{readOnly:true});db.exec(\"VACUUM INTO '\"+process.argv[2].replaceAll(\"'\",\"''\")+\"'\");db.close();" "$DATA/workshop.sqlite" "$BACKUPS/before-$VERSION-$STAMP.sqlite"
 chmod 600 "$BACKUPS/before-$VERSION-$STAMP.sqlite"
 SANTA_DATA="$DATA" node "$LIVE/deploy/reload-app.mjs"
fi
LOGS="${SANTA_STATE:-$HOME/santa-claw-state}/logs/pre-$VERSION-$STAMP"
run mkdir -p "$LOGS"
run find "$LIVE" -maxdepth 1 -type f \( -name "*.log" -o -name "gb10-*readiness*.json" \) -exec mv -t "$LOGS" {} +
SYNC_DELETE=--delete; [ "$KEEP_OLD" = 1 ] && SYNC_DELETE=
run rsync -a $SYNC_DELETE --exclude data --exclude work "$STAGE/" "$LIVE/"
run env SANTA_DATA="$DATA" node "$LIVE/deploy/reload-app.mjs" --restart
if [ "$APPLY" = 1 ]; then
 for i in $(seq 1 30); do curl -fsS -m 2 "http://127.0.0.1:${PORT:-4310}/santa/api/ready" >/dev/null 2>&1 && break; sleep 2; done
 curl -sS -m 5 "http://127.0.0.1:${PORT:-4310}/santa/api/ready" || true; echo
fi
node "$SOURCE/deploy/prune-releases.mjs" --protect "$VERSION-$STAMP" $([ "$APPLY" = 1 ] && [ "$KEEP_OLD" = 0 ] && echo --apply)
echo "Rollback: bash deploy/release.sh --apply --source $RELEASES/<previous-release>"
