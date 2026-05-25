#!/usr/bin/env bash
# Pack a feature-scoped context bundle for LLM sessions.
# Usage: pnpm ctx:feature <slug>
#   pnpm ctx:feature twr
#   pnpm ctx:feature holdings-and-transactions
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FEATURE="${1:-}"

print_usage() {
  cat <<'EOF'
Usage: pnpm ctx:feature <slug> [--stdout]

Slugs (Stage 3):
  twr                      Block D — TWR / MWR
  performance-attribution  Block D — PA
  drawdown                 Block D — drawdown
  tushare-adapter          Block A — CN/HK/FUND adapters
  coingecko-adapter        Block A — CRYPTO adapter
  multi-portfolio          Block B — multi portfolio
  holdings-and-transactions  Block C — holdings / tx / charts
  stage-3-roadmap          Stage 3 overview

Scope shortcuts (repo root configs):
  core                     packages/core
  data-sources             packages/data-sources + akshare-wrapper
  mobile-portfolio         Portfolio Tab mobile + UI charts

Examples:
  pnpm ctx:feature twr
  pnpm ctx:feature twr --stdout | pbcopy
EOF
}

if [[ -z "$FEATURE" ]] || [[ "$FEATURE" == "-h" ]] || [[ "$FEATURE" == "--help" ]]; then
  print_usage
  exit 0
fi

STDOUT=false
if [[ "${2:-}" == "--stdout" ]]; then
  STDOUT=true
fi

resolve_config() {
  local slug="$1"
  case "$slug" in
    core) echo "repomix.config.core.json" ;;
    data-sources) echo "repomix.config.data-sources.json" ;;
    mobile-portfolio) echo "repomix.config.mobile-portfolio.json" ;;
    *)
      local feature_config=".specify/feature-specs/stage-3/${slug}.repomix.json"
      if [[ ! -f "$feature_config" ]]; then
        echo "Error: unknown slug '$slug' or missing config: $feature_config" >&2
        echo >&2
        print_usage >&2
        exit 1
      fi
      echo "$feature_config"
      ;;
  esac
}

CONFIG="$(resolve_config "$FEATURE")"

mkdir -p .specify/codectx

if [[ "$STDOUT" == true ]]; then
  pnpm exec repomix -c "$CONFIG" --stdout --quiet
else
  pnpm exec repomix -c "$CONFIG"
  OUT="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$CONFIG','utf8')).output?.filePath || 'repomix-output.xml')")"
  echo ""
  echo "Context bundle written → $OUT"
  echo "Attach to chat or: cat $OUT | pbcopy"
fi
