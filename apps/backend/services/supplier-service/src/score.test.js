// Full path (water-market):
// D:\water-market\apps\backend\services\supplier-service\src\score.test.js
// Full path (your CT2 tree):
// D:\CT2\apps\backend\services\supplier-service\src\score.test.js

const { computeScore } = require('./score');

const schema = {
  fields: [{ key: 'q1', type: 'yn' }, { key: 'q2', type: 'yn' }],
  scoring: { type: 'sum', weights: { q1: 5, q2: 3 } }
};

test('q1=true, q2=false -> 5', () => {
  expect(computeScore({ q1: true, q2: false }, schema)).toBe(5);
});

test('q1=true, q2=true -> 8', () => {
  expect(computeScore({ q1: true, q2: true }, schema)).toBe(8);
});

test('accepts string "true"', () => {
  expect(computeScore({ q1: "true", q2: "TRUE" }, schema)).toBe(8);
});

test('unknown keys or false/undefined contribute 0', () => {
  expect(computeScore({ q1: false, q3: true }, schema)).toBe(0);
});
