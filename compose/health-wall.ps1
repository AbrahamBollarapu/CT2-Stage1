$Base="http://localhost:8081"

$svc=@(
  @{ name="evidence";          paths=@("/api/evidence") },
  @{ name="ingest";            paths=@("/api/ingest","/api/ingestion") },
  @{ name="esg";               paths=@("/api/esg") },
  @{ name="time-series";       paths=@("/api/time-series","/api/ts") },
  @{ name="emission-factors";  paths=@("/api/emission-factors","/api/factors") },
  @{ name="data-quality";      paths=@("/api/data-quality","/api/dataquality") },
  @{ name="kpi";               paths=@("/api/kpi") },
  @{ name="reports";           paths=@("/api/reports") },
  @{ name="xbrl";              paths=@("/api/xbrl") },
  @{ name="search";            paths=@("/api/search","/api/search-index") },
  @{ name="jobs";              paths=@("/api/jobs") },
  @{ name="dash";              paths=@("/api/dash","/api/dashboards") }
)

$all=$svc.Count; $ok=0
foreach($s in $svc) {
  $good=$false
  foreach($p in $s.paths) {
    foreach($suffix in @("/health","/ready")) {
      try {
        Invoke-RestMethod -Uri "$Base$p$suffix" -TimeoutSec 5 | Out-Null
        Write-Host ("✅ {0} -> {1}{2}" -f $s.name, $p, $suffix)
        $good=$true; break
      } catch { }
    }
    if($good){ break }
  }
  if(-not $good){
    Write-Host ("❌ {0} -> no response on {1}" -f $s.name, ($s.paths | % { $_ + "/health" } -join ", "))
  }
  $ok += [int]$good
}
if($ok -eq $all){ "ALL GOOD ✅ ($ok/$all)" } else { "SOME FAIL ❌ ($ok/$all)" }
