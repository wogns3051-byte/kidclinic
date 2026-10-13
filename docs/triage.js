/* 아이아플때 — "어디로 가야 해요?" 안내
 * 진단이 아니라, 공개된 소아 응급 안내(병원 건강정보·보건복지부 안내)를 그대로 옮긴 참고용 체크리스트.
 * 위험 신호가 하나라도 있으면 더 급한 쪽으로 안내한다. 선택한 증상은 저장하지 않는다.
 * 기준을 바꿀 때는 아래 ITEMS 만 고치면 된다.
 */
(function () {
  'use strict';
  var K = window.KC; if (!K) return;
  var $ = K.$, $$ = K.$$, esc = K.esc;

  var ITEMS = [
    { g: 'r', id: 'r1', t: '숨쉬기 매우 힘들어함 · 입술이나 얼굴이 파래짐' },
    { g: 'r', id: 'r2', t: '깨워도 잘 안 깨거나, 축 늘어져 반응이 없음' },
    { g: 'r', id: 'r3', t: '경련이 5분 넘게 계속되거나, 멈춘 뒤에도 의식이 돌아오지 않음' },
    { g: 'r', id: 'r4', t: '얼굴·입술이 붓고 숨쉬기 힘들어함 (심한 알레르기)' },
    { g: 'o', id: 'o2', t: '경련이 있었음 (지금은 멈춤)' },
    { g: 'o', id: 'o3', t: '숨이 가쁨 · 개 짖는 듯한 기침과 숨 쉴 때 쌕쌕거림' },
    { g: 'o', id: 'o4', t: '소변이 크게 줄고 입안이 마름 · 울어도 눈물이 없음' },
    { g: 'o', id: 'o5', t: '피 섞인 변 · 녹색이나 피 섞인 구토 · 계속 토함' },
    { g: 'o', id: 'o6', t: '눈에 띄게 처지고 먹는 양이 크게 줄었음' },
    { g: 'o', id: 'o7', t: '머리를 다친 뒤 토하거나 처짐' },
    { g: 'o', id: 'o8', t: '배터리·자석·약 같은 것을 삼켰음' },
    { g: 'y', id: 'f', t: '38℃ 이상 열이 남' },
    { g: 'y', id: 'y1', t: '해열제를 먹여도 많이 힘들어함' },
    { g: 'y', id: 'y2', t: '귀가 아프거나, 아파서 잠을 못 잠' },
    { g: 'y', id: 'y3', t: '열이 3일 넘게 계속됨' }
  ];
  var GROUPS = { r: '가장 위험한 신호', o: '빨리 진료가 필요한 신호', y: '그 밖의 증상' };
  var SOURCES = '참고: 한양대학교병원 건강정보(2026.1), 보건복지부 아이안심톡 안내(2025.7) 등 공개 자료';

  var picked = {}, under3 = null;

  function kidAge() {
    var k = K.curKid && K.curKid();
    if (!k || !k.birth) return null;
    var b = new Date(k.birth + 'T00:00:00'), n = new Date();
    var m = (n.getFullYear() - b.getFullYear()) * 12 + (n.getMonth() - b.getMonth()) - (n.getDate() < b.getDate() ? 1 : 0);
    return { name: k.name, months: m };
  }
  function open() {
    picked = {};
    var a = kidAge();
    under3 = a ? a.months < 3 : null;
    $('#sheet-body').innerHTML = form(a);
    $('#sheet').hidden = false; $('#sheet-bg').hidden = false;
    $('#sheet').scrollTop = 0;
    bind();
  }
  function form(a) {
    var html = '<h2>어디로 가야 해요?</h2>' +
      '<div class="tg-sub">지금 아이에게 해당하는 것을 <b>모두</b> 눌러 주세요. 진단이 아니라 공개된 안내를 바탕으로 한 참고용이에요.</div>' +
      '<a class="tg-119" href="tel:119">📞 아이가 위급해 보이면 고르지 말고 바로 119</a>';
    html += '<div class="tg-age"><div class="tg-age-h">아이 나이</div>' +
      (a ? '<div class="tg-age-v">' + esc(a.name) + ' · ' + (a.months < 1 ? '생후 1개월 미만' : a.months + '개월') + ' (응급 카드 기준)</div>' : '') +
      '<div class="seg tg-seg"><button data-u3="1" class="' + (under3 === true ? 'on' : '') + '">생후 3개월 미만</button><button data-u3="0" class="' + (under3 === false ? 'on' : '') + '">3개월 이상</button></div></div>';
    ['r', 'o', 'y'].forEach(function (g) {
      html += '<div class="tg-gh tg-' + g + '">' + GROUPS[g] + '</div><div class="tg-list">' +
        ITEMS.filter(function (x) { return x.g === g; }).map(function (x) {
          return '<button class="tg-item tg-' + g + '" data-tg="' + x.id + '"><span class="tg-box"></span>' + esc(x.t) + '</button>';
        }).join('') + '</div>';
    });
    html += '<button class="btn tg-go" id="tg-go">결과 보기</button>' +
      '<div class="note">고른 증상은 저장하지 않아요. ' + SOURCES + '</div>';
    return html;
  }
  function bind() {
    $$('#sheet-body [data-tg]').forEach(function (b) {
      b.addEventListener('click', function () { b.classList.toggle('on'); picked[b.dataset.tg] = b.classList.contains('on'); });
    });
    $$('#sheet-body [data-u3]').forEach(function (b) {
      b.addEventListener('click', function () {
        under3 = b.dataset.u3 === '1';
        $$('#sheet-body [data-u3]').forEach(function (x) { x.classList.toggle('on', x === b); });
      });
    });
    $('#tg-go').addEventListener('click', result);
  }
  function isDaytimeClinic() {
    var n = K.kstNow(), db = K.db;
    var holi = db && db.holis && db.holis[n.date];
    return !holi && n.dow >= 1 && n.dow <= 5 && n.hhmm >= 900 && n.hhmm < 1730;
  }
  function result() {
    var any = function (g) { return ITEMS.some(function (x) { return x.g === g && picked[x.id]; }); };
    var level;
    if (any('r')) level = 'r';
    else if (any('o') || (picked.f && under3 === true)) level = 'o';
    else if (any('y')) level = 'y';
    else level = 'g';
    if (picked.f && under3 === null && level !== 'r' && level !== 'o') {
      K.toast('아이 나이를 골라 주세요. 생후 3개월 미만은 열만 있어도 바로 진료가 필요해요');
      return;
    }
    var day = isDaytimeClinic();
    var R = {
      r: { cls: 'r', t: '지금 바로 119에 전화하세요', b: '고른 증상은 가장 위험한 신호예요. 병원을 찾아가지 말고 119의 안내를 받으세요.',
        acts: '<a class="btn big red" href="tel:119">📞 119 전화하기</a>' +
              '<button class="btn ghost" data-go-tab="benefit" data-go-pane="card">🪪 응급 카드 열어 두기</button>' },
      o: { cls: 'o', t: '지금 응급실 진료가 필요해요', b: (picked.f && under3 ? '생후 3개월 미만 아기의 38℃ 이상 열은 바로 진료가 필요해요. ' : '') + '가까운 응급실로 가세요. 가는 동안 상태가 나빠지면 119에 전화하세요.',
        acts: '<button class="btn big" data-go-tab="night" data-go-filter="er">🏥 가까운 야간 응급실 보기</button>' +
              '<a class="btn ghost" href="' + (K.ER_BEDS_URL || 'https://mediboard.nemc.or.kr/emergency_room_in_hand') + '" target="_blank" rel="noopener">🛏 응급실 실시간 병상</a>' +
              '<a class="btn ghost" href="tel:119">📞 119 (가는 길·상담)</a>' },
      y: { cls: 'y', t: day ? '오늘 소아과 진료를 받아 보세요' : '오늘 밤 문 연 소아과나 달빛어린이병원으로 가세요', b: day ? '지금 진료 중인 가까운 소아과를 찾아보세요.' : '응급실보다 비용과 대기가 적은 달빛어린이병원이나 야간 진료 의원을 먼저 찾아보세요.',
        acts: '<button class="btn big" data-go-tab="night" data-go-filter="openNow">🕘 지금 문 연 곳 보기</button>' +
              '<button class="btn ghost" data-go-tab="night" data-go-filter="moonlight">🌙 달빛어린이병원 보기</button>' },
      g: { cls: 'g', t: '집에서 지켜봐도 괜찮을 수 있어요', b: '열이 있어도 잘 먹고 잘 놀고 소변을 잘 보면 지켜볼 수 있어요. 열이 3일 넘게 가거나 위 증상이 하나라도 생기면 다시 확인하세요.',
        acts: '<button class="btn big" data-go-tab="benefit" data-go-pane="med">💊 해열제·체온 기록하기</button>' +
              '<button class="btn ghost" data-go-tab="region">내일 갈 소아과 찾기</button>' }
    }[level];
    var chosen = ITEMS.filter(function (x) { return picked[x.id]; }).map(function (x) { return esc(x.t); });
    $('#sheet-body').innerHTML =
      '<div class="tg-res tg-' + R.cls + '"><div class="tg-res-t">' + R.t + '</div><div class="tg-res-b">' + R.b + '</div></div>' +
      '<div class="tg-acts">' + R.acts + '</div>' +
      (chosen.length ? '<div class="tg-chosen"><b>고른 증상</b><br>' + chosen.join('<br>') + (under3 === true ? '<br>생후 3개월 미만' : '') + '</div>' : '') +
      '<div class="tg-help"><b>판단이 어려우면</b>' +
        '<div>보건복지부 <b>「응급똑똑」 앱 → 아이안심톡</b>: 만 12세 이하 아이 증상을 소아전문응급센터 의사·간호사에게 24시간 물어볼 수 있어요.</div>' +
        '<a class="btn ghost" href="https://play.google.com/store/search?q=%EC%9D%91%EA%B8%89%EB%98%91%EB%98%91&c=apps" target="_blank" rel="noopener">응급똑똑 앱 찾기 (플레이스토어)</a>' +
        '<div class="muted-s">아이폰은 앱스토어에서 "응급똑똑"을 검색하세요.</div>' +
        '<a class="btn ghost" href="tel:119">📞 119 의료상담</a></div>' +
      '<button class="btn ghost tg-again" id="tg-again">← 다시 고르기</button>' +
      '<div class="note">이 안내는 진단이 아니에요. 아이 상태가 걱정되면 망설이지 말고 119에 전화하세요. 고른 증상은 저장하지 않아요.<br>' + SOURCES + '</div>';
    $('#sheet').scrollTop = 0;
    $('#tg-again').addEventListener('click', open);
  }
  // 안내 화면 안의 이동 버튼을 누르면 창을 닫는다
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('#sheet [data-go-tab]')) { $('#sheet').hidden = true; $('#sheet-bg').hidden = true; }
  }, true);
  $$('[data-triage]').forEach(function (b) { b.addEventListener('click', open); });
  K.openTriage = open;
})();
