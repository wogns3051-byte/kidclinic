# GitHub Actions 에서 심평원 API 접속이 안 될 때(해외 접속 차단 등) 내 PC 에서 대신 갱신하는 스크립트
# 사용: PowerShell 에서  .\sync-local.ps1   (처음 한 번 인증키를 물어봅니다. 키는 .env 에만 저장되고 GitHub 에 올라가지 않습니다)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$keyFile = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $keyFile)) {
  $k = Read-Host "공공데이터포털 인증키(Encoding) 붙여넣기"
  Set-Content -Path $keyFile -Value $k.Trim() -Encoding ascii
}
$env:HIRA_SERVICE_KEY = (Get-Content $keyFile -Raw).Trim()
git pull --rebase
node sync/sync.js
if ($LASTEXITCODE -ne 0) { Write-Host "갱신 실패" -ForegroundColor Red; exit 1 }
git add state docs/data
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) { git commit -m "데이터 갱신 (PC) $(Get-Date -Format yyyy-MM-dd)"; git push }
Write-Host "완료" -ForegroundColor Green
