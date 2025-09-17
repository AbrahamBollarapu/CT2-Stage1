// Full path (water-market):
// D:\water-market\apps\backend\services\supplier-service\src\score.js
// Full path (your CT2 tree):
// D:\CT2\apps\backend\services\supplier-service\src\score.js

/**
 * computeScore(responses, schema)
 * Sums weights where response value is true (boolean true or string "true").
 * This mirrors the DB function calc_sum_score.
 */
function computeScore(responses = {}, schema = {}) {
  const weights = (schema?.scoring?.weights) || {};
  let total = 0;

  for (const [k, v] of Object.entries(responses)) {
    const isTrue =
      v === true ||
      (typeof v === 'string' && v.toLowerCase() === 'true');

    if (isTrue) {
      const w = parseInt(weights[k] ?? 0, 10);
      if (!Number.isNaN(w)) total += w;
    }
  }
  return total;
}

module.exports = { computeScore };
