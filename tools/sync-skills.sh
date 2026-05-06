#!/bin/bash
set -euo pipefail

# =============================================================================
# Skills 同步脚本
# =============================================================================
# 用途：保持 .claude/skills 和 .qoder/skills 两个目录内容一致。
#
# 背景说明：
#   - .claude/skills/  → Claude Code IDE 读取的 skill 目录
#   - .qoder/skills/   → Qoder IDE 读取的 skill 目录
#   - 两者各自独立，必须同时存在相同内容才能在两个 IDE 中被调用
#
# 设计原则：以 .claude/skills 为唯一来源（source of truth），单向同步到 .qoder/skills
# =============================================================================

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLAUDE_SKILLS="$PROJECT_ROOT/.claude/skills"
QODER_SKILLS="$PROJECT_ROOT/.qoder/skills"

log() {
  echo "[sync-skills] $1"
}

# 确保目录存在
if [ ! -d "$CLAUDE_SKILLS" ]; then
  log "错误：源目录 $CLAUDE_SKILLS 不存在"
  exit 1
fi

mkdir -p "$QODER_SKILLS"

log "同步方向: $CLAUDE_SKILLS -> $QODER_SKILLS"

# 统计变量
added=0
updated=0
removed=0

# 1. 遍历源目录，复制新增或变更的 skill
for skill in "$CLAUDE_SKILLS"/*; do
  [ -e "$skill" ] || continue

  skill_name=$(basename "$skill")
  target="$QODER_SKILLS/$skill_name"

  if [ ! -e "$target" ]; then
    # 新增
    cp -r "$skill" "$target"
    log "新增: $skill_name"
    ((added++)) || true
  elif [ -d "$skill" ] && ! diff -rq "$skill" "$target" > /dev/null 2>&1; then
    # 内容有变更，替换
    rm -rf "$target"
    cp -r "$skill" "$target"
    log "更新: $skill_name"
    ((updated++)) || true
  fi
done

# 2. 清理目标目录中源目录已不存在的 skill（避免孤儿文件）
for skill in "$QODER_SKILLS"/*; do
  [ -e "$skill" ] || continue

  skill_name=$(basename "$skill")
  source="$CLAUDE_SKILLS/$skill_name"

  if [ ! -e "$source" ]; then
    rm -rf "$skill"
    log "删除: $skill_name"
    ((removed++)) || true
  fi
done

log "同步完成 — 新增: $added, 更新: $updated, 删除: $removed"

