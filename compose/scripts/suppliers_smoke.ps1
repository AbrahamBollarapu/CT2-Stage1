[CmdletBinding()]
param(
  [string]$SupplierId,                # optional if -AutoPickSupplier
  [string]$OrgId   = "demo",
  [string]$BaseUrl = "http://localhost",
  [switch]$AutoPickSupplier,
  [switch]$AllYes,
  [switch]$AllNo,
  [switch]$Json
)

$ErrorActionPreference = 'Stop'

# Traefik + API headers
$h = @{ Host='suppliers.localhost'; 'x-api-key'='ct2-dev-key'; 'x-org-id'=$OrgId }

# SupplierId: validate or autopick the first one
$tmp = [Guid]::Empty
if (-not $SupplierId -or -not [Guid]::TryParse($SupplierId, [ref]$tmp)) {
  if ($AutoPickSupplier) {
    $supList = Invoke-RestMethod -Headers $h "$BaseUrl/api/suppliers?org_id=$OrgId"
    if (-not $supList) { throw "No suppliers found for org '$OrgId'." }
    $SupplierId = $supList[0].id     # <-- important: ensure it's set
  } else {
    throw "SupplierId is required (or use -AutoPickSupplier)."
  }
}

# Latest assessment
$aid = (Invoke-RestMethod -Headers $h "$BaseUrl/api/assessments?org_id=$OrgId")[0].id

# Pick answers
$answers = if     ($AllYes) { @{ q1=$true;  q2=$true  } }
           elseif ($AllNo)  { @{ q1=$false; q2=$false } }
           else              { @{ q1=$true;  q2=$false } }  # default => 80

# Assign
$null = Invoke-RestMethod -Method POST -Headers $h -ContentType 'application/json' `
  -Uri "$BaseUrl/api/suppliers/$SupplierId/assign-assessment/$aid" `
  -Body (@{ org_id=$OrgId } | ConvertTo-Json)

# Submit
$submit = Invoke-RestMethod -Method POST -Headers $h -ContentType 'application/json' `
  -Uri "$BaseUrl/api/suppliers/$SupplierId/responses" `
  -Body (@{ org_id=$OrgId; assessment_id=$aid; responses=$answers } | ConvertTo-Json -Compress)

if (-not $submit -or $submit.status -ne 'ok') { throw "Submit failed" }

# Score
$score = Invoke-RestMethod -Headers $h "$BaseUrl/api/suppliers/$SupplierId/score?assessment_id=$aid"

# Result object
$out = [pscustomobject]@{
  SupplierId   = $SupplierId
  AssessmentId = $aid
  AssignStatus = 'assigned'
  SubmitStatus = $submit.status
  Score        = ('{0:N2}' -f $score.score)
}

# Emit JSON only if requested (no extra noise)
if ($Json) {
  [Console]::Out.WriteLine(($out | ConvertTo-Json -Compress))
  exit 0
} else {
  $out
}
