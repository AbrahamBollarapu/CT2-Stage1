$ErrorActionPreference="Stop"
$Base="http://localhost:8081"
$H=@{ "X-Org-Id"="demo" }

function TryPost($url, $path, $ctype) {
  $b=[Convert]::ToBase64String([IO.File]::ReadAllBytes($path))
  $body=@{ filename=(Split-Path $path -Leaf); contentType=$ctype; dataBase64=$b } | ConvertTo-Json -Depth 5
  try {
    $resp=Invoke-RestMethod -Method Post -Uri $url -Headers $H -ContentType "application/json" -Body $body -TimeoutSec 10
    return @{ ok=$true; url=$url; resp=$resp }
  } catch {
    return @{ ok=$false; url=$url; err=$_.Exception.Message }
  }
}

$tmp=Join-Path (Get-Location) "tmp-d3"; New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$csv=Join-Path $tmp "scan.csv"; "a,b`n1,2" | Set-Content -Encoding UTF8 $csv
$txt=Join-Path $tmp "scan.txt";  "hello"   | Set-Content -Encoding UTF8 $txt

$urls=@(
  "$Base/api/ingest/documents",
  "$Base/api/ingest/upload",
  "$Base/api/ingest/files",
  "$Base/api/ingestion/documents",
  "$Base/api/ingestion/upload",
  "$Base/api/evidence/documents",
  "$Base/api/evidence/upload",
  "$Base/api/evidence/document"
)

"Scanning endpoints..."
foreach($u in $urls){
  $r1=TryPost $u $csv "text/csv"
  if($r1.ok){ "✅ $u -> $(($r1.resp | ConvertTo-Json -Depth 6))"; break } else { "❌ $u -> $($r1.err)" }
}
