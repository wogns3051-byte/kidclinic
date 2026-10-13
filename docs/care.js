/* 아이아플때 — 우리아이 → 🩺 진료
 * ① 진료실 요약 카드  ② 처방약 복용 체크  ③ 어린이집 투약의뢰서  ④ 등원 언제부터 돼요?
 * 모든 기록은 이 휴대폰 안에만 저장한다 (kidrx:<아이id>). 투약의뢰서·요약은 저장하지 않고 그때그때 만든다.
 */
(function () {
  'use strict';
  var K = window.KC; if (!K || !K.curKid) return;
  var $ = K.$, $$ = K.$$, esc = K.esc, load = K.load, save = K.save, toast = K.toast;

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function hm(t) { var d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function mdw(d) { return (d.getMonth() + 1) + '월 ' + d.getDate() + '일(' + '일월화수목금토'[d.getDay()] + ')'; }
  function when(t) {
    var d = new Date(t), n = new Date();
    var diff = Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
    return (diff === 0 ? '오늘' : diff === 1 ? '어제' : diff === 2 ? '그저께' : (d.getMonth() + 1) + '/' + d.getDate()) + ' ' + hm(t);
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function today0() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }

  var open = load('careOpen', 'sum');

  // ───── ① 진료실 요약 카드 ─────
  function summary(kid) {
    var l = K.kidLogs(kid.id), now = Date.now(), since = now - 72 * 3600000;
    var r = l.filter(function (x) { return x.t >= since; }).sort(function (a, b) { return a.t - b.t; });
    var temps = r.filter(function (x) { return x.type === 'temp'; });
    var hot = temps.filter(function (x) { return x.v >= 38; });
    // 열이 처음 난 때: 72시간 안에서 38℃ 이상이 시작된 첫 기록 (중간에 37.5 미만으로 내려가면 다시 셈)
    var feverStart = null;
    temps.forEach(function (x) { if (x.v >= 38 && !feverStart) feverStart = x; if (x.v < 37.5) feverStart = null; });
    var max = temps.reduce(function (m, x) { return !m || x.v > m.v ? x : m; }, null);
    var lastT = temps[temps.length - 1];
    var meds = function (k) { return r.filter(function (x) { return x.type === k; }); };
    var acet = meds('acet'), ibu = meds('ibu');
    var day = function (k) { return l.filter(function (x) { return x.type === k && now - x.t < 86400000; }).length; };
    var notes = r.filter(function (x) { return x.type === 'note'; });
    var symCount = {};
    notes.forEach(function (n) { String(n.v).split(/[,·]\s*/).forEach(function (w) { w = w.trim(); if (w) symCount[w] = (symCount[w] || 0) + 1; }); });
    var pee24 = day('pee'), drink24 = day('drink');
    var lastPee = l.filter(function (x) { return x.type === 'pee'; }).sort(function (a, b) { return b.t - a.t; })[0];
    var rx = rxList(kid).filter(function (x) { return rxActive(x); });
    var rows = [];
    if (feverStart) rows.push(['🌡 열 시작', when(feverStart.t) + ' (' + Math.max(1, Math.round((now - feverStart.t) / 3600000)) + '시간째)']);
    if (max) rows.push(['🔥 최고 체온', max.v.toFixed(1) + '℃ · ' + when(max.t), max.v >= 39]);
    if (lastT) rows.push(['🌡 마지막 체온', lastT.v.toFixed(1) + '℃ · ' + when(lastT.t), lastT.v >= 38]);
    if (acet.length || ibu.length) {
      var m = [];
      if (acet.length) m.push('아세트아미노펜 ' + acet.length + '회 (마지막 ' + when(acet[acet.length - 1].t) + ')');
      if (ibu.length) m.push('이부프로펜 계열 ' + ibu.length + '회 (마지막 ' + when(ibu[ibu.length - 1].t) + ')');
      rows.push(['💊 해열제 (3일)', m.join('\n')]);
    }
    var syms = Object.keys(symCount);
    if (syms.length) rows.push(['📝 증상', syms.map(function (w) { return w + (symCount[w] > 1 ? ' ' + symCount[w] + '번' : ''); }).join(', '), syms.some(function (w) { return /경련|처짐|소변 줄/.test(w); })]);
    if (pee24 || drink24 || lastPee) rows.push(['💧 소변·물 (24시간)', '소변 ' + pee24 + '번 · 물·수유 ' + drink24 + '번' + (lastPee ? '\n마지막 소변 ' + when(lastPee.t) : ''), lastPee && now - lastPee.t > 8 * 3600000]);
    if (rx.length) rows.push(['💊 먹는 처방약', rx.map(function (x) { return x.name + (x.dose ? ' ' + x.dose : ''); }).join('\n')]);
    if (kid.allergy) rows.push(['⚠️ 알레르기', kid.allergy, true]);
    return { rows: rows, hasData: !!(temps.length || acet.length || ibu.length || notes.length || pee24 || drink24) };
  }
  function renderSum(kid) {
    var S = summary(kid);
    var age = kid.birth ? K.ageText(kid.birth) : '';
    var body = !S.hasData ? '<div class="kid-empty small">최근 3일 기록이 없어요. 💊 해열제 화면에서 체온·해열제·증상을 기록하면 여기에 자동으로 정리돼요.</div>' :
      '<div class="sum-card"><div class="sum-h"><b>' + esc(kid.name) + '</b>' + (age ? ' <span>' + age + (kid.weight ? ' · ' + esc(kid.weight) + 'kg' : '') + '</span>' : '') + '<em>최근 3일</em></div>' +
      S.rows.map(function (r) { return '<div class="sum-r' + (r[2] ? ' warn' : '') + '"><span>' + r[0] + '</span><b>' + esc(r[1]).replace(/\n/g, '<br>') + '</b></div>'; }).join('') + '</div>' +
      '<div class="actions pad"><button class="btn" id="sum-full">🔍 크게 보여 주기</button><button class="btn ghost" id="sum-share">📤 보내기</button></div>';
    return '<div class="care-intro">진료실에서 의사 선생님께 이 화면을 그대로 보여 주세요. 해열제 화면의 기록으로 자동으로 만들어져요.</div>' + body;
  }
  function sumText(kid) {
    var S = summary(kid);
    return '[' + kid.name + ' 진료 요약 · 최근 3일]\n' + (kid.birth ? K.ageText(kid.birth) + (kid.weight ? ' · ' + kid.weight + 'kg' : '') + '\n' : '') +
      S.rows.map(function (r) { return r[0].replace(/^\S+\s/, '') + ': ' + r[1].replace(/\n/g, ' / '); }).join('\n') + '\n\n- 아이아플때 앱';
  }
  function bindSum(kid) {
    var f = $('#sum-full');
    if (f) f.addEventListener('click', function () {
      var S = summary(kid);
      $('#sheet-body').innerHTML = '<div class="sum-big"><div class="sum-big-h">' + esc(kid.name) + (kid.birth ? ' · ' + K.ageText(kid.birth) : '') + (kid.weight ? ' · ' + esc(kid.weight) + 'kg' : '') + '</div>' +
        S.rows.map(function (r) { return '<div class="sum-r' + (r[2] ? ' warn' : '') + '"><span>' + r[0] + '</span><b>' + esc(r[1]).replace(/\n/g, '<br>') + '</b></div>'; }).join('') +
        '<div class="note">아이아플때 앱에 보호자가 기록한 내용이에요 (최근 3일).</div></div>';
      $('#sheet').hidden = false; $('#sheet-bg').hidden = false; $('#sheet').scrollTop = 0;
    });
    var sh = $('#sum-share');
    if (sh) sh.addEventListener('click', function () { if (!K.confirmShare('진료 요약')) return; K.shareText(kid.name + ' 진료 요약', sumText(kid)); });
  }

  // ───── ② 처방약 복용 체크 ─────
  var SLOTS = ['아침', '점심', '저녁', '자기 전'];
  function rxList(kid) { return load('kidrx:' + kid.id, []); }
  function rxSave(kid, l) { save('kidrx:' + kid.id, l.slice(-30)); }
  function rxEnd(x) { return addDays(new Date(x.start + 'T00:00:00'), x.days - 1); }
  function rxActive(x) { return rxEnd(x) >= today0(); }
  function renderRx(kid) {
    var l = rxList(kid), t0 = today0();
    var act = l.filter(rxActive), old = l.filter(function (x) { return !rxActive(x); }).slice(-3).reverse();
    var card = function (x) {
      var s = new Date(x.start + 'T00:00:00'), rows = '', missed = 0, total = 0, doneN = 0;
      for (var i = 0; i < x.days; i++) {
        var d = addDays(s, i), key = ymd(d), isToday = +d === +t0, past = d < t0;
        rows += '<tr class="' + (isToday ? 'today' : '') + '"><th>' + (isToday ? '오늘' : (d.getMonth() + 1) + '/' + d.getDate()) + '</th>' +
          x.slots.map(function (si) {
            var on = x.c && x.c[key + '|' + si]; total++; if (on) doneN++; else if (past) missed++;
            return '<td><button class="rx-c' + (on ? ' on' : past ? ' miss' : '') + '" data-rx="' + x.id + '" data-k="' + key + '|' + si + '" aria-label="' + key + ' ' + SLOTS[si] + '">' + (on ? '✓' : '') + '</button></td>';
          }).join('') + '</tr>';
      }
      return '<div class="rx"><div class="rx-h"><div><b>' + esc(x.name) + '</b>' + (x.dose ? ' <span>' + esc(x.dose) + '</span>' : '') +
        '<div class="rx-sub">' + x.start.slice(5).replace('-', '/') + '부터 ' + x.days + '일 · 하루 ' + x.slots.length + '번 · ' + doneN + '/' + total + ' 먹음' + (x.cold ? ' · 🧊 냉장 보관' : '') + '</div></div>' +
        '<button class="rx-del" data-rxdel="' + x.id + '" aria-label="지우기">✕</button></div>' +
        (missed ? '<div class="rx-miss">⚠️ 빠뜨린 칸이 ' + missed + '개 있어요. 먹였다면 눌러서 체크하고, 못 먹였다면 다음 번에 두 번 먹이지 말고 약사·의사에게 물어보세요.</div>' : '') +
        '<div class="rx-scroll"><table class="rx-t"><thead><tr><th></th>' + x.slots.map(function (si) { return '<th>' + SLOTS[si] + '</th>'; }).join('') + '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '<button class="btn ghost rx-form-btn" data-rxform="' + x.id + '">📝 이 약으로 어린이집 투약의뢰서 만들기</button></div>';
    };
    return '<div class="care-intro">병원에서 받은 약을 적어 두고 먹일 때마다 칸을 눌러 체크하세요. 항생제는 다 나은 것 같아도 처방받은 날짜까지 먹이는 게 중요해요.</div>' +
      (act.length ? act.map(card).join('') : '<div class="kid-empty small">지금 먹는 처방약이 없어요</div>') +
      '<details class="rx-add"' + (act.length ? '' : ' open') + '><summary>+ 처방약 추가</summary><div class="g-form">' +
        '<label>약 이름<input id="rx-n" maxlength="30" placeholder="예: 항생제 시럽, 감기약"></label>' +
        '<label>한 번에 먹는 양<input id="rx-d" maxlength="20" placeholder="예: 5mL, 1포 (약 봉투대로)"></label>' +
        '<div class="g-two"><label>시작한 날<input type="date" id="rx-s" value="' + ymd(t0) + '"></label><label>며칠 동안<input type="number" id="rx-days" min="1" max="30" value="5" inputmode="numeric"></label></div>' +
        '<div class="rx-slots"><span>먹는 때</span>' + SLOTS.map(function (n, i) { return '<label><input type="checkbox" data-slot="' + i + '"' + (i < 3 ? ' checked' : '') + '> ' + n + '</label>'; }).join('') + '</div>' +
        '<label class="rx-cold"><input type="checkbox" id="rx-cold"> 🧊 냉장 보관하는 약</label>' +
        '<button class="btn" id="rx-save">추가하기</button></div></details>' +
      (old.length ? '<div class="rx-old"><b>끝난 약</b> ' + old.map(function (x) { return esc(x.name) + ' (' + x.start.slice(5).replace('-', '/') + ' · ' + x.days + '일)'; }).join(', ') + '</div>' : '') +
      '<div class="note pad">용량·횟수는 약 봉투와 약사 안내를 따라 주세요. 이 체크는 먹였는지 기억하기 위한 메모예요.</div>';
  }
  function bindRx(kid) {
    $$('#kid-care [data-rx]').forEach(function (b) {
      b.addEventListener('click', function () {
        var l = rxList(kid), x = l.filter(function (y) { return y.id === b.dataset.rx; })[0]; if (!x) return;
        x.c = x.c || {}; if (x.c[b.dataset.k]) delete x.c[b.dataset.k]; else x.c[b.dataset.k] = Date.now();
        rxSave(kid, l); render();
      });
    });
    $$('#kid-care [data-rxdel]').forEach(function (b) {
      b.addEventListener('click', function () { if (!confirm('이 처방약 기록을 지울까요?')) return; rxSave(kid, rxList(kid).filter(function (y) { return y.id !== b.dataset.rxdel; })); render(); });
    });
    $$('#kid-care [data-rxform]').forEach(function (b) {
      b.addEventListener('click', function () { formPrefill = rxList(kid).filter(function (y) { return y.id === b.dataset.rxform; })[0] || null; setOpen('form'); });
    });
    var sv = $('#rx-save');
    if (sv) sv.addEventListener('click', function () {
      var n = $('#rx-n').value.trim(), days = parseInt($('#rx-days').value, 10), st = $('#rx-s').value;
      var slots = $$('#kid-care [data-slot]').filter(function (c) { return c.checked; }).map(function (c) { return +c.dataset.slot; });
      if (!n) { toast('약 이름을 적어 주세요'); return; }
      if (!(days >= 1 && days <= 30)) { toast('며칠 동안 먹는지 1~30 사이로 적어 주세요'); return; }
      if (!slots.length) { toast('먹는 때를 하나 이상 골라 주세요'); return; }
      var l = rxList(kid); l.push({ id: uid(), name: n, dose: $('#rx-d').value.trim(), start: st || ymd(today0()), days: days, slots: slots, cold: $('#rx-cold').checked, c: {} });
      rxSave(kid, l); toast('추가했어요. 먹일 때마다 칸을 눌러 주세요'); render();
    });
  }

  // ───── ③ 어린이집 투약의뢰서 ─────
  var formPrefill = null;
  var FORM_TYPES = ['물약(시럽)', '가루약', '알약', '연고', '안약·귀약', '기타'];
  function renderForm(kid) {
    var p = formPrefill || {};
    var slotTime = { 0: '오전 등원 후', 1: '점심 먹고 12:30', 2: '하원 전', 3: '' };
    var defTime = p.slots ? p.slots.filter(function (s) { return s === 1; }).map(function (s) { return slotTime[s]; }).join(', ') || '점심 먹고 12:30' : '점심 먹고 12:30';
    return '<div class="care-intro">어린이집·유치원 선생님께 보낼 투약의뢰서를 만들어요. 원에서 정한 서식이 따로 있으면 그 서식을 따라 주세요.</div>' +
      '<div class="g-form">' +
        '<div class="g-two"><label>투약 날짜<input type="date" id="f-date" value="' + ymd(today0()) + '"></label><label>아이 이름<input id="f-name" value="' + esc(kid.name || '') + '" maxlength="12"></label></div>' +
        '<label>증상<input id="f-sym" maxlength="40" placeholder="예: 감기(콧물·기침)"></label>' +
        '<label>약 이름<input id="f-med" maxlength="40" value="' + esc(p.name || '') + '" placeholder="예: 항생제 시럽, 해열제"></label>' +
        '<div class="f-types"><span>약 종류</span>' + FORM_TYPES.map(function (t, i) { return '<button class="chip' + (i === 0 ? ' on' : '') + '" data-ftype="' + t + '">' + t + '</button>'; }).join('') + '</div>' +
        '<div class="g-two"><label>한 번 먹일 양<input id="f-dose" maxlength="20" value="' + esc(p.dose || '') + '" placeholder="예: 5mL"></label><label>먹일 시간<input id="f-time" maxlength="24" value="' + esc(defTime) + '"></label></div>' +
        '<div class="f-types"><span>보관</span><button class="chip' + (p.cold ? '' : ' on') + '" data-fkeep="실온">실온</button><button class="chip' + (p.cold ? ' on' : '') + '" data-fkeep="냉장">🧊 냉장</button></div>' +
        '<label>특이사항<input id="f-memo" maxlength="60" placeholder="예: 먹고 토하면 연락 주세요"></label>' +
        '<label>보호자<input id="f-guard" maxlength="30" value="' + esc(kid.guardian || '') + '" placeholder="예: 엄마 010-0000-0000"></label>' +
        '<div class="actions"><button class="btn" id="f-img">🖼 이미지로 만들기</button><button class="btn ghost" id="f-txt">💬 문자로 보내기</button></div>' +
        '<div class="priv">🔒 투약의뢰서는 저장하지 않고 그때그때 이 휴대폰 안에서 만들어요. 보내면 아이 이름·증상·보호자 연락처가 받는 사람(선생님)과 메신저에 전달돼요.</div>' +
      '</div><div id="f-out"></div>';
  }
  function formData() {
    var on = function (attr) { var b = $('#kid-care [' + attr + '].on'); return b ? b.getAttribute(attr) : ''; };
    var d = $('#f-date').value ? new Date($('#f-date').value + 'T00:00:00') : today0();
    return { date: mdw(d), name: $('#f-name').value.trim(), sym: $('#f-sym').value.trim(), med: $('#f-med').value.trim(), type: on('data-ftype'),
      dose: $('#f-dose').value.trim(), time: $('#f-time').value.trim(), keep: on('data-fkeep'), memo: $('#f-memo').value.trim(), guard: $('#f-guard').value.trim() };
  }
  function formRows(f) {
    return [['투약 날짜', f.date], ['아이 이름', f.name], ['증상', f.sym], ['약 이름', f.med], ['약 종류', f.type], ['한 번 먹일 양', f.dose], ['먹일 시간', f.time], ['보관', f.keep], ['특이사항', f.memo], ['보호자', f.guard]]
      .filter(function (r) { return r[1]; });
  }
  function bindForm(kid) {
    $$('#kid-care [data-ftype]').forEach(function (b) { b.addEventListener('click', function () { $$('#kid-care [data-ftype]').forEach(function (x) { x.classList.toggle('on', x === b); }); }); });
    $$('#kid-care [data-fkeep]').forEach(function (b) { b.addEventListener('click', function () { $$('#kid-care [data-fkeep]').forEach(function (x) { x.classList.toggle('on', x === b); }); }); });
    var check = function (f) { if (!f.med || !f.dose || !f.time) { toast('약 이름·양·시간은 꼭 적어 주세요'); return false; } return true; };
    $('#f-txt').addEventListener('click', function () {
      var f = formData(); if (!check(f)) return;
      if (!K.confirmShare('투약의뢰서')) return;
      K.shareText('투약의뢰서', '[투약의뢰서]\n' + formRows(f).map(function (r) { return r[0] + ': ' + r[1]; }).join('\n') +
        '\n\n위와 같이 투약을 부탁드립니다. 투약으로 생기는 일은 보호자가 책임지겠습니다.\n보호자 ' + (f.guard || ''));
    });
    $('#f-img').addEventListener('click', function () {
      var f = formData(); if (!check(f)) return;
      var go = function () { formImage(f); };
      if (document.fonts && document.fonts.load) document.fonts.load('40px Jua', '투약').then(go, go); else go();
    });
  }
  function formImage(f) {
    var W = 1080, rows = formRows(f), c = document.createElement('canvas'), ctx = c.getContext('2d');
    var SANS = '"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif';
    ctx.font = '600 40px ' + SANS;
    var lay = [], y = 0;
    rows.forEach(function (r) { var lines = K.wrapLines(ctx, r[1], W - 120 - 300); lay.push({ r: r, lines: lines, y: y }); y += Math.max(1, lines.length) * 54 + 34; });
    var H = 300 + y + 260; c.width = W; c.height = H;
    ctx.fillStyle = '#FFF8EC'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#FFFFFF'; K.roundRect(ctx, 40, 40, W - 80, H - 80, 44); ctx.fill();
    ctx.strokeStyle = '#FFD7A8'; ctx.lineWidth = 4; ctx.setLineDash([16, 12]); K.roundRect(ctx, 40, 40, W - 80, H - 80, 44); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#2B3150'; ctx.font = '70px Jua,' + SANS; ctx.textBaseline = 'alphabetic'; ctx.fillText('💊 투약의뢰서', 90, 170);
    ctx.fillStyle = '#9A8F80'; ctx.font = '500 32px ' + SANS; ctx.fillText('선생님, 아래와 같이 약을 먹여 주세요', 92, 228);
    ctx.textBaseline = 'top';
    lay.forEach(function (it) {
      var y0 = 290 + it.y;
      ctx.fillStyle = '#F2EDE4'; ctx.fillRect(90, y0 + Math.max(1, it.lines.length) * 54 + 12, W - 180, 2);
      ctx.fillStyle = '#9A8F80'; ctx.font = '600 34px ' + SANS; ctx.fillText(it.r[0], 92, y0 + 4);
      ctx.fillStyle = it.r[0] === '보관' && it.r[1] === '냉장' ? '#1D6FB8' : '#2B3150'; ctx.font = '700 40px ' + SANS;
      it.lines.forEach(function (ln, k) { ctx.fillText(ln, 390, y0 + k * 54); });
    });
    ctx.fillStyle = '#5B6380'; ctx.font = '500 30px ' + SANS;
    ctx.fillText('투약으로 생기는 일은 보호자가 책임지겠습니다.', 92, H - 200);
    ctx.fillStyle = '#2B3150'; ctx.font = '700 36px ' + SANS; ctx.fillText('보호자  ' + (f.guard || '') + '   (서명)', 92, H - 148);
    ctx.fillStyle = '#B8AE9F'; ctx.font = '500 26px ' + SANS; ctx.textAlign = 'right'; ctx.fillText('아이아플때', W - 92, H - 92); ctx.textAlign = 'left';
    c.toBlob(function (blob) {
      var url = URL.createObjectURL(blob), name = '투약의뢰서-' + (f.name || '') + '.png', file = null;
      try { file = new File([blob], name, { type: 'image/png' }); } catch (e) {}
      var canShare = file && navigator.canShare && navigator.canShare({ files: [file] });
      var out = $('#f-out');
      out.innerHTML = '<div class="lock-out"><img src="' + url + '" alt="투약의뢰서 이미지" class="f-img">' +
        '<div class="actions">' + (canShare ? '<button class="btn" id="f-share">📤 선생님께 보내기</button>' : '') + '<a class="btn' + (canShare ? ' ghost' : '') + '" href="' + url + '" download="' + esc(name) + '">⬇️ 내려받기</a></div>' +
        '<div class="muted-s">키즈노트·카톡 등으로 보낼 수 있어요. 원에 따라 직접 서명한 종이 서식을 요구할 수도 있어요.</div></div>';
      var sb = $('#f-share'); if (sb) sb.addEventListener('click', function () { if (!K.confirmShare('투약의뢰서')) return; navigator.share({ files: [file], title: '투약의뢰서' }).catch(function () {}); });
      out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 'image/png');
  }

  // ───── ④ 등원 언제부터 돼요? ─────
  // 기준: 교육부·질병관리청 「학생 감염병 예방·위기대응 매뉴얼」의 감염병별 등교(원) 중지 기간,
  //       인플루엔자는 질병관리청 권고(해열제 없이 열이 내린 뒤 24시간). 어린이집마다 소견서를 요구할 수 있다.
  // d: 기준일부터 쉬는 날 수 (기준일=0일째, d일째까지 쉬고 d+1일째부터 가능) / h: 시간 기준 / null: 날짜 계산 대신 상태 기준
  var DIS = [
    { id: 'hfmd', n: '수족구병', base: '물집(수포)이 처음 생긴 날', d: 6, rule: '물집이 생긴 뒤 6일간, 또는 물집에 딱지가 앉을 때까지 쉬어요', extra: '열이 내리고 입안 물집이 나아서 잘 먹을 수 있어야 해요' },
    { id: 'flu', n: '독감(인플루엔자)', base: '해열제 없이 열이 내린 시각', h: 24, rule: '해열제를 먹지 않고 열이 내린 뒤 24시간이 지날 때까지 쉬어요', extra: '항바이러스제를 먹었더라도 이 기준으로 봐요' },
    { id: 'pox', n: '수두', base: null, rule: '모든 물집에 딱지가 앉을 때까지 쉬어요', extra: '보통 발진이 생기고 5일 이상 걸려요. 딱지가 다 앉았는지 직접 확인해 주세요' },
    { id: 'noro', n: '노로바이러스 장염', base: '구토·설사가 멈춘 시각', h: 48, rule: '구토·설사가 멈춘 뒤 48시간이 지날 때까지 쉬어요', extra: '다 나은 뒤에도 손 씻기를 꼭 해 주세요' },
    { id: 'mump', n: '볼거리(유행성이하선염)', base: '침샘이 붓기 시작한 날', d: 5, rule: '증상이 생긴 뒤 5일까지 쉬어요' },
    { id: 'measles', n: '홍역', base: '발진이 생긴 날', d: 4, rule: '발진이 생긴 뒤 4일까지 쉬어요' },
    { id: 'rub', n: '풍진', base: '발진이 생긴 날', d: 7, rule: '발진이 생긴 뒤 7일까지 쉬어요' },
    { id: 'scarlet', n: '성홍열', base: '항생제를 처음 먹은 시각', h: 24, rule: '항생제를 먹기 시작하고 24시간이 지날 때까지 쉬어요', extra: '처방받은 항생제는 끝까지 먹여요' },
    { id: 'pert', n: '백일해', base: '항생제를 처음 먹은 날', d: 5, rule: '항생제를 먹기 시작하고 5일까지 쉬어요' },
    { id: 'eye', n: '유행성 눈병(각결막염)', base: null, rule: '격리 기준은 없지만, 눈곱·충혈이 심하면 쉬는 게 좋아요', extra: '어린이집마다 기준이 달라요. 원에 먼저 물어봐 주세요' }
  ];
  var disSel = load('disSel', 'hfmd');
  function renderDis() {
    var D = DIS.filter(function (x) { return x.id === disSel; })[0] || DIS[0];
    var nowLocal = new Date(); nowLocal.setMinutes(nowLocal.getMinutes() - nowLocal.getTimezoneOffset());
    return '<div class="care-intro">감염병에 걸렸을 때 언제까지 쉬어야 하는지 알려 드려요. 날짜를 넣으면 등원할 수 있는 날을 계산해요.</div>' +
      '<div class="dis-chips">' + DIS.map(function (x) { return '<button class="chip' + (x.id === D.id ? ' on' : '') + '" data-dis="' + x.id + '">' + x.n + '</button>'; }).join('') + '</div>' +
      '<div class="dis-card"><div class="dis-n">' + D.n + '</div><div class="dis-rule">' + D.rule + '</div>' + (D.extra ? '<div class="dis-extra">' + D.extra + '</div>' : '') +
      (D.base ? '<label class="dis-in">' + D.base + (D.h ? '<input type="datetime-local" id="dis-t" value="' + nowLocal.toISOString().slice(0, 16) + '">' : '<input type="date" id="dis-t" value="' + ymd(today0()) + '">') + '</label><div id="dis-res" class="dis-res"></div>' : '') +
      '</div>' +
      '<div class="note pad">어린이집·유치원마다 기준이 조금 다를 수 있고, 등원할 때 의사 소견서(완치 확인서)를 요구하는 곳도 있어요. 꼭 원에 확인하세요.<br>기준: 교육부·질병관리청 「학생 감염병 예방·위기대응 매뉴얼」 감염병별 등교 중지 기간, 인플루엔자는 질병관리청 권고 (2026.10 확인).</div>';
  }
  function calcDis() {
    var D = DIS.filter(function (x) { return x.id === disSel; })[0], el = $('#dis-t'), out = $('#dis-res');
    if (!D || !el || !out) return;
    if (!el.value) { out.innerHTML = ''; return; }
    if (D.h) {
      var t = new Date(el.value), ok = new Date(t.getTime() + D.h * 3600000);
      if (isNaN(ok)) { out.innerHTML = ''; return; }
      var morning = new Date(ok); if (ok.getHours() > 9 || (ok.getHours() === 9 && ok.getMinutes() > 0)) { morning = addDays(new Date(ok.getFullYear(), ok.getMonth(), ok.getDate()), 1); }
      else morning = new Date(ok.getFullYear(), ok.getMonth(), ok.getDate());
      out.innerHTML = '<div>⏰ <b>' + mdw(ok) + ' ' + hm(ok) + '</b> 이후면 기준을 채워요</div><div class="dis-ok">🎒 아침 등원은 <b>' + mdw(morning) + '</b>부터 가능해요</div>' +
        (ok > new Date() ? '<div class="dis-wait">그때까지 다시 열이 나거나 증상이 생기면 그 시각부터 다시 세요</div>' : '');
    } else {
      var b = new Date(el.value + 'T00:00:00'), last = addDays(b, D.d), go = addDays(b, D.d + 1);
      out.innerHTML = '<div>🏠 <b>' + mdw(last) + '</b>까지 쉬어요</div><div class="dis-ok">🎒 <b>' + mdw(go) + '</b>부터 등원할 수 있어요</div>' +
        (D.id === 'hfmd' ? '<div class="dis-wait">그 전이라도 모든 물집에 딱지가 앉았다면 원과 상의해 보세요</div>' : '');
    }
  }
  function bindDis() {
    $$('#kid-care [data-dis]').forEach(function (b) { b.addEventListener('click', function () { disSel = b.dataset.dis; save('disSel', disSel); render(); }); });
    var el = $('#dis-t'); if (el) { el.addEventListener('change', calcDis); el.addEventListener('input', calcDis); calcDis(); }
  }

  // ───── 화면 ─────
  var SECTIONS = [['sum', '🩺 진료실 요약'], ['rx', '💊 처방약 체크'], ['form', '📝 투약의뢰서'], ['dis', '🏠 등원 언제부터?']];
  function setOpen(k) { open = k; save('careOpen', k); render(); window.scrollTo({ top: $('#kid-care').offsetTop - 70, behavior: 'smooth' }); }
  function render() {
    var box = $('#kid-care'); if (!box) return;
    var kid = K.curKid();
    var tabs = '<div class="care-tabs">' + SECTIONS.map(function (s) { return '<button class="' + (s[0] === open ? 'on' : '') + '" data-care="' + s[0] + '">' + s[1] + '</button>'; }).join('') + '</div>';
    if (!kid && open !== 'dis') {
      box.innerHTML = tabs + '<div class="kid-empty"><b>아이를 먼저 추가해 주세요</b>진료실 요약·처방약 체크·투약의뢰서는 아이 기록으로 만들어져요. "등원 언제부터?"는 바로 볼 수 있어요.' +
        '<button class="btn" data-kid-add="care">+ 아이 추가</button></div>' + K.privNote('kid');
    } else {
      box.innerHTML = tabs + (open === 'sum' ? renderSum(kid) : open === 'rx' ? renderRx(kid) : open === 'form' ? renderForm(kid) : renderDis()) + (open === 'dis' ? '' : K.privNote('kid'));
      if (open === 'sum') bindSum(kid); else if (open === 'rx') bindRx(kid); else if (open === 'form') { bindForm(kid); formPrefill = null; } else bindDis();
    }
    $$('#kid-care [data-care]').forEach(function (b) { b.addEventListener('click', function () { open = b.dataset.care; save('careOpen', open); render(); }); });
  }
  K.renderCare = render;
})();

/* 💉 어린이 독감 무료접종 기간 배너 (지역 탭 위)
 * 2026-2027절기: 2026.9.21 ~ 2027.4.30, 생후 6개월 ~ 14세 (2012.1.1 ~ 2026.8.31 출생)
 * 2회 접종 대상 9.21부터, 1회 접종 대상 9.28부터. 해마다 질병관리청 공지를 보고 FLU 만 고치면 된다.
 */
(function () {
  'use strict';
  var K = window.KC; if (!K) return;
  var FLU = { season: 2026, from: '2026-09-21', to: '2027-04-30', born: ['2012-01-01', '2026-08-31'], one: '2026-09-28', checked: '2026.10' };
  var box = document.getElementById('flu-banner'); if (!box) return;
  var n = K.kstNow ? K.kstNow().date : new Date().toISOString().slice(0, 10);
  if (n < FLU.from || n > FLU.to) return;
  if (K.load('fluBannerOff', '') === String(FLU.season)) return;
  var ks = (K.kids ? K.kids().list : []).filter(function (k) { return k.birth; });
  var done = function (k) { var d = K.load('kiddone:' + k.id, {}); return d['flu' + FLU.season] && (d['flu' + FLU.season + 'b'] || true); };
  var elig = ks.filter(function (k) { return k.birth >= FLU.born[0] && k.birth <= FLU.born[1]; });
  if (ks.length && (!elig.length || elig.every(done))) return;
  var who = elig.filter(function (k) { return !done(k); }).map(function (k) { return K.esc(k.name); }).join(', ');
  box.hidden = false;
  box.className = 'flu-banner';
  box.innerHTML = '<span class="fb-ic">💉</span><div class="fb-t"><b>어린이 독감 무료접종 기간이에요</b>' +
    (who ? who + ' · ' : '생후 6개월~14세 · ') + '~' + FLU.to.slice(0, 4) + '.' + (+FLU.to.slice(5, 7)) + '.' + (+FLU.to.slice(8)) + '까지 지정 병원·보건소에서 무료' +
    '<div class="fb-l"><a href="https://nip.kdca.go.kr" target="_blank" rel="noopener">지정 병원 찾기 ↗</a> · <a href="#" data-go-tab="benefit" data-go-pane="sched">맞았으면 체크</a></div></div>' +
    '<button class="fb-x" aria-label="이번 절기 그만 보기">✕</button>';
  box.querySelector('.fb-x').addEventListener('click', function () { K.save('fluBannerOff', String(FLU.season)); box.hidden = true; });
})();
