#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://localhost:8081}"
KEY="${X_API_KEY:-ct2-dev-key}"

hdr=(-H "Content-Type: application/json" -H "x-api-key: ${KEY}")

# Create suppliers
SID1=$(curl -s "${hdr[@]}" -X POST "$BASE/api/suppliers" -d '{"org_id":"demo","name":"Acme Plastics","country":"IN"}' | jq -r .id)
SID2=$(curl -s "${hdr[@]}" -X POST "$BASE/api/suppliers" -d '{"org_id":"demo","name":"GreenPower LLC","country":"US"}' | jq -r .id)

# Create assessment
AID=$(curl -s "${hdr[@]}" -X POST "$BASE/api/assessments" -d @- <<'JSON' | jq -r .id
{"org_id":"demo","title":"ESG Basic","version":"1.0","schema":{"questions":[
  {"id":"q1","text":"Policy for emissions?","type":"boolean","weight":20},
  {"id":"q2","text":"Energy data audited?","type":"boolean","weight":20},
  {"id":"q3","text":"Renewables >25%?","type":"boolean","weight":20},
  {"id":"q4","text":"Waste mgmt in place?","type":"boolean","weight":20},
  {"id":"q5","text":"Water KPI tracked?","type":"boolean","weight":20}
]}}}
JSON
)

# Assign + submit responses
curl -s "${hdr[@]}" -X POST "$BASE/api/suppliers/$SID1/assign-assessment/$AID" -d '{"org_id":"demo"}' > /dev/null
curl -s "${hdr[@]}" -X POST "$BASE/api/suppliers/$SID2/assign-assessment/$AID" -d '{"org_id":"demo"}' > /dev/null

curl -s "${hdr[@]}" -X POST "$BASE/api/suppliers/$SID1/responses" -d '{"org_id":"demo","assessment_id":"'"$AID"'","responses":{"q1":true,"q2":true,"q3":false,"q4":true,"q5":true}}' > /dev/null
curl -s "${hdr[@]}" -X POST "$BASE/api/suppliers/$SID2/responses" -d '{"org_id":"demo","assessment_id":"'"$AID"'","responses":{"q1":true,"q2":false,"q3":false,"q4":true,"q5":false}}' > /dev/null

# Fetch scores
curl -s "$BASE/api/suppliers/$SID1/score?assessment_id=$AID" | jq .
curl -s "$BASE/api/suppliers/$SID2/score?assessment_id=$AID" | jq .
