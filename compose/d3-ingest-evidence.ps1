# D3: Ingest -> Evidence (no JWT) — PS 5 compatible
$ErrorActionPreference = "Stop"
$Base = "http://localhost:8081"
$Org  = "demo"
$H    = @{ "X-Org-Id" = $Org }

function New-HereFile([string]$Path, [string]$Content) {
  $Content | Set-Content -Encoding UTF8 -Path $Path
}

function Invoke-IngestJson([string]$url, [string]$filePath, [string]$contentType) {
  $bytes = [System.IO.File]::ReadAllBytes($filePath)
  $b64   = [System.Convert]::ToBase64String($bytes)
  $body  = @{
    filename     = [System.IO.Path]::GetFileName($filePath)
    contentType  = $contentType
    dataBase64   = $b64
  } | ConvertTo-Json -Depth 5
  return Invoke-RestMethod -Method Post -Uri $url -Headers $H -ContentType "application/json" -Body $body
}

function Get-EvidenceId($obj) {
  if (-not $obj) { return $null }
  $candidates = @("evidence_id","evidenceId","id","documentId","doc_id")
  foreach($k in $candidates) {
    if ($obj.PSObject.Properties.Name -contains $k) {
      $v = $obj.$k
      if ($v) { return $v }
    }
  }
  if ($obj.data -and $obj.data.id) { return $obj.data.id }
  return $null
}

function Verify-Evidence([string]$eid, [string]$suggestName) {
  $head = Invoke-WebRequest -Method Head -Uri "$Base/api/evidence/$eid/content" -Headers $H
  $ct   = $head.Headers["Content-Type"]; $len = $head.Headers["Content-Length"]
  Write-Host "HEAD $eid -> Content-Type=$ct Length=$len"
  $tmpDir = Join-Path (Get-Location) "tmp-d3"
  $outFile = Join-Path $tmpDir ("download_" + $suggestName)
  (Invoke-WebRequest -Uri "$Base/api/evidence/$eid/content" -Headers $H -OutFile $outFile) | Out-Null
  Write-Host "GET  $eid -> saved $outFile"
}

# --- 1) Demo files
$tmp = Join-Path (Get-Location) "tmp-d3"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

$csvPath = Join-Path $tmp "energy_2024Q4.csv"
New-HereFile $csvPath @"
timestamp,meter,unit,value
2024-10-01T00:00:00Z,meter-1,kWh,123.45
2024-10-02T00:00:00Z,meter-1,kWh,118.20
"@

$txtPath = Join-Path $tmp "supplier_policy.txt"
New-HereFile $txtPath "Demo supplier policy. Version 1.0"

# --- 2) Try a set of likely endpoints (JSON only, to stay PS5-safe)
$endpoints = @(
  "$Base/api/ingest/documents",
  "$Base/api/ingestion/documents",
  "$Base/api/ingest/document",
  "$Base/api/ingest/upload",
  "$Base/api/ingest/files",
  "$Base/api/ingestion/upload",
  # Evidence fallbacks:
  "$Base/api/evidence/document",
  "$Base/api/evidence/documents",
  "$Base/api/evidence/upload"
)

$used = $null
$ingCsv = $null
$ingTxt = $null

foreach ($u in $endpoints) {
  try {
    Write-Host "POST (JSON) -> $u"
    $ingCsv = Invoke-IngestJson -url $u -filePath $csvPath -contentType "text/csv"
    $ingTxt = Invoke-IngestJson -url $u -filePath $txtPath -contentType "text/plain"
    $used = $u
    break
  } catch {
    Write-Host "  -> $u failed: $($_.Exception.Message)"
  }
}

if (-not $used) {
  Write-Warning "No ingest/evidence POST endpoint worked. We need to expose one. See 'Next steps' in the instructions."
  exit 2
}

Write-Host "Used endpoint: $used"
$eidCsv = Get-EvidenceId $ingCsv
$eidTxt = Get-EvidenceId $ingTxt

if (-not $eidCsv -or -not $eidTxt) {
  Write-Warning "POST succeeded but response didn’t include obvious evidence ids. Raw responses next:"
  "CSV resp: $($ingCsv | ConvertTo-Json -Depth 8)"
  "TXT resp: $($ingTxt | ConvertTo-Json -Depth 8)"
  exit 3
}

Write-Host "CSV evidence id: $eidCsv"
Write-Host "TXT evidence id: $eidTxt"

# --- 3) HEAD/GET
Verify-Evidence -eid $eidCsv -suggestName "energy_2024Q4.csv"
Verify-Evidence -eid $eidTxt -suggestName "supplier_policy.txt"

Write-Host "D3 happy path complete ✅"
