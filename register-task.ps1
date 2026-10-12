# Windows 작업 스케줄러에 "매일 자동 갱신" 등록 (무료)
# 실행:  powershell -ExecutionPolicy Bypass -File .\register-task.ps1
# - 매일 오전 9시 실행, 그 시간에 PC 가 꺼져 있었으면 다음에 켰을 때 바로 실행
# - 해제:  Unregister-ScheduledTask -TaskName "소아과자료갱신" -Confirm:$false
$script = Join-Path $PSScriptRoot "sync-local.ps1"
if (-not (Test-Path (Join-Path $PSScriptRoot ".env"))) {
  Write-Host "먼저 sync-local.ps1 을 한 번 직접 실행해서 인증키를 저장하세요." -ForegroundColor Red; exit 1
}
$action   = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`"" -WorkingDirectory $PSScriptRoot
$trigger  = New-ScheduledTaskTrigger -Daily -At 9:00am
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName "소아과자료갱신" -Action $action -Trigger $trigger -Settings $settings -Description "우리아이 소아과 앱 자료 매일 갱신" -Force | Out-Null
Write-Host "등록 완료: 매일 오전 9시 (PC가 꺼져 있었으면 켜질 때 실행). 기록: sync-log.txt" -ForegroundColor Green
