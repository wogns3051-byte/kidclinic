/*
 * 국립중앙의료원 「전국 병·의원 찾기 서비스」 보충
 *  - getBabyListInfoInqire : 달빛어린이병원·소아전문센터 목록 (매일)
 *  - getHsptlMdcncFullDown  : 전국 병·의원 요일별·공휴일 진료시간 (7일마다)
 * 심평원 자료(병원 목록)에 이름+위치로 맞춰 붙인다. 심평원에 진료시간이 없는 병원을 채우는 용도.
 */
'use strict';
const BASE = (process.env.NMC_BASE_URL || '').trim() || 'https://apis.data.go.kr/B552657/HsptlAsembySearchService';
const ER_BASE = (process.env.NMC_ER_BASE_URL || '').trim() || 'https://apis.data.go.kr/B552657/ErmctInfoInqireService';
const FULL_EVERY_DAYS = Number(process.env.NMC_FULL_EVERY_DAYS || 7);

// 이름 비교용: 공백·괄호·법인 표기 제거
function norm(s) {
  return String(s || '')
    .replace(/\(.*?\)|㈜|주식회사/g, '')
    .replace(/[^0-9a-zA-Z가-힣]/g, '') // 공백·기호(&, · 등) 제거
    .replace(/^(의료법인|재단법인|사회복지법인|학교법인|사단법인)?.*?(의료재단|의료사단|재단|법인)(?=.{3,})/, '')
    .toLowerCase();
}
function similar(a, b) {
  a = norm(a); b = norm(b);
  if (a.length < 3 || b.length < 3) return a === b;
  return a === b || a.endsWith(b) || b.endsWith(a) || a.includes(b) || b.includes(a);
}
function dist(lat1, lng1, lat2, lng2) {
  const k = Math.PI / 180, R = 6371000;
  const x = Math.sin((lat2 - lat1) * k / 2) ** 2 + Math.cos(lat1 * k) * Math.cos(lat2 * k) * Math.sin((lng2 - lng1) * k / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
function t4(v) { const s = String(v || '').replace(/[^0-9]/g, ''); return s.length >= 3 ? s.padStart(4, '0').slice(0, 4) : ''; }
function span(it, n) {
  const s = t4(it['dutyTime' + n + 's']), e = t4(it['dutyTime' + n + 'c']);
  return s && e && Number(e) > Number(s) ? s + '-' + e : '';
}
// dutyTime1=월 … 6=토, 7=일, 8=공휴일  →  [일,월,화,수,목,금,토]
function nmcHours(it) {
  const hours = [span(it, 7), span(it, 1), span(it, 2), span(it, 3), span(it, 4), span(it, 5), span(it, 6)];
  return { hours: hours.some(Boolean) ? hours : null, holiday: span(it, 8) };
}

// 위치 격자(약 1km)로 심평원 병원을 빠르게 찾기
function buildIndex(items) {
  const grid = new Map();
  for (const h of items) {
    if (h.lat == null) continue;
    const key = Math.round(h.lat * 100) + ',' + Math.round(h.lng * 100);
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(h);
  }
  return grid;
}
function findMatch(grid, it) {
  const lat = Number(it.wgs84Lat), lng = Number(it.wgs84Lon);
  if (!lat || !lng) return null;
  const gy = Math.round(lat * 100), gx = Math.round(lng * 100);
  let best = null, bestD = 400; // 400m 이내 + 이름 비슷
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    for (const h of grid.get((gy + dy) + ',' + (gx + dx)) || []) {
      if (!similar(h.name, it.dutyName)) continue;
      const d = dist(lat, lng, h.lat, h.lng);
      if (d < bestD) { bestD = d; best = h; }
    }
  }
  return best;
}

async function fetchAll(callApi, op, rows, maxPages, log, base) {
  const out = [];
  let page = 1, total = 0;
  do {
    const r = await callApi((base || BASE) + '/' + op, { pageNo: page, numOfRows: rows });
    total = r.total;
    out.push(...r.items);
    if (!r.items.length) break;
    page++;
    if (log && page % 10 === 0) log(`  ${op} ${out.length}/${total}`);
  } while (out.length < total && page <= maxPages);
  return out;
}

async function supplement(state, callApi) {
  const items = Object.values(state.items);
  const grid = buildIndex(items);
  state.nmc = state.nmc || {};

  // 1) 달빛어린이병원·소아전문센터
  try {
    const baby = await fetchAll(callApi, 'getBabyListInfoInqire', 500, 10);
    if (baby[0]) console.log('  (달빛 응답 항목: ' + Object.keys(baby[0]).join(', ') + ')');
    const anyMoon = baby.some((it) => /달빛/.test(JSON.stringify(it)));
    for (const h of items) delete h.moon;
    let matched = 0;
    const missed = [];
    for (const it of baby) {
      const kind = !anyMoon || /달빛/.test(JSON.stringify(it)) ? 1 : 2; // 1=달빛어린이병원, 2=소아전문센터
      const h = findMatch(grid, it);
      if (!h) { missed.push(it.dutyName); continue; }
      h.moon = Math.min(h.moon || 9, kind);
      const nh = nmcHours(it);
      if (nh.hours) h.nmc = Object.assign(h.nmc || {}, nh, { at: new Date().toISOString() });
      matched++;
    }
    console.log(`달빛어린이병원·소아전문센터 ${baby.length}곳 중 ${matched}곳 연결` + (missed.length ? ` (못 찾음: ${missed.slice(0, 8).join(', ')}${missed.length > 8 ? ' 외' : ''})` : ''));
  } catch (e) {
    console.error('달빛어린이병원 조회 실패(이전 자료 유지): ' + e.message);
  }

  // 2) 응급의료기관 (정부 지정 응급실: 권역센터·지역센터·지역기관) — 매일
  try {
    const er = await fetchAll(callApi, 'getEgytListInfoInqire', 500, 10, null, ER_BASE);
    if (er[0]) console.log('  (응급의료기관 응답 항목: ' + Object.keys(er[0]).join(', ') + ')');
    for (const h of items) delete h.erInfo;
    let matched = 0;
    for (const it of er) {
      if (String(it.dutyEryn) === '2') continue; // 응급실 운영 안 함
      const h = findMatch(grid, it);
      if (!h) continue;
      h.erInfo = { level: it.dutyEmclsName || '', tel: it.dutyTel3 || '' };
      matched++;
    }
    console.log(`응급의료기관 ${er.length}곳 중 소아과 목록과 ${matched}곳 연결`);
  } catch (e) {
    console.error('응급의료기관 조회 실패(이전 자료 유지): ' + e.message);
  }

  // 3) 전국 진료시간 (7일마다)
  const last = state.nmc.fullAt ? Date.parse(state.nmc.fullAt) : 0;
  if (Date.now() - last < FULL_EVERY_DAYS * 86400000) {
    console.log(`국립중앙의료원 진료시간: ${FULL_EVERY_DAYS}일 이내에 받아서 건너뜀`);
    return;
  }
  try {
    const all = await fetchAll(callApi, 'getHsptlMdcncFullDown', 1000, 150, console.log);
    let filled = 0;
    for (const it of all) {
      const nh = nmcHours(it);
      if (!nh.hours && !nh.holiday) continue;
      const h = findMatch(grid, it);
      if (!h) continue;
      h.nmc = Object.assign(h.nmc || {}, nh, { at: new Date().toISOString() });
      filled++;
    }
    state.nmc.fullAt = new Date().toISOString();
    console.log(`국립중앙의료원 진료시간 ${all.length}곳 중 ${filled}곳 연결`);
  } catch (e) {
    console.error('국립중앙의료원 진료시간 조회 실패(다음에 다시): ' + e.message);
  }
}

module.exports = { supplement, nmcHours, norm, similar };
