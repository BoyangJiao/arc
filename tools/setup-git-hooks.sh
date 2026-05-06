#!/bin/bash
set -euo pipefail

# =============================================================================
# Git Hooks 安装脚本
# =============================================================================
# 将 tools/git-hooks/ 设为 Git 的 hooks 路径（core.hooksPath）
# 这样 hooks 被纳入版本控制，团队成员 clone 后只需运行一次即可启用
#
# 用法：pnpm setup:hooks 或 bash tools/setup-git-hooks.sh
# =============================================================================

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOKS_DIR="$PROJECT_ROOT/tools/git-hooks"

if [ ! -d "$HOOKS_DIR" ]; then
  echo "❌ 目录 $HOOKS_DIR 不存在"
  exit 1
fi

# 确保所有 hook 脚本可执行
chmod +x "$HOOKS_DIR"/* 2>/dev/null || true

# 设置 core.hooksPath（相对于 repo root）
git -C "$PROJECT_ROOT" config core.hooksPath tools/git-hooks

echo "✅ Git hooks 已安装！"
echo ""
echo "   hooks 目录: $HOOKS_DIR"
echo "   当前配置:   core.hooksPath = $(git -C "$PROJECT_ROOT" config core.hooksPath)"
echo ""
echo "   生效的 hooks:"
for hook in "$HOOKS_DIR"/*; do
  [ -f "$hook" ] && [ -x "$hook" ] && echo "   - $(basename "$hook")"
done
echo ""
echo "   现在 git pull / git checkout 时会自动同步 .claude/skills → .qoder/skills"
