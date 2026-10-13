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
  function render(where) { if (where === 'card') renderCard(); else renderMed(); }

  // ───── 해열제 기록 ─────
  // 최소 간격·하루 최대 횟수는 국내 어린이용 해열제 설명서의 일반적인 기준. 제품마다 다를 수 있어 설명서가 우선.
  var DRUGS = {
    acet: { name: '아세트아미노펜 계열', ex: '타이레놀·챔프 등', gapH: 4, maxDay: 5 },
    ibu: { name: '이부프로펜·덱시부프로펜 계열', ex: '부루펜·맥시부펜 등', gapH: 6, maxDay: 4 }
  };
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
      '</div>' +
      drugStatus(l, 'acet') + drugStatus(l, 'ibu') +
      '<div class="note pad">용량과 간격은 약 설명서와 약사 안내를 따라 주세요. 두 계열을 번갈아 먹이는 것은 의사·약사와 상의하세요.</div>' +
      '<h3 class="bn-h">최근 3일 기록</h3>' +
      (recent.length ? '<ul class="tl">' + recent.map(function (x) {
        var label = x.type === 'temp' ? '🌡 ' + x.v.toFixed(1) + '℃' : '💊 ' + DRUGS[x.type].name;
        return '<li class="' + (x.type === 'temp' && x.v >= 38 ? 'hot' : '') + '"><span class="tl-t">' + dayLabel(x.t) + ' ' + hm(x.t) + '</span><span class="tl-v">' + label + '</span><button class="tl-x" data-del="' + x.t + '" aria-label="지우기">✕</button></li>';
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
        return dayLabel(x.t) + ' ' + hm(x.t) + '  ' + (x.type === 'temp' ? '체온 ' + x.v.toFixed(1) + '℃' : DRUGS[x.type].name + ' 복용');
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

  // ───── 우리아이 탭 안 전환 ─────
  var pane = load('kidPane', 'med');
  function showPane(k) {
    pane = k; save('kidPane', k);
    $$('#kid-seg button').forEach(function (b) { b.classList.toggle('on', b.dataset.k === k); });
    $('#kid-med').hidden = k !== 'med'; $('#kid-card').hidden = k !== 'card'; $('#benefit-body').hidden = k !== 'bn';
    if (k === 'med') renderMed(); else if (k === 'card') renderCard(); else K.loadBenefit();
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
