#!/usr/bin/env bash
# Timestamped context dump for checkpoint / handoff (gitignored output).
# Usage: pnpm ctx:dump <slug>
#   pnpm ctx:dump twr
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FEATURE="${1:-}"

if [[ -z "$FEATURE" ]] || [[ "$FEATURE" == "-h" ]] || [[ "$FEATURE" == "--help" ]]; then
  echo "Usage: pnpm ctx:dump <slug>" >&2
  echo "  Same slugs as pnpm ctx:feature — see: pnpm ctx:feature --help" >&2
  exit 1
fi

case "$FEATURE" in
  core) CONFIG="repomix.config.core.json" ;;
  data-sources) CONFIG="repomix.config.data-sources.json" ;;
  mobile-portfolio) CONFIG="repomix.config.mobile-portfolio.json" ;;
  *)
    CONFIG=".specify/feature-specs/stage-3/${FEATURE}.repomix.json"
    if [[ ! -f "$CONFIG" ]]; then
      echo "Error: unknown slug '$FEATURE' or missing $CONFIG" >&2
      exit 1
    fi
    ;;
esac

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUT=".specify/codectx/${FEATURE}-${TIMESTAMP}.xml"

mkdir -p .specify/codectx

pnpm exec repomix -c "$CONFIG" -o "$OUT" --quiet

echo "$OUT"
