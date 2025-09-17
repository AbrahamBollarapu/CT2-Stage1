# D4: time-series write/read (no JWT)
$ErrorActionPreference="Stop"
$Base="http://localhost:8081"
$H=@{ "X-Org-Id"="demo" }

# sample points
$now = [DateTime]::UtcNow
$series = @{
  meter = "meter-1"
  unit  = "kWh"
  points = @(
    @{ ts = $now.ToString("o");               value = 12.34 },
    @{ ts = $now.AddMinutes(5).ToString("o"); value = 12.99 }
  )
}

function PostJson($url, $obj){
  $json = $obj | ConvertTo-Json -Depth 6
  Invoke-RestMethod -Method Post -Uri $url -Headers $H -ContentType "application/json" -Body $json -TimeoutSec 10
}

# try common write shapes; stop on first success
$writeAttempts = @(
  @{ name="points-array"; url="$Base/api/time-series/points"; body=@{ points=@(
       @{ meter=$series.meter; unit=$series.unit; ts=$series.points[0].ts; value=$series.points[0].value },
       @{ meter=$series.meter; unit=$series.unit; ts=$series.points[1].ts; value=$series.points[1].value }
  )}},
  @{ name="write-simple"; url="$Base/api/time-series/write";  body=@{ meter=$series.meter; unit=$series.unit; data=$series.points }},
  @{ name="ingest";       url="$Base/api/time-series/ingest"; body=@{ meter=$series.meter; unit=$series.unit; points=$series.points }}
)

$writeUsed=$null
foreach($w in $writeAttempts){
  try {
    Write-Host "POST -> $($w.name) @ $($w.url)"
    PostJson $w.url $w.body | Out-Null
    $writeUsed=$w; break
  } catch { Write-Host "  -> failed: $($_.Exception.Message)" }
}
if(-not $writeUsed){ throw "All writes failed. Check ct2-time-series-service-1 logs." }
"Write OK via: $($writeUsed.name)"

# try common read shapes
$since = $now.AddHours(-1).ToString("o")
$readAttempts = @(
  @{ name="points-query"; url="$Base/api/time-series/points?meter=$($series.meter)&unit=$($series.unit)&since=$([uri]::EscapeDataString($since))" },
  @{ name="read";         url="$Base/api/time-series/read?meter=$($series.meter)&unit=$($series.unit)&since=$([uri]::EscapeDataString($since))" },
  @{ name="query";        url="$Base/api/time-series/query?meter=$($series.meter)&unit=$($series.unit)&since=$([uri]::EscapeDataString($since))" }
)
$readUsed=$null; $data=$null
foreach($q in $readAttempts){
  try {
    Write-Host "GET -> $($q.name) @ $($q.url)"
    $data = Invoke-RestMethod -Uri $q.url -Headers $H -TimeoutSec 10
    $readUsed=$q; break
  } catch { Write-Host "  -> failed: $($_.Exception.Message)" }
}
if(-not $readUsed){ throw "All reads failed. Check ct2-time-series-service-1 logs." }

"Read OK via: $($readUsed.name)"
$data | ConvertTo-Json -Depth 6
"✅ D4 done (write+read)"
