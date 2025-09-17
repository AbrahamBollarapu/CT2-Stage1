Param(
  [string]$Base = "http://localhost:8081",
  [string]$ApiKey = "ct2-dev-key",
  [string]$Seed = ".\s2_seed.json"
)
$ErrorActionPreference = 'Stop'
if (!(Test-Path $Seed)) { Write-Error "Seed file not found: $Seed" }

$seed = Get-Content $Seed -Raw | ConvertFrom-Json
$org  = $seed.org_id
$h    = @{ "x-api-key" = $ApiKey }

function PostJson($url, $obj) {
  $body = $obj | ConvertTo-Json -Depth 10
  return Invoke-RestMethod -Headers $h -Method Post -Uri $url -ContentType 'application/json' -Body $body
}

# 1) Create suppliers
$nameToSupplierId = @{}
foreach ($s in $seed.suppliers) {
  $res = PostJson "$Base/api/suppliers" (@{ org_id=$org; name=$s.name; country=$s.country })
  $nameToSupplierId[$s.name] = $res.id
}

# 2) Create assessments
$titleToAssessmentId = @{}
foreach ($a in $seed.assessments) {
  $schema = @{ questions = $a.questions }
  $res = PostJson "$Base/api/assessments" (@{ org_id=$org; title=$a.title; version=$a.version; schema=$schema })
  $titleToAssessmentId[$a.title] = $res.id
}

# 3) Assign assessments
foreach ($pair in $seed.assign) {
  $sName, $aTitle = $pair[0], $pair[1]
  $sid = $nameToSupplierId[$sName]
  $aid = $titleToAssessmentId[$aTitle]
  Invoke-RestMethod -Headers $h -Method Post -Uri "$Base/api/suppliers/$sid/assign-assessment/$aid" -ContentType 'application/json' -Body (@{org_id=$org} | ConvertTo-Json)
}

# 4) Submit responses
foreach ($r in $seed.responses) {
  $sid = $nameToSupplierId[$r.supplier]
  $aid = $titleToAssessmentId[$r.assessment]
  $payload = @{ org_id=$org; assessment_id=$aid; responses=$r.answers }
  Invoke-RestMethod -Headers $h -Method Post -Uri "$Base/api/suppliers/$sid/responses" -ContentType 'application/json' -Body ($payload | ConvertTo-Json -Depth 10) | Out-Null
}

# 5) Fetch scores
$rows = @()
foreach ($k in $nameToSupplierId.Keys) {
  $sid = $nameToSupplierId[$k]
  foreach ($aTitle in $titleToAssessmentId.Keys) {
    $aid = $titleToAssessmentId[$aTitle]
    try {
      $scoreObj = Invoke-RestMethod "$Base/api/suppliers/$sid/score?assessment_id=$aid"
      $rows += [PSCustomObject]@{ Supplier=$k; Assessment=$aTitle; Score=$scoreObj.score; Status=$scoreObj.status }
    } catch {
      $rows += [PSCustomObject]@{ Supplier=$k; Assessment=$aTitle; Score=$null; Status="(no score)" }
    }
  }
}
$rows | Format-Table -AutoSize
