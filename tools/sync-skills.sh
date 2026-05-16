#!/bin/bash
set -euo pipefail

# =============================================================================
# Skills 同步脚本
# =============================================================================
# Canonical: .claude/skills/ (versioned in Git)
# Mirrors (gitignored, local-only): .qoder/skills/, .cursor/skills/
# =============================================================================

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLAUDE_SKILLS="$PROJECT_ROOT/.claude/skills"

MIRROR_DIRS=(
  "$PROJECT_ROOT/.qoder/skills"
  "$PROJECT_ROOT/.cursor/skills"
)

log() {
  echo "[sync-skills] $1"
}

if [ ! -d "$CLAUDE_SKILLS" ]; then
  log "错误：源目录 $CLAUDE_SKILLS 不存在"
  exit 1
fi

sync_one_mirror() {
  local target="$1"
  local added=0
  local updated=0
  local removed=0

  mkdir -p "$target"

  for skill in "$CLAUDE_SKILLS"/*; do
    [ -e "$skill" ] || continue

    local skill_name
    skill_name=$(basename "$skill")
    local dest="$target/$skill_name"

    if [ ! -e "$dest" ]; then
      cp -r "$skill" "$dest"
      log "  新增: $skill_name"
      ((added++)) || true
    elif [ -d "$skill" ] && ! diff -rq "$skill" "$dest" > /dev/null 2>&1; then
      rm -rf "$dest"
      cp -r "$skill" "$dest"
      log "  更新: $skill_name"
      ((updated++)) || true
    fi
  done

  for skill in "$target"/*; do
    [ -e "$skill" ] || continue

    local skill_name
    skill_name=$(basename "$skill")
    local source="$CLAUDE_SKILLS/$skill_name"

    if [ ! -e "$source" ]; then
      rm -rf "$skill"
      log "  删除: $skill_name"
      ((removed++)) || true
    fi
  done

  log "  → $(basename "$(dirname "$target")")/$(basename "$target"): +$added ~$updated -$removed"
}

log "同步: $CLAUDE_SKILLS"
for mirror in "${MIRROR_DIRS[@]}"; do
  sync_one_mirror "$mirror"
done
log "同步完成"
