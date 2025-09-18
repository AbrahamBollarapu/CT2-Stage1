param([string]$Base="http://localhost:8081",[string]$ApiKey="ct2-dev-key")
$H=@{ "x-api-key"=$ApiKey }
function Must($name,$sb){ try{ & $sb; Write-Host "√ $name" -f Green } catch { Write-Host "? $name" -f Red; throw } }

Must "Dashboards /health" { Invoke-RestMethod "$Base/health" | Out-Null }
Must "Dashboards /"       { if ((Invoke-WebRequest "$Base/").StatusCode -ne 200){ throw "root !200" } }
Must "Suppliers list"     { Invoke-RestMethod "$Base/api/suppliers?org_id=test-org" -Headers $H | Out-Null }
"√ Traefik routing OK"
