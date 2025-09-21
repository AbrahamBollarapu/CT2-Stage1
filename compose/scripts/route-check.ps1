param(
  [string]$Admin = "http://localhost:8090",
  [string[]]$Needles = @("api-suppliers@file","api-time-series@file")
)

try {
  $routers = Invoke-RestMethod "$Admin/api/http/routers"
} catch {
  Write-Host "Cannot reach Traefik admin at $Admin" -ForegroundColor Red
  exit 2
}

$missing = @()
foreach($n in $Needles){
  if(-not ($routers | Where-Object { $_.name -eq $n })) { $missing += $n }
}

if($missing.Count -gt 0){
  Write-Host "Missing routers: $($missing -join ', ')" -ForegroundColor Red
  exit 1
}

Write-Host "All required routers present: $($Needles -join ', ')" -ForegroundColor Green
