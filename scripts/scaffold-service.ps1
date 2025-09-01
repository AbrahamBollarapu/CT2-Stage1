param([Parameter(Mandatory=\True)][string]\, [string]\="/api/\")
function New-Dir([string]\) { if (-not (Test-Path \)) { New-Item -ItemType Directory -Path \ -Force | Out-Null } }
function Write-Text([string]\, [string]\) { \ = Split-Path \ -Parent; if (\) { New-Dir \ }; \ | Out-File -FilePath \ -Encoding utf8 -Force }
\D:\CT2 = "apps\\backend\\services\\\"
New-Dir \D:\CT2
New-Dir "\D:\CT2\\src\\api\\routes"
New-Dir "\D:\CT2\\src\\application"
New-Dir "\D:\CT2\\src\\domain"
New-Dir "\D:\CT2\\src\\infrastructure\\db"
New-Dir "\D:\CT2\\openapi"
Write-Text "\D:\CT2\\.env.example" @"
PORT=8000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/\_db
JWT_ISSUER=http://iam:8000
JWT_AUDIENCE=cogtechai
