(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  var mode = 'auto';
  try { mode = localStorage.getItem('fareMode') || 'auto'; } catch (e) {}
  if (['auto', 'day', 'evening'].indexOf(mode) < 0) mode = 'auto';
  var resultShown = false;

  function two(n) { return (n < 10 ? '0' : '') + n; }
  function num(n) { return String(Number(n.toFixed(3))); }

  function renderMode() {
    var btns = document.querySelectorAll('#seg button');
    for (var i = 0; i < btns.length; i++)
      btns[i].setAttribute('aria-checked', String(btns[i].getAttribute('data-mode') === mode));
    renderInfo();
  }

  function renderInfo() {
    var main = $('infoMain'), sub = $('infoSub');
    $('holRow').hidden = mode !== 'auto';
    if (mode === 'auto') {
      var a = Fare.autoPeriod(new Date(), $('hol').checked), p = a.parts;
      main.innerHTML = 'Auto: <b></b>';
      main.querySelector('b').textContent = Fare.RATES[a.period].label + ' rate';
      sub.textContent = a.reason + ' | Finland time ' + DAYS[p.dow] + ' ' + p.d + ' ' + MONTHS[p.m - 1] + ', ' + two(p.h) + ':' + two(p.min);
    } else {
      main.innerHTML = 'Manual: <b></b>';
      main.querySelector('b').textContent = Fare.RATES[mode].label + ' rate';
      sub.textContent = mode === 'day' ? 'Mon-Fri 06:00-18:00' : 'Mon-Fri 18:00-06:00, weekends and public holidays';
    }
  }

  function setError(which, msg) {
    $(which + 'Err').textContent = msg || '';
    $(which + 'Box').classList.toggle('bad', !!msg);
  }

  function hideResult() { $('result').hidden = true; resultShown = false; }

  function row(label, sub, value, cls) {
    return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + label + (sub ? '<small>' + sub + '</small>' : '') + '</td><td>' + value + '</td></tr>';
  }

  function calculate() {
    var d = Fare.parseNumber($('km').value, Fare.MAX_KM);
    var t = Fare.parseNumber($('min').value, Fare.MAX_MIN);
    setError('km', d.ok ? '' : d.error);
    setError('min', t.ok ? '' : t.error);
    if (!d.ok || !t.ok) { hideResult(); (d.ok ? $('min') : $('km')).focus(); return; }

    var info = mode === 'auto' ? Fare.autoPeriod(new Date(), $('hol').checked) : { period: mode, reason: 'Manual' };
    var r = Fare.calculate(info.period, d.value, t.value);
    var f = Fare.format;

    $('total').textContent = f(r.total);
    $('rateLine').textContent = r.label + ' rate (' + (mode === 'auto' ? 'auto: ' + info.reason : 'manual') + ')';
    $('bd').innerHTML =
      row('Initial fee', '', f(r.initial)) +
      row('Distance', num(r.km) + ' km x ' + f(r.perKm), f(r.distanceCharge)) +
      row('Time', num(r.minutes) + ' min x ' + f(r.perMin), f(r.timeCharge)) +
      row('Calculated fare', '', f(r.subtotal)) +
      row('Minimum fare', f(r.minimumFare), r.minimumApplied ? 'Applied' : 'Not needed') +
      row('Final total', '', f(r.total), 'tot');
    $('result').hidden = false;
    resultShown = true;
    $('result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  function clearAll() {
    $('km').value = ''; $('min').value = '';
    setError('km', ''); setError('min', '');
    hideResult();
    $('km').focus();
  }

  // events
  $('seg').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    mode = b.getAttribute('data-mode');
    try { localStorage.setItem('fareMode', mode); } catch (x) {}
    renderMode();
    if (resultShown) calculate();
  });
  $('hol').addEventListener('change', function () { renderInfo(); if (resultShown) calculate(); });
  ['km', 'min'].forEach(function (id) {
    $(id).addEventListener('input', function () { setError(id, ''); hideResult(); }); // never show a stale fare
    $(id).addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); id === 'km' ? $('min').focus() : calculate(); }
    });
  });
  $('calc').addEventListener('click', calculate);
  $('clear').addEventListener('click', clearAll);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) renderInfo(); });
  setInterval(renderInfo, 30000);

  renderMode();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol))
    navigator.serviceWorker.register('sw.js').catch(function () {});
})();
