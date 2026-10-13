/* 아이아플때 — 우리아이(해열제 기록·응급 카드) + 작은 기능(지금 열린 곳·연휴 안내·큰 글씨·공유)
 * 모든 기록은 이 휴대폰(브라우저) 안에만 저장되고 어디에도 보내지 않는다.
 * app.js 가 window.KC 로 넘겨준 도구(api, show, toast 등)를 쓴다.
 */
(function () {
  'use strict';
  var K = window.KC;
  if (!K) return;
  var $ = K.$, $$ = K.$$, esc = K.esc, load = K.load, save = K.save, toast = K.toast;

  // ───── 공통 ─────
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hm(t) { var d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function md(t) { var d = new Date(t); return (d.getMonth() + 1) + '/' + d.getDate(); }
  function dayLabel(t) {
    var d = new Date(t), n = new Date();
    var a = new Date(d.getFullYear(), d.getMonth(), d.getDate()), b = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    var diff = Math.round((b - a) / 86400000);
    return diff === 0 ? '오늘' : diff === 1 ? '어제' : md(t);
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function shareText(title, text) {
    if (navigator.share) return navigator.share({ title: title, text: text }).catch(function () {});
    var done = function () { toast('복사했어요. 카톡에 붙여넣기 하세요'); };
    if (navigator.clipboard) return navigator.clipboard.writeText(text).then(done, function () { prompt('아래 내용을 복사하세요', text); });
    prompt('아래 내용을 복사하세요', text);
  }
  K.shareText = shareText;
  // 개인정보 안내 (아이 정보·기록·위치가 나오는 곳마다 붙인다)
  var PRIV = {
    kid: '🔒 아이 정보와 기록은 <b>이 휴대폰에만</b> 저장되고 어디에도 보내지 않아요. 휴대폰을 바꾸거나 브라우저 기록을 지우면 사라져요. <a href="privacy.html">개인정보 처리방침</a>',
    loc: '🔒 위치는 가까운 곳을 찾는 데만 휴대폰 안에서 쓰고 저장하지 않아요. <a href="privacy.html">자세히</a>'
  };
  K.PRIV = PRIV;
  function privNote(k) { return '<div class="priv">' + PRIV[k] + '</div>'; }
  function confirmShare(what) {
    return confirm(what + '에는 아이 이름·생년월일 같은 개인정보가 들어 있어요.\n받는 사람을 꼭 확인하고 보내 주세요.\n\n계속할까요?');
  }

  // ───── 아이 목록 ─────
  function kids() { return load('kids', { list: [], cur: '' }); }
  function saveKids(k) { save('kids', k); }
  function curKid() { var k = kids(); return k.list.filter(function (x) { return x.id === k.cur; })[0] || k.list[0] || null; }
  K.curKid = curKid;
  function ageText(birth) {
    if (!birth) return '';
    var b = new Date(birth + 'T00:00:00'), n = new Date();
    var m = (n.getFullYear() - b.getFullYear()) * 12 + (n.getMonth() - b.getMonth()) - (n.getDate() < b.getDate() ? 1 : 0);
    if (m < 0) return '';
    if (m < 1) return '생후 ' + Math.max(0, Math.floor((n - b) / 86400000)) + '일';
    if (m < 24) return m + '개월';
    return '만 ' + Math.floor(m / 12) + '세 (' + m + '개월)';
  }
  function ageMonths(birth) {
    if (!birth) return null;
    var b = new Date(birth + 'T00:00:00'), n = new Date();
    return (n.getFullYear() - b.getFullYear()) * 12 + (n.getMonth() - b.getMonth()) - (n.getDate() < b.getDate() ? 1 : 0);
  }
  function kidPicker(kid, where) {
    var k = kids();
    return '<div class="kid-pick">' + k.list.map(function (x) {
      return '<button class="chip' + (kid && x.id === kid.id ? ' on' : '') + '" data-kid="' + x.id + '" data-where="' + where + '">' + esc(x.name || '아이') + '</button>';
    }).join('') + '<button class="chip add" data-kid-add="' + where + '">+ 아이 추가</button></div>';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-kid]');
    if (b) { var k = kids(); k.cur = b.dataset.kid; saveKids(k); render(b.dataset.where); return; }
    var a = e.target.closest && e.target.closest('[data-kid-add]');
    if (a) {
      var name = (prompt('아이 이름(또는 별명)을 적어 주세요\n(이 휴대폰에만 저장돼요. 별명도 괜찮아요)') || '').trim();
      if (!name) return;
      var k2 = kids(), id = uid();
      k2.list.push({ id: id, name: name.slice(0, 12) }); k2.cur = id; saveKids(k2);
      render(a.dataset.kidAdd);
      if (a.dataset.kidAdd === 'med') toast('생일을 응급 카드에 넣어 두면 나이에 맞는 안내가 나와요');
    }
  });
  function render(where) { if (where === 'card') renderCard(); else if (where === 'sched') renderSched(); else renderMed(); }

  // ───── 해열제 기록 ─────
  // 최소 간격·하루 최대 횟수는 국내 어린이용 해열제 설명서의 일반적인 기준. 제품마다 다를 수 있어 설명서가 우선.
  var DRUGS = {
    acet: { name: '아세트아미노펜 계열', ex: '타이레놀·챔프 등', gapH: 4, maxDay: 5 },
    ibu: { name: '이부프로펜·덱시부프로펜 계열', ex: '부루펜·맥시부펜 등', gapH: 6, maxDay: 4 }
  };
  var SYMS = ['구토', '설사', '기침', '콧물', '발진', '처짐', '잘 못 먹음', '잘 먹음', '소변 줄어듦', '경련'];
  var HOMECARE = '<details class="homecare"><summary>🏠 열날 때 집에서 할 일</summary><ul>' +
    '<li>옷은 얇고 편하게 입혀요. 추워서 떨면 억지로 벗기지 말고 얇은 이불을 살짝 덮어 주세요.</li>' +
    '<li>물이나 모유·분유를 조금씩 자주 먹여요. 소변 횟수를 함께 살펴 주세요.</li>' +
    '<li>해열제는 열이 있으면서 아이가 힘들어할 때, 설명서의 용량과 간격대로 먹여요.</li>' +
    '<li>찬물이나 알코올로 몸을 닦지 마세요.</li>' +
    '<li>체온·해열제·소변을 기록해 두면 진료 때 도움이 돼요.</li>' +
    '<li>열이 3일 넘게 가거나, 처지고 잘 못 먹거나, 소변이 줄거나, 경련이 있으면 <a href="#" data-open-triage>"어디로 가야 해요?"</a>를 다시 확인하세요.</li>' +
    '</ul><div class="hc-src">여러 병원의 공개 건강정보에서 공통으로 안내하는 내용이에요. 자세한 내용은 <a href="https://health.kdca.go.kr" target="_blank" rel="noopener">국가건강정보포털(질병관리청)</a>을 참고하세요.</div></details>';
  K.HOMECARE = HOMECARE;
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-open-triage]');
    if (a) { e.preventDefault(); if (K.openTriage) K.openTriage(); }
  });
  function tempChart(l) {
    var since = Date.now() - 48 * 3600000;
    var temps = l.filter(function (x) { return x.type === 'temp' && x.t >= since; }).sort(function (a, b) { return a.t - b.t; });
    if (temps.length < 2) return '';
    var meds = l.filter(function (x) { return (x.type === 'acet' || x.type === 'ibu') && x.t >= temps[0].t; });
    var W = 340, H = 150, L = 30, R = 8, T = 10, B = 26;
    var t0 = temps[0].t, t1 = Math.max(Date.now(), temps[temps.length - 1].t);
    var lo = Math.min(36, Math.floor(Math.min.apply(null, temps.map(function (x) { return x.v; })))), hi = Math.max(40, Math.ceil(Math.max.apply(null, temps.map(function (x) { return x.v; }))));
    var X = function (t) { return L + (W - L - R) * (t - t0) / Math.max(1, t1 - t0); };
    var Y = function (v) { return T + (H - T - B) * (hi - v) / (hi - lo); };
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="tchart" role="img" aria-label="최근 48시간 체온 그래프">';
    svg += '<rect x="' + L + '" y="' + Y(hi) + '" width="' + (W - L - R) + '" height="' + (Y(38) - Y(hi)) + '" class="tc-hot"/>';
    for (var v = lo; v <= hi; v++) svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" class="tc-grid"/><text x="' + (L - 4) + '" y="' + (Y(v) + 4) + '" class="tc-ax" text-anchor="end">' + v + '</text>';
    meds.forEach(function (m) {
      var x = X(m.t);
      svg += '<line x1="' + x + '" x2="' + x + '" y1="' + T + '" y2="' + (H - B) + '" class="tc-med ' + m.type + '"/><text x="' + x + '" y="' + (H - B + 12) + '" class="tc-ml ' + m.type + '" text-anchor="middle">💊</text>';
    });
    svg += '<polyline class="tc-line" points="' + temps.map(function (x) { return X(x.t).toFixed(1) + ',' + Y(x.v).toFixed(1); }).join(' ') + '"/>';
    temps.forEach(function (x) { svg += '<circle cx="' + X(x.t).toFixed(1) + '" cy="' + Y(x.v).toFixed(1) + '" r="3.5" class="tc-dot' + (x.v >= 38 ? ' hot' : '') + '"/>'; });
    svg += '<text x="' + L + '" y="' + (H - 4) + '" class="tc-ax">' + dayLabel(t0) + ' ' + hm(t0) + '</text><text x="' + (W - R) + '" y="' + (H - 4) + '" class="tc-ax" text-anchor="end">지금</text></svg>';
    return '<div class="tc-box"><div class="tc-h">최근 48시간 체온 <span>💊 = 해열제 먹인 때 · 빨간 영역 = 38℃ 이상</span></div>' + svg + '</div>';
  }
  function logs(id) { return load('kidlog:' + id, []); }
  function saveLogs(id, l) { save('kidlog:' + id, l.slice(-300)); }
  function pickedTime() {
    var v = ($('#med-time') || {}).value;
    if (!v) return Date.now();
    var p = v.split(':'), d = new Date(); d.setHours(+p[0], +p[1], 0, 0);
    if (d.getTime() > Date.now() + 60000) d.setDate(d.getDate() - 1); // 미래 시각이면 어제로
    return d.getTime();
  }
  function drugStatus(l, key) {
    var D = DRUGS[key], now = Date.now();
    var given = l.filter(function (x) { return x.type === key; }).sort(function (a, b) { return b.t - a.t; });
    var last = given[0];
    var day = given.filter(function (x) { return now - x.t < 86400000; }).length;
    var next = last ? last.t + D.gapH * 3600000 : 0;
    var html = '<div class="med-st"><div class="med-st-h">' + D.name + '</div>';
    if (!last) html += '<div class="med-st-b">기록 없음</div>';
    else {
      html += '<div class="med-st-b">마지막 ' + dayLabel(last.t) + ' ' + hm(last.t) + ' · 24시간 안에 ' + day + '회 (설명서 기준 하루 최대 ' + D.maxDay + '회)</div>';
      if (day >= D.maxDay) html += '<div class="med-next warn">24시간 최대 횟수에 닿았어요. 더 먹이기 전에 의사·약사와 상의하세요</div>';
      else if (next > now) {
        var mins = Math.ceil((next - now) / 60000);
        html += '<div class="med-next">같은 약은 <b>' + hm(next) + '</b> 이후 (' + (mins >= 60 ? Math.floor(mins / 60) + '시간 ' : '') + (mins % 60) + '분 뒤)</div>';
      } else html += '<div class="med-next ok">같은 약을 다시 먹일 수 있는 간격(' + D.gapH + '시간)이 지났어요</div>';
    }
    return html + '</div>';
  }
  function fluidStatus(l) {
    var now = Date.now(), day = l.filter(function (x) { return now - x.t < 86400000; });
    var pee = day.filter(function (x) { return x.type === 'pee'; }), drink = day.filter(function (x) { return x.type === 'drink'; });
    if (!pee.length && !drink.length) return '';
    var lastPee = l.filter(function (x) { return x.type === 'pee'; }).sort(function (a, b) { return b.t - a.t; })[0];
    var hrs = lastPee ? Math.floor((now - lastPee.t) / 3600000) : null;
    var warn = hrs != null && hrs >= 8;
    return '<div class="fl' + (warn ? ' warn' : '') + '"><div>최근 24시간 · 💧 소변 ' + pee.length + '회 · 🥤 물·수유 ' + drink.length + '회</div>' +
      (lastPee ? '<div>마지막 소변 ' + dayLabel(lastPee.t) + ' ' + hm(lastPee.t) + (warn ? ' (<b>' + hrs + '시간 전</b>)' : '') + '</div>' : '') +
      (warn ? '<div>소변이 오랫동안 없으면 탈수 신호일 수 있어요. <a href="#" data-open-triage>"어디로 가야 해요?"</a>를 확인하세요.</div>' : '') + '</div>';
  }
  function feverAlerts(kid, l) {
    var out = [], m = ageMonths(kid.birth);
    var temps = l.filter(function (x) { return x.type === 'temp'; }).sort(function (a, b) { return b.t - a.t; });
    var latest = temps[0];
    if (latest && latest.v >= 38 && m != null && m < 3)
      out.push('<div class="alert"><b>생후 3개월 미만 아기가 38℃ 이상이에요.</b> 바로 진료가 필요해요. 밤이라면 응급실로 가세요. <a href="tel:119">119</a></div>');
    var firstHigh = null;
    temps.slice().reverse().forEach(function (x) { if (x.v >= 38 && !firstHigh) firstHigh = x; if (x.v < 37.5) firstHigh = null; });
    if (latest && latest.v >= 38 && firstHigh && Date.now() - firstHigh.t > 72 * 3600000)
      out.push('<div class="alert soft">열이 3일 넘게 이어지고 있어요. 소아과 진료를 받아 보세요.</div>');
    return out.join('');
  }
  function renderMed() {
    var box = $('#kid-med'); if (!box) return;
    var kid = curKid();
    if (!kid) {
      box.innerHTML = '<div class="kid-empty"><b>아이를 먼저 추가해 주세요</b>해열제 먹인 시간과 체온을 기록하면, 다음에 먹일 수 있는 시각을 알려 드려요.' +
        '<button class="btn" data-kid-add="med">+ 아이 추가</button></div>' + privNote('kid');
      return;
    }
    var l = logs(kid.id);
    var recent = l.filter(function (x) { return Date.now() - x.t < 72 * 3600000; }).sort(function (a, b) { return b.t - a.t; });
    var now = new Date();
    box.innerHTML = kidPicker(kid, 'med') + feverAlerts(kid, l) +
      '<div class="med-box">' +
        '<div class="med-time"><label>먹인 시각</label><input type="time" id="med-time" value="' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + '"></div>' +
        '<button class="btn med-btn" data-med="acet">💊 아세트아미노펜 계열 먹였어요<small>' + DRUGS.acet.ex + '</small></button>' +
        '<button class="btn med-btn alt" data-med="ibu">💊 이부프로펜·덱시부프로펜 계열 먹였어요<small>' + DRUGS.ibu.ex + '</small></button>' +
        '<div class="temp-row"><input type="number" id="temp-in" inputmode="decimal" step="0.1" min="34" max="43" placeholder="체온 예: 38.5"><button class="btn ghost" id="temp-btn">🌡 체온 기록</button></div>' +
        '<div class="quick2"><button class="btn ghost" data-quick="pee">💧 소변·기저귀</button><button class="btn ghost" data-quick="drink">🥤 물·수유</button></div>' +
        '<div class="sym"><div class="sym-h">증상 메모 (눌러서 고르고 저장)</div><div class="sym-chips">' + SYMS.map(function (x) { return '<button class="chip" data-sym="' + x + '">' + x + '</button>'; }).join('') + '</div>' +
        '<div class="temp-row"><input type="text" id="sym-in" maxlength="60" placeholder="직접 적기 (예: 오른쪽 귀 아프다고 함)"><button class="btn ghost" id="sym-btn">📝 메모 저장</button></div></div>' +
      '</div>' +
      fluidStatus(l) + tempChart(l) +
      drugStatus(l, 'acet') + drugStatus(l, 'ibu') + '<div class="pad-x">' + HOMECARE + '</div>' +
      '<div class="note pad">용량과 간격은 약 설명서와 약사 안내를 따라 주세요. 두 계열을 번갈아 먹이는 것은 의사·약사와 상의하세요.</div>' +
      '<h3 class="bn-h">최근 3일 기록</h3>' +
      (recent.length ? '<ul class="tl">' + recent.map(function (x) {
        var label = x.type === 'temp' ? '🌡 ' + x.v.toFixed(1) + '℃' : x.type === 'note' ? '📝 ' + esc(x.v) : x.type === 'pee' ? '💧 소변·기저귀' : x.type === 'drink' ? '🥤 물·수유' : '💊 ' + DRUGS[x.type].name;
        return '<li class="' + (x.type === 'temp' && x.v >= 38 ? 'hot' : x.type === 'note' && /경련/.test(x.v) ? 'hot' : '') + '"><span class="tl-t">' + dayLabel(x.t) + ' ' + hm(x.t) + '</span><span class="tl-v">' + label + '</span><button class="tl-x" data-del="' + x.t + '" aria-label="지우기">✕</button></li>';
      }).join('') + '</ul>' : '<div class="kid-empty small">아직 기록이 없어요</div>') +
      '<div class="actions pad"><button class="btn ghost" id="med-share">📤 진료 때 보여줄 기록 공유</button><button class="btn ghost" id="med-clear">기록 모두 지우기</button></div>' + privNote('kid');

    $$('#kid-med [data-med]').forEach(function (b) {
      b.addEventListener('click', function () {
        var key = b.dataset.med, t = pickedTime(), D = DRUGS[key];
        var day = l.filter(function (x) { return x.type === key && t - x.t < 86400000 && t >= x.t; }).length;
        var last = l.filter(function (x) { return x.type === key && x.t <= t; }).sort(function (a, c) { return c.t - a.t; })[0];
        if (last && t - last.t < D.gapH * 3600000 && !confirm('같은 계열을 ' + hm(last.t) + '에 먹였어요. 설명서 기준 간격(' + D.gapH + '시간)보다 짧은데 그래도 기록할까요?')) return;
        if (day >= D.maxDay && !confirm('24시간 안에 이미 ' + day + '회 먹였어요. 그래도 기록할까요?')) return;
        l.push({ t: t, type: key }); saveLogs(kid.id, l); toast(hm(t) + ' 기록했어요'); renderMed();
      });
    });
    $('#temp-btn').addEventListener('click', function () {
      var v = parseFloat(($('#temp-in').value || '').replace(',', '.'));
      if (!(v >= 34 && v <= 43)) { toast('체온을 34~43 사이 숫자로 적어 주세요'); return; }
      l.push({ t: pickedTime(), type: 'temp', v: Math.round(v * 10) / 10 }); saveLogs(kid.id, l); renderMed();
    });
    $$('#kid-med [data-quick]').forEach(function (b) {
      b.addEventListener('click', function () { l.push({ t: pickedTime(), type: b.dataset.quick }); saveLogs(kid.id, l); toast((b.dataset.quick === 'pee' ? '소변' : '물·수유') + ' ' + hm(pickedTime()) + ' 기록했어요'); renderMed(); });
    });
    $$('#kid-med [data-sym]').forEach(function (b) { b.addEventListener('click', function () { b.classList.toggle('on'); }); });
    $('#sym-btn').addEventListener('click', function () {
      var picked = $$('#kid-med [data-sym].on').map(function (b) { return b.dataset.sym; });
      var txt = ($('#sym-in').value || '').trim();
      var v = picked.concat(txt ? [txt] : []).join(', ');
      if (!v) { toast('증상을 고르거나 적어 주세요'); return; }
      l.push({ t: pickedTime(), type: 'note', v: v.slice(0, 100) }); saveLogs(kid.id, l); renderMed();
      if (/경련/.test(v)) toast('경련이 있었다면 멈췄어도 진료가 필요해요. "어디로 가야 해요?"를 확인하세요');
    });
    $$('#kid-med [data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = +b.dataset.del;
        saveLogs(kid.id, l.filter(function (x) { return x.t !== t; })); renderMed();
      });
    });
    $('#med-clear').addEventListener('click', function () {
      if (confirm(kid.name + '의 해열제·체온 기록을 모두 지울까요?')) { saveLogs(kid.id, []); renderMed(); }
    });
    $('#med-share').addEventListener('click', function () {
      if (!confirmShare('해열제·체온 기록')) return;
      var lines = recent.slice().reverse().map(function (x) {
        return dayLabel(x.t) + ' ' + hm(x.t) + '  ' + (x.type === 'temp' ? '체온 ' + x.v.toFixed(1) + '℃' : x.type === 'note' ? '메모: ' + x.v : x.type === 'pee' ? '소변·기저귀' : x.type === 'drink' ? '물·수유' : DRUGS[x.type].name + ' 복용');
      });
      shareText(kid.name + ' 해열제·체온 기록', '[' + kid.name + (kid.birth ? ' · ' + ageText(kid.birth) : '') + ' 해열제·체온 기록]\n' + (lines.join('\n') || '기록 없음') + '\n\n- 아이아플때 앱');
    });
  }

  // ───── 응급 카드 ─────
  var FIELDS = [
    ['name', '이름', 'text', '예: 하윤'],
    ['birth', '생년월일', 'date', ''],
    ['weight', '몸무게(kg)', 'number', '예: 12.5'],
    ['blood', '혈액형', 'text', '예: A+ (모르면 비워 두세요)'],
    ['allergy', '알레르기 (약·음식)', 'textarea', '예: 페니실린, 땅콩'],
    ['meds', '지금 먹는 약', 'textarea', '예: 천식 흡입기'],
    ['conditions', '앓는 병·수술·입원 이력', 'textarea', '예: 열성경련 1회(2025.3)'],
    ['hospital', '다니는 병원', 'text', '예: ○○소아청소년과'],
    ['guardian', '보호자 연락처', 'text', '예: 엄마 010-0000-0000'],
    ['memo', '메모', 'textarea', '']
  ];
  var editing = false;
  function renderCard() {
    var box = $('#kid-card'); if (!box) return;
    var kid = curKid();
    if (!kid) {
      box.innerHTML = '<div class="kid-empty"><b>우리 아이 응급 카드</b>알레르기·먹는 약·지병을 적어 두면 응급실이나 119에서 화면 하나로 보여 줄 수 있어요. 조부모님·돌보미에게 카톡으로 보낼 수도 있어요.' +
        '<button class="btn" data-kid-add="card">+ 아이 추가</button></div>' + privNote('kid');
      return;
    }
    if (editing || !kid.birth) {
      box.innerHTML = kidPicker(kid, 'card') + '<div class="card-form">' + FIELDS.map(function (f) {
        var v = esc(kid[f[0]] || '');
        return '<label>' + f[1] + (f[2] === 'textarea'
          ? '<textarea data-f="' + f[0] + '" rows="2" placeholder="' + f[3] + '">' + v + '</textarea>'
          : '<input data-f="' + f[0] + '" type="' + f[2] + '"' + (f[2] === 'number' ? ' step="0.1" inputmode="decimal"' : '') + ' value="' + v + '" placeholder="' + f[3] + '">') + '</label>';
      }).join('') +
        '<div class="actions"><button class="btn" id="card-save">저장</button><button class="btn ghost" id="card-del">이 아이 지우기</button></div>' +
        '<div class="note">꼭 필요한 것만 적어 주세요. 비워 둔 칸은 카드에 나오지 않아요.</div></div>' + privNote('kid');
      $('#card-save').addEventListener('click', function () {
        var k = kids(), me = k.list.filter(function (x) { return x.id === kid.id; })[0];
        $$('#kid-card [data-f]').forEach(function (el) { me[el.dataset.f] = el.value.trim(); });
        if (!me.name) me.name = '아이';
        if (me.weight) me.weightAt = new Date().toISOString().slice(0, 10);
        saveKids(k); editing = false; toast('저장했어요'); renderCard();
      });
      $('#card-del').addEventListener('click', function () {
        if (!confirm(kid.name + '의 카드와 해열제 기록을 모두 지울까요?')) return;
        var k = kids(); k.list = k.list.filter(function (x) { return x.id !== kid.id; }); k.cur = k.list[0] ? k.list[0].id : '';
        saveKids(k); save('kidlog:' + kid.id, []); editing = false; renderCard();
      });
      return;
    }
    var row = function (label, v) { return v ? '<div class="ec-row"><span>' + label + '</span><b>' + esc(v).replace(/\n/g, '<br>') + '</b></div>' : ''; };
    box.innerHTML = kidPicker(kid, 'card') +
      '<div class="ec">' +
        '<div class="ec-h"><div class="ec-name">' + esc(kid.name) + '</div><div class="ec-age">' + ageText(kid.birth) + ' · ' + esc(kid.birth) + '</div></div>' +
        row('몸무게', kid.weight ? kid.weight + 'kg' + (kid.weightAt ? ' (' + kid.weightAt + ' 기준)' : '') : '') +
        row('혈액형', kid.blood) +
        '<div class="ec-row ' + (kid.allergy ? 'danger' : '') + '"><span>알레르기</span><b>' + (kid.allergy ? esc(kid.allergy) : '없음 / 모름') + '</b></div>' +
        row('먹는 약', kid.meds) + row('병력', kid.conditions) + row('다니는 병원', kid.hospital) + row('보호자', kid.guardian) + row('메모', kid.memo) +
      '</div>' +
      '<div class="actions pad"><button class="btn" id="card-share">📤 카톡으로 보내기</button><button class="btn ghost" id="card-edit">✏️ 고치기</button></div>' +
      '<div class="note pad">응급실·119에서 이 화면을 그대로 보여 주세요.</div>' + privNote('kid');
    $('#card-edit').addEventListener('click', function () { editing = true; renderCard(); });
    $('#card-share').addEventListener('click', function () {
      if (!confirmShare('응급 카드')) return;
      var t = '[' + kid.name + ' 응급 카드]\n' +
        '생년월일: ' + kid.birth + ' (' + ageText(kid.birth) + ')\n' +
        (kid.weight ? '몸무게: ' + kid.weight + 'kg\n' : '') + (kid.blood ? '혈액형: ' + kid.blood + '\n' : '') +
        '알레르기: ' + (kid.allergy || '없음/모름') + '\n' +
        (kid.meds ? '먹는 약: ' + kid.meds + '\n' : '') + (kid.conditions ? '병력: ' + kid.conditions + '\n' : '') +
        (kid.hospital ? '다니는 병원: ' + kid.hospital + '\n' : '') + (kid.guardian ? '보호자: ' + kid.guardian + '\n' : '') +
        (kid.memo ? '메모: ' + kid.memo + '\n' : '') + '\n- 아이아플때 앱';
      shareText(kid.name + ' 응급 카드', t);
    });
  }


  // ───── 📅 예방접종·건강검진 일정 ─────
  // 기준: 질병관리청 표준예방접종일정표(2026), 국민건강보험공단 영유아 건강검진·구강검진 시기.
  // 일정이 바뀌면 아래 SCHED 만 고치면 된다. s/e = 시작·끝 (d:일, m:개월, y:세)
  var SCHED_CHECKED = '2026.10';
  var VAC = 'https://nip.kdca.go.kr', NHIS = 'https://www.nhis.or.kr';
  var SCHED = [
    { id: 'hepb1', c: 'vac', n: 'B형간염 1차', s: 'd0', e: 'd7', note: '출생 직후 (보통 출산한 병원에서 접종)' },
    { id: 'bcg', c: 'vac', n: 'BCG(결핵)', s: 'd0', e: 'd28', note: '생후 4주 이내. 피내접종은 보건소 예약제인 곳이 많아요' },
    { id: 'chk1', c: 'chk', n: '영유아 건강검진 1차', s: 'd14', e: 'd35' },
    { id: 'hepb2', c: 'vac', n: 'B형간염 2차', s: 'm1', e: 'm2' },
    { id: 'v2m', c: 'vac', n: '2개월 접종', s: 'm2', e: 'm3', note: 'DTaP·폴리오·Hib·폐렴구균·로타바이러스 1차' },
    { id: 'v4m', c: 'vac', n: '4개월 접종', s: 'm4', e: 'm5', note: 'DTaP·폴리오·Hib·폐렴구균·로타바이러스 2차' },
    { id: 'chk2', c: 'chk', n: '영유아 건강검진 2차', s: 'm4', e: 'm6' },
    { id: 'v6m', c: 'vac', n: '6개월 접종', s: 'm6', e: 'm7', note: 'DTaP·Hib·폐렴구균 3차, B형간염 3차, 폴리오 3차(18개월까지 가능), 로타바이러스 3차(로타텍만)' },
    { id: 'chk3', c: 'chk', n: '영유아 건강검진 3차', s: 'm9', e: 'm12' },
    { id: 'v12m', c: 'vac', n: '12~15개월 접종', s: 'm12', e: 'm15', note: 'Hib·폐렴구균 추가, MMR 1차, 수두' },
    { id: 'hepa1', c: 'vac', n: 'A형간염 1차', s: 'm12', e: 'm23', note: '2차는 1차 접종 6~12개월 뒤' },
    { id: 'je12', c: 'vac', n: '일본뇌염 1·2차', s: 'm12', e: 'm24', note: '불활성화 백신 기준 (1·2차는 7~30일 간격). 생백신을 맞았다면 일정이 달라요' },
    { id: 'dtap4', c: 'vac', n: 'DTaP 4차', s: 'm15', e: 'm19', note: '15~18개월' },
    { id: 'hepa2', c: 'vac', n: 'A형간염 2차', s: 'm18', e: 'm36', note: '1차를 맞은 날로부터 6~12개월 뒤에 맞아요' },
    { id: 'chk4', c: 'chk', n: '영유아 건강검진 4차', s: 'm18', e: 'm24' },
    { id: 'oral1', c: 'oral', n: '영유아 구강검진 1차', s: 'm18', e: 'm29' },
    { id: 'je3', c: 'vac', n: '일본뇌염 3차', s: 'm24', e: 'm36', note: '2차 접종 12개월 뒤 (불활성화 백신 기준)' },
    { id: 'chk5', c: 'chk', n: '영유아 건강검진 5차', s: 'm30', e: 'm36' },
    { id: 'oral2', c: 'oral', n: '영유아 구강검진 2차', s: 'm30', e: 'm41' },
    { id: 'chk6', c: 'chk', n: '영유아 건강검진 6차', s: 'm42', e: 'm48' },
    { id: 'oral3', c: 'oral', n: '영유아 구강검진 3차', s: 'm42', e: 'm53' },
    { id: 'v4y', c: 'vac', n: '만 4~6세 접종', s: 'y4', e: 'y7', note: 'DTaP 5차, 폴리오 4차, MMR 2차' },
    { id: 'chk7', c: 'chk', n: '영유아 건강검진 7차', s: 'm54', e: 'm60' },
    { id: 'oral4', c: 'oral', n: '영유아 구강검진 4차', s: 'm54', e: 'm65' },
    { id: 'je4', c: 'vac', n: '일본뇌염 4차', s: 'y6', e: 'y7', note: '만 6세 (불활성화 백신 기준)' },
    { id: 'chk8', c: 'chk', n: '영유아 건강검진 8차', s: 'm66', e: 'm71' },
    { id: 'v12y', c: 'vac', n: '만 12세 접종', s: 'y11', e: 'y13', note: 'Tdap/Td 6차, 일본뇌염 5차, HPV(대상 여부 확인)' }
  ];
  var CAT = { vac: { label: '예방접종', icon: '💉', link: VAC, linkName: '예방접종도우미' },
              chk: { label: '건강검진', icon: '🩺', link: NHIS, linkName: '국민건강보험공단' },
              oral: { label: '구강검진', icon: '🦷', link: NHIS, linkName: '국민건강보험공단' },
              flu: { label: '예방접종', icon: '💉', link: VAC, linkName: '예방접종도우미' } };
  function addSpan(birth, code) {
    var b = new Date(birth + 'T00:00:00'), n = +code.slice(1), u = code[0];
    if (u === 'd') return new Date(b.getTime() + n * 86400000);
    var months = u === 'y' ? n * 12 : n;
    var d = new Date(b.getFullYear(), b.getMonth() + months, b.getDate());
    if (d.getDate() !== b.getDate()) d.setDate(0); // 31일생 등 월말 보정
    return d;
  }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function kdate(d) { return d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate(); }
  // 앞 접종 날짜에 따라 정해지는 일정: [앞 일정, 시작(뒤로), 끝(뒤로), 바뀐 설명]
  var DEPS = {
    hepa2: ['hepa1', 'm6', 'm12', 'A형간염 1차를 맞은 날로부터 6~12개월 뒤'],
    je3: ['je12', 'm11', 'm13', '일본뇌염 2차 접종 약 12개월 뒤 (불활성화 백신 기준)']
  };
  function doneDate(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null; }
  function schedFor(kid) {
    var dn = done(kid);
    var list = SCHED.map(function (x) {
      var it = { id: x.id, c: x.c, n: x.n, note: x.note || '', s: addSpan(kid.birth, x.s), e: addSpan(kid.birth, x.e) };
      var dep = DEPS[x.id], base = dep && doneDate(dn[dep[0]]);
      if (base) { it.s = addSpan(base, dep[1]); it.e = addSpan(base, dep[2]); it.note = dep[3] + ' (앞 접종 ' + base.replace(/-/g, '.') + ' 기준)'; }
      return it;
    });
    // 독감: 생후 6개월 ~ 만 13세, 매년 10월 (처음 맞는 해는 4주 간격 2회)
    var from = addSpan(kid.birth, 'm6'), to = addSpan(kid.birth, 'y13'), y = from.getFullYear(), first = true;
    for (; y <= to.getFullYear(); y++) {
      var s = new Date(y, 9, 1), e = new Date(y, 11, 31);
      if (e < from || s > to) continue;
      if (s < from) s = from;
      list.push({ id: 'flu' + y, c: 'flu', n: y + '년 어린이 독감 접종' + (first ? ' (1차)' : ''), s: s, e: e,
        note: first ? '처음 맞는 해에는 4주 간격으로 2회 맞아요. 시작 날짜는 해마다 공지돼요' : '매년 1회. 시작 날짜는 해마다 공지돼요' });
      var fd = first && doneDate(dn['flu' + y]);
      if (fd) {
        list.push({ id: 'flu' + y + 'b', c: 'flu', n: y + '년 어린이 독감 접종 (2차)', s: addSpan(fd, 'd28'), e: addSpan(fd, 'd56'),
          note: '1차(' + fd.replace(/-/g, '.') + ') 4주 뒤에 맞아요' });
      }
      first = false;
    }
    return list.sort(function (a, b) { return a.s - b.s; });
  }
  function done(kid) { return load('kiddone:' + kid.id, {}); }
  function gcalLink(kid, x, who) {
    var e1 = new Date(x.e.getTime() + 86400000);
    var f = function (d) { return ymd(d).replace(/-/g, ''); };
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent('[' + who + '] ' + x.n) +
      '&dates=' + f(x.s) + '/' + f(e1) + '&details=' + encodeURIComponent((x.note ? x.note + '\n' : '') + '기간: ' + kdate(x.s) + ' ~ ' + kdate(x.e) + '\n확인: ' + CAT[x.c].link + '\n- 아이아플때');
  }
  var showAllSched = false;
  function renderSched() {
    var box = $('#kid-sched'); if (!box) return;
    var kid = curKid();
    if (!kid) {
      box.innerHTML = '<div class="kid-empty"><b>예방접종·건강검진 일정</b>생년월일만 넣으면 국가예방접종과 영유아 건강검진 시기를 자동으로 계산하고, 휴대폰 캘린더에 넣어 알림을 받을 수 있어요.' +
        '<button class="btn" data-kid-add="sched">+ 아이 추가</button></div>' + privNote('kid');
      return;
    }
    if (!kid.birth) {
      box.innerHTML = kidPicker(kid, 'sched') + '<div class="kid-empty"><b>생년월일이 필요해요</b>응급 카드에 ' + esc(kid.name) + '의 생년월일을 넣으면 일정을 계산해 드려요.' +
        '<button class="btn" id="to-card">🪪 응급 카드에서 생년월일 넣기</button></div>' + privNote('kid');
      $('#to-card').addEventListener('click', function () { editing = true; showPane('card'); });
      return;
    }
    var all = schedFor(kid), dn = done(kid), today = new Date(); today.setHours(0, 0, 0, 0);
    var soon = new Date(today.getTime() + 60 * 86400000);
    var now = [], next = [], later = [], past = [];
    all.forEach(function (x) {
      if (dn[x.id]) past.push(x);
      else if (x.e < today) past.push(x);
      else if (x.s <= today) now.push(x);
      else if (x.s <= soon) next.push(x);
      else later.push(x);
    });
    var item = function (x, cls) {
      var C = CAT[x.c], isDone = !!dn[x.id], dd = doneDate(dn[x.id]);
      return '<li class="sc ' + cls + (isDone ? ' done' : '') + '">' +
        '<label class="sc-chk"><input type="checkbox" data-done="' + x.id + '"' + (isDone ? ' checked' : '') + '><span></span></label>' +
        '<div class="sc-body"><div class="sc-n">' + C.icon + ' ' + esc(x.n) + '</div>' +
        (dd ? '<div class="sc-done">✓ ' + dd.replace(/-/g, '.') + ' 완료 <a href="#" data-redate="' + x.id + '">날짜 고치기</a></div>' : '') +
        '<div class="sc-d">' + kdate(x.s) + ' ~ ' + kdate(x.e) + (cls === 'now' ? ' <b>· 지금 할 때</b>' : cls === 'next' ? ' · ' + Math.ceil((x.s - today) / 86400000) + '일 뒤 시작' : cls === 'past' && !isDone ? ' <em>· 기간 지남 · 맞았다면 체크</em>' : '') + '</div>' +
        (x.note ? '<div class="sc-note">' + esc(x.note) + '</div>' : '') +
        '<div class="sc-links"><a href="' + C.link + '" target="_blank" rel="noopener">' + C.linkName + ' ↗</a>' +
        (x.e >= today && !isDone ? ' · <a href="#" data-gcal="' + x.id + '">구글 캘린더에 추가</a>' : '') + '</div></div></li>';
    };
    var sec = function (title, arr, cls) { return arr.length ? '<h3 class="bn-h">' + title + '</h3><ul class="sc-list">' + arr.map(function (x) { return item(x, cls); }).join('') + '</ul>' : ''; };
    box.innerHTML = kidPicker(kid, 'sched') +
      '<div class="sc-head">' + esc(kid.name) + ' · ' + ageText(kid.birth) + '</div>' +
      '<div class="cal-box"><button class="btn" id="ics-btn">📅 남은 일정 캘린더에 한 번에 넣기</button>' +
      '<div class="cal-hint">아이폰·삼성 캘린더에 들어가고, 각 일정 시작 하루 전 아침 9시에 알림이 와요. 구글 캘린더는 아래 일정마다 "구글 캘린더에 추가"를 눌러 주세요.</div></div>' +
      (function () {
        var missed = past.filter(function (x) { return !dn[x.id] && x.c !== 'flu'; }).length;
        return missed && !showAllSched ? '<button class="missed" id="missed-btn">⚠️ 기간이 지난 일정 ' + missed + '개가 체크되지 않았어요. 맞았는지 확인해 주세요 →</button>' : '';
      })() +
      (now.length || next.length ? '' : '<div class="kid-empty small">지금 할 일정이 없어요 🎉</div>') +
      sec('지금 할 때', now, 'now') + sec('곧 시작 (60일 안)', next, 'next') +
      (later.length ? (showAllSched ? sec('나중 일정', later, 'later') : '<button class="btn ghost more-sc" id="more-sc">나중 일정 ' + later.length + '개 더 보기</button>') : '') +
      (past.length ? (showAllSched ? sec('지난 일정·완료', past.slice().reverse(), 'past') : '') : '') +
      '<div class="note pad">체크(✓)할 때 맞은 날짜를 넣으면 A형간염 2차·일본뇌염 3차·첫해 독감 2차를 그 날짜 기준으로 다시 계산해요.<br>체크(✓)는 맞았거나 받은 일정을 표시하는 용도예요. 실제 접종 기록은 <a href="' + VAC + '" target="_blank" rel="noopener">예방접종도우미</a>에서 확인하고, 그곳에서도 접종 알림을 받을 수 있어요.<br>기준: 질병관리청 표준예방접종일정(2026), 국민건강보험공단 영유아 검진 시기 (' + SCHED_CHECKED + ' 확인). 아이 상태에 따라 일정이 달라질 수 있으니 소아과와 상의하세요.</div>' +
      privNote('kid') + '<div class="priv">🔒 캘린더에 넣으면 일정 제목에 적은 이름이 들어가고, 캘린더가 구글·삼성·애플 계정과 동기화되면 그곳에도 저장돼요. 넣기 전에 이름 대신 별명을 쓸 수 있어요.</div>';

    function askDate(def) {
      var v = prompt('맞은(받은) 날짜를 적어 주세요. 다음 일정 계산에 써요.\n예: ' + def + '  (모르면 비워 두고 확인)', def);
      if (v === null) return null;
      v = v.trim().replace(/[./]/g, '-').replace(/-(\d)(?=-|$)/g, '-0$1');
      if (!v) return 'x';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(Date.parse(v)) || new Date(v + 'T00:00:00') > new Date()) { toast('날짜를 2026-10-13처럼 적어 주세요 (오늘 이후는 안 돼요)'); return null; }
      return v;
    }
    $$('#kid-sched [data-done]').forEach(function (c) {
      c.addEventListener('change', function () {
        var d2 = done(kid), id = c.dataset.done;
        if (c.checked) {
          var x = all.filter(function (y) { return y.id === id; })[0];
          var def = ymd(x && x.e < today ? x.e : today);
          var v = askDate(def);
          if (v === null) { c.checked = false; return; }
          d2[id] = v === 'x' ? 1 : v;
        } else delete d2[id];
        save('kiddone:' + kid.id, d2); renderSched();
      });
    });
    $$('#kid-sched [data-redate]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var d2 = done(kid), v = askDate(doneDate(d2[a.dataset.redate]) || ymd(today));
        if (v === null) return;
        d2[a.dataset.redate] = v === 'x' ? 1 : v; save('kiddone:' + kid.id, d2); renderSched();
      });
    });
    var mb = $('#more-sc'); if (mb) mb.addEventListener('click', function () { showAllSched = true; renderSched(); });
    var ms = $('#missed-btn'); if (ms) ms.addEventListener('click', function () { showAllSched = true; renderSched(); var h = $$('#kid-sched .bn-h'); if (h.length) h[h.length - 1].scrollIntoView({ behavior: 'smooth' }); });
    $$('#kid-sched [data-gcal]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var who = askCalName(kid); if (!who) return;
        var x = all.filter(function (y) { return y.id === a.dataset.gcal; })[0];
        window.open(gcalLink(kid, x, who), '_blank', 'noopener');
      });
    });
    $('#ics-btn').addEventListener('click', function () {
      var items = all.filter(function (x) { return !dn[x.id] && x.e >= today; });
      if (!items.length) { toast('넣을 남은 일정이 없어요'); return; }
      var who = askCalName(kid); if (!who) return;
      downloadIcs(kid, items, who);
    });
  }
  var calName = {};
  function askCalName(kid) {
    var v = prompt('캘린더 일정 제목에 들어갈 이름이에요.\n캘린더가 계정과 동기화되면 그곳에도 저장되니, 별명을 써도 좋아요.', calName[kid.id] || kid.name);
    if (v === null) return '';
    v = v.trim().slice(0, 12) || '아이';
    calName[kid.id] = v;
    return v;
  }
  function icsEsc(t) { return String(t).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
  function downloadIcs(kid, items, who) {
    var f = function (d) { return ymd(d).replace(/-/g, ''); };
    var stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//aiapulttae//schedule//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + icsEsc(who + ' 접종·검진')];
    var today = new Date(); today.setHours(0, 0, 0, 0);
    items.forEach(function (x) {
      var start = x.s < today ? today : x.s;
      lines.push('BEGIN:VEVENT', 'UID:' + kid.id + '-' + x.id + '@aiapulttae', 'DTSTAMP:' + stamp,
        'DTSTART;VALUE=DATE:' + f(start), 'DTEND;VALUE=DATE:' + f(new Date(x.e.getTime() + 86400000)),
        'SUMMARY:' + icsEsc('[' + who + '] ' + CAT[x.c].icon + ' ' + x.n),
        'DESCRIPTION:' + icsEsc((x.note ? x.note + '\n' : '') + '기간: ' + kdate(x.s) + ' ~ ' + kdate(x.e) + '\n확인: ' + CAT[x.c].link + '\n- 아이아플때'),
        'TRANSP:TRANSPARENT');
      if (x.s >= today) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(who + ' ' + x.n + ' 시작'), 'TRIGGER:-PT15H', 'END:VALARM');
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    var blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'aiapulttae-' + (who.replace(/[^0-9a-zA-Z가-힣]/g, '') || 'kid') + '.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
    toast(items.length + '개 일정 파일을 만들었어요. 열어서 캘린더에 추가하세요');
  }

  // ───── 💾 백업 내보내기·불러오기 ─────
  // 휴대폰에만 저장하는 대신, 이용자가 직접 파일로 옮길 수 있게 한다. (서버를 거치지 않음)
  var BK_KEYS = /^(kids|kidlog:.+|kiddone:.+|favs|region|bigFont|kidPane)$/;
  function backupData() {
    var data = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (BK_KEYS.test(k)) { try { data[k] = JSON.parse(localStorage.getItem(k)); } catch (e) {} }
    }
    return { app: 'aiapulttae', v: 1, at: new Date().toISOString(), data: data };
  }
  $('#bk-out').addEventListener('click', function () {
    var b = backupData(), n = (b.data.kids && b.data.kids.list || []).length;
    if (!confirm('백업 파일에는 아이 이름·생년월일·알레르기·해열제 기록 같은 개인정보가 들어 있어요.\n파일을 다른 사람과 공유하지 말고, 안전한 곳(내 클라우드, 카톡 나와의 채팅 등)에 보관하세요.\n\n백업 파일을 만들까요?')) return;
    var name = 'aiapulttae-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    var blob = new Blob([JSON.stringify(b)], { type: 'application/json' });
    var file = typeof File === 'function' ? new File([blob], name, { type: 'application/json' }) : null;
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: '아이아플때 백업' }).catch(function () {});
    } else {
      var url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
    }
    toast('아이 ' + n + '명의 기록을 백업 파일로 만들었어요');
  });
  $('#bk-in').addEventListener('click', function () { $('#bk-file').value = ''; $('#bk-file').click(); });
  $('#bk-file').addEventListener('change', function () {
    var f = this.files && this.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var b = JSON.parse(r.result);
        if (!b || b.app !== 'aiapulttae' || !b.data) throw new Error();
        var n = (b.data.kids && b.data.kids.list || []).length;
        if (!confirm((b.at ? b.at.slice(0, 10) + '에 만든 ' : '') + '백업(아이 ' + n + '명)을 불러올까요?\n지금 이 휴대폰에 있는 아이 정보와 기록은 백업 내용으로 바뀌어요.')) return;
        for (var i = localStorage.length - 1; i >= 0; i--) { var k = localStorage.key(i); if (/^(kids|kidlog:.+|kiddone:.+)$/.test(k)) localStorage.removeItem(k); }
        Object.keys(b.data).forEach(function (k) { if (BK_KEYS.test(k)) localStorage.setItem(k, JSON.stringify(b.data[k])); });
        toast('불러왔어요'); setTimeout(function () { location.reload(); }, 600);
      } catch (e) { toast('아이아플때 백업 파일이 아니에요'); }
    };
    r.readAsText(f);
  });

  // ───── 우리아이 탭 안 전환 ─────
  var pane = load('kidPane', 'med');
  function showPane(k) {
    pane = k; save('kidPane', k);
    $$('#kid-seg button').forEach(function (b) { b.classList.toggle('on', b.dataset.k === k); });
    $('#kid-med').hidden = k !== 'med'; $('#kid-card').hidden = k !== 'card'; $('#kid-sched').hidden = k !== 'sched'; $('#benefit-body').hidden = k !== 'bn';
    if (k === 'med') renderMed(); else if (k === 'card') renderCard(); else if (k === 'sched') renderSched(); else K.loadBenefit();
  }
  $$('#kid-seg button').forEach(function (b) { b.addEventListener('click', function () { showPane(b.dataset.k); }); });
  K.onShow.benefit = function (opt) { showPane(opt && opt.pane ? opt.pane : pane); };
  setInterval(function () { if (!$('#kid-med').hidden && !$('#tab-benefit').hidden && document.activeElement && document.activeElement.tagName !== 'INPUT') renderMed(); }, 60000);

  // ───── 큰 글씨 ─────
  function applyFont(on) { document.documentElement.classList.toggle('big', on); $('#font-btn').textContent = on ? '가-' : '가+'; $('#font-btn').setAttribute('aria-label', on ? '글씨 보통' : '글씨 크게'); }
  applyFont(!!load('bigFont', false));
  $('#font-btn').addEventListener('click', function () {
    var on = !document.documentElement.classList.contains('big'); save('bigFont', on); applyFont(on);
    toast(on ? '글씨를 크게 했어요' : '글씨를 보통으로 했어요');
  });

  // ───── 첫 실행 안내 ─────
  (function () {
    if (load('onboarded', false)) return;
    var ob = $('#onboard'), i = 0, sl = $$('#onboard .ob-s'), dots = $$('#onboard .ob-dots i');
    var go = function (n) {
      i = n; sl.forEach(function (x, k) { x.hidden = k !== i; }); dots.forEach(function (x, k) { x.classList.toggle('on', k === i); });
      $('#ob-next').textContent = i === sl.length - 1 ? '시작하기' : '다음';
    };
    var close = function () { ob.hidden = true; save('onboarded', true); };
    $('#ob-next').addEventListener('click', function () { if (i < sl.length - 1) go(i + 1); else close(); });
    $('#ob-skip').addEventListener('click', close);
    ob.hidden = false;
  })();

  // ───── 자료가 오래되면 경고 ─────
  K.getDB().then(function (db) {
    var u = db.meta.updatedAt; if (!u) return;
    var days = Math.floor((Date.now() - Date.parse(u)) / 86400000);
    if (days >= 7) {
      var el = $('#stale');
      el.innerHTML = '⚠️ 병원 자료가 ' + days + '일 전(' + u.slice(5, 10).replace('-', '/') + ') 기준이에요. 진료시간이 바뀌었을 수 있으니 꼭 전화로 확인하세요.';
      el.hidden = false;
    }
  }).catch(function () {});

  // ───── 연휴 안내 ─────
  K.getDB().then(function (db) {
    var hol = db.meta.holidays || [], now = K.kstNow(), box = $('#holiday-banner');
    var today = now.date, upcoming = null;
    for (var i = 1; i <= 3; i++) {
      var d = new Date(Date.parse(today + 'T00:00:00Z') + i * 86400000).toISOString().slice(0, 10);
      if (hol.indexOf(d) >= 0) { upcoming = d; break; }
    }
    var W = ['일', '월', '화', '수', '목', '금', '토'];
    if (hol.indexOf(today) >= 0) {
      box.innerHTML = '<button class="hol" data-go-tab="night" data-go-filter="openNow">🗓 오늘은 공휴일이에요 · <b>지금 문 연 곳 보기 →</b></button>';
      box.hidden = false;
    } else if (upcoming) {
      var dd = new Date(upcoming + 'T00:00:00Z');
      box.innerHTML = '<button class="hol" data-go-tab="night" data-go-filter="weekend">🗓 ' + (dd.getUTCMonth() + 1) + '월 ' + dd.getUTCDate() + '일(' + W[dd.getUTCDay()] + ') 공휴일이에요 · <b>휴일에 문 여는 곳 보기 →</b></button>';
      box.hidden = false;
    }
  }).catch(function () {});

  // ───── 첫 화면: 지금 열린 가까운 곳 ─────
  function renderOpenNear(pos) {
    var box = $('#open-near');
    box.innerHTML = '<div class="on-h">📍 지금 열린 가까운 소아과</div><div class="spinner small">찾는 중…</div>';
    K.api('/hospitals', { lat: pos.lat, lng: pos.lng, radius: 20, openNow: '1', limit: 3 }).then(function (d) {
      if (!d.items.length) {
        box.innerHTML = '<div class="on-h">📍 지금 열린 가까운 소아과</div><div class="on-empty">20km 안에 지금 진료 중인 곳이 없어요.</div>' +
          '<div class="on-btns"><button class="btn ghost" data-go-tab="night" data-go-filter="er">야간 응급실 보기</button><button class="btn ghost" data-go-tab="pharm">문 연 약국</button></div>';
        return;
      }
      box.innerHTML = '<div class="on-h">📍 지금 열린 가까운 소아과 <button class="on-more" data-go-tab="near">더 보기 →</button></div><ul class="list tight">' + d.items.map(K.card).join('') + '</ul>';
    }).catch(function () { box.innerHTML = ''; });
  }
  function askOpenNear() {
    var box = $('#open-near');
    box.innerHTML = '<button class="btn on-ask" id="on-ask">📍 지금 열린 가까운 소아과 바로 보기</button>' + privNote('loc');
    $('#on-ask').addEventListener('click', function () {
      K.locate(true).then(renderOpenNear).catch(function (e) { toast(e.message); });
    });
  }
  K.getDB().then(function (db) {
    if (!db.meta.withHours) return;
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then(function (st) {
        if (st.state === 'granted') K.locate().then(renderOpenNear).catch(askOpenNear); else askOpenNear();
      }).catch(askOpenNear);
    } else askOpenNear();
  }).catch(function () {});
})();
