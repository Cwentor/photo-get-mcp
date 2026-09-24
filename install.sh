#!/usr/bin/env bash
# photo-get skill 安装脚本（Linux / macOS）
# 把 SKILL.md + scripts/ 拷贝到 agent 的 skills 目录。
# 用法:  ./install.sh                       → 安装到 ~/.agents/skills/photo-get
#        ./install.sh /path/to/skills/dir   → 安装到指定目录（如 ~/.claude/skills/photo-get）
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DST="${1:-$HOME/.agents/skills/photo-get}"

mkdir -p "$DST"
cp "$SRC/SKILL.md" "$DST/"
rm -rf "$DST/scripts"
cp -r "$SRC/scripts" "$DST/scripts"

echo "[photo-get] 已安装到 $DST"
echo "[photo-get] 验证: node $DST/scripts/cli.mjs --help"
