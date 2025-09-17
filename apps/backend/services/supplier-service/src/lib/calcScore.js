// D:\CT2\apps\backend\services\supplier-service\src\lib\calcScore.js

function calcScore(responses = {}, assessmentSchema = {}) {
  const weights = assessmentSchema?.scoring?.weights ?? {};
  let sum = 0;
  for (const [k, v] of Object.entries(responses)) {
    const isTrue = v === true || v === 'true';
    if (isTrue) sum += Number(weights[k] ?? 0);
  }
  return sum;
}

module.exports = { calcScore };
