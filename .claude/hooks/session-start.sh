#!/bin/bash
set -euo pipefail

# Only run in remote (web) sessions
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Ensure pnpm is available
if ! command -v pnpm &> /dev/null; then
  npm install -g pnpm
fi

# Install all workspace dependencies
pnpm install

# Run typecheck if packages are present (skipped until apps/packages scaffold exists)
if [ -f "turbo.json" ]; then
  pnpm turbo run build --dry=json > /dev/null 2>&1 || true
fi
