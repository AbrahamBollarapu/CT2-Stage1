param(
  [string]$ServicesRoot = "D:\CT2\apps\backend\services",
  [string]$ComposeRoot  = "D:\CT2",
  [string]$Out          = "D:\CT2\audit\s1_audit.csv"
)
$ErrorActionPreference = 'SilentlyContinue'

$S1 = @(
  @{Name='ingestion-service';         Prefix='/api/ingest';       DevPort=8040},
  @{Name='evidence-store';            Prefix='/api/evidence';     DevPort=8061},
  @{Name='esg-service';               Prefix='/api/esg';          DevPort=8007},
  @{Name='time-series-service';       Prefix='/api/timeseries';   DevPort=8025},
  @{Name='emission-factors-service';  Prefix='/api/factors';      DevPort=8021},
  @{Name='data-quality-service';      Prefix='/api/data-quality'; DevPort=8051},
  @{Name='kpi-calculation-service';   Prefix='/api/kpi';          DevPort=8045},
  @{Name='report-compiler-service';   Prefix='/api/reports';      DevPort=8057},
  @{Name='xbrl-mapping-service';      Prefix='/api/xbrl';         DevPort=8059},
  @{Name='dashboards-service';        Prefix='/api/dash';         DevPort=8028},
  @{Name='search-index-service';      Prefix='/api/search';       DevPort=8026},
  @{Name='jobs-service';              Prefix='/api/jobs';         DevPort=8030}
)

$composeFiles = Get-ChildItem -Path $ComposeRoot -Recurse -Include "docker-compose*.yml","docker-compose*.yaml" -File
$composeText  = ($composeFiles | ForEach-Object { Get-Content $_.FullName -Raw }) -join "`n`n"

$rows = @()
foreach($svc in $S1){
  $dir     = Join-Path $ServicesRoot $svc.Name
  $pkgPath = Join-Path $dir "package.json"
  $tscPath = Join-Path $dir "tsconfig.json"
  $dockPath= Join-Path $dir "Dockerfile"
  $idxTs   = Join-Path $dir "src\index.ts"
  $idxJs   = Join-Path $dir "dist\index.js"

  $hasPkg = Test-Path $pkgPath
  $pkgType = ""
  $pkgCJS = $false
  if($hasPkg){
    try { $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json; $pkgType = $pkg.type } catch { $pkgType = "parse-error" }
    $pkgCJS = ($pkgType -ne "module")
  }

  $hasTsConfig = Test-Path $tscPath
  $tsModule = ""
  $tsIsCJS = $false
  if($hasTsConfig){
    try { $tsc = Get-Content $tscPath -Raw | ConvertFrom-Json; $tsModule = $tsc.compilerOptions.module } catch { $tsModule = "parse-error" }
    $tsIsCJS = ($tsModule -eq "CommonJS") -or ($tsModule -eq "commonjs")
  }

  $hasDocker  = Test-Path $dockPath
  $expose8000 = $false
  if($hasDocker){ $expose8000 = (Select-String -Path $dockPath -Pattern 'EXPOSE\s+8000' -Quiet) }

  $hasIndexTs = Test-Path $idxTs
  $hasIndexJs = Test-Path $idxJs

  # Simple check: does any compose file include the service prefix?
  $routeInCompose = $false
  if($composeText){ $routeInCompose = ($composeText -match [regex]::Escape($svc.Prefix)) }

  $score = 0
  if($hasPkg){                    $score+=10 }
  if($pkgCJS){                    $score+=15 }
  if($hasTsConfig){               $score+=10 }
  if($tsIsCJS){                   $score+=15 }
  if($hasDocker){                 $score+=10 }
  if($expose8000){                $score+=10 }
  if($hasIndexTs -or $hasIndexJs){$score+=15 }
  if($routeInCompose){            $score+=15 }

  $rows += [pscustomobject]@{
    Service=$svc.Name; Prefix=$svc.Prefix; Pkg=$hasPkg; TypeIsCJS=$pkgCJS; TSConfig=$hasTsConfig; TSIsCJS=$tsIsCJS;
    Dockerfile=$hasDocker; Expose8000=$expose8000; Index=($hasIndexTs -or $hasIndexJs); RouteInCompose=$routeInCompose; Score=$score
  }
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Out) | Out-Null
$rows | Sort-Object Score -Descending | Tee-Object -Variable Table | Export-Csv -NoTypeInformation -Encoding UTF8 $Out
$ok = ($Table | Where-Object { $_.Score -ge 80 }).Count
$total = $Table.Count
$compliance = [math]::Round(($ok * 100.0 / [Math]::Max($total,1)),0)
Write-Host "S1 Compliance (>=80): $ok / $total ($compliance`%)" -ForegroundColor Cyan
$Table | Format-Table -AutoSize
