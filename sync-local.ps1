# 내 PC 에서 심평원 자료를 받아 GitHub 에 올리는 스크립트 (무료)
# 직접 실행:  powershell -ExecutionPolicy Bypass -File .\sync-local.ps1
# 처음 한 번 인증키를 물어봅니다. 키는 이 폴더의 .env 에만 저장되고 GitHub 에는 올라가지 않습니다(.gitignore).
Set-Location $PSScriptRoot
$log = Join-Path $PSScriptRoot "sync-log.txt"
Start-Transcript -Path $log -Append | Out-Null
try {
  $keyFile = Join-Path $PSScriptRoot ".env"
  if (-not (Test-Path $keyFile)) {
    $k = Read-Host "공공데이터포털 인증키(Encoding) 붙여넣기"
    Set-Content -Path $keyFile -Value $k.Trim() -Encoding ascii
  }
  $env:HIRA_SERVICE_KEY = (Get-Content $keyFile -Raw).Trim()
  Write-Host "=== $(Get-Date -Format 'yyyy-MM-dd HH:mm') 갱신 시작 ==="
  git pull --rebase --quiet
  node sync/sync.js
  if ($LASTEXITCODE -ne 0) { Write-Host "갱신 실패" -ForegroundColor Red; exit 1 }
  git add state docs/data
  git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    git commit -m "데이터 갱신 (PC) $(Get-Date -Format yyyy-MM-dd)" --quiet
    git push --quiet
    Write-Host "GitHub 에 올림 완료" -ForegroundColor Green
  } else { Write-Host "바뀐 자료 없음" }
} finally { Stop-Transcript | Out-Null }
