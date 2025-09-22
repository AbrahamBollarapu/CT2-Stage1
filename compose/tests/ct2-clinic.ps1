param(
  [string]$Base   = "http://localhost:8081",
  [string]$Admin  = "http://localhost:8090",
  [string]$ApiKey = "ct2-dev-key",
  [string]$Org    = "test-org"
)

$ErrorActionPreference = "Stop"
$H = @{ "x-api-key" = $ApiKey }

function Step($name, [scriptblock]$sb) {
  try {
    & $sb
    Write-Host "√ $name" -ForegroundColor Green
  } catch {
    Write-Host "× $name" -ForegroundColor Red
    if ($_.Exception.Response) {
      try {
        $body = [IO.StreamReader]::new($_.Exception.Response.GetResponseStream()).ReadToEnd()
        Write-Host ("  Status: {0} {1}" -f $_.Exception.Response.StatusCode,$_.Exception.Response.StatusDescription)
        if ($body) { Write-Host "  Body: $body" }
      } catch {}
    } else {
      Write-Host ("  Error: {0}" -f $_.Exception.Message)
    }
    exit 1
  }
}

# 1) Traefik admin reachable & version
Step "Traefik admin" {
  $v = Invoke-RestMethod "$Admin/api/version"
  if (-not $v.Version) { throw "no version" }
}

# 2) Supplier list returns >= 1 row
Step "Supplier GET" {
  $r = Invoke-RestMethod "$Base/api/supplier?org_id=$Org" -Headers $H
  if (-not ($r.Count -ge 1)) { throw "expected >=1 row, got $($r.Count)" }
}

# 3) KPI health
Step "KPI health" {
  $r = Invoke-RestMethod "$Base/api/kpi/health" -Headers $H
  if ($r.status -ne "OK") { throw "status=$($r.status)" }
}

# 4) KPI compute
Step "KPI compute" {
  $r = Invoke-RestMethod -Method Post "$Base/api/kpi/compute" -Headers $H -Body (@{} | ConvertTo-Json)
  if (-not $r.computed_at) { throw "no computed_at" }
}

# 5) UI title contains keyword
Step "UI title" {
  $ts = Get-Random
  $html = (Invoke-WebRequest "$Base/index.html?ts=$ts").Content
  if ($html -notmatch "CT2 Demo Dashboard · Hyper") { throw "title not found" }
}

# 6) From Traefik container, both services are reachable
Step "Traefik->dashboards" {
  docker exec ct2-demo-traefik-1 sh -lc "wget -qO- --timeout=2 http://dashboards-service:8000/ | head -n 1" | Out-Null
}
Step "Traefik->supplier" {
  docker exec ct2-demo-traefik-1 sh -lc "wget -qO- --timeout=2 'http://supplier-service:8000/health' | grep -q ok"
}

Write-Host "`nALL GREEN ✅" -ForegroundColor Green
