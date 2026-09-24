# photo-get skill 安装脚本（Windows / PowerShell）
# 把 SKILL.md + scripts/ 拷贝到 agent 的 skills 目录。
# 用法:  .\install.ps1                        → 安装到 $HOME\.agents\skills\photo-get
#        .\install.ps1 -Destination <目录>    → 安装到指定目录（如 $HOME\.claude\skills\photo-get）
param(
  [string]$Destination = "$HOME\.agents\skills\photo-get"
)

$ErrorActionPreference = "Stop"
$src = $PSScriptRoot
$dst = $Destination

New-Item -ItemType Directory -Force -Path $dst | Out-Null
Copy-Item -Path (Join-Path $src "SKILL.md") -Destination $dst -Force
if (Test-Path (Join-Path $dst "scripts")) {
  Remove-Item (Join-Path $dst "scripts") -Recurse -Force
}
Copy-Item -Path (Join-Path $src "scripts") -Destination $dst -Recurse -Force

$cli = Join-Path $dst "scripts\cli.mjs"
Write-Output "[photo-get] 已安装到 $dst"
Write-Output "[photo-get] 验证: node `"$cli`" --help"
