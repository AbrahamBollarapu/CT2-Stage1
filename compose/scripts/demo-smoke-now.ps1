# --- Time-series GET /query (expects non-empty) ---
try {
  $Base = "http://localhost:8085"
  $H = @{ "x-api-key"="ct2-dev-key"; "Content-Type"="application/json" }

  $q = Invoke-RestMethod `
        -Method Get `
        -Uri "$Base/api/time-series/query?org_id=test-org&metric=demo.kwh&range=1h&limit=100&order=asc" `
        -Headers $H

  if ($q.ok -and $q.count -ge 1) {
    Write-Host "√ time-series GET /query returned $($q.count) point(s)" -ForegroundColor Green
  } else {
    Write-Host "x time-series GET /query returned empty result" -ForegroundColor Yellow
  }
}
catch {
  Write-Host "x time-series GET /query failed: $($_.Exception.Message)" -ForegroundColor Red
}
