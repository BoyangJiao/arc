#!/bin/bash
# =============================================================================
# Quality Gate — Stop Hook for Claude Code
# =============================================================================
# Runs automatically when AI signals task completion.
# If typecheck or tests fail, exits 2 to block and let AI self-fix.
# =============================================================================

set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Skip if no turbo.json (not in project root)
if [ ! -f "turbo.json" ]; then
  exit 0
fi

ERRORS=""

# ─── Step 1: TypeScript typecheck ──────────────────────────────────────────────
if ! pnpm typecheck > /tmp/arc-quality-gate-typecheck.log 2>&1; then
  ERRORS="${ERRORS}\n⚠️  TypeScript errors detected:"
  ERRORS="${ERRORS}\n$(grep -E 'error TS' /tmp/arc-quality-gate-typecheck.log 2>/dev/null | head -10)"
fi

# ─── Step 2: Property-based tests (@arc/core) ─────────────────────────────────
if [ -f "packages/core/vitest.config.ts" ]; then
  if ! pnpm --filter @arc/core test > /tmp/arc-quality-gate-test.log 2>&1; then
    ERRORS="${ERRORS}\n⚠️  @arc/core tests failed:"
    ERRORS="${ERRORS}\n$(tail -15 /tmp/arc-quality-gate-test.log)"
  fi
fi

# ─── Result ────────────────────────────────────────────────────────────────────
if [ -n "$ERRORS" ]; then
  echo -e "🚫 Quality gate FAILED — please fix before marking complete:${ERRORS}"
  exit 2  # exit 2 = block (let AI continue fixing)
fi

echo "✅ Quality gate passed: typecheck clean + tests green"
exit 0
