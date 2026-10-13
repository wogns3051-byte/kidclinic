/* 아이아플때 — 우리아이(해열제 기록·응급 카드) + 작은 기능(지금 열린 곳·연휴 안내·큰 글씨·공유)
 * 모든 기록은 이 휴대폰(브라우저) 안에만 저장되고 어디에도 보내지 않는다.
 * app.js 가 window.KC 로 넘겨준 도구(api, show, toast 등)를 쓴다.
 */
(function () {
  'use strict';
  var K = window.KC;
  if (!K) return;
  var $ = K.$, $$ = K.$$, esc = K.esc, load = K.load, save = K.save, toast = K.toast;

  var pane = load('kidPane', 'med');
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
  K.privNote = privNote; K.confirmShare = function (w) { return confirmShare(w); };
  function confirmShare(what) {
    return confirm(what + '에는 아이 이름·생년월일 같은 개인정보가 들어 있어요.\n받는 사람을 꼭 확인하고 보내 주세요.\n\n계속할까요?');
  }

  // ───── 아이 목록 ─────
  function kids() { return load('kids', { list: [], cur: '' }); }
  function saveKids(k) { save('kids', k); }
  function curKid() { var k = kids(); return k.list.filter(function (x) { return x.id === k.cur; })[0] || k.list[0] || null; }
  K.curKid = curKid; K.kids = kids; K.saveKids = saveKids;
  K.ageText = function (b) { return ageText(b); };
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
  // 아이 고르기 줄은 우리아이 탭 위에 하나만 둔다 (모든 메뉴가 같은 아이 목록을 쓴다)
  function kidPicker() { return ''; }
  function renderBar() {
    var bar = $('#kid-bar'); if (!bar) return;
    var k = kids(), kid = curKid();
    if (!k.list.length || pane === 'bn') { bar.hidden = true; bar.innerHTML = ''; return; }
    bar.hidden = false;
    bar.innerHTML = '<div class="kid-pick">' + k.list.map(function (x) {
      return '<button class="chip' + (kid && x.id === kid.id ? ' on' : '') + '" data-kid="' + x.id + '">' + esc(x.name || '아이') + '</button>';
    }).join('') + '<button class="chip add" data-kid-add="bar">+ 아이 추가</button></div>' +
      '<div class="kid-bar-hint">' + (k.list.length > 1 ? '고른 아이 기준으로 모든 메뉴가 바뀌어요' : '한 번 추가하면 해열제·진료·응급카드·일정·성장에 모두 같이 쓰여요') + '</div>';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-kid]');
    if (b) { var k = kids(); k.cur = b.dataset.kid; saveKids(k); showPane(pane); return; }
    var a = e.target.closest && e.target.closest('[data-kid-add]');
    if (a) {
      var name = (prompt('아이 이름(또는 별명)을 적어 주세요\n(이 휴대폰에만 저장돼요. 별명도 괜찮아요)') || '').trim();
      if (!name) return;
      var k2 = kids(), id = uid();
      k2.list.push({ id: id, name: name.slice(0, 12) }); k2.cur = id; saveKids(k2);
      showPane(pane);
      toast(k2.list.length > 1 ? '추가했어요. 위에서 아이를 바꿀 수 있어요' : '추가했어요. 생일을 응급 카드에 넣어 두면 나이에 맞는 안내가 나와요');
    }
  });

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
  K.HOMECARE = HOMECARE; K.DRUGS = DRUGS;
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
  K.kidLogs = function (id) { return logs(id); };
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
        html += '<div class="med-next">같은 약은 <b>' + hm(next) + '</b> 이후 (' + (mins >= 60 ? Math.floor(mins / 60) + '시간 ' : '') + (mins % 60) + '분 뒤)</div>' +
          '<div class="med-alarm"><button class="chip" data-med-alarm="' + key + '" data-at="' + next + '">⏰ ' + hm(next) + ' 캘린더 알림</button><a href="#" data-med-gcal="' + key + '" data-at="' + next + '">구글 캘린더</a></div>';
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
    $$('#kid-med [data-med-alarm]').forEach(function (b) {
      b.addEventListener('click', function () { var who = askCalName(kid); if (who) medIcs(who, b.dataset.medAlarm, +b.dataset.at); });
    });
    $$('#kid-med [data-med-gcal]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault(); var who = askCalName(kid); if (!who) return;
        var at = +a.dataset.at, f = function (t) { return new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z'); };
        window.open('https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent('[' + who + '] 해열제 먹일 수 있는 시각 (' + DRUGS[a.dataset.medGcal].name + ')') +
          '&dates=' + f(at) + '/' + f(at + 600000) + '&details=' + encodeURIComponent('열이 없거나 아이가 편하게 자면 꼭 먹이지 않아도 돼요.\n- 아이아플때'), '_blank', 'noopener');
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
        saveKids(k); editing = false; toast('저장했어요'); showPane('card');
      });
      $('#card-del').addEventListener('click', function () {
        if (!confirm(kid.name + '의 카드와 해열제·처방약·진료·일정·성장 기록을 모두 지울까요?')) return;
        var k = kids(); k.list = k.list.filter(function (x) { return x.id !== kid.id; }); k.cur = k.list[0] ? k.list[0].id : '';
        saveKids(k); try { ['kidlog:', 'kiddone:', 'kidgrow:', 'kidrx:', 'kidvisit:'].forEach(function (p) { localStorage.removeItem(p + kid.id); }); } catch (e) {} editing = false; showPane('card');
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
      '<button class="btn soft lock-open" id="card-lock">📱 잠금화면 이미지 만들기</button>' +
      '<div id="lock-box"></div>' +
      '<div class="note pad">응급실·119에서 이 화면을 그대로 보여 주세요.</div>' + privNote('kid');
    $('#card-edit').addEventListener('click', function () { editing = true; renderCard(); });
    $('#card-lock').addEventListener('click', function () { lockForm(kid); });
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


  // ───── 📱 응급 카드 → 잠금화면 이미지 (휴대폰 안에서만 그림을 만든다) ─────
  var LOCK_FIELDS = [
    ['age', '이름·나이', true], ['birth', '생년월일', false], ['allergy', '알레르기', true], ['meds', '먹는 약', true],
    ['conditions', '병력', true], ['blood', '혈액형', true], ['weight', '몸무게', false], ['hospital', '다니는 병원', false], ['guardian', '보호자 연락처', true]
  ];
  function lockForm(kid) {
    var box = $('#lock-box');
    if (box.innerHTML) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="lock-form"><div class="lock-h">잠금화면에 넣을 내용</div>' +
      '<div class="lock-warn">⚠️ 잠금화면은 휴대폰을 열지 않아도 <b>누구나 볼 수 있어요</b>. 꼭 필요한 것만 골라 주세요.</div>' +
      '<div class="lock-chk">' + LOCK_FIELDS.map(function (f) {
        var has = f[0] === 'age' || f[0] === 'allergy' || kid[f[0]];
        return '<label' + (has ? '' : ' class="off"') + '><input type="checkbox" data-lf="' + f[0] + '"' + (f[2] && has ? ' checked' : '') + (f[0] === 'age' ? ' checked disabled' : '') + (has ? '' : ' disabled') + '> ' + f[1] + (has ? '' : ' <small>(카드에 없음)</small>') + '</label>';
      }).join('') + '</div>' +
      '<div class="lock-theme"><span>배경</span>' + ['pink', 'sky', 'mint', 'night'].map(function (t, i) { return '<button class="lt lt-' + t + (i === 0 ? ' on' : '') + '" data-lt="' + t + '" aria-label="' + t + '"></button>'; }).join('') + '</div>' +
      '<button class="btn" id="lock-make">이미지 만들기</button>' +
      '<div class="priv">🔒 이미지는 이 휴대폰 안에서만 만들어지고 어디에도 보내지 않아요. 저장한 사진이 클라우드(구글 포토·아이클라우드)와 동기화되면 그곳에도 저장돼요.</div></div>';
    var theme = 'pink';
    $$('#lock-box [data-lt]').forEach(function (b) { b.addEventListener('click', function () { theme = b.dataset.lt; $$('#lock-box [data-lt]').forEach(function (x) { x.classList.toggle('on', x === b); }); }); });
    $('#lock-make').addEventListener('click', function () {
      var pick = {}; $$('#lock-box [data-lf]').forEach(function (c) { pick[c.dataset.lf] = c.checked; });
      var go = function () { lockResult(kid, drawLock(kid, pick, theme)); };
      if (document.fonts && document.fonts.load) document.fonts.load('40px Jua', '아이').then(go, go); else go();
    });
  }
  var LOCK_THEMES = {
    pink: { bg: ['#FFE9F0', '#F1EEFF'], ink: '#2B3150', sub: '#7A7F99', dot: '#FFB3C7' },
    sky: { bg: ['#E3F1FF', '#F4F5FF'], ink: '#2B3150', sub: '#6F7894', dot: '#9CC8FF' },
    mint: { bg: ['#E2F6EF', '#FFF8E1'], ink: '#22413A', sub: '#62786F', dot: '#9ADBC5' },
    night: { bg: ['#1E2456', '#3A3F86'], ink: '#FFFFFF', sub: '#C5C8EE', dot: '#FFD166' }
  };
  function wrapLines(ctx, text, maxW) {
    var out = [];
    String(text).split(/\n/).forEach(function (para) {
      var line = '';
      Array.from(para).forEach(function (ch) {
        if (ctx.measureText(line + ch).width > maxW && line) { out.push(line); line = ch.trim() ? ch : ''; } else line += ch;
      });
      out.push(line);
    });
    return out;
  }
  K.wrapLines = function (c, t, w) { return wrapLines(c, t, w); };
  K.roundRect = function (c, x, y, w, h, r) { roundRect(c, x, y, w, h, r); };
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function drawLock(kid, pick, theme) {
    var Th = LOCK_THEMES[theme] || LOCK_THEMES.pink;
    var W = 1170, H = 2532, c = document.createElement('canvas'); c.width = W; c.height = H;
    var ctx = c.getContext('2d');
    var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, Th.bg[0]); g.addColorStop(1, Th.bg[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 작은 점 무늬 (귀엽게)
    ctx.fillStyle = Th.dot; ctx.globalAlpha = theme === 'night' ? 0.55 : 0.35;
    for (var i = 0; i < 46; i++) { var px = (i * 263) % W, py = 120 + ((i * 397) % (H - 240)); ctx.beginPath(); ctx.arc(px, py, 6 + (i % 4) * 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    var SANS = '"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif', DISP = 'Jua,' + SANS;
    var rows = [];
    if (pick.birth && kid.birth) rows.push(['생년월일', kid.birth]);
    rows.push(['알레르기', kid.allergy || '없음 / 모름', !!kid.allergy]);
    if (pick.meds && kid.meds) rows.push(['먹는 약', kid.meds]);
    if (pick.conditions && kid.conditions) rows.push(['병력', kid.conditions]);
    if (pick.blood && kid.blood) rows.push(['혈액형', kid.blood]);
    if (pick.weight && kid.weight) rows.push(['몸무게', kid.weight + 'kg' + (kid.weightAt ? ' (' + kid.weightAt + ')' : '')]);
    if (pick.hospital && kid.hospital) rows.push(['다니는 병원', kid.hospital]);
    if (pick.guardian && kid.guardian) rows.push(['보호자', kid.guardian]);
    if (!pick.allergy) rows = rows.filter(function (r) { return r[0] !== '알레르기'; });
    // 카드 크기: 위 40%는 시계 자리로 비워 둔다
    var CX = 90, CW = W - 180, top = 1010, pad = 56, maxBottom = H - 230;
    var fs = 50, layout;
    for (; fs >= 30; fs -= 2) {
      var y = 0; layout = [];
      ctx.font = '700 ' + fs + 'px ' + SANS;
      rows.forEach(function (r) {
        var lines = wrapLines(ctx, r[1], CW - pad * 2);
        layout.push({ r: r, lines: lines, y: y });
        y += fs * 0.62 + 18 + lines.length * fs * 1.3 + 30;
      });
      if (top + 190 + y + 40 <= maxBottom) break;
    }
    var bodyH = layout.length ? layout[layout.length - 1].y + 18 + fs * 0.62 + layout[layout.length - 1].lines.length * fs * 1.3 + 30 : 0;
    var CH = 190 + bodyH + 30;
    ctx.save(); ctx.shadowColor = 'rgba(40,40,90,.18)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 16;
    ctx.fillStyle = '#FFFFFF'; roundRect(ctx, CX, top, CW, CH, 56); ctx.fill(); ctx.restore();
    // 머리띠
    ctx.save(); roundRect(ctx, CX, top, CW, CH, 56); ctx.clip();
    ctx.fillStyle = '#E8475F'; ctx.fillRect(CX, top, CW, 92);
    ctx.restore();
    ctx.fillStyle = '#FFFFFF'; ctx.font = '44px ' + DISP; ctx.textBaseline = 'middle';
    ctx.fillText('✚ 응급 정보 · EMERGENCY', CX + pad, top + 48);
    ctx.fillStyle = '#2B3150'; ctx.font = '72px ' + DISP; ctx.textBaseline = 'alphabetic';
    var nm = kid.name || '아이'; ctx.fillText(nm, CX + pad, top + 172);
    var nw = ctx.measureText(nm).width;
    ctx.fillStyle = '#7A7F99'; ctx.font = '600 40px ' + SANS; ctx.fillText(ageText(kid.birth), CX + pad + nw + 22, top + 168);
    var by = top + 190;
    ctx.strokeStyle = '#EEF0F7'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(CX + pad, by); ctx.lineTo(CX + CW - pad, by); ctx.stroke();
    layout.forEach(function (it) {
      var y0 = by + 30 + it.y, danger = it.r[2];
      if (danger) { ctx.fillStyle = '#FFECEF'; roundRect(ctx, CX + pad - 22, y0 - 14, CW - pad * 2 + 44, fs * 0.62 + 18 + it.lines.length * fs * 1.3 + 22, 26); ctx.fill(); }
      ctx.fillStyle = danger ? '#D2334C' : '#8A8FA8'; ctx.font = '700 ' + Math.round(fs * 0.62) + 'px ' + SANS; ctx.textBaseline = 'top';
      ctx.fillText((danger ? '⚠ ' : '') + it.r[0], CX + pad, y0);
      ctx.fillStyle = danger ? '#B0182F' : '#2B3150'; ctx.font = '700 ' + fs + 'px ' + SANS;
      it.lines.forEach(function (ln, k) { ctx.fillText(ln, CX + pad, y0 + fs * 0.62 + 18 + k * fs * 1.3); });
    });
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
    ctx.fillStyle = Th.sub; ctx.font = '600 34px ' + SANS;
    ctx.fillText('위급하면 119 · 아이아플때', W / 2, Math.min(H - 150, top + CH + 90));
    ctx.textAlign = 'left';
    return c;
  }
  function lockResult(kid, canvas) {
    var box = $('#lock-box');
    var old = $('#lock-out'); if (old) old.remove();
    canvas.toBlob(function (blob) {
      if (!blob) { toast('이미지를 만들지 못했어요'); return; }
      var url = URL.createObjectURL(blob), name = (kid.name || 'kid') + '-응급카드-잠금화면.png';
      var file = null; try { file = new File([blob], name, { type: 'image/png' }); } catch (e) {}
      var canShare = file && navigator.canShare && navigator.canShare({ files: [file] });
      var out = document.createElement('div'); out.id = 'lock-out'; out.className = 'lock-out';
      out.innerHTML = '<img src="' + url + '" alt="잠금화면용 응급 카드 이미지">' +
        '<div class="actions">' + (canShare ? '<button class="btn" id="lock-share">📥 사진으로 저장</button>' : '') +
        '<a class="btn' + (canShare ? ' ghost' : '') + '" href="' + url + '" download="' + esc(name) + '">⬇️ 내려받기</a></div>' +
        '<div class="lock-how"><b>잠금화면으로 설정하는 방법</b>' +
        '<div>📱 <b>아이폰</b>: 저장 → 사진 앱에서 이미지 열기 → 공유(□↑) → "배경화면으로 사용" → 잠금 화면</div>' +
        '<div>🤖 <b>안드로이드</b>: 저장 → 갤러리에서 이미지 열기 → ⋮ → "배경화면으로 설정" → 잠금화면</div>' +
        '<div class="muted-s">이미지를 길게 눌러 저장할 수도 있어요. 카드 내용을 고치면 이미지도 다시 만들어 주세요.</div></div>';
      box.appendChild(out);
      var sb = $('#lock-share');
      if (sb) sb.addEventListener('click', function () { navigator.share({ files: [file], title: name }).catch(function () {}); });
      out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 'image/png');
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
    // 독감: 생후 6개월 ~ 14세 (2026-2027절기부터 14세까지 무료), 9월 하순 ~ 다음 해 4월 (처음 맞는 해는 4주 간격 2회)
    var from = addSpan(kid.birth, 'm6'), by = +kid.birth.slice(0, 4), y = from.getFullYear(), first = true;
    if (from.getMonth() < 4) y--; // 1~4월에 6개월이 되면 지난해 절기부터
    for (; y - by <= 14; y++) {
      var s = new Date(y, 8, 21), e = new Date(y + 1, 3, 30);
      if (e < from) continue;
      if (s < from) s = from;
      list.push({ id: 'flu' + y, c: 'flu', n: y + '~' + String(y + 1).slice(2) + ' 절기 어린이 독감 접종' + (first ? ' (1차)' : ''), s: s, e: e,
        note: first ? '처음 맞는 해에는 4주 간격으로 2회 맞아요. 시작 날짜는 해마다 공지돼요' : '매년 1회. 시작 날짜는 해마다 공지돼요' });
      var fd = first && doneDate(dn['flu' + y]);
      if (fd) {
        list.push({ id: 'flu' + y + 'b', c: 'flu', n: y + '~' + String(y + 1).slice(2) + ' 절기 어린이 독감 접종 (2차)', s: addSpan(fd, 'd28'), e: addSpan(fd, 'd56'),
          note: '1차(' + fd.replace(/-/g, '.') + ') 4주 뒤에 맞아요' });
      }
      first = false;
    }
    return list.sort(function (a, b) { return a.s - b.s; });
  }
  function done(kid) { return load('kiddone:' + kid.id, {}); }
  // 오늘의 우리아이 카드용: 지금 할 때인데 아직 체크 안 한 접종·검진
  K.schedNow = function (kid) {
    if (!kid || !kid.birth) return [];
    var dn = done(kid), t = new Date(); t.setHours(0, 0, 0, 0);
    return schedFor(kid).filter(function (x) { return !dn[x.id] && x.s <= t && x.e >= t; }).map(function (x) { return { n: x.n, c: x.c, e: x.e, icon: CAT[x.c].icon }; });
  };
  function gcalLink(kid, x, who) {
    var e1 = new Date(x.e.getTime() + 86400000);
    var f = function (d) { return ymd(d).replace(/-/g, ''); };
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent('[' + who + '] ' + x.n) +
      '&dates=' + f(x.s) + '/' + f(e1) + '&details=' + encodeURIComponent((x.note ? x.note + '\n' : '') + '기간: ' + kdate(x.s) + ' ~ ' + kdate(x.e) + '\n확인: ' + CAT[x.c].link + '\n- 아이아플때');
  }
  // ───── 🐰 칭찬 스티커판 (완료한 접종·검진마다 동물 도장) ─────
  var ANIMALS = ['🐰', '🐻', '🐥', '🐶', '🐱', '🦊', '🐼', '🐨', '🐯', '🐷', '🐸', '🐹', '🦁', '🐮', '🐳', '🦄'];
  var STICKER_BG = ['#FFE3EC', '#FFF1C9', '#E3F6EE', '#E6E8FF', '#FFE6D6', '#E0F3FF'];
  var newSticker = '';
  function animalOf(id) { var i = SCHED.map(function (x) { return x.id; }).indexOf(id); if (i < 0) i = id.length; return { a: ANIMALS[i % ANIMALS.length], bg: STICKER_BG[i % STICKER_BG.length] }; }
  function stickerBoard(all, dn, today) {
    var list = all.filter(function (x) { return x.c !== 'flu'; });
    var got = list.filter(function (x) { return dn[x.id]; });
    var due = list.filter(function (x) { return !dn[x.id] && x.s <= today; });
    var nextOne = list.filter(function (x) { return !dn[x.id] && x.s > today; })[0];
    var slots = list.filter(function (x) { return dn[x.id] || x.s <= today; });
    if (nextOne) slots.push(nextOne);
    if (!slots.length) return '';
    var html = '<div class="stk"><div class="stk-h"><span>칭찬 스티커판</span><b>' + got.length + '개 모았어요</b></div><div class="stk-grid">' +
      slots.map(function (x) {
        var A = animalOf(x.id), isGot = !!dn[x.id];
        if (isGot) return '<div class="stk-s got' + (x.id === newSticker ? ' pop' : '') + '" style="--sb:' + A.bg + '" title="' + esc(x.n) + '"><i>' + A.a + '</i><small>' + esc(x.n.replace(/ 접종$/, '').replace('영유아 ', '')) + '</small></div>';
        return '<div class="stk-s ' + (x === nextOne ? 'next' : 'empty') + '" title="' + esc(x.n) + '"><i>' + (x === nextOne ? '🎁' : '?') + '</i><small>' + esc(x.n.replace(/ 접종$/, '').replace('영유아 ', '')) + '</small></div>';
      }).join('') + '</div>' +
      '<div class="stk-f">' + (due.length ? '체크하면 스티커가 찍혀요 · 받을 수 있는 스티커 ' + due.length + '개' :
        nextOne ? '다음 스티커 🎁 ' + esc(nextOne.n) + ' · ' + Math.max(1, Math.ceil((nextOne.s - today) / 86400000)) + '일 뒤부터' : '모든 스티커를 모았어요! 🎉') + '</div></div>';
    newSticker = '';
    return html;
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
      stickerBoard(all, dn, today) +
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
          if (x && x.c !== 'flu') { newSticker = id; toast(animalOf(id).a + ' 칭찬 스티커를 받았어요! 잘했어요'); }
        } else delete d2[id];
        save('kiddone:' + kid.id, d2); renderSched();
        if (newSticker === '' && c.checked) { var st = $('#kid-sched .stk'); if (st) st.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
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
  function icsEsc(t) { return String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
  // 해열제: 다음에 먹일 수 있는 시각에 울리는 캘린더 일정 1개
  function medIcs(who, key, at) {
    var f = function (t) { return new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z'); };
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//aiapulttae//med//KO', 'METHOD:PUBLISH',
      'BEGIN:VEVENT', 'UID:med-' + at + '@aiapulttae', 'DTSTAMP:' + f(Date.now()), 'DTSTART:' + f(at), 'DTEND:' + f(at + 600000),
      'SUMMARY:' + icsEsc('[' + who + '] 💊 해열제 먹일 수 있는 시각 (' + DRUGS[key].name + ')'),
      'DESCRIPTION:' + icsEsc('같은 계열 약을 다시 먹일 수 있는 간격이 지났어요. 열이 없거나 아이가 편하게 자면 꼭 먹이지 않아도 돼요.\n- 아이아플때'),
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc('해열제 먹일 수 있는 시각'), 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'];
    var blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'aiapulttae-med-' + hm(at).replace(':', '') + '.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
    toast(hm(at) + ' 알림 파일을 만들었어요. 열어서 캘린더에 추가하세요');
  }
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
  var BK_KEYS = /^(kids|kidlog:.+|kiddone:.+|kidgrow:.+|kidrx:.+|kidvisit:.+|lang|favs|hmemo|region|home|bigFont|kidPane)$/;
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

  // ───── 📏 키·몸무게 성장 기록 ─────
  // 또래 비교: WHO 아동 성장 기준(0~60개월). 우리나라 2017 성장도표도 만 3세 미만은 WHO 기준을 그대로 쓴다.
  function grows(id) { return load('kidgrow:' + id, []); }
  function ageMonthsAt(birth, ymdStr) {
    var b = new Date(birth + 'T00:00:00'), d = new Date(ymdStr + 'T00:00:00');
    return (d - b) / 86400000 / 30.4375;
  }
  function lmsAt(key, m) {
    var T = window.KC_GROW && window.KC_GROW[key];
    if (!T || m < 0 || m > 60) return null;
    var i = Math.min(59, Math.floor(m)), f = m - i, a = T[i], b = T[i + 1];
    if (key[0] === 'h' && i === 23) b = [b[0], b[1] + 0.7, b[2]]; // 24개월: 누운 키 기준으로 이어 붙임
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }
  function zOf(lms, x) { var L = lms[0], M = lms[1], S = lms[2]; return Math.abs(L) < 1e-6 ? Math.log(x / M) / S : (Math.pow(x / M, L) - 1) / (L * S); }
  function xOf(lms, z) { var L = lms[0], M = lms[1], S = lms[2]; return Math.abs(L) < 1e-6 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L); }
  function cdf(z) { var t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2); var p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; }
  var PZ = { 3: -1.8808, 15: -1.0364, 50: 0, 85: 1.0364, 97: 1.8808 };
  function pctText(kind, p) {
    var word = kind === 'h' ? '커요' : '무거워요';
    if (p < 3) return '<b>백분위 3 미만</b> · 또래보다 많이 ' + (kind === 'h' ? '작은' : '가벼운') + ' 편이에요';
    if (p > 97) return '<b>백분위 97 초과</b> · 또래보다 많이 ' + (kind === 'h' ? '큰' : '무거운') + ' 편이에요';
    return '<b>백분위 ' + Math.round(p) + '</b> · 또래 100명 중 <b>' + Math.max(1, 100 - Math.round(p)) + '번째</b>로 ' + word;
  }
  function growChart(kid, recs, kind) {
    var key = kind + (kid.sex === 'f' ? 'g' : 'b');
    var pts = recs.filter(function (r) { return r[kind]; }).map(function (r) { return { m: ageMonthsAt(kid.birth, r.d), v: +r[kind] }; }).filter(function (p) { return p.m >= 0 && p.m <= 60; });
    if (!pts.length) return '';
    var mn = Math.min.apply(null, pts.map(function (p) { return p.m; })), mx = Math.max.apply(null, pts.map(function (p) { return p.m; }));
    var a0 = Math.max(0, Math.floor(mn) - 3), a1 = Math.min(60, Math.ceil(mx) + 3);
    if (a1 - a0 < 12) { a1 = Math.min(60, a0 + 12); a0 = Math.max(0, a1 - 12); }
    var curve = function (pc) { var out = []; for (var m = a0; m <= a1 + 1e-9; m += 0.5) { var l = lmsAt(key, m); if (l) out.push({ m: m, v: xOf(l, PZ[pc]) }); } return out; };
    var c3 = curve(3), c15 = curve(15), c50 = curve(50), c85 = curve(85), c97 = curve(97);
    var all = c3.concat(c97).map(function (p) { return p.v; }).concat(pts.map(function (p) { return p.v; }));
    var lo = Math.floor(Math.min.apply(null, all)), hi = Math.ceil(Math.max.apply(null, all));
    var W = 340, H = 190, L = 34, R = 34, T = 10, B = 24;
    var X = function (m) { return L + (W - L - R) * (m - a0) / (a1 - a0); }, Y = function (v) { return T + (H - T - B) * (hi - v) / (hi - lo); };
    var path = function (arr) { return arr.map(function (p, i) { return (i ? 'L' : 'M') + X(p.m).toFixed(1) + ' ' + Y(p.v).toFixed(1); }).join(''); };
    var band = function (a, b) { return path(a) + b.slice().reverse().map(function (p) { return 'L' + X(p.m).toFixed(1) + ' ' + Y(p.v).toFixed(1); }).join('') + 'Z'; };
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="gchart ' + kind + '" role="img" aria-label="' + (kind === 'h' ? '키' : '몸무게') + ' 성장 그래프">';
    var step = (hi - lo) > 30 ? 10 : (hi - lo) > 12 ? 5 : (hi - lo) > 6 ? 2 : 1;
    for (var v = Math.ceil(lo / step) * step; v <= hi; v += step) svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" class="g-grid"/><text x="' + (L - 4) + '" y="' + (Y(v) + 4) + '" class="g-ax" text-anchor="end">' + v + '</text>';
    var mstep = (a1 - a0) > 30 ? 12 : (a1 - a0) > 14 ? 6 : 3;
    for (var m = Math.ceil(a0 / mstep) * mstep; m <= a1; m += mstep) svg += '<text x="' + X(m) + '" y="' + (H - 6) + '" class="g-ax" text-anchor="middle">' + (m % 12 === 0 && m ? (m / 12) + '세' : m + '개월') + '</text>';
    svg += '<path d="' + band(c3, c97) + '" class="g-b1"/><path d="' + band(c15, c85) + '" class="g-b2"/><path d="' + path(c50) + '" class="g-50"/>';
    [[c97, '97'], [c50, '50'], [c3, '3']].forEach(function (x) { var p = x[0][x[0].length - 1]; svg += '<text x="' + (W - R + 3) + '" y="' + (Y(p.v) + 4) + '" class="g-pl">' + x[1] + '</text>'; });
    pts.sort(function (a, b) { return a.m - b.m; });
    if (pts.length > 1) svg += '<path d="' + path(pts) + '" class="g-line"/>';
    pts.forEach(function (p) { svg += '<circle cx="' + X(p.m).toFixed(1) + '" cy="' + Y(p.v).toFixed(1) + '" r="5" class="g-dot"/>'; });
    return '<div class="g-box"><div class="g-h">' + (kind === 'h' ? '📏 키 (cm)' : '⚖️ 몸무게 (kg)') + ' <span>가운데 진한 선 = 또래 평균(50) · 색 띠 = 100명 중 가운데 70명</span></div>' + svg + '</div>';
  }
  function renderGrow() {
    var box = $('#kid-grow'); if (!box) return;
    var kid = curKid();
    if (!kid) {
      box.innerHTML = '<div class="kid-empty"><b>키·몸무게 성장 기록</b>키와 몸무게를 적어 두면 또래와 비교한 그래프로 보여 드려요. 영유아 검진 갈 때도 도움이 돼요.' +
        '<button class="btn" data-kid-add="grow">+ 아이 추가</button></div>' + privNote('kid');
      return;
    }
    var recs = grows(kid.id).slice().sort(function (a, b) { return a.d < b.d ? 1 : -1; });
    var today = ymd(new Date());
    var am = kid.birth ? ageMonths(kid.birth) : null;
    var canCmp = kid.birth && kid.sex && am !== null && am <= 60;
    var head = kidPicker(kid, 'grow') + '<div class="sc-head">' + esc(kid.name) + (kid.birth ? ' · ' + ageText(kid.birth) : '') + '</div>';
    var sexRow = '<div class="g-sex"><span>또래 비교 기준</span><div class="seg mini">' +
      '<button data-sex="m" class="' + (kid.sex === 'm' ? 'on' : '') + '">👦 남아</button><button data-sex="f" class="' + (kid.sex === 'f' ? 'on' : '') + '">👧 여아</button></div></div>';
    var latest = '';
    if (recs.length) {
      var r = recs[0], m0 = kid.birth ? ageMonthsAt(kid.birth, r.d) : null;
      var line = function (kind, v, unit) {
        if (!v) return '';
        var lms = canCmp && m0 !== null && m0 >= 0 && m0 <= 60 ? lmsAt(kind + (kid.sex === 'f' ? 'g' : 'b'), m0) : null;
        return '<div class="g-now ' + kind + '"><i>' + (kind === 'h' ? '📏' : '⚖️') + '</i><div><div class="g-v">' + v + unit + '</div>' +
          (lms ? '<div class="g-p">' + pctText(kind, cdf(zOf(lms, +v)) * 100) + '</div>' : '') + '</div></div>';
      };
      latest = '<div class="g-latest"><div class="g-lh">' + r.d.replace(/-/g, '.') + ' 기록</div>' + line('h', r.h, 'cm') + line('w', r.w, 'kg') + '</div>';
    }
    var note = !kid.birth ? '<div class="g-tip">응급 카드에 생년월일을 넣으면 또래와 비교해 드려요.</div>' :
      !kid.sex ? '<div class="g-tip">위에서 남아·여아를 고르면 또래와 비교해 드려요.</div>' :
      am > 60 ? '<div class="g-tip">만 5세가 넘으면 이 화면에서는 기록만 해요. 또래 비교는 영유아 검진 결과지나 질병관리청 「2017 소아청소년 성장도표」를 참고하세요.</div>' : '';
    box.innerHTML = head + sexRow + latest + note +
      (canCmp ? growChart(kid, recs, 'h') + growChart(kid, recs, 'w') : '') +
      '<div class="g-form"><div class="g-fh">새로 재기</div>' +
        '<label>날짜<input type="date" id="g-d" value="' + today + '" max="' + today + '"></label>' +
        '<div class="g-two"><label>키 (cm)<input type="number" id="g-h" step="0.1" inputmode="decimal" placeholder="예: 86.5"></label>' +
        '<label>몸무게 (kg)<input type="number" id="g-w" step="0.1" inputmode="decimal" placeholder="예: 12.3"></label></div>' +
        '<button class="btn" id="g-save">기록하기</button>' +
        '<div class="muted-s">만 2세 전에는 누워서 잰 키, 2세부터는 서서 잰 키로 비교해요. 하나만 적어도 괜찮아요.</div></div>' +
      (recs.length ? '<h3 class="bn-h">지난 기록</h3><ul class="g-list">' + recs.map(function (r) {
        return '<li><span>' + r.d.replace(/-/g, '.') + (kid.birth ? ' <small>' + (function (m) { m = Math.floor(m); return m < 24 ? m + '개월' : Math.floor(m / 12) + '세 ' + (m % 12) + '개월'; })(ageMonthsAt(kid.birth, r.d)) + '</small>' : '') + '</span>' +
          '<b>' + (r.h ? r.h + 'cm' : '') + (r.h && r.w ? ' · ' : '') + (r.w ? r.w + 'kg' : '') + '</b><button class="del" data-gdel="' + r.d + '" aria-label="지우기">✕</button></li>';
      }).join('') + '</ul>' : '') +
      '<div class="note pad">또래 비교는 참고용이에요. 한 번 잰 값보다 꾸준히 자라는 흐름이 더 중요해요. 걱정되면 소아과나 영유아 검진 때 상의하세요.<br>기준: WHO 아동 성장 기준(0~5세). 우리나라 2017 소아청소년 성장도표도 만 3세 미만은 이 기준을 써요. 만 3~5세는 국내 도표와 조금 다를 수 있어요.</div>' +
      privNote('kid');
    $$('#kid-grow [data-sex]').forEach(function (b) {
      b.addEventListener('click', function () { var k = kids(), me = k.list.filter(function (x) { return x.id === kid.id; })[0]; me.sex = b.dataset.sex; saveKids(k); renderGrow(); });
    });
    $('#g-save').addEventListener('click', function () {
      var d = $('#g-d').value || today, h = parseFloat($('#g-h').value), w = parseFloat($('#g-w').value);
      if (d > today) { toast('오늘 이후 날짜는 안 돼요'); return; }
      if (!(h > 0) && !(w > 0)) { toast('키나 몸무게를 하나 이상 적어 주세요'); return; }
      if (h && (h < 30 || h > 200)) { toast('키를 cm로 적어 주세요 (예: 86.5)'); return; }
      if (w && (w < 1 || w > 150)) { toast('몸무게를 kg로 적어 주세요 (예: 12.3)'); return; }
      var l = grows(kid.id).filter(function (x) { return x.d !== d; });
      var prev = grows(kid.id).filter(function (x) { return x.d === d; })[0] || {};
      l.push({ d: d, h: h > 0 ? Math.round(h * 10) / 10 : prev.h, w: w > 0 ? Math.round(w * 10) / 10 : prev.w });
      l.sort(function (a, b) { return a.d < b.d ? -1 : 1; });
      save('kidgrow:' + kid.id, l.slice(-200));
      var last = l[l.length - 1];
      if (w > 0 && last.d === d) { var k = kids(), me = k.list.filter(function (x) { return x.id === kid.id; })[0]; me.weight = String(last.w); me.weightAt = d; saveKids(k); }
      toast('기록했어요' + (w > 0 && last.d === d ? ' · 응급 카드 몸무게도 바꿨어요' : '')); renderGrow();
    });
    $$('#kid-grow [data-gdel]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!confirm(b.dataset.gdel + ' 기록을 지울까요?')) return;
        save('kidgrow:' + kid.id, grows(kid.id).filter(function (x) { return x.d !== b.dataset.gdel; })); renderGrow();
      });
    });
  }

  // ───── 우리아이 탭 안 전환 ─────
  function showPane(k) {
    pane = k; save('kidPane', k);
    $$('#kid-seg button').forEach(function (b) { b.classList.toggle('on', b.dataset.k === k); });
    ['med', 'care', 'card', 'sched', 'grow'].forEach(function (x) { var el = $('#kid-' + x); if (el) el.hidden = k !== x; });
    $('#benefit-body').hidden = k !== 'bn';
    renderBar();
    if (K.renderToday) setTimeout(K.renderToday, 0);
    if (k === 'med') renderMed(); else if (k === 'care') { if (K.renderCare) K.renderCare(); } else if (k === 'card') renderCard(); else if (k === 'sched') renderSched(); else if (k === 'grow') renderGrow(); else K.loadBenefit();
  }
  $$('#kid-seg button').forEach(function (b) { b.addEventListener('click', function () { showPane(b.dataset.k); }); });
  K.onShow.benefit = function (opt) { showPane(opt && opt.pane ? opt.pane : pane); };
  K.showPane = function (k) { showPane(k); };
  if (K.FEEDBACK_URL) $$('.kid-fb').forEach(function (b) { b.hidden = false; });
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
