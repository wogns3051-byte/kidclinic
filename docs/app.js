/* 아이아플때 — 앱 화면 로직 (프레임워크 없음) */
(function () {
  'use strict';
  var PAGES_URL = (window.APP_CONFIG && window.APP_CONFIG.PAGES_URL || '').replace(/\/+$/, '');
  var REPORT_URL = (window.APP_CONFIG && window.APP_CONFIG.REPORT_URL || '').trim();
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
  function toView(r, db, now, lat, lng, full) {
    var reg = db.meta.regions[r.s] || { name: '', sggu: {} };
    var o = { id: r.i, name: r.n, type: r.t, sido: reg.name, sggu: reg.sggu[r.g] || '', addr: r.a, tel: r.p,
      lat: r.y == null ? null : r.y, lng: r.x == null ? null : r.x, doctors: r.dr || null,
      open: openState(r, now, db.holis), night: isNight(r), weekend: isWeekend(r), moonlight: !!r.m, moonKind: r.m || 0, general: r.k === 3, er: !!r.er, erTel: r.et || '', erLevel: r.el || '' };
    o.when = whenInfo(r, now, db.holis, o.open);
    o.sd = r.sd || 0;
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
    return getDB().then(function (db) {
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
      db.rows.forEach(function (r) {
        if (r.k === 3 && q.general !== '1' && !ids) return;
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
    if (h.sd) t.push('<span class="tag sd">소아과 전문의' + (h.sd > 1 ? ' ' + h.sd + '명' : '') + '</span>');
    if (h.general) t.push('<span class="tag">일반 의원·소아 진료</span>');
    else if (h.type) t.push('<span class="tag">' + esc(h.type) + '</span>');
    return t.join('');
  }
  function avatar(h) {
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
      '<div class="meta">' + tags(h) + '</div></li>';
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
      if (g === 'region') loadRegion(); else if (g === 'near') loadNear(); else if (g === 'pharm') loadPharm(); else loadNight();
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
  var regionOffset = 0;
  function loadRegion(more) {
    var sido = $('#sido').value, sggu = $('#sggu').value, kw = $('#kw').value.trim();
    save('region', { sido: sido, sggu: sggu });
    var list = $('#region-list'), cnt = $('#region-count');
    if (!sido && kw.length < 2) {
      list.innerHTML = '<li class="empty"><b>지역을 골라 주세요</b>또는 병원 이름을 두 글자 이상 검색하세요.</li>';
      cnt.textContent = ''; $('#region-more').hidden = true; return;
    }
    regionOffset = more ? regionOffset + 50 : 0;
    if (!more) loading(list, cnt);
    var p = Object.assign({ sido: sido, sggu: sggu, q: kw, limit: 50, offset: regionOffset }, chipFilters('region'));
    api('/hospitals', p).then(function (d) {
      render(list, cnt, d, more);
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
  function loadFav() {
    var list = $('#fav-list'), cnt = $('#fav-count');
    if (!favs.length) { list.innerHTML = '<li class="empty"><b>즐겨찾기한 병원이 없어요</b>병원 상세에서 ☆ 를 눌러 추가하세요.</li>'; cnt.textContent = ''; return; }
    loading(list, cnt);
    var p = { ids: favs.join(','), limit: 100 };
    if (myPos) { p.lat = myPos.lat; p.lng = myPos.lng; }
    api('/hospitals', p).then(function (d) { render(list, cnt, d); }).catch(function (e) { fail(list, e); });
  }

  // ───── 상세 시트 ─────
  function closeSheet() { $('#sheet').hidden = true; $('#sheet-bg').hidden = true; }
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
      '<div class="hrs-tip">' + (rcvW || rcvS ? '접수 마감은 병원이 신고한 접수시간이에요. ' : '소아과는 보통 진료 끝나기 30분 전쯤 접수를 마감해요. ') + '점심시간 직전·진료 마감 직전은 접수가 막힐 수 있어요.</div>';
    return html;
  }
  // 👩‍⚕️ 의료진·진료과목 (심평원 자료: 의사 구성, 과목별 전문의 수, 진료과목)
  function staffBlock(h) {
    var z = h.staff || [0, 0, 0, 0], total = h.doctors || 0;
    if (!total && !h.specs.length && !h.subjects.length) return '';
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
      '<div class="st-note">' + (peds ? '분홍 동그라미는 소아청소년과 전문의, ' : '') + '🧑‍⚕️ 전문의 · 👤 일반의·수련의예요. 의사 이름·사진·세부 전문분야(예: 알레르기·성장)는 공공데이터에 없어서, 병원이 직접 올린 소개를 보세요.</div>' +
      '<a class="btn ghost st-link" href="https://m.search.naver.com/search.naver?query=' + encodeURIComponent(h.name + ' ' + (h.sggu || '') + ' 의료진') + '" target="_blank" rel="noopener">🔎 의료진 소개 찾아보기 (네이버) ↗</a></div>';
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
          (h.when.kind === 'open' || h.when.kind === 'lunch' ? '<span>소아과는 보통 진료 끝나기 30분 전쯤 접수를 마감해요. 늦은 시간엔 출발 전에 전화로 확인하세요.</span>' : '') + '</div>' : '') +
        '<div class="actions">' +
          (tel ? '<a class="btn" href="tel:' + tel + '">📞 전화하기</a>' : '<span class="btn ghost">전화번호 없음</span>') +
          '<a class="btn" href="' + kakao + '">카카오맵 길찾기</a>' +
          '<a class="btn ghost" href="' + naver + '">네이버지도</a>' +
          '<button class="btn ghost" id="fav-btn">' + (isFav ? '★ 즐겨찾기 해제' : '☆ 즐겨찾기') + '</button>' +
          (h.url ? '<a class="btn ghost wide" href="' + esc(/^https?:/.test(h.url) ? h.url : 'http://' + h.url) + '">병원 홈페이지</a>' : '') +
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
        (REPORT_URL ? '<button class="btn ghost report" id="report-btn">정보가 달라요</button>' : '') +
        '<div class="note">진료시간·휴진은 병원 사정으로 바뀔 수 있어요. 방문 전 꼭 전화로 확인하세요.<br>자료: 건강보험심사평가원 병원정보서비스' + (d.src ? ' · 진료시간: ' + d.src : '') + (h.moonlight ? ' · 달빛어린이병원: 국립중앙의료원' : '') + '</div>';
      if ($('#after-pharm')) afterPharm(h, $('#after-pharm'));
      holWeek(h);
      $('#share-btn').addEventListener('click', function () {
        var tk = d.hours ? d.hours[todayKey] : null;
        KC.shareText(h.name,
          h.name + '\n' + h.addr + (h.tel ? '\n☎ ' + h.tel : '') +
          (d.hours ? '\n오늘 진료 ' + (tk ? fmt(tk[0]) + '~' + fmt(tk[1]) : '휴진') : '') +
          '\n길찾기 ' + kakao + '\n\n(방문 전 전화로 확인하세요 · 아이아플때)');
      });
      var rb = $('#report-btn');
      if (rb) rb.addEventListener('click', function () {
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
        closeSheet(); if (current === 'fav') loadFav();
      });
    }).catch(function (e) { $('#sheet-body').innerHTML = '<div class="empty"><b>불러오지 못했어요</b>' + esc(e.message) + '</div>'; });
  }
  document.addEventListener('click', function (e) {
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
  var benefitLoaded = false;
  function loadBenefit() {
    if (benefitLoaded) { renderLocal(); return; }
    fetchJson(DATA_BASE + '/benefits.json?t=' + Math.floor(Date.now() / 86400000))
      .catch(function () { return fetchJson('./data/benefits.json'); })
      .then(function (b) {
        benefitLoaded = true;
        var html = '<div class="bn-notice">' + esc(b.notice) + ' <span>(' + esc(b.checked.replace('-', '.')) + ' 기준)</span></div>';
        b.sections.forEach(function (sec) {
          html += '<h3 class="bn-h">' + esc(sec.title) + '</h3><ul class="list">';
          sec.items.forEach(function (it, i) {
            html += '<li class="bn-card"><div class="bn-title">' + esc(it.title) + '</div>' +
              (it.big ? '<div class="bn-big">' + esc(it.big) + '</div>' : '') +
              (it.who ? '<div class="bn-who">대상 · ' + esc(it.who) + '</div>' : '') +
              '<div class="bn-body">' + esc(it.body) + '</div>' +
              (it.link ? '<a class="btn ghost bn-btn" href="' + esc(it.link.url) + '" target="_blank" rel="noopener">' + esc(it.link.label) + ' ↗</a>' : '') +
              (it.action ? '<button class="btn bn-btn" data-go-tab="' + esc(it.action.tab) + '" data-go-filter="' + esc(it.action.filter || '') + '">' + esc(it.action.label) + '</button>' : '') +
              '</li>';
          });
          html += '</ul>';
        });
        html += '<h3 class="bn-h">우리 지역 혜택</h3><div id="local-benefit"></div>';
        $('#benefit-body').innerHTML = html;
        renderLocal();
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
        return '<li class="bn-card lb"><div class="bn-title">' + esc(x.n) + '</div>' + (x.c ? '<div class="bn-big">' + esc(x.c) + '</div>' : '') +
          (x.t ? '<div class="bn-who">대상 · ' + esc(x.t) + '</div>' : '') + (x.how ? '<div class="bn-body">신청 · ' + esc(x.how) + '</div>' : '') +
          '<div class="lb-ag">' + esc(x.ag || '') + (x.tel ? ' · ' + esc(x.tel) : '') + '</div>' +
          (x.u ? '<a class="btn ghost bn-btn" href="' + esc(x.u) + '" target="_blank" rel="noopener">자세히 · 신청 ↗</a>' : '') + '</li>';
      };
      var more = function (arr, id) { return arr.length > 5 ? '<details class="lb-more"><summary>' + (arr.length - 5) + '개 더 보기</summary><ul class="list">' + arr.slice(5).map(card).join('') + '</ul></details>' : ''; };
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
    var tab = b.dataset.goTab, f = b.dataset.goFilter;
    if (b.dataset.goPane) showOpt = { pane: b.dataset.goPane };
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
    ER_BEDS_URL: ER_BEDS_URL, fetchJson: fetchJson, DATA_BASE: DATA_BASE,
    shareText: function (t, x) { if (navigator.share) navigator.share({ title: t, text: x }).catch(function () {}); else if (navigator.clipboard) navigator.clipboard.writeText(x).then(function () { toast('복사했어요'); }); } };

  getDB().then(function (db) { KC.db = db; }).catch(function () {});
  // ───── 시작 ─────
  api('/regions').then(function (d) {
    regions = d.regions;
    fillSido($('#sido')); fillSido($('#nsido'));
    if (lastRegion.sido) { $('#sido').value = lastRegion.sido; fillSggu($('#sido'), $('#sggu')); $('#sggu').value = lastRegion.sggu || ''; }
    loadRegion();
  }).catch(function (e) { fail($('#region-list'), e); });
  if ($('#beds-top')) $('#beds-top').href = ER_BEDS_URL;
  if ($('#open-fav')) $('#open-fav').addEventListener('click', function () { show('fav'); });
  // ───── 홈 화면 설치 안내 ─────
  (function () {
    var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    if (standalone || window.Capacitor || load('installDismissed', false)) return;
    var box = $('#install'), btn = $('#install-btn'), deferred = null;
    var ua = navigator.userAgent;
    var isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; box.hidden = false; });
    if (isIOS) {
      $('#install-text').innerHTML = /CriOS|FxiOS|KAKAOTALK|NAVER/i.test(ua)
        ? '<b>Safari로 열어 주세요</b>Safari에서 공유 → 홈 화면에 추가'
        : '<b>홈 화면에 추가하면 앱처럼 써요</b>아래 공유 버튼(□↑) → 홈 화면에 추가';
      btn.hidden = true; box.hidden = false;
    }
    btn.addEventListener('click', function () {
      if (!deferred) return;
      deferred.prompt();
      deferred.userChoice.then(function () { deferred = null; box.hidden = true; });
    });
    $('#install-x').addEventListener('click', function () { box.hidden = true; save('installDismissed', true); });
    window.addEventListener('appinstalled', function () { box.hidden = true; toast('설치됐어요. 홈 화면에서 열어 보세요'); });
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
      '<a href="privacy.html">개인정보 처리방침</a>';
  }).catch(function () {});
  api('/health').then(function (h) {
    if (h.listUpdatedAt) $('#updated').textContent = '전국 ' + h.hospitals.toLocaleString() + '곳 · ' + h.listUpdatedAt.slice(5, 10).replace('-', '/') + ' 갱신';
  }).catch(function () {});
})();
