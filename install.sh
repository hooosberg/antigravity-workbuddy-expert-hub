#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${HOME}/.gemini/config/plugins/expert-hub"

echo "1/3 安装依赖..."
cd "$SCRIPT_DIR"
npm install --no-audit --no-fund

echo "2/3 构建单文件 MCP App UI..."
npm run build:ui

echo "3/3 安装至 Antigravity 插件目录: $TARGET_DIR"
mkdir -p "$TARGET_DIR"
rsync -a --delete \
  --exclude '.git' \
  --exclude '.DS_Store' \
  --exclude '.data' \
  --exclude 'ui' \
  --exclude 'vite.config.mjs' \
  --exclude 'install.sh' \
  "$SCRIPT_DIR/" "$TARGET_DIR/"
chmod +x "$TARGET_DIR/server/index.mjs"

echo "✅ 安装完成！请在 Antigravity 右侧边栏「+」菜单或左侧全局导航栏中打开「专家市场」。"
