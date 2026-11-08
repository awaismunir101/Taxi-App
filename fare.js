/* Taxi fare logic. All money is handled in integer cents. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Fare = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var RATES = {
    day:     { label: 'Daytime',                  initial: 590, perKm: 140, perMin: 100 },
    evening: { label: 'Evening, night & weekend', initial: 790, perKm: 140, perMin: 100 }
  };
  var MIN_FARE = 999;
  var MAX_KM = 2000, MAX_MIN = 3000;

  /* ---------- input parsing ---------- */
  function parseNumber(raw, max) {
    var s = String(raw == null ? '' : raw).trim().replace(',', '.');
    if (s === '') return { ok: false, error: 'Enter a number' };
    if (!/^\d+(\.\d+)?$/.test(s)) return { ok: false, error: 'Use digits only, e.g. 12.5' };
    var n = Number(s);
    if (!isFinite(n)) return { ok: false, error: 'Use digits only, e.g. 12.5' };
    if (n > max) return { ok: false, error: 'Maximum is ' + max };
    return { ok: true, value: n };
  }

  /* ---------- money ---------- */
  function format(cents) {
    var neg = cents < 0; cents = Math.abs(cents);
    var e = Math.floor(cents / 100), c = cents % 100;
    var es = String(e).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + '\u20AC' + es + '.' + (c < 10 ? '0' : '') + c;
  }

  function calculate(period, km, minutes) {
    var r = RATES[period];
    if (!r) throw new Error('Unknown pricing period: ' + period);
    if (!(km >= 0) || !(minutes >= 0) || !isFinite(km) || !isFinite(minutes)) throw new Error('Invalid distance or duration');
    var distanceCharge = Math.round(km * r.perKm + 1e-7);
    var timeCharge = Math.round(minutes * r.perMin + 1e-7);
    var subtotal = r.initial + distanceCharge + timeCharge;
    var total = Math.max(MIN_FARE, subtotal);
    return {
      period: period, label: r.label, km: km, minutes: minutes,
      initial: r.initial, perKm: r.perKm, perMin: r.perMin,
      distanceCharge: distanceCharge, timeCharge: timeCharge,
      subtotal: subtotal, minimumFare: MIN_FARE,
      minimumApplied: subtotal < MIN_FARE, total: total
    };
  }

  /* ---------- Finland time ---------- */
  function finlandParts(date) {
    var f = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Helsinki', year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', hourCycle: 'h23'
    });
    var p = {};
    f.formatToParts(date).forEach(function (x) { p[x.type] = x.value; });
    var y = +p.year, m = +p.month, d = +p.day;
    return { y: y, m: m, d: d, h: (+p.hour) % 24, min: +p.minute,
             dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay() }; // 0 = Sunday
  }

  /* ---------- Finnish public holidays ---------- */
  function easter(y) { // Gregorian computus
    var a = y % 19, b = Math.floor(y / 100), c = y % 100,
        d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
        g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
        i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7,
        m = Math.floor((a + 11 * h + 22 * l) / 451),
        month = Math.floor((h + l - 7 * m + 114) / 31),
        day = ((h + l - 7 * m + 114) % 31) + 1;
    return Date.UTC(y, month - 1, day);
  }
  function key(t) { var d = new Date(t); return (d.getUTCMonth() + 1) + '-' + d.getUTCDate(); }

  function holidays(y) {
    var map = {}, DAY = 86400000, E = easter(y);
    function add(t, name) { map[key(t)] = name; }
    function fixed(m, d, name) { add(Date.UTC(y, m - 1, d), name); }
    fixed(1, 1, "New Year's Day");
    fixed(1, 6, 'Epiphany');
    add(E - 2 * DAY, 'Good Friday');
    add(E, 'Easter Sunday');
    add(E + DAY, 'Easter Monday');
    fixed(5, 1, 'May Day');
    add(E + 39 * DAY, 'Ascension Day');
    add(E + 49 * DAY, 'Pentecost');
    for (var d = 20; d <= 26; d++) // Midsummer Day = Saturday 20-26 June
      if (new Date(Date.UTC(y, 5, d)).getUTCDay() === 6) {
        fixed(6, d - 1, 'Midsummer Eve'); fixed(6, d, 'Midsummer Day');
      }
    for (var t = Date.UTC(y, 9, 31), n = 0; n < 7; n++, t += DAY) // All Saints: Saturday 31 Oct-6 Nov
      if (new Date(t).getUTCDay() === 6) { add(t, "All Saints' Day"); break; }
    fixed(12, 6, 'Independence Day');
    fixed(12, 24, 'Christmas Eve');
    fixed(12, 25, 'Christmas Day');
    fixed(12, 26, "St Stephen's Day");
    return map;
  }

  /* ---------- automatic pricing period ---------- */
  function autoPeriod(date, forceHoliday) {
    var p = finlandParts(date || new Date());
    var holiday = holidays(p.y)[p.m + '-' + p.d] || null;
    var res = { parts: p, holiday: holiday };
    if (forceHoliday) { res.period = 'evening'; res.reason = 'Public holiday (manual override)'; }
    else if (holiday) { res.period = 'evening'; res.reason = 'Public holiday: ' + holiday; }
    else if (p.dow === 0 || p.dow === 6) { res.period = 'evening'; res.reason = 'Weekend'; }
    else if (p.h >= 6 && p.h < 18) { res.period = 'day'; res.reason = 'Weekday 06:00-18:00'; }
    else { res.period = 'evening'; res.reason = 'Weekday 18:00-06:00'; }
    return res;
  }

  return {
    RATES: RATES, MIN_FARE: MIN_FARE, MAX_KM: MAX_KM, MAX_MIN: MAX_MIN,
    parseNumber: parseNumber, format: format, calculate: calculate,
    finlandParts: finlandParts, holidays: holidays, autoPeriod: autoPeriod
  };
});
