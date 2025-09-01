# Scrub smart quotes, dashes, arrows, zero-width chars, NBSP, stray BOM from TS files
$ErrorActionPreference='Stop'

$svcSrc = 'D:/CT2/apps/backend/services/time-series-service/src'  # scope just this service

function Read-TextUtf8NoBom([string]$path){
  $bytes = [IO.File]::ReadAllBytes($path)
  $enc   = New-Object System.Text.UTF8Encoding($false)
  return $enc.GetString($bytes)
}
function Write-TextUtf8NoBom([string]$path,[string]$text){
  $enc = New-Object System.Text.UTF8Encoding($false)
  [IO.File]::WriteAllText($path,$text,$enc)
}

$files = Get-ChildItem -Path $svcSrc -Recurse -Include *.ts
foreach($f in $files){
  $text = Read-TextUtf8NoBom $f.FullName
  $orig = $text

  # Strip/normalize suspicious characters
  $text = [regex]::Replace($text, "\uFEFF", "")                           # BOM anywhere (U+FEFF)
  $text = [regex]::Replace($text, "\u00A0", " ")                          # NBSP -> space
  $text = [regex]::Replace($text, "\u200B|\u200C|\u200D|\u2060", "")      # zero-widths
  $text = [regex]::Replace($text, "[\u2018\u2019]", "'")                  # curly single quotes -> '
  $text = [regex]::Replace($text, "[\u201C\u201D]", '"')                  # curly double quotes -> "
  $text = [regex]::Replace($text, "[\u2012\u2013\u2014\u2015]", "-")      # dashes -> -
  $text = [regex]::Replace($text, "\u2212", "-")                          # minus sign -> -
  $text = [regex]::Replace($text, "\u2026", "...")                        # ellipsis -> ...
  $text = [regex]::Replace($text, "\u2192", "->")                         # → -> ->
  $text = [regex]::Replace($text, "\u2190", "<-")                         # ← -> <-

  if($text -ne $orig){
    Write-TextUtf8NoBom $f.FullName $text
    Write-Host "[cleaned] $($f.FullName)" -ForegroundColor Cyan
  }
}

# Show the lines around the reported errors in server.ts (sanity check)
$server = Join-Path $svcSrc 'server.ts'
if(Test-Path $server){
  $lines = Get-Content $server
  8..16 | % { if($_ -lt $lines.Count){ "{0,2}: {1}" -f ($_+1), $lines[$_] } }
}
Write-Host "Unicode scrub complete for time-series-service." -ForegroundColor Green
