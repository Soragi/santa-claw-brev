#!/usr/bin/env bash
set -euo pipefail
umask 077

name=${SANTA_SANDBOX:?Missing workshop sandbox}
[[ "$name" =~ ^[a-z][a-z0-9-]{1,18}$ ]]
state=${SANTA_GB10_BOOT_STATE:?Missing workshop boot state directory}
marker="$state/start-sandbox-next-boot"
boot_id=$(< /proc/sys/kernel/random/boot_id)

case "${1:-}" in
 stop)
  running=$(docker ps -q --filter "label=openshell.ai/sandbox-name=$name")
  [ -n "$running" ] || exit 0
  nemoclaw "$name" stop
  printf '%s\n' "$boot_id" > "$marker"
  ;;
 start)
  if [ -f "$marker" ] && [ "$(< "$marker")" != "$boot_id" ]; then
   echo "Restoring the existing OpenClaw sandbox after host reboot: $name"
   nemoclaw "$name" start || nemoclaw "$name" recover
   rm -- "$marker"
  fi
  ;;
 *) exit 2;;
esac
