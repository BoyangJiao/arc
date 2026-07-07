#!/bin/bash
# =============================================================================
# Claude Code SessionStart hook for Arc
# =============================================================================
# Triggered at the start of every Claude Code session.
# - Always runs (local + remote)
# - Auto-installs dependencies on remote sessions
# - Reports typecheck status so Claude knows the baseline immediately
# - Surfaces .specify/constitution.md last-modified date so AI re-reads if recent
# =============================================================================

set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

# ─── Remote-only: install dependencies ───────────────────────────────────────
if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  if ! command -v pnpm &> /dev/null; then
    npm install -g pnpm
  fi
  pnpm install --silent 2>&1 | tail -5
fi

# ─── Always: surface constitution recency ────────────────────────────────────
if [ -f ".specify/constitution.md" ]; then
  CONSTITUTION_MTIME=$(stat -f %m .specify/constitution.md 2>/dev/null || stat -c %Y .specify/constitution.md 2>/dev/null || echo 0)
  CONSTITUTION_AGE_DAYS=$(( ( $(date +%s) - CONSTITUTION_MTIME ) / 86400 ))
  if [ "$CONSTITUTION_AGE_DAYS" -lt 7 ]; then
    echo "📜 .specify/constitution.md was updated ${CONSTITUTION_AGE_DAYS}d ago — recommend re-read before coding."
  fi
fi

# ─── Always: report typecheck health (lightweight, ~5s) ──────────────────────
if [ -f "turbo.json" ]; then
  if pnpm typecheck > /tmp/arc-typecheck.log 2>&1; then
    echo "✅ pnpm typecheck: 6/6 workspaces clean"
  else
    echo "⚠️  pnpm typecheck has errors — see /tmp/arc-typecheck.log"
    echo "    First 5 errors:"
    grep -E "error TS" /tmp/arc-typecheck.log 2>/dev/null | head -5 || true
  fi
fi

# ─── Repomix: auto-ensure feature context bundle (silent on success, logged on error) ─
if [ -f ".specify/session-state.md" ] && command -v node &>/dev/null && [ -f "tools/repomix-auto-context.mjs" ]; then
  CTX_LOG=/tmp/arc-ctx-auto.log
  if ! node tools/repomix-auto-context.mjs --ensure --quiet > "$CTX_LOG" 2>&1; then
    echo "⚠️  Repomix ctx:auto failed (non-blocking) — see $CTX_LOG"
  fi
  if [ -f ".specify/codectx/.active.json" ]; then
    BUNDLE_INFO=$(node -e "
      try {
        const j = require('./.specify/codectx/.active.json');
        if (j.slug && j.path) {
          const age = Math.round((Date.now() - new Date(j.generatedAt).getTime()) / 1000);
          process.stdout.write(\`slug=\${j.slug} path=\${j.path} age=\${age}s confidence=\${j.confidence || '?'}\`);
        }
      } catch {}
    " 2>/dev/null || true)
    if [ -n "$BUNDLE_INFO" ]; then
      echo "📦 Repomix context ready ($BUNDLE_INFO) — Read this path before grepping for feature code."
    fi
  fi
fi

exit 0
