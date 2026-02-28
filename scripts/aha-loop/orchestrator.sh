#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
AHA_LOOP_ROOT="$PROJECT_ROOT/参考/Aha-Loop"
TARGET="$AHA_LOOP_ROOT/scripts/aha-loop/orchestrator.sh"

if [ ! -f "$TARGET" ]; then
  echo "Error: Aha Loop orchestrator not found at: $TARGET" >&2
  exit 1
fi

exec "$TARGET" --workspace "$PROJECT_ROOT" "$@"
