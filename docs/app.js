/* 아이아플때 — 앱 화면 로직 (프레임워크 없음) */
(function () {
  'use strict';
  var PAGES_URL = (window.APP_CONFIG && window.APP_CONFIG.PAGES_URL || '').replace(/\/+$/, '');
  var REPORT_URL = (window.APP_CONFIG && window.APP_CONFIG.REPORT_URL || '').trim();
  var FEEDBACK_URL = (window.APP_CONFIG && window.APP_CONFIG.FEEDBACK_URL || '').trim();
  if (!/^https:\/\/open\.kakao\.com\//.test(FEEDBACK_URL)) FEEDBACK_URL = '';
  var FEEDBACK_CODE = (window.APP_CONFIG && window.APP_CONFIG.FEEDBACK_CODE || '').trim();
  // 💬 오픈채팅으로 의견 보내기 (나가기 전에 개인정보 안내)
  function openFeedback(copyText) {
    if (!FEEDBACK_URL) return;
    var go = function () { location.href = FEEDBACK_URL; };
    var msg = '카카오톡 오픈채팅 "의견방"으로 이동해요.\n' + (FEEDBACK_CODE ? '\n🔑 참여 코드: ' + FEEDBACK_CODE + (copyText ? '  (들어갈 때 입력해 주세요)' : '  (자동으로 복사돼요. 입장할 때 붙여 넣으세요)') + '\n' : '') + '\n• 오픈채팅은 카카오 서비스라, 들어가면 고른 프로필(닉네임)이 방 사람들에게 보여요.\n• 아이 이름·생년월일·연락처 같은 개인정보는 올리지 말아 주세요.\n• 위급할 때는 채팅 말고 바로 119!' + (copyText ? '\n\n병원 정보를 복사해 둘게요. 채팅창에 붙여 넣어 주세요.' : '') + '\n\n이동할까요?';
    if (!confirm(msg)) return;
    var clip = copyText || FEEDBACK_CODE;
    if (clip && navigator.clipboard) navigator.clipboard.writeText(clip).then(go, go); else go();
  }
  var ER_BEDS_URL = (window.APP_CONFIG && window.APP_CONFIG.ER_BEDS_URL || 'https://mediboard.nemc.or.kr/emergency_room_in_hand').trim();
  function bedsLink(cls) { return '<a class="btn ' + (cls || 'ghost') + ' beds-btn" href="' + ER_BEDS_URL + '" target="_blank" rel="noopener">🛏 응급실 실시간 병상 보기 ↗</a>'; }
  // 휴대폰 앱(Capacitor) 안이면 GitHub Pages 에서, 웹으로 열면 같은 사이트의 data 폴더에서 받는다
  var DATA_BASE = window.Capacitor && PAGES_URL && PAGES_URL.indexOf('YOUR-GITHUB-ID') < 0 ? PAGES_URL + '/data' : './data';
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var DAY_LABEL = { mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일' };
  var DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  var DOW_KEY = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  // ───── 저장소 (실패해도 동작) ─────
  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var favs = load('favs', []);
  var lastRegion = load('region', { sido: '', sggu: '' });

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 2600);
  }
  // ───── 데이터: 서버 없이 GitHub Pages 의 JSON 파일을 받아 기기 안에서 검색 ─────
  // 순서: ① 인터넷에서 최신 파일 → ② 지난번에 받아 둔 파일 → ③ 앱에 들어 있는 파일
  var dbPromise = null;
  function fetchJson(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }
  function loadSet(base) {
    var t = '?t=' + Date.now();
    return Promise.all([fetchJson(base + '/meta.json' + t), fetchJson(base + '/hospitals.json' + t)])
      .then(function (r) { if (!r[0].updatedAt) throw new Error('empty'); return { meta: r[0], rows: r[1] }; });
  }
  function getDB() {
    if (dbPromise) return dbPromise;
    dbPromise = loadSet(DATA_BASE).then(function (d) {
      try { localStorage.setItem('kc-data', JSON.stringify(d)); } catch (e) {}
      return d;
    }).catch(function () {
      var cached = load('kc-data', null);
      if (cached && cached.meta && cached.meta.updatedAt) { setTimeout(function () { toast('인터넷 연결이 없어 저장된 자료로 보여드려요'); }, 300); return cached; }
      return loadSet('./data');
    }).then(function (d) {
      var byId = {};
      d.rows.forEach(function (r) { byId[r.i] = r; });
      d.byId = byId;
      d.holis = {};
      (d.meta.holidays || []).forEach(function (x) { d.holis[x] = 1; });
      return d;
    }).catch(function (e) { dbPromise = null; throw new Error('병원 자료를 받지 못했어요. 인터넷 연결을 확인해 주세요.'); });
    return dbPromise;
  }
  // 🦷 소아치과 자료 (필요할 때만 받음). 받으면 db.byId 에도 넣어 상세·즐겨찾기·메모가 함께 동작
  var dentPromise = null;
  function getDental() {
    if (dentPromise) return dentPromise;
    dentPromise = getDB().then(function (db) {
      return fetchJson(DATA_BASE + '/dental.json?t=' + Math.floor(Date.now() / 3600000))
        .then(function (rows) { try { localStorage.setItem('kc-dental', JSON.stringify(rows)); } catch (e) {} return rows; })
        .catch(function () { var c = load('kc-dental', null); return c || fetchJson('./data/dental.json'); })
        .catch(function () { return []; })
        .then(function (rows) { rows.forEach(function (r) { r.dt = 1; db.byId[r.i] = r; }); db.dental = rows; return db; });
    });
    return dentPromise;
  }
  function kstNow() {
    var d = new Date(Date.now() + 9 * 3600000);
    return { date: d.toISOString().slice(0, 10), dow: d.getUTCDay(), hhmm: d.getUTCHours() * 100 + d.getUTCMinutes() };
  }
  function span(v) { if (!v) return null; var p = v.split('-'); return [Number(p[0]), Number(p[1])]; }
  // 점심시간 글자("13:00~14:00", "12시30분~13시30분" 등)를 [1300,1400] 으로
  function parseLunch(v) {
    var q = /(\d{2})(\d{2})\s*[~\-–]\s*(\d{2})(\d{2})/.exec(v || '');
    if (q) v = q[1] + ':' + q[2] + '~' + q[3] + ':' + q[4];
    var m = /(\d{1,2})\s*(?:[:시]\s*(\d{2})?\s*분?)?\s*[~\-–]\s*(\d{1,2})\s*(?:[:시]\s*(\d{2})?\s*분?)?/.exec(v || '');
    if (!m) return null;
    var a = Number(m[1]) * 100 + Number(m[2] || 0), b = Number(m[3]) * 100 + Number(m[4] || 0);
    return b > a && a >= 1000 && b <= 1600 ? [a, b] : null; // 엉뚱한 숫자는 무시
  }
  function openState(r, now, holis) {
    if (!r.h) return 'unknown';
    var holi = !!holis[now.date];
    if (holi && !r.ho) return 'closed';
    var t = span(holi ? (r.hh || r.h[0]) : r.h[now.dow]);
    if (!t) return 'closed';
    if (!(now.hhmm >= t[0] && now.hhmm < t[1])) return 'closed';
    if (!holi && now.dow >= 1 && now.dow <= 6) {
      var l = parseLunch(now.dow === 6 ? r.ls : r.l);
      if (l && now.hhmm >= l[0] && now.hhmm < l[1]) return 'lunch';
    }
    return 'open';
  }
  // 오늘 진료 구간·남은 시간·다음 진료 시작
  var WD = ['일', '월', '화', '수', '목', '금', '토'];
  function fmtT(t) { var s = String(t).padStart(4, '0'); return s.slice(0, 2) + ':' + s.slice(2); }
  function daySpan(r, dateStr, dow, holis) {
    if (!r.h) return null;
    if (holis[dateStr]) return r.ho ? span(r.hh || r.h[0]) : null;
    return span(r.h[dow]);
  }
  function whenInfo(r, now, holis, state) {
    if (!r.h) return null;
    var t = daySpan(r, now.date, now.dow, holis);
    var mins = function (a, b) { return (Math.floor(b / 100) * 60 + b % 100) - (Math.floor(a / 100) * 60 + a % 100); };
    if (state === 'open' || state === 'lunch') {
      var left = mins(now.hhmm, t[1]);
      var w = { kind: state, until: t[1], left: left, soon: state === 'open' && left <= 30 };
      if (state === 'lunch') { var l = parseLunch(now.dow === 6 ? r.ls : r.l); if (l) w.back = l[1]; }
      return w;
    }
    if (t && now.hhmm < t[0]) return { kind: 'later', start: t[0], day: '오늘' };
    var base = Date.parse(now.date + 'T00:00:00Z');
    for (var i = 1; i <= 7; i++) {
      var d = new Date(base + i * 86400000), ds = d.toISOString().slice(0, 10), dw = d.getUTCDay();
      var x = daySpan(r, ds, dw, holis);
      if (x) return { kind: 'next', start: x[0], day: i === 1 ? '내일' : i === 2 ? '모레' : WD[dw] + '요일' };
    }
    return null;
  }
  function whenText(w) {
    if (!w) return '';
    var h = function (m) { return (m >= 60 ? Math.floor(m / 60) + '시간 ' : '') + (m % 60 ? (m % 60) + '분' : (m >= 60 ? '' : '0분')); };
    if (w.kind === 'open') return '🕘 오늘 ' + fmtT(w.until) + '까지 · ' + h(w.left).trim() + ' 남음';
    if (w.kind === 'lunch') return '🍚 점심시간' + (w.back ? ' · ' + fmtT(w.back) + '부터 다시 진료' : '') + ' · ' + fmtT(w.until) + '까지';
    if (w.kind === 'later') return '⏰ 오늘 ' + fmtT(w.start) + '부터 진료';
    return '⏰ 다음 진료 ' + w.day + ' ' + fmtT(w.start);
  }
  function isNight(r) { if (!r.h) return false; for (var i = 1; i <= 5; i++) { var t = span(r.h[i]); if (t && t[1] >= 2000) return true; } return false; }
  function isWeekend(r) { return !!(r.h && (r.h[0] || r.ho)); }
  function distKm(a, b, c, d) {
    var R = 6371, k = Math.PI / 180;
    var x = Math.pow(Math.sin((c - a) * k / 2), 2) + Math.cos(a * k) * Math.cos(c * k) * Math.pow(Math.sin((d - b) * k / 2), 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  // 소아과와 함께 보는 과 (심평원 과목별 전문의 수·진료과목 자료)
  var ALSO = [['ent', '이비인후과', '👂'], ['eye', '안과', '👁'], ['skin', '피부과', '🧴'], ['ortho', '정형외과', '🦴']];
  function alsoOf(r) {
    var out = [];
    ALSO.forEach(function (a) {
      var sp = (r.sp || []).filter(function (x) { return x[0] === a[1]; })[0];
      if (sp) out.push({ k: a[0], n: a[1], ic: a[2], sdr: sp[1] });
      else if ((r.sj || []).indexOf(a[1]) >= 0) out.push({ k: a[0], n: a[1], ic: a[2], sdr: 0 });
    });
    return out;
  }
  // 📝 나만의 병원 메모 (이 휴대폰에만)
  var MEMO_TAGS = ['👂 귀·코 잘 봐줘요', '👁 눈 잘 봐줘요', '🧴 피부 잘 봐줘요', '🤧 감기·호흡기', '😊 친절해요', '🧸 아이가 안 무서워해요', '💬 설명을 잘해줘요', '⏰ 대기 짧아요', '⏳ 대기 길어요', '🅿️ 주차 편해요', '💉 접종 잘해줘요', '💊 약 적게 써요'];
  function memos() { return load('hmemo', {}); }
  function memoOf(id) { return memos()[id] || null; }
  function memoLine(id) {
    var m = memoOf(id); if (!m || (!(m.t || []).length && !m.x)) return '';
    return '<div class="memo-line">📝 ' + (m.t || []).map(function (i) { return esc(MEMO_TAGS[i] || ''); }).join(' · ') + (m.x ? ((m.t || []).length ? ' · ' : '') + esc(m.x.length > 30 ? m.x.slice(0, 30) + '…' : m.x) : '') + '</div>';
  }
  function toView(r, db, now, lat, lng, full) {
    var reg = db.meta.regions[r.s] || { name: '', sggu: {} };
    var o = { id: r.i, name: r.n, type: r.t, sido: reg.name, sggu: reg.sggu[r.g] || '', addr: r.a, tel: r.p,
      lat: r.y == null ? null : r.y, lng: r.x == null ? null : r.x, doctors: r.dr || null,
      open: openState(r, now, db.holis), night: isNight(r), weekend: isWeekend(r), moonlight: !!r.m, moonKind: r.m || 0, general: r.k === 3, er: !!r.er, erTel: r.et || '', erLevel: r.el || '' };
    o.when = whenInfo(r, now, db.holis, o.open);
    o.sd = r.sd || 0;
    o.also = r.dt ? [] : alsoOf(r);
    if (r.dt) { o.dental = true; o.pd = r.pd || 0; o.dentKid = r.k === 1; o.general = false; }
    if (lat != null && r.y != null) o.distance = Math.round(distKm(lat, lng, r.y, r.x) * 100) / 100;
    if (full) {
      o.url = r.u || ''; o.park = r.pk || ''; o.trans = r.tr || []; o.plc = r.pl || ''; o.staff = r.dz || null; o.specs = r.sp || []; o.subjects = r.sj || [];
      var keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'], hours = null;
      if (r.h) { hours = {}; keys.forEach(function (k, i) { hours[k] = span(r.h[i]); }); }
      o.detail = r.h ? { hours: hours, lunch: r.l || '', lunchSat: r.ls || '', holiNote: r.hn || '', sunNote: r.sn || '', src: r.hs === 'n' ? '국립중앙의료원' : '',
        rcvWeek: r.rw || '', rcvSat: r.rs || '', holiOpen: !!r.ho, holiHours: r.hh ? span(r.hh) : (r.ho ? span(r.h[0]) : null), holiExact: !!r.hh } : null;
    }
    return o;
  }
  function api(path, q) {
    q = q || {};
    var needDent = q.ds === 'dental' || q.ids || /^\/hospitals\//.test(path);
    return (needDent ? getDental() : getDB()).then(function (db) {
      var now = kstNow();
      var lat = q.lat != null && q.lat !== '' ? Number(q.lat) : null, lng = lat != null ? Number(q.lng) : null;
      if (path === '/health') return { hospitals: db.meta.pedsCount || db.meta.count, withHours: db.meta.withHours, listUpdatedAt: db.meta.updatedAt };
      if (path === '/regions') {
        var counts = {}, sg = {};
        db.rows.forEach(function (r) { if (r.k === 3) return; counts[r.s] = (counts[r.s] || 0) + 1; sg[r.g] = (sg[r.g] || 0) + 1; });
        var order = db.meta.sidoOrder || Object.keys(db.meta.regions);
        return { regions: order.filter(function (c) { return db.meta.regions[c]; }).map(function (c) {
          var reg = db.meta.regions[c];
          return { code: c, name: reg.name, count: counts[c] || 0, sggu: Object.keys(reg.sggu).map(function (g) {
            return { code: g, name: reg.sggu[g], count: sg[g] || 0 };
          }).sort(function (a, b) { return a.name.localeCompare(b.name, 'ko'); }) };
        }) };
      }
      var m = /^\/hospitals\/(.+)$/.exec(path);
      if (m) {
        var row = db.byId[decodeURIComponent(m[1])];
        if (!row) throw new Error('병원을 찾을 수 없어요.');
        return toView(row, db, now, lat, lng, true);
      }
      // /hospitals 검색
      var kw = (q.q || '').replace(/\s/g, '');
      var ids = q.ids ? q.ids.split(',') : null;
      var radius = q.radius ? Number(q.radius) : null;
      var out = [];
      var src = ids ? db.rows.concat(db.dental || []) : q.ds === 'dental' ? (db.dental || []) : db.rows;
      src.forEach(function (r) {
        if (r.dt) { if (q.kidsOnly === '1' && r.k !== 1) return; }
        else if (r.k === 3 && q.general !== '1' && !ids) return;
        if (q.sido && r.s !== q.sido) return;
        if (q.sggu && r.g !== q.sggu) return;
        if (kw && (r.n + r.a).replace(/\s/g, '').indexOf(kw) < 0) return;
        if (ids && ids.indexOf(r.i) < 0) return;
        if (radius && lat != null) {
          if (r.y == null) return;
          // 빠른 1차 거르기 (위도 1도 ≈ 111km)
          if (Math.abs(r.y - lat) > radius / 111 + 0.01 || Math.abs(r.x - lng) > radius / 88 + 0.01) return;
        }
        var v = toView(r, db, now, lat, lng, false);
        if (radius && (v.distance == null || v.distance > radius)) return;
        if (q.openNow === '1' && v.open !== 'open') return;
        if (q.night === '1' && !v.night) return;
        if (q.weekend === '1' && !v.weekend) return;
        if (q.moonlight === '1' && !v.moonlight) return;
        if (q.er === '1' && !v.er) return;
        if (q.hospitalOnly === '1' && /의원$/.test(v.type)) return;
        var miss = ALSO.some(function (a) { return q[a[0]] === '1' && !v.also.some(function (x) { return x.k === a[0]; }); });
        if (miss) return;
        out.push(v);
      });
      var rank = function (o) { return o.open === 'open' ? 0 : o.open === 'lunch' ? 1 : o.open === 'unknown' ? 2 : 3; };
      out.sort(function (a, b) {
        if (a.distance != null && b.distance != null) return a.distance - b.distance;
        return rank(a) - rank(b) || a.name.localeCompare(b.name, 'ko');
      });
      var limit = Number(q.limit || 50), offset = Number(q.offset || 0);
      return { total: out.length, items: out.slice(offset, offset + limit) };
    });
  }
  function fmt(t) { var s = String(t).padStart(4, '0'); return s.slice(0, 2) + ':' + s.slice(2); }

  // ───── 위치 ─────
  var myPos = null;
  function locate(force) {
    if (myPos && !force) return Promise.resolve(myPos);
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) return reject(new Error('위치 기능을 쓸 수 없는 기기입니다.'));
      navigator.geolocation.getCurrentPosition(function (p) {
        myPos = { lat: p.coords.latitude, lng: p.coords.longitude }; resolve(myPos);
      }, function () { reject(new Error('위치 권한을 허용해 주세요. (브라우저 주소창 옆 자물쇠 또는 휴대폰 설정 > 위치)')); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
    });
  }

  // ───── 카드 ─────
  function tags(h) {
    var t = [];
    if (h.open === 'open' && h.when && h.when.soon) t.push('<span class="tag soon">곧 마감</span>');
    else if (h.open === 'open') t.push('<span class="tag open">진료중</span>');
    else if (h.open === 'lunch') t.push('<span class="tag lunch">점심시간</span>');
    else if (h.open === 'closed') t.push('<span class="tag closed">진료 종료</span>');
    if (h.moonlight) t.push('<span class="tag moon">' + (h.moonKind === 2 ? '소아전문센터' : '달빛어린이병원') + '</span>');
    if (h.night) t.push('<span class="tag night">평일 야간</span>');
    if (h.er) t.push('<span class="tag er">야간 응급실</span>');
    if (h.weekend) t.push('<span class="tag weekend">일·공휴일</span>');
    if (h.dental) {
      if (h.pd) t.push('<span class="tag sd">🦷 소아치과 전문의' + (h.pd > 1 ? ' ' + h.pd + '명' : '') + '</span>');
      t.push('<span class="tag dent">' + (h.dentKid ? '🦷 어린이·소아치과' : '🦷 치과 · 소아 진료') + '</span>');
    }
    if (h.sd) t.push('<span class="tag sd">소아과 전문의' + (h.sd > 1 ? ' ' + h.sd + '명' : '') + '</span>');
    (h.also || []).forEach(function (a) { t.push('<span class="tag also">' + a.ic + ' ' + a.n + (a.sdr ? ' 전문의' : '도 봐요') + '</span>'); });
    if (h.general) t.push('<span class="tag">일반 의원·소아 진료</span>');
    else if (h.type && !h.dental) t.push('<span class="tag">' + esc(h.type) + '</span>');
    return t.join('');
  }
  function avatar(h) {
    if (h.dental) return '<span class="av dent" aria-hidden="true">🦷</span>';
    if (h.moonlight) return '<span class="av moon" aria-hidden="true">🌙</span>';
    if (h.general) return '<span class="av gen" aria-hidden="true">🩺</span>';
    if (/병원/.test(h.type || '')) return '<span class="av hosp" aria-hidden="true">🏥</span>';
    return '<span class="av peds" aria-hidden="true">🧸</span>';
  }
  function card(h) {
    return '<li class="item" data-id="' + esc(h.id) + '">' +
      '<div class="name">' + avatar(h) + '<span class="nm">' + esc(h.name) + '</span>' + (favs.indexOf(h.id) >= 0 ? ' <span style="color:#e0a400">★</span>' : '') +
      (h.distance != null ? '<span class="dist">' + (h.distance < 1 ? Math.round(h.distance * 1000) + 'm' : h.distance.toFixed(1) + 'km') + '</span>' : '') + '</div>' +
      '<div class="addr">' + esc(h.addr) + '</div>' +
      (h.when ? '<div class="when' + (h.when.soon ? ' soon' : '') + '">' + whenText(h.when) + '</div>' : '') +
      '<div class="meta">' + tags(h) + '</div>' + memoLine(h.id) + quickActs(h) + '</li>';
  }
  // 목록에서 바로 전화·길찾기 (상세를 열지 않고)
  function quickActs(h) {
    var tel = (h.tel || '').replace(/[^0-9]/g, '');
    var map = h.lat != null ? 'https://map.kakao.com/link/to/' + encodeURIComponent(h.name) + ',' + h.lat + ',' + h.lng : 'https://map.kakao.com/link/search/' + encodeURIComponent(h.addr || h.name);
    return '<div class="qa">' + (tel ? '<a class="qa-call" data-stop href="tel:' + tel + '">📞 전화</a>' : '') +
      '<a class="qa-map" data-stop href="' + map + '" target="_blank" rel="noopener">🗺 길찾기</a><span class="qa-more">자세히 ›</span></div>';
  }
  function render(listEl, countEl, data, append, emptyMsg) {
    if (!append) listEl.innerHTML = '';
    if (!data.items.length && !append) {
      listEl.innerHTML = '<li class="empty"><b>조건에 맞는 병원이 없어요</b>' + (emptyMsg || '필터를 줄이거나 지역을 넓혀 보세요.') + '</li>';
    } else listEl.insertAdjacentHTML('beforeend', data.items.map(card).join(''));
    countEl.textContent = '총 ' + data.total.toLocaleString() + '곳';
  }
  function loading(listEl, countEl) { listEl.innerHTML = '<li class="spinner">불러오는 중…</li>'; countEl.textContent = ''; }
  function fail(listEl, e) { listEl.innerHTML = '<li class="empty"><b>불러오지 못했어요</b>' + esc(e.message) + '</li>'; }

  function chipFilters(group) {
    var f = {};
    $$('.chips[data-for="' + group + '"] .chip.on').forEach(function (c) { f[c.dataset.f] = '1'; });
    return f;
  }
  $$('.chip').forEach(function (c) {
    c.addEventListener('click', function () {
      c.classList.toggle('on');
      var g = c.parentNode.dataset.for;
      if (g === 'region' || g === 'dental') loadRegion(); else if (g === 'near') loadNear(); else if (g === 'pharm') loadPharm(); else loadNight();
    });
  });

  // ───── 지역 데이터 ─────
  var regions = [];
  function fillSido(sel) {
    sel.innerHTML = '<option value="">시·도 선택</option>' + regions.map(function (r) {
      return '<option value="' + r.code + '">' + esc(r.name) + ' (' + r.count + ')</option>';
    }).join('');
  }
  function fillSggu(sidoSel, sgguSel) {
    var r = regions.filter(function (x) { return x.code === sidoSel.value; })[0];
    sgguSel.innerHTML = '<option value="">시·군·구 전체</option>' + (r ? r.sggu.map(function (g) {
      return '<option value="' + g.code + '">' + esc(g.name) + ' (' + g.count + ')</option>';
    }).join('') : '');
    sgguSel.disabled = !r;
  }

  // ───── 탭: 지역 ─────
  var regionOffset = 0, regionsReady = false, regionMode = load('mode', 'peds') === 'dental' ? 'dental' : 'peds';
  // 🧸 소아과 / 🦷 아이 치과 전환
  function applyMode() {
    $$('#mode-seg button').forEach(function (b) { b.classList.toggle('on', b.dataset.mode === regionMode); });
    var dent = regionMode === 'dental';
    var pc = document.querySelector('.chips[data-for="region"]'), dc = document.querySelector('.chips[data-for="dental"]');
    if (pc) pc.hidden = dent; if (dc) dc.hidden = !dent;
    var hint = $('#region-hint');
    if (hint) hint.innerHTML = dent ? '진료과목에 <b>소아치과</b>가 있는 치과예요. <b>소아치과 전문만</b>을 누르면 어린이 치과이거나 소아치과 전문의가 있는 곳만 보여요. 아이 진료 여부는 전화로 꼭 확인하세요.'
      : '기본은 소아청소년과 전문 의원과 병원급만 보여요. 내과·가정의학과 등에서 소아도 보는 곳은 <b>일반 의원 포함</b>을 누르세요.';
    $('#kw').placeholder = dent ? '치과 이름·주소 검색' : '병원 이름·주소 검색';
  }
  $$('#mode-seg button').forEach(function (b) {
    b.addEventListener('click', function () { regionMode = b.dataset.mode; save('mode', regionMode); applyMode(); loadRegion(); });
  });
  applyMode();
  // ───── 📌 우리 동네 고정 ─────
  function homeRegion() { return load('home', null); }
  function regionName(sd, sg) {
    var n = ''; regions.forEach(function (x) { if (x.code === sd) { n = x.name; x.sggu.forEach(function (g) { if (g.code === sg) n += ' ' + g.name; }); } });
    return n;
  }
  function renderHomeRow() {
    var row = $('#home-row'); if (!row || !regionsReady) return;
    var hm = homeRegion(), sd = $('#sido').value, sg = $('#sggu').value;
    if (hm && hm.sido === sd && (hm.sggu || '') === sg) {
      var ios = /iPhone|iPad|iPod/.test(navigator.userAgent) && !(navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches);
      row.innerHTML = '<div class="home-on">📌 <b>' + esc(hm.name) + '</b> 우리 동네로 고정돼 있어요 <button id="home-off">해제</button></div>' +
        (ios ? '<div class="home-tip">아이폰은 Safari에서 공유 → <b>홈 화면에 추가</b>로 설치해야 고정이 오래 유지돼요. (Safari는 오래 안 열면 저장된 설정을 지울 수 있어요)</div>' : '');
      $('#home-off').addEventListener('click', function () { if (!confirm('우리 동네 고정을 해제할까요?')) return; save('home', null); toast('고정을 해제했어요'); renderHomeRow(); renderHomeCard(); });
    } else if (sd) {
      var rn = regionName(sd, sg), lc = rn.charCodeAt(rn.length - 1), jo = lc >= 0xAC00 && lc <= 0xD7A3 && (lc - 0xAC00) % 28 ? '을' : '를';
      row.innerHTML = '<button class="btn soft home-pin" id="home-pin">📌 ' + esc(rn) + jo + ' 우리 동네로 고정' + (hm ? ' (지금: ' + esc(hm.name) + ')' : '') + '</button>';
      $('#home-pin').addEventListener('click', function () {
        save('home', { sido: sd, sggu: sg, name: regionName(sd, sg) });
        if (navigator.storage && navigator.storage.persist) { try { navigator.storage.persist(); } catch (e) {} }
        toast('📌 우리 동네로 고정했어요. 다음에 열어도 이 지역이 바로 나와요'); renderHomeRow(); renderHomeCard();
      });
    } else if (hm) {
      row.innerHTML = '<button class="btn ghost home-pin" id="home-go">📌 우리 동네(' + esc(hm.name) + ')로 돌아가기</button>';
      $('#home-go').addEventListener('click', function () { setRegion(hm.sido, hm.sggu); loadRegion(); });
    } else row.innerHTML = '';
  }
  function setRegion(sd, sg) { $('#sido').value = sd; fillSggu($('#sido'), $('#sggu')); $('#sggu').value = sg || ''; }
  // 지역 탭 위 "우리 동네" 카드: 즐겨찾기 → 지금 진료 중인 소아과 순, 바로 전화
  function renderHomeCard() {
    var box = $('#home-card'); if (!box) return;
    var hm = homeRegion();
    if (!hm) { box.hidden = true; return; }
    api('/hospitals', { sido: hm.sido, sggu: hm.sggu || '', limit: 300 }).then(function (d) {
      var items = d.items.filter(function (h) { return !h.general || favs.indexOf(h.id) >= 0; });
      var score = function (h) { return (favs.indexOf(h.id) >= 0 ? 0 : 10) + (h.open === 'open' ? 0 : h.open === 'lunch' ? 1 : h.open === 'unknown' ? 3 : 4); };
      items.sort(function (a, b) { return score(a) - score(b) || a.name.localeCompare(b.name, 'ko'); });
      var show = items.slice(0, 5), openN = items.filter(function (h) { return h.open === 'open'; }).length;
      box.hidden = false; box.className = 'home-card';
      box.innerHTML = '<div class="hc-h"><b>📌 우리 동네 · ' + esc(hm.name) + '</b><span>지금 진료 중 ' + openN + '곳 · 소아과·병원 ' + items.length + '곳</span></div>' +
        (show.length ? '<ul class="hc-list">' + show.map(function (h) {
          var tel = (h.tel || '').replace(/[^0-9]/g, '');
          return '<li class="item hc-item" data-id="' + esc(h.id) + '"><div class="hc-m"><div class="hc-n">' + (favs.indexOf(h.id) >= 0 ? '<span class="hc-star">★</span>' : '') + esc(h.name) + '</div>' +
            '<div class="hc-w ' + (h.open === 'open' ? 'on' : h.open === 'lunch' ? 'lunch' : 'off') + '">' + (h.when ? whenText(h.when) : '진료시간 확인 필요') + '</div></div>' +
            (tel ? '<a class="hc-call" data-stop href="tel:' + tel + '" aria-label="' + esc(h.name) + ' 전화">📞</a>' : '') + '</li>';
        }).join('') + '</ul>' : '<div class="td-calm">이 지역에 소아과 정보가 없어요</div>') +
        '<button class="hc-all" id="hc-all">' + esc(hm.name) + ' 전체 목록 보기 ↓</button>';
      $('#hc-all').addEventListener('click', function () { setRegion(hm.sido, hm.sggu); loadRegion(); var p = $('#sido'); if (p) p.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    }).catch(function () { box.hidden = true; });
  }
  function loadRegion(more) {
    var sido = $('#sido').value, sggu = $('#sggu').value, kw = $('#kw').value.trim();
    if (regionsReady) save('region', { sido: sido, sggu: sggu }); // 지역 목록을 받기 전에는 저장하지 않음 (빈 값으로 덮어쓰기 방지)
    renderHomeRow();
    var list = $('#region-list'), cnt = $('#region-count');
    if (!sido && kw.length < 2) {
      list.innerHTML = '<li class="empty"><b>지역을 골라 주세요</b>또는 병원 이름을 두 글자 이상 검색하세요.</li>';
      cnt.textContent = ''; $('#region-more').hidden = true; return;
    }
    regionOffset = more ? regionOffset + 50 : 0;
    if (!more) loading(list, cnt);
    var p = Object.assign({ sido: sido, sggu: sggu, q: kw, limit: 50, offset: regionOffset }, chipFilters(regionMode === 'dental' ? 'dental' : 'region'));
    if (regionMode === 'dental') p.ds = 'dental';
    api('/hospitals', p).then(function (d) {
      var alsoOn = ALSO.some(function (a) { return p[a[0]] === '1'; });
      render(list, cnt, d, more, alsoOn ? '함께 보는 과 자료(진료과목·과목별 전문의)는 받는 중이라 아직 비어 있을 수 있어요. 며칠 뒤 다시 확인해 주세요.' : '');
      $('#region-more').hidden = regionOffset + 50 >= d.total;
    }).catch(function (e) { fail(list, e); });
  }
  // 내 위치로: 가장 가까운 병원의 시·도/시·군·구를 골라 준다
  if ($('#locate-region')) $('#locate-region').addEventListener('click', function () {
    var btn = this;
    if (!load('locNoticeSeen', false)) { toast('위치는 휴대폰 안에서만 쓰고 저장하지 않아요'); save('locNoticeSeen', true); }
    btn.disabled = true; btn.textContent = '찾는 중…';
    Promise.all([locate(true), getDB()]).then(function (r) {
      var pos = r[0], db = r[1], best = null, bd = 1e9;
      db.rows.forEach(function (x) {
        if (x.y == null) return;
        var d = Math.pow(x.y - pos.lat, 2) + Math.pow((x.x - pos.lng) * 0.8, 2);
        if (d < bd) { bd = d; best = x; }
      });
      if (!best) throw new Error('가까운 지역을 찾지 못했어요.');
      $('#sido').value = best.s; fillSggu($('#sido'), $('#sggu')); $('#sggu').value = best.g;
      loadRegion();
    }).catch(function (e) { toast(e.message); })
      .then(function () { btn.disabled = false; btn.textContent = '📍 내 위치로'; });
  });
  $('#sido').addEventListener('change', function () { fillSggu($('#sido'), $('#sggu')); loadRegion(); });
  $('#sggu').addEventListener('change', function () { loadRegion(); });
  var kwTimer;
  $('#kw').addEventListener('input', function () { clearTimeout(kwTimer); kwTimer = setTimeout(loadRegion, 350); });
  $('#region-more').addEventListener('click', function () { loadRegion(true); });

  // ───── 탭: 내 주변 (지도) ─────
  var map, meMarker, pinLayer;
  function ensureMap(center) {
    if (!window.L) { $('#map').innerHTML = '<div class="empty">지도를 불러오지 못했어요. 인터넷 연결을 확인하세요.</div>'; return false; }
    if (!map) {
      map = L.map('map', { zoomControl: false, attributionControl: true }).setView([center.lat, center.lng], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
      pinLayer = L.layerGroup().addTo(map);
    }
    setTimeout(function () { map.invalidateSize(); }, 50);
    return true;
  }
  function loadNear(force) {
    var list = $('#near-list'), cnt = $('#near-count');
    loading(list, cnt);
    locate(force).then(function (pos) {
      var hasMap = ensureMap(pos);
      var radius = Number($('#radius').value);
      return api('/hospitals', Object.assign({ lat: pos.lat, lng: pos.lng, radius: radius, limit: 150 }, chipFilters('near'))).then(function (d) {
        render(list, cnt, d, false, '반경을 넓혀 보세요.');
        if (!hasMap) return;
        if (meMarker) meMarker.remove();
        meMarker = L.marker([pos.lat, pos.lng], { icon: L.divIcon({ className: '', html: '<div class="me-dot"></div>', iconSize: [16, 16] }) }).addTo(map);
        pinLayer.clearLayers();
        d.items.forEach(function (h) {
          if (h.lat == null) return;
          var cls = h.moonlight ? 'moon' : h.open === 'open' ? 'open' : '';
          L.marker([h.lat, h.lng], { icon: L.divIcon({ className: '', html: '<div class="pin ' + cls + '"></div>', iconSize: [26, 26], iconAnchor: [13, 26] }) })
            .on('click', function () { openDetail(h.id); }).addTo(pinLayer);
        });
        var zoom = radius <= 2 ? 15 : radius <= 5 ? 14 : radius <= 10 ? 13 : 12;
        map.setView([pos.lat, pos.lng], zoom);
      });
    }).catch(function (e) { fail(list, e); });
  }
  $('#radius').addEventListener('change', function () { loadNear(); });
  $('#relocate').addEventListener('click', function () { loadNear(true); });

  // ───── 탭: 야간·휴일 ─────
  var nightMode = 'near';
  $$('#night-mode button').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('#night-mode button').forEach(function (x) { x.classList.toggle('on', x === b); });
      nightMode = b.dataset.m; $('#night-region').hidden = nightMode !== 'region'; loadNight();
    });
  });
  $('#nsido').addEventListener('change', function () { fillSggu($('#nsido'), $('#nsggu')); loadNight(); });
  $('#nsggu').addEventListener('change', function () { loadNight(); });
  function loadNight() {
    var list = $('#night-list'), cnt = $('#night-count');
    var f = chipFilters('night');
    if (!f.openNow && !f.moonlight && !f.night && !f.weekend && !f.er) f = { night: '', weekend: '' }; // 아무것도 안 고르면 전체
    loading(list, cnt);
    var req;
    if (nightMode === 'near') {
      req = locate().then(function (pos) { return api('/hospitals', Object.assign({ lat: pos.lat, lng: pos.lng, radius: 20, limit: 100 }, f)); });
    } else {
      if (!$('#nsido').value) { list.innerHTML = '<li class="empty"><b>시·도를 골라 주세요</b></li>'; return; }
      req = api('/hospitals', Object.assign({ sido: $('#nsido').value, sggu: $('#nsggu').value, limit: 100 }, f));
    }
    req.then(function (d) { render(list, cnt, d, false, '"지금 진료중"을 끄거나 지역에서 찾기로 바꿔 보세요.'); })
      .catch(function (e) { fail(list, e); });
  }

  // ───── 탭: 즐겨찾기 ─────
  var favMode = load('favMode', 'fav'), memoTag = -1, memoQ = '';
  function loadFav() {
    var list = $('#fav-list'), cnt = $('#fav-count'), tools = $('#memo-tools');
    var all = memos(), memoIds = Object.keys(all);
    $$('#fav-seg button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.fm === favMode);
      b.textContent = b.dataset.fm === 'fav' ? '★ 즐겨찾기 ' + favs.length : '📝 내 메모 ' + memoIds.length;
    });
    if (favMode === 'fav') {
      tools.innerHTML = '';
      if (!favs.length) { list.innerHTML = '<li class="empty"><b>즐겨찾기한 병원이 없어요</b>병원 상세에서 ☆ 를 눌러 추가하세요.</li>'; cnt.textContent = ''; return; }
      loading(list, cnt);
      var p = { ids: favs.join(','), limit: 100 };
      if (myPos) { p.lat = myPos.lat; p.lng = myPos.lng; }
      api('/hospitals', p).then(function (d) { render(list, cnt, d); }).catch(function (e) { fail(list, e); });
      return;
    }
    // 📝 내 메모만 모아 보기
    if (!memoIds.length) {
      tools.innerHTML = '';
      list.innerHTML = '<li class="empty"><b>메모한 병원이 없어요</b>병원 상세 맨 아래 📝 내 메모에서 "귀·코 잘 봐줘요" 같은 태그나 글을 남겨 보세요.</li>'; cnt.textContent = ''; return;
    }
    var used = {};
    memoIds.forEach(function (id) { (all[id].t || []).forEach(function (i) { used[i] = (used[i] || 0) + 1; }); });
    tools.innerHTML = '<div class="memo-filter"><button class="chip' + (memoTag < 0 ? ' on' : '') + '" data-mtag="-1">전체</button>' +
      Object.keys(used).sort(function (x, y) { return used[y] - used[x]; }).map(function (i) { return '<button class="chip' + (memoTag === +i ? ' on' : '') + '" data-mtag="' + i + '">' + esc(MEMO_TAGS[i]) + ' ' + used[i] + '</button>'; }).join('') + '</div>' +
      '<input class="vis-q memo-q" id="memo-q" placeholder="🔍 메모 글 찾기 (예: 중이염, 선생님 이름)" value="' + esc(memoQ) + '">' +
      '<div class="memo-act"><button class="chip" id="memo-share">📤 내 메모 목록 보내기</button></div>';
    var ids = memoIds.filter(function (id) {
      var m = all[id];
      if (memoTag >= 0 && (m.t || []).indexOf(memoTag) < 0) return false;
      if (memoQ && (m.x || '').indexOf(memoQ) < 0 && !(m.t || []).some(function (i) { return (MEMO_TAGS[i] || '').indexOf(memoQ) >= 0; })) return false;
      return true;
    });
    $$('#memo-tools [data-mtag]').forEach(function (c) { c.addEventListener('click', function () { memoTag = +c.dataset.mtag; loadFav(); }); });
    var qi = $('#memo-q'); qi.addEventListener('input', function () { memoQ = qi.value.trim(); clearTimeout(qi._t); qi._t = setTimeout(function () { loadFav(); var q2 = $('#memo-q'); if (q2) { q2.focus(); q2.setSelectionRange(q2.value.length, q2.value.length); } }, 300); });
    if (!ids.length) { list.innerHTML = '<li class="empty"><b>맞는 메모가 없어요</b>다른 태그를 골라 보세요.</li>'; cnt.textContent = ''; bindMemoShare(all, memoIds); return; }
    loading(list, cnt);
    api('/hospitals', { ids: ids.join(','), limit: 300 }).then(function (d) {
      d.items.sort(function (x, y) { return (all[y.id].at || '') < (all[x.id].at || '') ? -1 : 1; });
      render(list, cnt, d);
      cnt.textContent = '메모한 병원 ' + d.total + '곳 · 최근 메모 순';
    }).catch(function (e) { fail(list, e); });
    bindMemoShare(all, memoIds);
  }
  function bindMemoShare(all, memoIds) {
    var b = $('#memo-share'); if (!b) return;
    b.addEventListener('click', function () {
      getDB().then(function (db) {
        var lines = memoIds.map(function (id) {
          var r = db.byId[id], m = all[id];
          return '• ' + (r ? r.n : '병원') + (r && r.p ? ' (' + r.p + ')' : '') + '\n  ' + (m.t || []).map(function (i) { return MEMO_TAGS[i]; }).join(', ') + (m.x ? (m.t && m.t.length ? ' / ' : '') + m.x : '');
        });
        if (!confirm('내 메모 목록을 보낼까요?\n받는 사람에게 메모 내용이 그대로 보여요.')) return;
        KC.shareText('내 병원 메모', '[아이아플때 · 내 병원 메모]\n' + lines.join('\n') + '\n\n- 아이아플때 앱');
      });
    });
  }
  $$('#fav-seg button').forEach(function (b) { b.addEventListener('click', function () { favMode = b.dataset.fm; save('favMode', favMode); loadFav(); }); });

  // ───── 상세 시트 ─────
  function closeSheet() { var was = !$('#sheet').hidden; $('#sheet').hidden = true; $('#sheet-bg').hidden = true; if (was && current === 'fav' && favMode === 'memo') loadFav(); }
  $('#sheet-bg').addEventListener('click', closeSheet);
  $('#sheet-x').addEventListener('click', closeSheet);
  // 이 병원 진료가 끝나는 시각 뒤에도 문 여는 1km 안 약국
  function afterPharm(h, box) {
    var endT = h.when.until;
    Promise.all([getPharm(), getDB()]).then(function (r) {
      var rows = r[0], db = r[1], now = kstNow(), holi = !!db.holis[now.date];
      var out = [];
      rows.forEach(function (p) {
        if (Math.abs(p.y - h.lat) > 0.012 || Math.abs(p.x - h.lng) > 0.015) return;
        var dkm = distKm(h.lat, h.lng, p.y, p.x); if (dkm > 1) return;
        var t = span(holi ? (p.hh || '') : (p.h ? p.h[now.dow] : ''));
        if (!t || t[1] < endT + 10 || t[0] > endT) return;
        out.push({ p: p, d: dkm, close: t[1] });
      });
      out.sort(function (a, b) { return a.d - b.d; });
      box.innerHTML = out.length
        ? '<div class="ap-h">진료 끝(' + fmtT(endT) + ') 뒤에도 문 여는 1km 안 약국</div>' + out.slice(0, 3).map(function (x) {
            var tel = (x.p.p || '').replace(/[^0-9]/g, '');
            return '<div class="ap-row"><div><b>' + esc(x.p.n) + '</b><span>' + fmtT(x.close) + '까지 · ' + (x.d < 1 ? Math.round(x.d * 1000) + 'm' : x.d.toFixed(1) + 'km') + '</span></div>' +
              (tel ? '<a href="tel:' + tel + '">전화</a>' : '') + '</div>';
          }).join('')
        : '<div class="ap-h">진료가 끝나는 ' + fmtT(endT) + ' 뒤에도 여는 약국이 1km 안에 없어요.</div><div class="ap-tip">약국 탭에서 "밤 10시 이후"로 더 넓게 찾아보세요.</div>';
    }).catch(function () { box.innerHTML = '<div class="ap-tip">약국 정보를 불러오지 못했어요.</div>'; });
  }
  // ───── 외래 진료시간 자세히: 한 줄 요약 + 요일별 시간 막대(점심·지금) + 접수 마감 + 이번 주 공휴일 ─────
  var BAR_FROM = 700, BAR_TO = 2300;
  function toMin(t) { return Math.floor(t / 100) * 60 + t % 100; }
  function pct(t) { var a = toMin(BAR_FROM), b = toMin(BAR_TO); return Math.max(0, Math.min(100, (toMin(t) - a) / (b - a) * 100)); }
  function rcvEnd(v) {
    var m = /(\d{1,2})\s*[:시]\s*(\d{2})?\s*분?\s*$/.exec(String(v || '').replace(/\s*(까지|마감)\s*$/, '').trim());
    var q = /[~\-–]\s*(\d{1,2})\s*[:시]?\s*(\d{2})?/.exec(String(v || ''));
    var x = q || m; if (!x) return null;
    var hh = +x[1], mm = +(x[2] || 0); if (hh > 24 || mm > 59) return null;
    return hh * 100 + mm;
  }
  function hoursBlock(d, todayKey) {
    if (!d.hours) return '<div class="hrs-empty">진료시간 정보가 아직 없어요. 전화로 확인해 주세요.</div>';
    var now = kstNow(), nowT = now.hhmm;
    var txt = function (t) { return t ? fmt(t[0]) + '~' + fmt(t[1]) : '휴진'; };
    // 한 줄 요약 (같은 시간끼리 묶기)
    var groups = [];
    DAY_ORDER.forEach(function (k) {
      var v = txt(d.hours[k]), g = groups[groups.length - 1];
      if (g && g.v === v) g.days.push(k); else groups.push({ v: v, days: [k] });
    });
    var summary = groups.map(function (g) {
      var a = DAY_LABEL[g.days[0]], b = DAY_LABEL[g.days[g.days.length - 1]];
      var lbl = g.days.length === 5 && g.days[0] === 'mon' ? '평일' : g.days.length > 2 ? a + '~' + b : g.days.map(function (x) { return DAY_LABEL[x]; }).join('·');
      return '<span><b>' + lbl + '</b> ' + g.v + '</span>';
    }).join('');
    var lunchW = parseLunch(d.lunch), lunchS = parseLunch(d.lunchSat), lastTags = '';
    var rcvW = rcvEnd(d.rcvWeek), rcvS = rcvEnd(d.rcvSat);
    var row = function (key, label, t, lunch, rcv, isToday, note) {
      var bar = '';
      if (t) {
        bar += '<i class="hb-open" style="left:' + pct(t[0]) + '%;width:' + Math.max(1.5, pct(t[1]) - pct(t[0])) + '%"></i>';
        if (lunch && lunch[0] >= t[0] && lunch[1] <= t[1]) bar += '<i class="hb-lunch" style="left:' + pct(lunch[0]) + '%;width:' + (pct(lunch[1]) - pct(lunch[0])) + '%"></i>';
      }
      if (isToday && nowT >= BAR_FROM && nowT <= BAR_TO) bar += '<i class="hb-now" style="left:' + pct(nowT) + '%"></i>';
      var tags = [];
      if (t && t[0] <= 830) tags.push('<em class="early">아침 일찍</em>');
      if (t && t[1] >= 2000) tags.push('<em class="late">저녁 ' + fmt(t[1]) + '</em>');
      if (lunch && t) tags.push('<em>점심 ' + fmt(lunch[0]) + '~' + fmt(lunch[1]) + '</em>');
      if (rcv && t && rcv < t[1]) tags.push('<em class="rcv">접수 ' + fmt(rcv) + '까지</em>');
      var tagHtml = tags.join('');
      if (!isToday && tagHtml && tagHtml === lastTags) tagHtml = ''; else if (!isToday) lastTags = tagHtml;
      return '<div class="hr' + (isToday ? ' today' : '') + (t ? '' : ' off') + '"><div class="hr-d' + (label.length > 1 ? ' sm' : '') + '">' + label + (isToday ? '<small>오늘</small>' : '') + '</div>' +
        '<div class="hr-m"><div class="hr-t">' + txt(t) + (note ? ' <span class="hr-note">' + esc(note) + '</span>' : '') + '</div><div class="hb">' + bar + '</div>' + (tagHtml ? '<div class="hr-tags">' + tagHtml + '</div>' : '') + '</div></div>';
    };
    var holiToday = !!(KC.db && KC.db.holis && KC.db.holis[now.date]);
    var html = '<div class="hrs-sum">' + summary + '</div>' +
      '<div class="hb-scale">' + [700, 1200, 1700, 2200].map(function (t) { return '<span style="left:' + pct(t) + '%">' + (t / 100) + '시</span>'; }).join('') + '</div>' +
      '<div class="hrs">' + DAY_ORDER.map(function (k) {
        var isSat = k === 'sat';
        return row(k, DAY_LABEL[k], d.hours[k], isSat ? lunchS : (k === 'sun' ? null : lunchW), isSat ? rcvS : (k === 'sun' ? null : rcvW), k === todayKey && !holiToday, k === 'sun' && d.sunNote && !/휴진|휴무/.test(d.sunNote) ? d.sunNote : '');
      }).join('') +
      row('holi', '공휴일', d.holiOpen ? d.holiHours : null, null, null, holiToday, d.holiOpen && !d.holiExact ? '시간은 전화 확인' : (d.holiNote && !/휴진|휴무/.test(d.holiNote) ? d.holiNote : '')) + '</div>' +
      '<div class="hrs-legend"><span><i class="lg-open"></i>진료</span><span><i class="lg-lunch"></i>점심시간</span><span><i class="lg-now"></i>지금</span></div>' +
      '<div class="hrs-tip">' + (rcvW || rcvS ? '접수 마감은 병원이 신고한 접수시간이에요. ' : '보통 진료 끝나기 30분 전쯤 접수를 마감해요. ') + '점심시간 직전·진료 마감 직전은 접수가 막힐 수 있어요.</div>';
    return html;
  }
  // 👩‍⚕️ 의료진·진료과목 (심평원 자료: 의사 구성, 과목별 전문의 수, 진료과목)
  function staffBlock(h) {
    var z = h.staff || [0, 0, 0, 0], total = h.doctors || 0;
    if (!total && !h.specs.length && !h.subjects.length) return '<div class="sub-h">의료진 · 전문분야</div><div class="staff">' + whyNoDoctor() + doctorLinks(h) + '</div>';
    var parts = [];
    if (z[0]) parts.push('전문의 ' + z[0] + '명'); if (z[1]) parts.push('일반의 ' + z[1] + '명');
    if (z[2]) parts.push('레지던트 ' + z[2] + '명'); if (z[3]) parts.push('인턴 ' + z[3] + '명');
    var peds = 0; h.specs.forEach(function (x) { if (/소아/.test(x[0])) peds += x[1]; });
    var people = '';
    var n = Math.min(total || 0, 12);
    var spec = Math.max(z[0] || 0, peds);
    for (var i = 0; i < n; i++) people += '<i class="' + (i < peds ? 'p' : i < spec ? 's' : '') + '">' + (i < spec ? '🧑‍⚕️' : '👤') + '</i>';
    return '<div class="sub-h">의료진 · 전문분야</div><div class="staff">' +
      (total ? '<div class="st-top"><div class="st-n"><b>' + total + '</b>명<small>의사</small></div><div><div class="st-people">' + people + (total > 12 ? '<span>+' + (total - 12) + '</span>' : '') + '</div>' +
        (parts.length ? '<div class="st-parts">' + parts.join(' · ') + '</div>' : '') + '</div></div>' : '') +
      (h.specs.length ? '<div class="st-row"><span>전문의</span><div class="st-chips">' + h.specs.map(function (x) {
        return '<em class="' + (/소아/.test(x[0]) ? 'peds' : '') + '">' + esc(x[0]) + ' ' + x[1] + '명</em>'; }).join('') + '</div></div>' : '') +
      (h.subjects.length ? '<div class="st-row"><span>진료과목</span><div class="st-chips sj">' + h.subjects.map(function (x) {
        return '<em class="' + (/소아/.test(x) ? 'peds' : '') + '">' + esc(x) + '</em>'; }).join('') + '</div></div>' : '') +
      '<div class="st-note">' + (peds ? '분홍 동그라미는 ' + (h.dental ? '소아치과' : '소아청소년과') + ' 전문의, ' : '') + '🧑‍⚕️ 전문의 · 👤 일반의·수련의예요.</div>' +
      whyNoDoctor() +
      doctorLinks(h) + '</div>';
  }
  // 👩‍⚕️ 의료진 소개 페이지로 더 정확하게: ① 내가 저장한 페이지 ② 병원 누리집(심평원 등록) ③ 네이버 지도(병원 위치 중심) ④ 네이버 검색(이름+동네+도로명)
  function roadOf(addr) {
    var m = /([가-힣0-9]+(?:로|길))\s*\d/.exec(addr || '') || /([가-힣0-9]+(?:동|읍|면|리))(?:\s|$)/.exec(addr || '');
    return m ? m[1] : '';
  }
  // 의사 이름·사진을 앱에서 보여 줄 수 없는 이유 (엄마들이 납득할 수 있게)
  function whyNoDoctor() {
    return '<details class="why"><summary>❓ 의사 이름·사진·전문분야는 왜 안 나와요?</summary><div class="why-b">' +
      '<div><b>1. 공공데이터에 없어요</b>건강보험심사평가원은 병원 단위 정보(의사 수, 과목별 전문의 수, 진료과목)까지만 공개해요. 의사 이름·사진·경력은 <b>의사 개인의 개인정보</b>라서 나라에서 공개하지 않아요.</div>' +
      '<div><b>2. 네이버 등의 의료진 소개는 가져올 수 없어요</b>네이버·병원 앱에 있는 의료진 소개는 <b>병원이 그 회사에 직접 올린 정보</b>예요. 다른 앱이 받아 쓸 수 있는 공개 통로가 없고, 몰래 가져오면 이용약관 위반이자 사진·글 저작권 침해가 돼요.</div>' +
      '<div><b>3. 확인된 정보만 보여 드려요</b>아이아플때는 광고 없는 무료 서비스라 <b>나라가 공개한 확인된 자료</b>만 보여 드려요. 출처가 불분명한 정보로 엄마들이 헷갈리지 않게 하려는 거예요.</div>' +
      '<div class="why-f">그래서 아래 버튼으로 <b>병원이 직접 올린 의료진 소개</b>를 네이버에서 바로 볼 수 있게 연결해 두었어요.</div>' +
      '</div></details>';
  }
  function doctorLinks(h) {
    var m = memoOf(h.id) || {}, q = (h.name + ' ' + (h.sggu || '') + ' ' + roadOf(h.addr)).trim();
    return '<div class="dl">' +
      '<a class="btn st-link" href="https://m.search.naver.com/search.naver?query=' + encodeURIComponent(q) + '" target="_blank" rel="noopener">🔎 의료진 소개 찾아보기 (네이버) ↗</a>' +
      (m.u ? '<a class="dl-a mine" href="' + esc(m.u) + '" target="_blank" rel="noopener"><b>📌 내가 저장한 의료진 페이지</b><small>' + esc(m.u.replace(/^https?:\/\//, '').slice(0, 40)) + '</small></a>' : '') +
      '</div><button class="dl-save" id="dl-save">' + (m.u ? '📎 저장한 페이지 바꾸기·지우기' : '📎 맞는 페이지를 찾았으면 주소 저장해 두기') + '</button>';
  }
  function bindDoctorLinks(h) {
    var b = $('#dl-save'); if (!b) return;
    b.addEventListener('click', function () {
      var all = memos(), m = all[h.id] || { t: [], x: '' };
      var v = prompt('의료진 소개 페이지 주소를 붙여 넣어 주세요.\n(네이버 지도·병원 누리집에서 공유 → 링크 복사)\n비우고 확인하면 저장한 주소를 지워요.', m.u || '');
      if (v === null) return;
      v = v.trim();
      var found = /(https?:\/\/[^\s]+)/.exec(v); // "[네이버 지도] 병원이름 https://naver.me/xxxx" 처럼 와도 주소만 꺼냄
      if (v && !found) { toast('https:// 로 시작하는 주소를 붙여 넣어 주세요'); return; }
      if (found) m.u = found[1]; else delete m.u;
      m.at = new Date().toISOString().slice(0, 10);
      if ((m.t || []).length || m.x || m.u) all[h.id] = m; else delete all[h.id];
      save('hmemo', all); toast(found ? '저장했어요. 다음부터 바로 연결돼요' : '저장한 주소를 지웠어요');
      var box = document.querySelector('.staff'); if (box) box.outerHTML = staffBlock(h);
      bindDoctorLinks(h);
    });
  }
  function memoBlock(h) {
    var m = memoOf(h.id) || { t: [], x: '' };
    return '<div class="sub-h">📝 내 메모</div><div class="memo-box" data-memo="' + esc(h.id) + '">' +
      '<div class="memo-tags">' + MEMO_TAGS.map(function (t, i) { return '<button class="chip' + ((m.t || []).indexOf(i) >= 0 ? ' on' : '') + '" data-mt="' + i + '">' + t + '</button>'; }).join('') + '</div>' +
      '<textarea id="memo-x" maxlength="100" rows="2" placeholder="예: 김○○ 선생님이 중이염 잘 봐줌, 오전 10시 전이 한산">' + esc(m.x || '') + '</textarea>' +
      '<button class="btn ghost" id="memo-save">메모 저장</button>' +
      '<div class="priv">🔒 내 메모는 <b>이 휴대폰에만</b> 저장되고 다른 사람에게 보이지 않아요. 백업 파일에는 들어가요.</div></div>';
  }
  function bindMemo(h) {
    var box = document.querySelector('.memo-box'); if (!box) return;
    var put = function (quiet) {
      var all = memos(), t = $$('.memo-box [data-mt].on').map(function (b) { return +b.dataset.mt; }), x = ($('#memo-x').value || '').trim();
      var keepU = all[h.id] && all[h.id].u;
      if (t.length || x || keepU) all[h.id] = { t: t, x: x, u: keepU || undefined, at: new Date().toISOString().slice(0, 10) }; else delete all[h.id];
      save('hmemo', all); if (!quiet) toast(t.length || x ? '내 메모를 저장했어요' : '메모를 지웠어요');
      var li = document.querySelector('.item[data-id="' + h.id + '"] .memo-line'), item = document.querySelector('#region-list .item[data-id="' + h.id + '"]');
      if (li) li.outerHTML = memoLine(h.id); else if (item) { var qa = item.querySelector('.qa'); if (qa) qa.insertAdjacentHTML('beforebegin', memoLine(h.id)); }
    };
    $$('.memo-box [data-mt]').forEach(function (b) { b.addEventListener('click', function () { b.classList.toggle('on'); put(true); }); });
    $('#memo-save').addEventListener('click', function () { put(false); });
  }
  function holWeek(h) {
    var box = document.getElementById('hol-week'); if (!box || !h.detail) return;
    getDB().then(function (db) {
      var out = [], base = Date.now() + 9 * 3600000;
      for (var i = 0; i < 14; i++) {
        var dd = new Date(base + i * 86400000), ds = dd.toISOString().slice(0, 10);
        if (!db.holis[ds]) continue;
        var t = h.detail.holiOpen ? h.detail.holiHours : null;
        out.push('<div class="hw"><b>' + (dd.getUTCMonth() + 1) + '/' + dd.getUTCDate() + '(' + '일월화수목금토'[dd.getUTCDay()] + ')' + (i === 0 ? ' 오늘' : '') + '</b> 공휴일 · ' +
          (t ? '<span class="ok">' + fmt(t[0]) + '~' + fmt(t[1]) + ' 진료' + (h.detail.holiExact ? '' : ' (시간 확인 필요)') + '</span>' : '<span class="no">휴진</span>') + '</div>');
      }
      box.innerHTML = out.length ? '<div class="hol-week"><div class="hw-h">📅 다가오는 공휴일 (2주 안)</div>' + out.join('') + '</div>' : '';
    }).catch(function () {});
  }
  function openDetail(id) {
    $('#sheet-body').innerHTML = '<div class="spinner">불러오는 중…</div>';
    $('#sheet').hidden = false; $('#sheet-bg').hidden = false;
    var p = myPos ? { lat: myPos.lat, lng: myPos.lng } : {};
    api('/hospitals/' + encodeURIComponent(id), p).then(function (h) {
      var isFav = favs.indexOf(h.id) >= 0;
      var todayKey = DOW_KEY[new Date().getDay()];
      var d = h.detail || {};
      var rows = hoursBlock(d, todayKey);
      var tel = (h.tel || '').replace(/[^0-9]/g, '');
      var hasPos = h.lat != null;
      var kakao = hasPos ? 'https://map.kakao.com/link/to/' + encodeURIComponent(h.name) + ',' + h.lat + ',' + h.lng
        : 'https://map.kakao.com/link/search/' + encodeURIComponent(h.addr);
      var naver = 'https://map.naver.com/p/search/' + encodeURIComponent(h.name + ' ' + (h.sggu || ''));
      $('#sheet-body').innerHTML =
        '<h2>' + esc(h.name) + '</h2>' +
        '<div class="meta" style="display:flex;gap:5px;flex-wrap:wrap">' + tags(h) + '</div>' +
        '<div class="addr">' + esc(h.addr) + (h.distance != null ? ' · 직선거리 ' + h.distance + 'km' : '') + '</div>' +
        (h.when ? '<div class="when-box' + (h.when.soon ? ' soon' : '') + '"><b>' + whenText(h.when) + '</b>' +
          (h.when.kind === 'open' || h.when.kind === 'lunch' ? '<span>보통 진료 끝나기 30분 전쯤 접수를 마감해요. 늦은 시간엔 출발 전에 전화로 확인하세요.</span>' : '') + '</div>' : '') +
        '<div class="actions">' +
          (tel ? '<a class="btn" href="tel:' + tel + '">📞 전화하기</a>' : '<span class="btn ghost">전화번호 없음</span>') +
          '<a class="btn" href="' + kakao + '">카카오맵 길찾기</a>' +
          '<a class="btn ghost" href="' + naver + '">네이버지도</a>' +
          '<button class="btn ghost" id="fav-btn">' + (isFav ? '★ 즐겨찾기 해제' : '☆ 즐겨찾기') + '</button>' +

          (hasPos ? '<button class="btn ghost wide" id="near-pharm-btn">℞ 이 병원 근처 약국</button>' : '') +
          '<button class="btn ghost wide" id="share-btn">📤 카톡으로 이 병원 보내기</button>' +
        '</div>' +
        (h.er ? '<div class="er-box"><b>야간 응급실 운영' + (h.erLevel ? ' · ' + esc(h.erLevel) : '') + '</b>외래 진료가 끝난 뒤에는 응급실로 받아요. 응급실 비용이 더 들고, 소아 전문의가 없을 수 있어요.' +
          (h.erTel ? '<a class="btn" href="tel:' + h.erTel.replace(/[^0-9]/g, '') + '">응급실 전화 ' + esc(h.erTel) + '</a>' : '') + bedsLink('ghost') + '</div>' : '') +
        (hasPos && h.when && (h.when.kind === 'open' || h.when.kind === 'lunch') ? '<div class="sub-h">℞ 진료 끝나고 약 살 곳</div><div id="after-pharm" class="after-ph"><div class="spinner small">찾는 중…</div></div>' : '') +
        '<div class="sub-h">외래 진료시간</div>' + rows + '<div id="hol-week"></div>' +
        (h.plc || h.park || (h.trans && h.trans.length) ? '<div class="sub-h">찾아가는 길</div><div class="way">' +
          (h.plc ? '<div>📍 ' + esc(h.plc) + '</div>' : '') +
          (h.park ? '<div>🅿️ ' + esc(h.park) + '</div>' : '') +
          (h.trans || []).map(function (t) { return '<div>' + (/지하철|전철/.test(t) ? '🚇 ' : '🚌 ') + esc(t) + '</div>'; }).join('') + '</div>' : '') +
        staffBlock(h) +
        memoBlock(h) +
        (REPORT_URL || FEEDBACK_URL ? '<button class="btn ghost report" id="report-btn">✏️ 정보가 달라요 (알려 주기)</button>' : '') +
        '<div class="note">진료시간·휴진은 병원 사정으로 바뀔 수 있어요. 방문 전 꼭 전화로 확인하세요.<br>자료: 건강보험심사평가원 병원정보서비스' + (d.src ? ' · 진료시간: ' + d.src : '') + (h.moonlight ? ' · 달빛어린이병원: 국립중앙의료원' : '') + '</div>';
      if ($('#after-pharm')) afterPharm(h, $('#after-pharm'));
      holWeek(h);
      bindMemo(h);
      bindDoctorLinks(h);
      $('#share-btn').addEventListener('click', function () {
        var tk = d.hours ? d.hours[todayKey] : null;
        KC.shareText(h.name,
          h.name + '\n' + h.addr + (h.tel ? '\n☎ ' + h.tel : '') +
          (d.hours ? '\n오늘 진료 ' + (tk ? fmt(tk[0]) + '~' + fmt(tk[1]) : '휴진') : '') +
          '\n길찾기 ' + kakao + '\n\n(방문 전 전화로 확인하세요 · 아이아플때)');
      });
      var rb = $('#report-btn');
      if (rb) rb.addEventListener('click', function () {
        if (!REPORT_URL) { openFeedback('[정보 수정 요청]\n병원: ' + h.name + '\n주소: ' + (h.addr || '') + '\n다른 점: '); return; }
        var u = REPORT_URL.replace('{name}', encodeURIComponent(h.name)).replace('{addr}', encodeURIComponent(h.addr || ''));
        location.href = u;
      });
      if (hasPos) $('#near-pharm-btn').addEventListener('click', function () {
        closeSheet();
        phHosp = { lat: h.lat, lng: h.lng, name: h.name };
        phMode = 'hosp';
        show('pharm');
      });
      $('#fav-btn').addEventListener('click', function () {
        var i = favs.indexOf(h.id);
        if (i >= 0) favs.splice(i, 1); else favs.push(h.id);
        save('favs', favs);
        toast(i >= 0 ? '즐겨찾기에서 뺐어요' : '즐겨찾기에 추가했어요');
        closeSheet(); if (current === 'fav') loadFav(); renderHomeCard();
      });
    }).catch(function (e) { $('#sheet-body').innerHTML = '<div class="empty"><b>불러오지 못했어요</b>' + esc(e.message) + '</div>'; });
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-feedback]')) { e.preventDefault(); openFeedback(''); return; }
    if (e.target.closest && e.target.closest('[data-stop]')) return; // 전화·길찾기는 그대로
    var li = e.target.closest && e.target.closest('.item');
    if (!li) return;
    if (li.classList.contains('pitem')) { var v = phShown[Number(li.dataset.pi)]; if (v) openPharm(v); return; }
    openDetail(li.dataset.id);
  });

  // ───── 약국 ─────
  var pharmPromise = null, phMode = 'me', phHosp = null, phShown = [];
  function getPharm() {
    if (!pharmPromise) {
      pharmPromise = fetchJson(DATA_BASE + '/pharmacies.json?t=' + Math.floor(Date.now() / 3600000))
        .catch(function () { return fetchJson('./data/pharmacies.json'); })
        .catch(function (e) { pharmPromise = null; throw new Error('약국 자료를 받지 못했어요.'); });
    }
    return pharmPromise;
  }
  function pharmView(p, center, now, holis) {
    var holi = !!holis[now.date], st = 'unknown';
    if (p.h || p.hh) {
      var t = span(holi ? (p.hh || '') : (p.h ? p.h[now.dow] : ''));
      st = t && now.hhmm >= t[0] && now.hhmm < t[1] ? 'open' : 'closed';
    }
    var late = false;
    if (p.h) for (var i = 0; i < 7; i++) { var x = span(p.h[i]); if (x && x[1] >= 2200) late = true; }
    return { p: p, open: st, late: late, weekend: !!((p.h && p.h[0]) || p.hh),
      distance: Math.round(distKm(center.lat, center.lng, p.y, p.x) * 100) / 100 };
  }
  function pharmTags(v) {
    var t = [];
    if (v.open === 'open') t.push('<span class="tag open">영업중</span>');
    else if (v.open === 'closed') t.push('<span class="tag closed">영업 종료</span>');
    if (v.late) t.push('<span class="tag night">밤 10시 이후</span>');
    if (v.weekend) t.push('<span class="tag weekend">일·공휴일</span>');
    return t.join('');
  }
  function loadPharm() {
    var list = $('#ph-list'), cnt = $('#ph-count');
    $('#ph-hosp-btn').hidden = !phHosp;
    if (phHosp) $('#ph-hosp-btn').textContent = phHosp.name + ' 근처';
    $$('#ph-mode button').forEach(function (b) { b.classList.toggle('on', b.dataset.m === phMode); });
    loading(list, cnt);
    var centerP = phMode === 'hosp' && phHosp ? Promise.resolve(phHosp) : locate();
    Promise.all([centerP, getPharm(), getDB()]).then(function (r) {
      var c = r[0], rows = r[1], db = r[2], now = kstNow();
      var radius = Number($('#ph-radius').value), f = chipFilters('pharm');
      var out = [];
      rows.forEach(function (p) {
        if (Math.abs(p.y - c.lat) > radius / 111 + 0.01 || Math.abs(p.x - c.lng) > radius / 88 + 0.01) return;
        var v = pharmView(p, c, now, db.holis);
        if (v.distance > radius) return;
        if (f.openNow && v.open !== 'open') return;
        if (f.late && !v.late) return;
        if (f.weekend && !v.weekend) return;
        out.push(v);
      });
      out.sort(function (a, b) { return a.distance - b.distance; });
      phShown = out.slice(0, 100);
      cnt.textContent = '총 ' + out.length + '곳' + (phMode === 'hosp' && phHosp ? ' · ' + phHosp.name + ' 기준' : '');
      list.innerHTML = phShown.length ? phShown.map(function (v, i) {
        return '<li class="item pitem" data-pi="' + i + '"><div class="name"><span class="av ph" aria-hidden="true">💊</span><span class="nm">' + esc(v.p.n) + '</span>' +
          '<span class="dist">' + (v.distance < 1 ? Math.round(v.distance * 1000) + 'm' : v.distance.toFixed(1) + 'km') + '</span></div>' +
          '<div class="addr">' + esc(v.p.a) + '</div><div class="meta">' + pharmTags(v) + '</div></li>';
      }).join('') : '<li class="empty"><b>조건에 맞는 약국이 없어요</b>반경을 넓히거나 필터를 줄여 보세요.</li>';
    }).catch(function (e) { fail(list, e); });
  }
  function openPharm(v) {
    var p = v.p, keys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], idx = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    var todayKey = DOW_KEY[new Date().getDay()];
    var rows = p.h ? keys.map(function (k) {
      var t = span(p.h[idx[k]]);
      return '<tr class="' + (k === todayKey ? 'today' : '') + '"><td>' + DAY_LABEL[k] + '요일</td><td>' + (t ? fmt(t[0]) + ' ~ ' + fmt(t[1]) : '휴무') + '</td></tr>';
    }).join('') : '<tr><td colspan="2">영업시간 정보가 없어요. 전화로 확인해 주세요.</td></tr>';
    var ht = span(p.hh || '');
    rows += '<tr><td>공휴일</td><td>' + (ht ? fmt(ht[0]) + ' ~ ' + fmt(ht[1]) : '휴무') + '</td></tr>';
    var tel = (p.p || '').replace(/[^0-9]/g, '');
    $('#sheet-body').innerHTML = '<h2>' + esc(p.n) + '</h2>' +
      '<div class="meta" style="display:flex;gap:5px;flex-wrap:wrap">' + pharmTags(v) + '</div>' +
      '<div class="addr">' + esc(p.a) + ' · ' + v.distance + 'km</div>' +
      '<div class="actions">' +
        (tel ? '<a class="btn" href="tel:' + tel + '">📞 전화하기</a>' : '<span class="btn ghost">전화번호 없음</span>') +
        '<a class="btn" href="https://map.kakao.com/link/to/' + encodeURIComponent(p.n) + ',' + p.y + ',' + p.x + '">카카오맵 길찾기</a>' +
        '<button class="btn ghost wide" id="ph-share">📤 카톡으로 이 약국 보내기</button>' +
      '</div>' +
      '<div class="sub-h">영업시간</div><table class="hours">' + rows + '</table>' +
      '<div class="note">영업시간은 바뀔 수 있어요. 방문 전 전화로 확인하세요.<br>자료: 국립중앙의료원 전국 약국 정보</div>';
    $('#sheet').hidden = false; $('#sheet-bg').hidden = false;
    $('#ph-share').addEventListener('click', function () {
      KC.shareText(p.n, p.n + '\n' + p.a + (p.p ? '\n☎ ' + p.p : '') + '\n길찾기 https://map.kakao.com/link/to/' + encodeURIComponent(p.n) + ',' + p.y + ',' + p.x + '\n\n(방문 전 전화로 확인하세요 · 아이아플때)');
    });
  }
  $$('#ph-mode button').forEach(function (b) {
    b.addEventListener('click', function () { phMode = b.dataset.m; loadPharm(); });
  });
  $('#ph-radius').addEventListener('change', function () { loadPharm(); });

  // ───── 혜택 ─────
  var benefitLoaded = false, goAnchor = '';
  function jumpAnchor() { if (!goAnchor) return; var el = document.getElementById(goAnchor); goAnchor = ''; if (el) setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60); }
  function loadBenefit() {
    if (benefitLoaded) { renderLocal(); jumpAnchor(); return; }
    fetchJson(DATA_BASE + '/benefits.json?t=' + Math.floor(Date.now() / 86400000))
      .catch(function () { return fetchJson('./data/benefits.json'); })
      .then(function (b) {
        benefitLoaded = true;
        var html = '<div class="bn-notice">' + esc(b.notice) + ' <span>(' + esc(b.checked.replace('-', '.')) + ' 기준)</span></div>';
        b.sections.forEach(function (sec) {
          html += '<h3 class="bn-h"' + (sec.id ? ' id="bn-' + esc(sec.id) + '"' : '') + '>' + esc(sec.title) + '</h3>' + (sec.note ? '<div class="bn-sub">' + esc(sec.note) + '</div>' : '') + '<ul class="list">';
          sec.items.forEach(function (it, i) {
            html += '<li class="bn-card"><div class="bn-title">' + esc(it.title) + '</div>' +
              (it.big ? '<div class="bn-big">' + esc(it.big) + '</div>' : '') +
              (it.who ? '<div class="bn-who">대상 · ' + esc(it.who) + '</div>' : '') +
              '<div class="bn-body">' + esc(it.body) + '</div>' +
              (it.link && /^https?:\/\//.test(it.link.url) ? '<a class="btn ghost bn-btn" href="' + esc(it.link.url) + '" target="_blank" rel="noopener">' + esc(it.link.label) + ' ↗</a>' : '') +
              (it.action ? '<button class="btn bn-btn" data-go-tab="' + esc(it.action.tab) + '" data-go-filter="' + esc(it.action.filter || '') + '"' + (it.action.mode ? ' data-go-mode="' + esc(it.action.mode) + '"' : '') + (it.action.pane ? ' data-go-pane="' + esc(it.action.pane) + '"' : '') + '>' + esc(it.action.label) + '</button>' : '') +
              '</li>';
          });
          html += '</ul>';
          if (sec.id === 'dental') html += '<div id="local-dent"><div class="bn-sub">지역을 고르면 우리 지역 보건소·시군구의 아이 치아 지원도 여기 모아 보여 드려요.</div></div>';
        });
        html += '<h3 class="bn-h">우리 지역 혜택</h3><div id="local-benefit"></div>';
        $('#benefit-body').innerHTML = html;
        renderLocal();
        jumpAnchor();
      }).catch(function () { $('#benefit-body').innerHTML = '<div class="empty"><b>혜택 정보를 불러오지 못했어요</b>인터넷 연결을 확인해 주세요.</div>'; });
  }
  var lbCache = {};
  function renderLocal() {
    var box = $('#local-benefit'); if (!box) return;
    var r = load('region', { sido: '', sggu: '' });
    var sidoName = '', sgName = '';
    regions.forEach(function (x) { if (x.code === r.sido) { sidoName = x.name; x.sggu.forEach(function (g) { if (g.code === r.sggu) sgName = g.name; }); } });
    var name = sidoName + (sgName ? ' ' + sgName : '');
    var fallback = function (msg) {
      box.innerHTML = '<div class="bn-card"><div class="bn-title">' + (name ? esc(name) + ' 출산·육아 지원' : '지역을 먼저 골라 주세요') + '</div>' +
        '<div class="bn-body">' + (name ? msg : '지역 탭에서 시·도와 시·군·구를 고르거나 📍 내 위치로를 누르면, 그 지역 혜택을 여기서 보여 드려요.') + '</div>' +
        '<a class="btn ghost bn-btn" href="https://www.bokjiro.go.kr" target="_blank" rel="noopener">복지로에서 지역 혜택 찾기 ↗</a></div>';
    };
    if (!r.sido) return fallback('');
    var draw = function (d) {
      var mine = (r.sggu && d.sg && d.sg[r.sggu]) || [], wide = d.all || [];
      if (!mine.length && !wide.length) return fallback('이 지역의 출산·육아 혜택을 아직 찾지 못했어요. 복지로에서 지역을 골라 확인해 보세요.');
      var card = function (x) {
        return '<li class="bn-card lb"><div class="bn-title">' + (x.d ? '<span class="lb-dent">🦷 치아</span>' : '') + esc(x.n) + '</div>' + (x.c ? '<div class="bn-big">' + esc(x.c) + '</div>' : '') +
          (x.t ? '<div class="bn-who">대상 · ' + esc(x.t) + '</div>' : '') + (x.how ? '<div class="bn-body">신청 · ' + esc(x.how) + '</div>' : '') +
          '<div class="lb-ag">' + esc(x.ag || '') + (x.tel ? ' · ' + esc(x.tel) : '') + '</div>' +
          (x.u && /^https?:\/\//.test(x.u) ? '<a class="btn ghost bn-btn" href="' + esc(x.u) + '" target="_blank" rel="noopener">자세히 · 신청 ↗</a>' : '') + '</li>';
      };
      var more = function (arr, id) { return arr.length > 5 ? '<details class="lb-more"><summary>' + (arr.length - 5) + '개 더 보기</summary><ul class="list">' + arr.slice(5).map(card).join('') + '</ul></details>' : ''; };
      var dent = mine.concat(wide).filter(function (x) { return x.d; });
      var dentBox = $('#local-dent');
      if (dentBox) dentBox.innerHTML = dent.length ? '<div class="lb-h">📍 ' + esc(name) + ' 아이 치아 지원 (' + dent.length + ')</div><ul class="list">' + dent.slice(0, 5).map(card).join('') + '</ul>' + more(dent) :
        '<div class="bn-sub">' + esc(name) + '에서 따로 찾은 아이 치아 지원은 아직 없어요. 보건소 구강보건실 운영 여부는 관할 보건소에 물어보세요.</div>';
      box.innerHTML = (mine.length ? '<div class="lb-h">📍 ' + esc(name) + ' (' + mine.length + ')</div><ul class="list">' + mine.slice(0, 5).map(card).join('') + '</ul>' + more(mine) : '') +
        (wide.length ? '<div class="lb-h">🗺 ' + esc(sidoName) + ' 전체 (' + wide.length + ')</div><ul class="list">' + wide.slice(0, 5).map(card).join('') + '</ul>' + more(wide) : '') +
        '<div class="note pad">출처: 행정안전부 대한민국 공공서비스(혜택) 정보 (' + esc((d.at || '').slice(0, 10).replace(/-/g, '.')) + ' 받음). 지원 금액·조건은 바뀔 수 있으니 신청 전에 꼭 확인하세요.</div>';
    };
    if (lbCache[r.sido]) return draw(lbCache[r.sido]);
    box.innerHTML = '<div class="spinner">불러오는 중…</div>';
    fetchJson(DATA_BASE + '/lb/' + r.sido + '.json?t=' + Math.floor(Date.now() / 86400000))
      .catch(function () { return fetchJson('./data/lb/' + r.sido + '.json'); })
      .then(function (d) { lbCache[r.sido] = d; draw(d); })
      .catch(function () { fallback('시·군·구마다 출산축하금, 산후조리비, 영유아 의료비 같은 지원이 따로 있어요. 자동으로 모아 보여 드리는 기능을 준비하고 있어요. 지금은 복지로에서 지역을 골라 확인할 수 있어요.'); });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-go-tab]');
    if (!b) return;
    if (e.preventDefault) e.preventDefault();
    var tab = b.dataset.goTab, f = b.dataset.goFilter;
    if (b.dataset.goMode && tab === 'region' && b.dataset.goMode !== regionMode) { regionMode = b.dataset.goMode; save('mode', regionMode); applyMode(); if (regionsReady) loadRegion(); }
    if (b.dataset.goPane) showOpt = { pane: b.dataset.goPane };
    goAnchor = b.dataset.goAnchor || '';
    if (f) $$('.chips[data-for="' + tab + '"] .chip').forEach(function (c) { c.classList.toggle('on', c.dataset.f === f); });
    loaded[tab] = 0;
    show(tab);
  });

  // ───── 탭 전환 ─────
  var current = 'region', loaded = {}, showOpt = null;
  function show(tab) {
    current = tab;
    $$('.bottom button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === (tab === 'fav' ? 'region' : tab)); });
    $$('.tab').forEach(function (s) { s.hidden = s.id !== 'tab-' + tab; });
    window.scrollTo(0, 0);
    if (tab === 'near') { if (!loaded.near) { loaded.near = 1; loadNear(); } else if (map) setTimeout(function () { map.invalidateSize(); }, 50); }
    if (tab === 'night' && !loaded.night) { loaded.night = 1; loadNight(); }
    if (tab === 'fav') loadFav();
    if (tab === 'pharm') loadPharm();
    if (tab === 'benefit') { if (KC.onShow.benefit) KC.onShow.benefit(showOpt); else loadBenefit(); }
    showOpt = null;
  }
  $$('.bottom button').forEach(function (b) { b.addEventListener('click', function () { show(b.dataset.tab); }); });
  // 안드로이드 뒤로가기: 시트가 열려 있으면 닫기
  document.addEventListener('backbutton', function (e) { if (!$('#sheet').hidden) { e.preventDefault(); closeSheet(); } });

  // ───── kid.js 에 도구 넘기기 ─────
  var KC = window.KC = { $: $, $$: $$, esc: esc, load: load, save: save, toast: toast, api: api, show: show,
    getDB: getDB, kstNow: kstNow, locate: locate, card: card, loadBenefit: loadBenefit, onShow: {},
    ER_BEDS_URL: ER_BEDS_URL, FEEDBACK_URL: FEEDBACK_URL, FEEDBACK_CODE: FEEDBACK_CODE, openFeedback: openFeedback, fetchJson: fetchJson, DATA_BASE: DATA_BASE,
    shareText: function (t, x) { if (navigator.share) navigator.share({ title: t, text: x }).catch(function () {}); else if (navigator.clipboard) navigator.clipboard.writeText(x).then(function () { toast('복사했어요'); }); } };

  getDB().then(function (db) { KC.db = db; }).catch(function () {});
  // ───── 시작 ─────
  api('/regions').then(function (d) {
    regions = d.regions;
    fillSido($('#sido')); fillSido($('#nsido'));
    regionsReady = true;
    var hm0 = homeRegion(), start = hm0 && hm0.sido ? hm0 : lastRegion;
    if (start.sido) setRegion(start.sido, start.sggu);
    loadRegion();
    renderHomeCard();
    setInterval(function () { if (current === 'region' && !document.hidden) renderHomeCard(); }, 5 * 60000);
  }).catch(function (e) { fail($('#region-list'), e); });
  if ($('#beds-top')) $('#beds-top').href = ER_BEDS_URL;
  if ($('#open-fav')) $('#open-fav').addEventListener('click', function () { show('fav'); });
  // ───── 홈 화면 설치 안내 ─────
  // 설치해서(홈 화면 아이콘으로) 열면 나오지 않음. ✕ 는 7일 동안 숨기고, "이미 설치했어요"는 이 브라우저에서 다시 안 나옴.
  (function () {
    var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    if (standalone) { save('installDone', true); return; }
    if (window.Capacitor || load('installDone', false) || load('installDismissed', false)) return;
    var snooze = load('installSnooze', 0);
    if (snooze && Date.now() - snooze < 7 * 86400000) return;
    var box = $('#install'), btn = $('#install-btn'), deferred = null;
    var ua = navigator.userAgent;
    var isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var inKakao = /KAKAOTALK/i.test(ua), inApp = inKakao || /NAVER|Instagram|FBAN|FBAV|Line\//i.test(ua);
    var isSamsung = /SamsungBrowser/i.test(ua);
    var setText = function (t, s) { $('#install-text').innerHTML = '<b>' + t + '</b>' + s; };
    var showBtn = function (label) { btn.textContent = label; btn.hidden = false; box.hidden = false; };
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault(); deferred = e;
      setText('홈 화면에 앱으로 설치', '한 번 설치하면 아이콘 하나로 바로 열려요'); showBtn('설치');
    });
    if (isIOS) {
      if (inApp) setText('Safari로 열어서 설치해 주세요', '카톡·앱 안 화면에서는 설치가 안 돼요');
      else if (/CriOS|FxiOS|EdgiOS/i.test(ua)) setText('홈 화면에 앱으로 설치', '공유(□↑) → 홈 화면에 추가 (Safari가 가장 확실해요)');
      else setText('홈 화면에 추가하면 앱처럼 써요', '설치하면 우리 동네·아이 기록이 오래 유지돼요');
      showBtn(inKakao ? 'Safari로 열기' : '설치 방법');
    } else if (inApp) {
      setText('크롬에서 열어서 설치해 주세요', '앱 안 화면에서는 설치가 잘 안 돼요'); showBtn(inKakao ? '크롬으로 열기' : '설치 방법');
    } else if (isSamsung) {
      setText('홈 화면에 앱으로 설치', '메뉴(≡) → 페이지 추가 → 홈 화면'); showBtn('설치 방법');
    } else {
      // 크롬은 beforeinstallprompt 가 오면 '설치' 버튼으로 바뀜. 안 오면 메뉴 안내
      setTimeout(function () { if (!deferred && box.hidden) { setText('홈 화면에 앱으로 설치', '메뉴(⋮) → 홈 화면에 추가 · 앱 설치'); showBtn('설치 방법'); } }, 2500);
    }
    function guide() {
      var steps = isIOS ? [
        ['🧭', 'Safari로 열기', inApp ? '지금은 앱 안 화면이에요. ⋯ 또는 나침반 버튼 → "Safari로 열기"를 눌러 주세요.' : '지금 Safari로 잘 열려 있어요.'],
        ['⬆️', '공유 버튼 누르기', '화면 아래 공유 버튼(□↑)을 눌러요. 안 보이면 주소창 옆 ⋯ → 공유.'],
        ['➕', '"홈 화면에 추가"', '메뉴를 위로 올려 "홈 화면에 추가"를 눌러요. "웹 앱으로 열기"가 보이면 켜 두세요.'],
        ['✅', '"추가" 누르기', '오른쪽 위 "추가"를 누르면 홈 화면에 아기 얼굴 아이콘이 생겨요.'],
        ['👶', '앞으로는 아이콘으로 열기', '아이콘으로 열어야 앱처럼 보이고 기록이 안 지워져요. Safari 화면과 아이콘 화면은 저장 공간이 달라서, 쓰던 기록은 💾 백업 → 📂 불러오기로 옮겨요.']
      ] : [
        ['🌐', '크롬(또는 삼성 인터넷)으로 열기', inApp ? '지금은 앱 안 화면이에요. ⋮ 메뉴 → "다른 브라우저로 열기"를 눌러 주세요.' : '지금 브라우저에서 바로 설치할 수 있어요.'],
        ['⋮', '메뉴 열기', '크롬은 오른쪽 위 ⋮, 삼성 인터넷은 아래 ≡ 를 눌러요.'],
        ['➕', '"홈 화면에 추가" 또는 "앱 설치"', '삼성 인터넷은 "페이지 추가 → 홈 화면"이에요.'],
        ['👶', '아이콘으로 열기', '홈 화면의 아기 얼굴 아이콘으로 열면 앱처럼 써요.']
      ];
      $('#sheet-body').innerHTML = '<h2>📱 홈 화면에 앱으로 설치하기</h2><div class="tg-sub">앱스토어 없이 무료로 설치돼요. 개인정보를 따로 받지 않아요.</div>' +
        '<ol class="inst-steps">' + steps.map(function (x, i) { return '<li><span class="is-ic">' + x[0] + '</span><div><b>' + (i + 1) + '. ' + x[1] + '</b><small>' + x[2] + '</small></div></li>'; }).join('') + '</ol>' +
        '<button class="btn" id="inst-done">이미 설치했어요 · 다시 보지 않기</button>' +
        '<button class="btn ghost" id="inst-later">나중에 할게요</button>';
      $('#sheet').hidden = false; $('#sheet-bg').hidden = false; $('#sheet').scrollTop = 0;
      $('#inst-done').addEventListener('click', function () { save('installDone', true); box.hidden = true; closeSheet(); toast('앞으로는 홈 화면 아이콘으로 열어 주세요'); });
      $('#inst-later').addEventListener('click', function () { save('installSnooze', Date.now()); box.hidden = true; closeSheet(); });
    }
    btn.addEventListener('click', function () {
      if (deferred) { deferred.prompt(); deferred.userChoice.then(function (c) { deferred = null; if (c && c.outcome === 'accepted') { save('installDone', true); box.hidden = true; } }); return; }
      if (inKakao) { location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(location.href); setTimeout(guide, 800); return; }
      guide();
    });
    $('#install-x').addEventListener('click', function () { box.hidden = true; save('installSnooze', Date.now()); toast('7일 뒤에 다시 알려 드릴게요'); });
    window.addEventListener('appinstalled', function () { save('installDone', true); box.hidden = true; toast('설치됐어요. 홈 화면에서 열어 보세요'); });
  })();
  if ('serviceWorker' in navigator && !window.Capacitor && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  // 진료시간 자료가 아직 없으면 시간 관련 버튼을 숨기고 안내
  getDB().then(function (db) {
    if (db.meta.withHours) return;
    $$('.chips:not([data-for=pharm]) .chip[data-f=openNow], .chip[data-f=night], .chips:not([data-for=pharm]) .chip[data-f=weekend]').forEach(function (c) { c.classList.remove('on'); c.hidden = true; });
    $$('.panel').forEach(function (p) {
      if (p.querySelector('.chips')) p.insertAdjacentHTML('beforeend', '<div class="hint" style="margin:0">진료시간 자료를 준비 중이에요. 지금은 위치·연락처만 볼 수 있어요.</div>');
    });
    if (loaded.night) loadNight();
  }).catch(function () {});
  getDB().then(function (db) {
    var d = db.meta.updatedAt ? db.meta.updatedAt.slice(0, 10).replace(/-/g, '.') : '';
    $('#foot-info').innerHTML =
      '<b>위치 정보</b> 내 위치는 가까운 병원·약국을 찾는 데만 휴대폰 안에서 쓰고, 어디에도 보내거나 저장하지 않아요.<br>' +
      '<b>자료</b> 건강보험심사평가원, 국립중앙의료원, 한국천문연구원 공공데이터' + (d ? ' (' + d + ' 갱신)' : '') + '<br>' +
      '<b>주의</b> 진료시간은 바뀔 수 있으니 방문 전 꼭 전화로 확인하세요. 위급하면 119.<br>' +
      '<a href="privacy.html">개인정보 처리방침</a>' +
      (FEEDBACK_URL ? '<button class="fb-btn" data-feedback>💬 의견 보내기 · 오류 제보 (카카오톡 오픈채팅)' + (FEEDBACK_CODE ? '<small>🔑 참여 코드 ' + esc(FEEDBACK_CODE) + '</small>' : '') + '</button>' : '');
  }).catch(function () {});
  api('/health').then(function (h) {
    if (h.listUpdatedAt) $('#updated').textContent = '전국 ' + h.hospitals.toLocaleString() + '곳 · ' + h.listUpdatedAt.slice(5, 10).replace('-', '/') + ' 갱신';
  }).catch(function () {});
})();
