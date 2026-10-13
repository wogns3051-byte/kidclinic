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
    var lv = visits(kid)[0];
    if (lv && (Date.now() - new Date(lv.d + 'T00:00:00')) < 14 * 86400000) rows.push(['📒 최근 진료', lv.d.slice(5).replace('-', '/') + ' ' + (lv.hosp || '') + (lv.diag ? ' · ' + lv.diag : '')]);
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
        (x.drugs && x.drugs.length ? '<ul class="rx-drugs">' + x.drugs.map(function (d) { return '<li><b>' + esc(d.n) + '</b>' + (d.dose ? ' ' + esc(d.dose) : '') + (d.eff ? ' <span>' + esc(d.eff) + '</span>' : '') + '</li>'; }).join('') + '</ul>' : '') +
        (missed ? '<div class="rx-miss">⚠️ 빠뜨린 칸이 ' + missed + '개 있어요. 먹였다면 눌러서 체크하고, 못 먹였다면 다음 번에 두 번 먹이지 말고 약사·의사에게 물어보세요.</div>' : '') +
        '<div class="rx-scroll"><table class="rx-t"><thead><tr><th></th>' + x.slots.map(function (si) { return '<th>' + SLOTS[si] + '</th>'; }).join('') + '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '<button class="btn ghost rx-form-btn" data-rxform="' + x.id + '">📝 이 약으로 어린이집 투약의뢰서 만들기</button></div>';
    };
    return '<div class="care-intro">병원에서 받은 약을 적어 두고 먹일 때마다 칸을 눌러 체크하세요. 항생제는 다 나은 것 같아도 처방받은 날짜까지 먹이는 게 중요해요.</div>' +
      (act.length ? act.map(card).join('') : '<div class="kid-empty small">지금 먹는 처방약이 없어요</div>') +
      '<button class="btn soft rx-scan" data-scan>📷 약봉투 사진 찍어서 자동으로 넣기</button>' +
      '<details class="rx-add"' + (act.length ? '' : ' open') + '><summary>+ 직접 적어서 추가</summary><div class="g-form">' +
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


  // ───── ⑤ 진료 기록 수첩 ─────
  function visits(kid) { return load('kidvisit:' + kid.id, []); }
  function visSave(kid, l) { l.sort(function (a, b) { return a.d < b.d ? 1 : -1; }); save('kidvisit:' + kid.id, l.slice(0, 300)); }
  K.addVisit = function (kid, v) { var l = visits(kid); v.id = uid(); l.push(v); visSave(kid, l); };
  var visEdit = null, visQ = '';
  function hospNames() {
    var names = {};
    try { var db = K.db; (load('favs', []) || []).forEach(function (id) { var r = db && db.byId && db.byId[id]; if (r && r.n) names[r.n] = 1; }); } catch (e) {}
    try { var k = K.curKid(); if (k && k.hospital) names[k.hospital] = 1; visits(k).forEach(function (v) { if (v.hosp) names[v.hosp] = 1; }); } catch (e) {}
    return Object.keys(names).slice(0, 30);
  }
  // ───── 💰 실손보험 청구 체크 ─────
  var CLAIM_YEARS = 3; // 보험금 청구권 소멸시효: 진료일로부터 3년
  function won(n) { return Number(n || 0).toLocaleString('ko-KR') + '원'; }
  function claimable(v) { return (v.cost || v.pcost) && !v.claim; }
  function claimDeadline(v) { var d = new Date(v.d + 'T00:00:00'); d.setFullYear(d.getFullYear() + CLAIM_YEARS); return d; }
  function claimLine(v) {
    if (!v.cost && !v.pcost) return '';
    var sum = (+v.cost || 0) + (+v.pcost || 0);
    if (v.claim === 'done') return '<div class="vis-claim ok">💰 ' + won(sum) + ' · 실손 청구 완료</div>';
    if (v.claim === 'skip') return '<div class="vis-claim">💰 ' + won(sum) + ' · 청구 안 함</div>';
    var left = Math.ceil((claimDeadline(v) - today0()) / 86400000);
    return '<div class="vis-claim todo">💰 ' + won(sum) + ' · <b>실손 청구 전</b>' + (left < 90 ? ' · 청구 기한 ' + Math.max(0, left) + '일 남음' : '') +
      ' <a href="#" data-claim-done="' + v.id + '" data-v="done">청구했어요</a> · <a href="#" data-claim-done="' + v.id + '" data-v="skip">안 해요</a></div>';
  }
  function claimBox(l) {
    var todo = l.filter(claimable);
    if (!todo.length && !l.some(function (v) { return v.cost || v.pcost; })) return '';
    var sum = todo.reduce(function (s, v) { return s + (+v.cost || 0) + (+v.pcost || 0); }, 0);
    return '<details class="claim-box' + (todo.length ? ' todo' : '') + '"><summary>' + (todo.length ? '💰 실손 청구 안 한 진료 <b>' + todo.length + '건 · ' + won(sum) + '</b>' : '💰 실손 청구할 진료가 없어요') + '</summary>' +
      '<div class="claim-guide">' +
        '<div><b>📱 서류 없이 청구</b> 보험개발원 「실손24」 앱·누리집에서, 참여한 병원·약국 진료비는 서류를 떼지 않고 보험사로 보낼 수 있어요. 2025년 10월부터 동네 의원·약국까지 넓어졌어요.</div>' +
        '<div><b>🧾 서류로 청구</b> 보통 <b>진료비 영수증 + 진료비 세부내역서</b>, 약값은 <b>약제비 영수증 + 처방전</b>을 사진으로 보험사 앱에 올려요. 금액·보험사마다 필요한 서류가 달라서 가입한 보험사 앱에서 꼭 확인하세요.</div>' +
        '<div><b>⏳ 청구 기한</b> 진료일로부터 3년 안에 청구해야 해요. 지나면 받을 수 없어요.</div>' +
        '<div class="claim-links"><a class="btn ghost" href="https://play.google.com/store/search?q=%EC%8B%A4%EC%86%9024&c=apps" target="_blank" rel="noopener">실손24 앱 (플레이스토어)</a><a class="btn ghost" href="https://apps.apple.com/kr/app/id6553966660" target="_blank" rel="noopener">실손24 앱 (앱스토어)</a></div>' +
        '<div class="muted-s">이 기능은 청구했는지 기억하기 위한 메모예요. 보험금 지급 여부와 금액은 가입한 보험 약관에 따라 달라요.</div>' +
      '</div></details>';
  }
  K.claimTodo = function (kid) { return visits(kid).filter(claimable); };
  function renderVisit(kid) {
    var l = visits(kid), t0 = ymd(today0());
    var e = visEdit && visEdit !== 'new' ? l.filter(function (v) { return v.id === visEdit; })[0] || {} : {};
    var q = visQ.trim();
    var shown = q ? l.filter(function (v) { return [v.hosp, v.diag, v.rx, v.memo].join(' ').indexOf(q) >= 0; }) : l;
    var form = '<div class="g-form vis-form"><div class="g-fh">' + (visEdit && visEdit !== 'new' ? '진료 기록 고치기' : '새 진료 기록') + '</div>' +
      '<div class="g-two"><label>진료 날짜<input type="date" id="v-d" max="' + t0 + '" value="' + esc(e.d || t0) + '"></label><label>다음 진료(재진)<input type="date" id="v-next" value="' + esc(e.next || '') + '"></label></div>' +
      '<label>병원<input id="v-h" list="v-hl" maxlength="40" value="' + esc(e.hosp || '') + '" placeholder="예: ○○소아청소년과"><datalist id="v-hl">' + hospNames().map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist></label>' +
      '<label>진단·들은 말<input id="v-diag" maxlength="60" value="' + esc(e.diag || '') + '" placeholder="예: 중이염(오른쪽), 목감기"></label>' +
      '<label>처방약<textarea id="v-rx" rows="2" maxlength="300" placeholder="예: 항생제 시럽 5mL 하루 3번 5일">' + esc(e.rx || '') + '</textarea></label>' +
      '<label>메모<input id="v-memo" maxlength="80" value="' + esc(e.memo || '') + '" placeholder="예: 열 3일 넘으면 다시 오라고 함"></label>' +
      '<div class="g-two"><label>병원 진료비(원)<input type="number" id="v-cost" min="0" inputmode="numeric" value="' + esc(e.cost || '') + '" placeholder="예: 4500"></label><label>약값(원)<input type="number" id="v-pcost" min="0" inputmode="numeric" value="' + esc(e.pcost || '') + '" placeholder="예: 3200"></label></div>' +
      '<div class="f-types"><span>실손보험 청구</span>' + [['', '아직 안 함'], ['done', '청구했어요'], ['skip', '청구 안 해요']].map(function (c) { return '<button class="chip' + ((e.claim || '') === c[0] ? ' on' : '') + '" data-vclaim="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div>' +
      '<div class="actions"><button class="btn" id="v-save">' + (visEdit && visEdit !== 'new' ? '고치기' : '저장') + '</button>' + (visEdit ? '<button class="btn ghost" id="v-cancel">취소</button>' : '') + '</div></div>';
    var next = l.filter(function (v) { return v.next && v.next >= t0; }).sort(function (a, b) { return a.next < b.next ? -1 : 1; })[0];
    return '<div class="care-intro">언제, 어느 병원에서, 무슨 진단과 약을 받았는지 쌓아 두세요. "지난번에 무슨 항생제 먹었지?"가 바로 찾아져요. 📷 약봉투 사진으로 넣으면 처방약도 자동으로 적혀요.</div>' +
      '<div class="vis-top"><button class="btn" id="v-new">+ 진료 기록 쓰기</button><button class="btn soft" data-scan>📷 약봉투 사진으로</button></div>' +
      claimBox(l) +
      (next ? '<div class="vis-next">📅 다음 진료 <b>' + next.next.slice(5).replace('-', '/') + '</b> · ' + esc(next.hosp || '') + ' <a href="#" data-vis-cal="' + next.id + '">캘린더에 넣기</a></div>' : '') +
      (visEdit ? form : '') +
      (l.length > 3 ? '<input class="vis-q" id="v-q" placeholder="🔍 찾기 (병원·진단·약 이름)" value="' + esc(visQ) + '">' : '') +
      (shown.length ? '<ul class="vis-list">' + shown.map(function (v) {
        return '<li><div class="vis-d">' + v.d.slice(2).replace(/-/g, '.') + '</div><div class="vis-b"><b>' + esc(v.hosp || '병원') + '</b>' + (v.diag ? '<div class="vis-diag">' + esc(v.diag) + '</div>' : '') +
          (v.rx ? '<div class="vis-rx">💊 ' + esc(v.rx).replace(/\n/g, '<br>') + '</div>' : '') + (v.memo ? '<div class="vis-memo">' + esc(v.memo) + '</div>' : '') +
          (v.next ? '<div class="vis-memo">다음 진료 ' + v.next.slice(5).replace('-', '/') + '</div>' : '') +
          claimLine(v) +
          '<div class="vis-act"><a href="#" data-vis-edit="' + v.id + '">고치기</a> · <a href="#" data-vis-del="' + v.id + '">지우기</a></div></div></li>';
      }).join('') + '</ul>' : (l.length ? '<div class="kid-empty small">찾는 기록이 없어요</div>' : '<div class="kid-empty small">아직 진료 기록이 없어요</div>')) +
      (l.length ? '<div class="actions pad"><button class="btn ghost" id="v-share">📤 진료 기록 보내기</button></div>' : '');
  }
  function bindVisit(kid) {
    $$('#kid-care [data-vclaim]').forEach(function (b) { b.addEventListener('click', function () { $$('#kid-care [data-vclaim]').forEach(function (x) { x.classList.toggle('on', x === b); }); }); });
    $$('#kid-care [data-claim-done]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); var l = visits(kid).map(function (x) { if (x.id === b.dataset.claimDone) x.claim = b.dataset.v; return x; }); visSave(kid, l); toast(b.dataset.v === 'done' ? '청구 완료로 표시했어요' : '청구 안 함으로 표시했어요'); render(); });
    });
    var nb = $('#v-new'); if (nb) nb.addEventListener('click', function () { visEdit = 'new'; render(); var f = $('#v-h'); if (f) f.focus(); });
    var cb = $('#v-cancel'); if (cb) cb.addEventListener('click', function () { visEdit = null; render(); });
    var sb = $('#v-save');
    if (sb) sb.addEventListener('click', function () {
      var cl = $('#kid-care [data-vclaim].on');
      var v = { d: $('#v-d').value || ymd(today0()), next: $('#v-next').value || '', hosp: $('#v-h').value.trim(), diag: $('#v-diag').value.trim(), rx: $('#v-rx').value.trim(), memo: $('#v-memo').value.trim(),
        cost: Math.max(0, parseInt($('#v-cost').value, 10) || 0) || '', pcost: Math.max(0, parseInt($('#v-pcost').value, 10) || 0) || '', claim: cl ? cl.dataset.vclaim : '' };
      if (!v.hosp && !v.diag && !v.rx) { toast('병원·진단·처방약 중 하나는 적어 주세요'); return; }
      var l = visits(kid);
      if (visEdit && visEdit !== 'new') { l = l.map(function (x) { return x.id === visEdit ? Object.assign(x, v) : x; }); }
      else { v.id = uid(); l.push(v); }
      visSave(kid, l); visEdit = null; toast('저장했어요'); render();
    });
    $$('#kid-care [data-vis-edit]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); visEdit = a.dataset.visEdit; render(); }); });
    $$('#kid-care [data-vis-del]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); if (!confirm('이 진료 기록을 지울까요?')) return; visSave(kid, visits(kid).filter(function (x) { return x.id !== a.dataset.visDel; })); render(); }); });
    var q = $('#v-q'); if (q) q.addEventListener('input', function () { visQ = q.value; var pos = q.selectionStart; render(); var q2 = $('#v-q'); if (q2) { q2.focus(); q2.setSelectionRange(pos, pos); } });
    var calA = $('#kid-care [data-vis-cal]');
    if (calA) calA.addEventListener('click', function (e) {
      e.preventDefault(); var v = visits(kid).filter(function (x) { return x.id === calA.dataset.visCal; })[0]; if (!v) return;
      var d = v.next.replace(/-/g, ''), d2 = ymd(addDays(new Date(v.next + 'T00:00:00'), 1)).replace(/-/g, '');
      window.open('https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent('다음 진료 · ' + (v.hosp || '')) + '&dates=' + d + '/' + d2 + '&details=' + encodeURIComponent((v.diag ? v.diag + '\n' : '') + '- 아이아플때'), '_blank', 'noopener');
    });
    var sh = $('#v-share');
    if (sh) sh.addEventListener('click', function () {
      if (!K.confirmShare('진료 기록')) return;
      K.shareText(kid.name + ' 진료 기록', '[' + kid.name + ' 진료 기록]\n' + visits(kid).slice(0, 10).map(function (v) {
        return v.d.replace(/-/g, '.') + ' ' + (v.hosp || '') + (v.diag ? '\n  진단: ' + v.diag : '') + (v.rx ? '\n  약: ' + v.rx.replace(/\n/g, ', ') : '') + (v.cost || v.pcost ? '\n  진료비 ' + won((+v.cost || 0) + (+v.pcost || 0)) : '');
      }).join('\n') + '\n\n- 아이아플때 앱');
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
  var SECTIONS = [['sum', '🩺 진료실 요약'], ['rx', '💊 처방약'], ['visit', '📒 진료 기록'], ['form', '📝 투약의뢰서'], ['dis', '🏠 등원 언제부터?']];
  function setOpen(k) { open = k; save('careOpen', k); render(); window.scrollTo({ top: $('#kid-care').offsetTop - 70, behavior: 'smooth' }); }
  function render() {
    var box = $('#kid-care'); if (!box) return;
    var kid = K.curKid();
    var tabs = '<div class="care-tabs">' + SECTIONS.map(function (s) { return '<button class="' + (s[0] === open ? 'on' : '') + '" data-care="' + s[0] + '">' + s[1] + '</button>'; }).join('') + '</div>';
    if (!kid && open !== 'dis') {
      box.innerHTML = tabs + '<div class="kid-empty"><b>아이를 먼저 추가해 주세요</b>진료실 요약·처방약 체크·투약의뢰서는 아이 기록으로 만들어져요. "등원 언제부터?"는 바로 볼 수 있어요.' +
        '<button class="btn" data-kid-add="care">+ 아이 추가</button></div>' + K.privNote('kid');
    } else {
      box.innerHTML = tabs + (open === 'sum' ? renderSum(kid) : open === 'rx' ? renderRx(kid) : open === 'visit' ? renderVisit(kid) : open === 'form' ? renderForm(kid) : renderDis()) + (open === 'dis' ? '' : K.privNote('kid'));
      if (open === 'sum') bindSum(kid); else if (open === 'rx') bindRx(kid); else if (open === 'visit') bindVisit(kid); else if (open === 'form') { bindForm(kid); formPrefill = null; } else bindDis();
    }
    $$('#kid-care [data-care]').forEach(function (b) { b.addEventListener('click', function () { open = b.dataset.care; save('careOpen', open); render(); }); });
    if (K.renderToday) K.renderToday();
  }
  K.renderCare = function () { render(); if (K.renderToday) K.renderToday(); };
  K.visits = visits; K.rxList = rxList; K.rxActive = rxActive; K.rxSave = rxSave; K.SLOTS = SLOTS;
  K.careOpen = function (k) { open = k; save('careOpen', k); };
  K.rxAdd = function (kid, x) { var l = rxList(kid); x.id = uid(); x.c = {}; l.push(x); rxSave(kid, l); };
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

/* ☀️/🌙 낮에는 해·구름, 밤에는 잠자는 달 (한국 기준 대략적인 해 뜨고 지는 시각, 월별) */
(function () {
  var RISE = [740, 720, 650, 610, 530, 510, 520, 540, 610, 630, 700, 730];
  var SET = [1740, 1810, 1840, 1910, 1930, 1950, 1950, 1930, 1850, 1810, 1730, 1720];
  function apply() {
    var d = new Date(Date.now() + 9 * 3600000), m = d.getUTCMonth(), t = d.getUTCHours() * 100 + d.getUTCMinutes();
    var day = t >= RISE[m] && t < SET[m];
    document.documentElement.classList.toggle('daytime', day);
    Array.prototype.forEach.call(document.querySelectorAll('meta[name="theme-color"]'), function (mt) {
      var dark = /dark/.test(mt.getAttribute('media') || '');
      mt.setAttribute('content', day ? (dark ? '#2C5F8E' : '#4AA6E8') : (dark ? '#1A1F45' : '#2E3878'));
    });
  }
  apply(); setInterval(apply, 5 * 60000);
})();

/* 🦠 요즘 유행해요 (질병관리청 자료, docs/data/epi.json — PC 자료 갱신 때 함께 받음) */
(function () {
  'use strict';
  var K = window.KC; if (!K || !K.fetchJson) return;
  var box = document.getElementById('epi-card'); if (!box) return;
  var esc = K.esc;
  K.fetchJson(K.DATA_BASE + '/epi.json?t=' + Math.floor(Date.now() / 3600000)).catch(function () { return K.fetchJson('./data/epi.json'); }).then(function (d) {
    if (!d || !d.at || Date.now() - Date.parse(d.at) > 21 * 86400000) return;
    var lines = [], all = [];
    var arrow = function (v, p) { return p == null ? '' : v > p * 1.1 ? ' <b class="up">▲</b>' : v < p * 0.9 ? ' <b class="down">▼</b>' : ' <b class="flat">–</b>'; };
    var f = d.flu, kidAge = f && f.ages && (f.ages['1-6세'] || f.ages['7-12세']);
    if (kidAge) {
      var a16 = f.ages['1-6세'], a712 = f.ages['7-12세'];
      var over = f.threshold && ((a16 && a16.v >= f.threshold) || (a712 && a712.v >= f.threshold));
      lines.push('<div class="epi-r' + (over ? ' hot' : '') + '"><span>🤧 독감</span><div>' +
        (a16 ? '1~6세 <b>' + a16.v + '명</b>' + arrow(a16.v, a16.prev) : '') + (a16 && a712 ? ' · ' : '') + (a712 ? '7~12세 <b>' + a712.v + '명</b>' + arrow(a712.v, a712.prev) : '') +
        '<small>외래 환자 1,000명 중 독감 의심 환자 · ' + esc(f.week) + (f.threshold ? ' · 유행 기준 ' + f.threshold + '명(전체 연령)' : '') + '</small></div></div>');
    }
    if (d.nat && d.nat.items) {
      d.nat.items.forEach(function (x) {
        var r = '<div class="epi-r' + (x.trend === 'up' ? ' hot' : '') + '"><span>' + (x.n === '수두' ? '🔴 ' : '🦠 ') + esc(x.n) + '</span><div><b>' + x.v.toLocaleString() + '명</b>' + arrow(x.v, x.prev) +
          '<small>전국 한 주 신고 · ' + esc(d.nat.week) + ' · 앞선 4주 평균 ' + x.prev + '명</small></div></div>';
        all.push(r); if (x.trend === 'up' || (x.v >= 50 && lines.length < 3)) lines.push(r);
      });
    }
    if (!lines.length && !all.length) return;
    box.hidden = false; box.className = 'epi-card';
    box.innerHTML = '<div class="epi-h"><b>🦠 요즘 유행해요</b><span>질병관리청 · 늦게 들어오는 신고 때문에 2주 전 기준</span></div>' +
      (lines.length ? lines.join('') : '<div class="epi-calm">크게 늘어난 아이 감염병은 없어요</div>') +
      (all.length ? '<details class="epi-more"><summary>다른 감염병 보기</summary>' + all.join('') + '</details>' : '') +
      '<div class="epi-act"><button class="chip" data-epi-dis>🏠 걸리면 등원은 언제부터?</button><button class="chip" data-triage>🤒 아이가 아파요</button></div>' +
      '<div class="epi-src">출처: ' + esc(d.src || '질병관리청') + ' (잠정 통계, ' + esc(d.at.slice(0, 10).replace(/-/g, '.')) + ' 받음). 수족구병은 아직 공개 자료로 받을 수 없어요.</div>';
    var b = box.querySelector('[data-epi-dis]');
    if (b) b.addEventListener('click', function () { if (K.careOpen) K.careOpen('dis'); if (K.show) K.show('benefit'); if (K.showPane) K.showPane('care'); });
    var t = box.querySelector('[data-triage]'); if (t) t.addEventListener('click', function () { if (K.openTriage) K.openTriage(); });
  }).catch(function () {});
})();

/* 🌤 오늘의 우리아이 (지역 탭 맨 위) — 처방약 남은 칸, 해열제 간격, 다음 진료, 지금 할 접종, 실손 청구 */
(function () {
  'use strict';
  var K = window.KC; if (!K || !K.kids) return;
  var box = document.getElementById('today-card'); if (!box) return;
  var esc = K.esc, load = K.load, save = K.save;
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function hm(t) { var d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function dayWord(ymdStr) {
    var t = new Date(); t.setHours(0, 0, 0, 0);
    var d = new Date(ymdStr + 'T00:00:00'), diff = Math.round((d - t) / 86400000);
    return diff === 0 ? '오늘' : diff === 1 ? '내일' : diff === 2 ? '모레' : (d.getMonth() + 1) + '/' + d.getDate() + '(' + '일월화수목금토'[d.getDay()] + ')';
  }
  var GAP = { acet: 4, ibu: 6 }, DN = { acet: '아세트아미노펜', ibu: '이부프로펜 계열' };
  function linesFor(kid) {
    var out = [], now = Date.now(), today = ymd(new Date());
    // 처방약: 오늘 남은 칸 (눌러서 바로 체크)
    (K.rxList ? K.rxList(kid) : []).filter(function (x) { return K.rxActive(x) && x.start <= today; }).forEach(function (x) {
      var left = x.slots.filter(function (si) { return !(x.c && x.c[today + '|' + si]); });
      out.push({ go: 'rx', h: '<span class="td-ic">💊</span><div><b>' + esc(x.name) + '</b> ' + (left.length
        ? left.map(function (si) { return '<button class="td-slot" data-td-rx="' + x.id + '" data-td-kid="' + kid.id + '" data-k="' + today + '|' + si + '">' + K.SLOTS[si] + '</button>'; }).join('') + '<small>먹였으면 눌러서 체크</small>'
        : '<span class="td-ok">오늘 다 먹었어요 ✓</span>') + '</div>' });
    });
    // 해열제 간격 · 최근 체온
    var l = K.kidLogs ? K.kidLogs(kid.id) : [];
    ['acet', 'ibu'].forEach(function (k) {
      var last = l.filter(function (x) { return x.type === k; }).sort(function (a, b) { return b.t - a.t; })[0];
      if (last && now - last.t < 24 * 3600000) {
        var next = last.t + GAP[k] * 3600000;
        if (next > now) out.push({ go: 'med', h: '<span class="td-ic">⏱</span><div>' + DN[k] + ' 다음은 <b>' + hm(next) + '</b> 이후<small>마지막 ' + hm(last.t) + '</small></div>' });
      }
    });
    var lt = l.filter(function (x) { return x.type === 'temp'; }).sort(function (a, b) { return b.t - a.t; })[0];
    if (lt && now - lt.t < 12 * 3600000 && lt.v >= 37.5) out.push({ go: 'med', h: '<span class="td-ic">🌡</span><div>마지막 체온 <b class="' + (lt.v >= 38 ? 'hot' : '') + '">' + lt.v.toFixed(1) + '℃</b><small>' + Math.max(1, Math.round((now - lt.t) / 3600000)) + '시간 전 · 다시 재면 기록해 주세요</small></div>' });
    // 다음 진료 (7일 안)
    var vs = K.visits ? K.visits(kid) : [];
    var nv = vs.filter(function (v) { return v.next && v.next >= today; }).sort(function (a, b) { return a.next < b.next ? -1 : 1; })[0];
    if (nv && (new Date(nv.next + 'T00:00:00') - new Date(today + 'T00:00:00')) <= 7 * 86400000) out.push({ go: 'visit', h: '<span class="td-ic">📅</span><div>다음 진료 <b>' + dayWord(nv.next) + '</b><small>' + esc(nv.hosp || '') + (nv.diag ? ' · ' + esc(nv.diag) : '') + '</small></div>' });
    // 지금 할 접종·검진
    (K.schedNow ? K.schedNow(kid) : []).slice(0, 2).forEach(function (x) {
      out.push({ go: 'sched', h: '<span class="td-ic">' + x.icon + '</span><div><b>' + esc(x.n) + '</b> 지금 할 때<small>' + (x.e.getMonth() + 1) + '/' + x.e.getDate() + '까지</small></div>' });
    });
    // 실손 청구 안 한 진료
    var cl = K.claimTodo ? K.claimTodo(kid) : [];
    if (cl.length) {
      var sum = cl.reduce(function (s, v) { return s + (+v.cost || 0) + (+v.pcost || 0); }, 0);
      out.push({ go: 'visit', h: '<span class="td-ic">💰</span><div>실손 청구 안 한 진료 <b>' + cl.length + '건</b><small>' + sum.toLocaleString('ko-KR') + '원 · 진료일로부터 3년 안에 청구</small></div>' });
    }
    return out;
  }
  function render() {
    var ks = K.kids().list || [];
    if (!ks.length) { box.hidden = true; return; }
    var h = new Date().getHours();
    var hi = h < 5 ? '늦은 밤이에요, 고생 많아요 🌙' : h < 11 ? '좋은 아침이에요 ☀️' : h < 17 ? '오늘도 힘내요 🌤' : h < 21 ? '저녁이에요, 오늘 하루도 수고했어요' : '편안한 밤 되세요 🌙';
    var blocks = ks.slice(0, 3).map(function (kid) {
      var ls = linesFor(kid);
      return '<div class="td-kid">' + (ks.length > 1 ? '<div class="td-name">' + esc(kid.name || '아이') + '</div>' : '') +
        (ls.length ? (function () {
          var row = function (x) { return '<div class="td-row" data-td-go="' + x.go + '" data-td-kid="' + kid.id + '">' + x.h + '</div>'; };
          var max = ks.length > 1 ? 2 : 3;
          return ls.slice(0, max).map(row).join('') + (ls.length > max ? '<details class="td-more"><summary>' + (ls.length - max) + '개 더 보기</summary>' + ls.slice(max).map(row).join('') + '</details>' : '');
        })() : '<div class="td-calm">오늘은 챙길 게 없어요 😊</div>') + '</div>';
    }).join('');
    box.hidden = false; box.className = 'today-card';
    box.innerHTML = '<div class="td-h"><b>🌤 오늘의 ' + (ks.length > 1 ? '우리아이' : esc(ks[0].name || '우리아이')) + '</b><span>' + hi + '</span></div>' + blocks +
      '<div class="td-priv">🔒 이 휴대폰에만 저장된 기록으로 만들어요</div>';
  }
  box.addEventListener('click', function (e) {
    var sl = e.target.closest('[data-td-rx]');
    if (sl) {
      e.stopPropagation();
      var kid = (K.kids().list || []).filter(function (k) { return k.id === sl.dataset.tdKid; })[0]; if (!kid) return;
      var l = K.rxList(kid), x = l.filter(function (y) { return y.id === sl.dataset.tdRx; })[0]; if (!x) return;
      x.c = x.c || {}; x.c[sl.dataset.k] = Date.now(); K.rxSave(kid, l);
      K.toast(K.SLOTS[+sl.dataset.k.split('|')[1]] + ' 약 체크했어요 ✓'); render(); return;
    }
    var row = e.target.closest('[data-td-go]'); if (!row) return;
    var k = K.kids(); if (row.dataset.tdKid && k.cur !== row.dataset.tdKid) { k.cur = row.dataset.tdKid; K.saveKids(k); }
    var go = row.dataset.tdGo;
    if (go === 'rx' || go === 'visit') { K.careOpen(go); K.show('benefit'); K.showPane('care'); }
    else { K.show('benefit'); K.showPane(go); }
  });
  K.renderToday = render;
  render();
  document.addEventListener('visibilitychange', function () { if (!document.hidden) render(); });
  setInterval(render, 5 * 60000);
})();
