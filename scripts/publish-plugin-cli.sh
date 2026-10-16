#!/bin/bash
# 发布 ztools-plugin-cli 到独立仓库的脚本

set -e

echo "📦 准备发布 ztools-plugin-cli 到独立仓库..."

# 检查是否在 ZTools 根目录
if [ ! -d "ztools-plugin-cli" ]; then
  echo "❌ 错误：请在 ZTools 根目录运行此脚本"
  exit 1
fi

# 获取远程仓库地址（需要先在 GitHub 创建）
REMOTE_URL="https://github.com/ZToolsCenter/ztools-plugin-cli.git"

echo "📍 目标仓库: $REMOTE_URL"
echo ""
echo "⚠️  请确保："
echo "   1. 已在 GitHub 创建仓库: ZToolsCenter/ztools-plugin-cli"
echo "   2. 仓库设置为 Public 或 Private（推荐 Public）"
echo "   3. 没有初始化 README、.gitignore、license"
echo ""
read -p "按 Enter 继续，或 Ctrl+C 取消..."

# 检查 ztools-plugin-cli 是否已提交到 ZTools
if git diff --quiet ztools-plugin-cli/ && git diff --cached --quiet ztools-plugin-cli/; then
  echo "✅ ztools-plugin-cli 已提交"
else
  echo "⚠️  ztools-plugin-cli 有未提交的变更"
  read -p "是否先提交这些变更？(y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    git add ztools-plugin-cli/
    git commit -m "feat(ztools-plugin-cli): prepare for publish"
  fi
fi

# 使用 git subtree 推送
echo "🚀 使用 git subtree 推送到远程仓库..."
git subtree push --prefix=ztools-plugin-cli "$REMOTE_URL" main

echo ""
echo "✅ 发布完成！"
echo ""
echo "📝 下一步："
echo "   1. 访问 https://github.com/ZToolsCenter/ztools-plugin-cli"
echo "   2. 添加仓库描述：ZTools 插件 CLI 工具 - 快速创建 ZTools 插件项目"
echo "   3. 添加主题标签：ztools, cli, plugin, typescript"
echo "   4. npm 包已发布在: https://www.npmjs.com/package/@ztools-center/plugin-cli"
