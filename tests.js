// Run with: node tests.js
const assert = require('assert');
const F = require('./fare.js');
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };
const tot = (p, km, min) => F.calculate(p, km, min).total;

t('daytime reference 10 km + 15 min = 34.90', () => assert.strictEqual(F.format(tot('day', 10, 15)), '\u20AC34.90'));
t('evening reference 10 km + 15 min = 36.90', () => assert.strictEqual(F.format(tot('evening', 10, 15)), '\u20AC36.90'));
t('minimum fare 9.99 (day)', () => {
  [[0,0],[1,1],[0.5,0],[2,1]].forEach(([k,m]) => assert.strictEqual(tot('day', k, m), 999));
  assert.strictEqual(F.calculate('day', 0, 0).minimumApplied, true);
});
t('minimum fare 9.99 (evening)', () => {
  [[0,0],[0.5,1],[0,1]].forEach(([k,m]) => assert.strictEqual(tot('evening', k, m), 999));
});
t('just above minimum is not raised', () => {
  assert.strictEqual(tot('day', 2, 2), 1070);
  assert.strictEqual(F.calculate('day', 2, 2).minimumApplied, false);
});
t('long journeys', () => {
  assert.strictEqual(F.format(tot('day', 120, 90)), '\u20AC263.90');
  assert.strictEqual(F.format(tot('evening', 120, 90)), '\u20AC265.90');
  assert.strictEqual(F.format(tot('day', 1000, 600)), '\u20AC2,005.90');
});
t('decimal inputs', () => {
  assert.strictEqual(F.format(tot('day', 12.5, 17.3)), '\u20AC40.70');
  assert.strictEqual(tot('day', 4.35, 10), 590 + 609 + 1000);
});
t('invalid inputs rejected', () => {
  ['', '  ', 'abc', '-5', '1e3', '1.2.3', 'Infinity', 'NaN', '5000', '.5', '10km'].forEach(s =>
    assert.strictEqual(F.parseNumber(s, F.MAX_KM).ok, false, 'should reject "' + s + '"'));
  assert.strictEqual(F.parseNumber(' 10 ', F.MAX_KM).value, 10);
  assert.strictEqual(F.parseNumber('1,5', F.MAX_KM).value, 1.5);
  assert.strictEqual(F.parseNumber('0', F.MAX_KM).value, 0);
  assert.throws(() => F.calculate('day', -1, 5));
  assert.throws(() => F.calculate('night', 1, 5));
});
t('breakdown always matches total (10,000 random cases)', () => {
  for (let i = 0; i < 10000; i++) {
    const p = i % 2 ? 'day' : 'evening', km = Math.round(Math.random() * 30000) / 100, mi = Math.round(Math.random() * 30000) / 100;
    const r = F.calculate(p, km, mi);
    assert.strictEqual(r.subtotal, r.initial + r.distanceCharge + r.timeCharge);
    assert.strictEqual(r.total, Math.max(999, r.subtotal));
    assert.strictEqual(r.minimumApplied, r.subtotal < 999);
    assert.ok(r.total >= 999 && Number.isInteger(r.total));
  }
});
t('money format', () => {
  assert.strictEqual(F.format(999), '\u20AC9.99'); assert.strictEqual(F.format(5), '\u20AC0.05');
  assert.strictEqual(F.format(123456), '\u20AC1,234.56');
});
t('Finnish holidays 2026', () => {
  const h = F.holidays(2026);
  const want = { '1-1':1,'1-6':1,'4-3':1,'4-5':1,'4-6':1,'5-1':1,'5-14':1,'5-24':1,'6-19':1,'6-20':1,'10-31':1,'12-6':1,'12-24':1,'12-25':1,'12-26':1 };
  Object.keys(want).forEach(k => assert.ok(h[k], 'missing ' + k));
  assert.strictEqual(Object.keys(h).length, Object.keys(want).length);
});
t('Finnish holidays 2025 (Easter 20 Apr, Midsummer 20-21 Jun, All Saints 1 Nov)', () => {
  const h = F.holidays(2025);
  ['4-18','4-20','4-21','5-29','6-8','6-20','6-21','11-1'].forEach(k => assert.ok(h[k], 'missing ' + k));
});
const P = iso => F.autoPeriod(new Date(iso)).period;
t('auto period: winter boundaries (UTC+2)', () => {
  assert.strictEqual(P('2026-01-12T03:59:00Z'), 'evening'); // Mon 05:59
  assert.strictEqual(P('2026-01-12T04:00:00Z'), 'day');     // Mon 06:00
  assert.strictEqual(P('2026-01-12T15:59:00Z'), 'day');     // Mon 17:59
  assert.strictEqual(P('2026-01-12T16:00:00Z'), 'evening'); // Mon 18:00
});
t('auto period: summer boundaries (UTC+3)', () => {
  assert.strictEqual(P('2026-07-15T02:59:00Z'), 'evening'); // Wed 05:59
  assert.strictEqual(P('2026-07-15T03:00:00Z'), 'day');     // Wed 06:00
  assert.strictEqual(P('2026-07-15T14:59:00Z'), 'day');     // Wed 17:59
  assert.strictEqual(P('2026-07-15T15:00:00Z'), 'evening'); // Wed 18:00
});
t('auto period: daylight-saving switches', () => {
  assert.strictEqual(P('2026-03-30T02:59:00Z'), 'evening'); // Mon after spring change: 05:59 EEST
  assert.strictEqual(P('2026-03-30T03:00:00Z'), 'day');
  assert.strictEqual(P('2026-10-26T03:00:00Z'), 'evening'); // Mon after autumn change: 05:00 EET
  assert.strictEqual(P('2026-10-26T04:00:00Z'), 'day');     // 06:00 EET
});
t('auto period: weekends and holidays', () => {
  assert.strictEqual(P('2026-10-31T10:00:00Z'), 'evening'); // Saturday
  assert.strictEqual(P('2026-11-01T10:00:00Z'), 'evening'); // Sunday
  assert.strictEqual(P('2026-04-03T10:00:00Z'), 'evening'); // Good Friday
  assert.strictEqual(P('2026-04-06T10:00:00Z'), 'evening'); // Easter Monday
  assert.strictEqual(P('2026-06-19T10:00:00Z'), 'evening'); // Midsummer Eve (Fri)
  assert.strictEqual(P('2026-12-24T10:00:00Z'), 'evening'); // Christmas Eve (Thu)
  assert.strictEqual(P('2026-04-07T10:00:00Z'), 'day');     // ordinary Tuesday
  assert.strictEqual(F.autoPeriod(new Date('2026-04-07T10:00:00Z'), true).period, 'evening'); // manual holiday override
});
console.log('\nAll ' + n + ' test groups passed.');
