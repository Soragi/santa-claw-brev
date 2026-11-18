#!/usr/bin/env bash
# Run from a downloaded/tagged Santa Claw checkout. No Node prerequisite.
set -euo pipefail
exec bash "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/deploy/bootstrap-gb10.sh" "$@"
