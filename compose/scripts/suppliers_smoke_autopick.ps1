param(
  [string]$OrgId   = "demo",
  [string]$BaseUrl = "http://localhost"
)

# Traefik + API headers
$h = @{ Host="suppliers.localhost"; "x-api-key"="ct2-dev-key"; "x-org-id"=$OrgId }

# Grab the first supplier for the org
try {
  $list = Invoke-RestMethod -Headers $h "$BaseUrl/api/suppliers?org_id=$OrgId"
  if (-not $list) { throw "No suppliers returned for org '$OrgId'." }
  $SupplierId = ($list | Select-Object -First 1 -ExpandProperty id)
} catch {
  Write-Error $_
  exit 1
}

# Call your existing smoke script
& 'D:\CT2\compose\scripts\suppliers_smoke.ps1' -SupplierId $SupplierId -OrgId $OrgId -BaseUrl $BaseUrl
