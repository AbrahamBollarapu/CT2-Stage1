// D:\CT2\apps\backend\services\supplier-service\__tests__\calcScore.test.js

const { calcScore } = require('../src/lib/calcScore');

const schema = {
  scoring: { type: 'sum', weights: { q1: 5, q2: 3 } },
};

test('q1=true, q2=false -> 5', () => {
  expect(calcScore({ q1: true, q2: false }, schema)).toBe(5);
});

test('q1=true, q2=true -> 8', () => {
  expect(calcScore({ q1: true, q2: true }, schema)).toBe(8);
});

test('string "true" values also count', () => {
  expect(calcScore({ q1: 'true', q2: 'true' }, schema)).toBe(8);
});

test('missing weights -> counts as 0', () => {
  expect(calcScore({ q9: true }, schema)).toBe(0);
});
