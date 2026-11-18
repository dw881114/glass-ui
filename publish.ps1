# 一键推送 / 发版（需要先装 git + gh 并 gh auth login）
# 用法：powershell -ExecutionPolicy Bypass -File .\publish.ps1 -Version 1.0.0
# （Owner 默认 dw881114，要换仓库名就加 -Repo xxx）

param(
  [string]$Owner = "dw881114",
  [string]$Repo = "glass-ui",
  [string]$Version = "1.0.0",
  [switch]$Public
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "没装 git：winget install Git.Git" }
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw "没装 gh：winget install GitHub.cli" }
gh auth status *> $null
if ($LASTEXITCODE -ne 0) { throw "先执行 gh auth login" }

# 1. 替换 README 里的占位
$readme = Join-Path $PSScriptRoot "README.md"
(Get-Content $readme -Raw -Encoding UTF8).Replace("<owner>", $Owner) |
  Set-Content $readme -Encoding UTF8 -NoNewline

# 2. 初始化仓库
Push-Location $PSScriptRoot
try {
  if (-not (Test-Path ".git")) {
    git init -b main | Out-Null
  }
  git add -A
  git commit -m "Glass UI $Version" | Out-Null

  # 3. 建远端（已存在就只加 remote）
  $visibility = if ($Public) { "--public" } else { "--private" }
  $exists = gh repo view "$Owner/$Repo" 2>$null
  if (-not $exists) {
    gh repo create "$Repo" $visibility --source . --push
  } else {
    git remote remove origin 2>$null
    git remote add origin "https://github.com/$Owner/$Repo.git"
    git push -u origin main
  }

  # 4. 描述 / topics（HACS 审核会看）
  gh repo edit "$Owner/$Repo" `
    --description "iOS 26 liquid glass look for the Home Assistant dashboard, built on native HA controls." `
    --add-topic home-assistant --add-topic hacs --add-topic lovelace `
    --add-topic dashboard --add-topic frontend --add-topic liquid-glass

  # 5. tag + Release（HACS 靠 Release 发版）
  git tag "v$Version"
  git push origin "v$Version"
  gh release create "v$Version" --title "Glass UI $Version" --notes-file CHANGELOG.md

  Write-Host ""
  Write-Host "完成：https://github.com/$Owner/$Repo" -ForegroundColor Green
  Write-Host "HACS 里添加自定义存储库（类别选 Lovelace/仪表盘）即可安装。" -ForegroundColor Green
}
finally {
  Pop-Location
}
