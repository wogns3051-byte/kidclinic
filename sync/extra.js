/*
 * 부가 자료
 *  - 한국천문연구원 특일정보 getRestDeInfo : 공휴일·대체공휴일 (매일, 올해+내년)
 *  - 국립중앙의료원 약국 getParmacyFullDown : 전국 약국 영업시간 (7일마다)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const HOLI_URL = (process.env.HOLIDAY_URL || '').trim() || 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo';
const PHARM_URL = (process.env.PHARM_URL || '').trim() || 'https://apis.data.go.kr/B552657/ErmctInsttInfoInqireService/getParmacyFullDown';
const PHARM_EVERY_DAYS = Number(process.env.PHARM_EVERY_DAYS || 7);

// ───── 공휴일 ─────
async function holidays(callApi, manual) {
  const set = new Set(manual || []);
  const y = new Date(Date.now() + 9 * 3600000).getUTCFullYear();
  let got = 0;
  try {
    for (const year of [y, y + 1]) {
      for (let m = 1; m <= 12; m++) {
        const r = await callApi(HOLI_URL, { solYear: year, solMonth: String(m).padStart(2, '0'), numOfRows: 50, pageNo: 1 });
        for (const it of r.items) {
          if (it.isHoliday && it.isHoliday !== 'Y') continue;
          const d = String(it.locdate || '');
          if (/^\d{8}$/.test(d)) { set.add(d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8)); got++; }
        }
      }
    }
    console.log(`공휴일 ${y}~${y + 1}년 ${got}일 받음`);
  } catch (e) {
    console.error('공휴일 조회 실패(손으로 넣은 holidays.json 사용): ' + e.message);
  }
  return Array.from(set).sort();
}

// ───── 약국 ─────
function t4(v) { const s = String(v || '').replace(/[^0-9]/g, ''); return s.length >= 3 ? s.padStart(4, '0').slice(0, 4) : ''; }
function span(it, n) {
  const s = t4(it['dutyTime' + n + 's']), e = t4(it['dutyTime' + n + 'c']);
  return s && e && Number(e) > Number(s) ? s + '-' + e : '';
}
async function pharmacies(callApi, state, outDir) {
  const out = path.join(outDir, 'pharmacies.json');
  const last = state.pharmAt ? Date.parse(state.pharmAt) : 0;
  if (fs.existsSync(out) && Date.now() - last < PHARM_EVERY_DAYS * 86400000) {
    console.log(`약국: ${PHARM_EVERY_DAYS}일 이내에 받아서 건너뜀`);
    return null;
  }
  try {
    const all = [];
    let page = 1, total = 0;
    do {
      const r = await callApi(PHARM_URL, { pageNo: page, numOfRows: 1000 });
      total = r.total;
      if (page === 1 && r.items[0]) console.log('  (약국 응답 항목: ' + Object.keys(r.items[0]).join(', ') + ')');
      all.push(...r.items);
      if (!r.items.length) break;
      page++;
      if (page % 10 === 0) console.log(`  약국 ${all.length}/${total}`);
    } while (all.length < total && page <= 60);
    const rows = [];
    for (const it of all) {
      const lat = Number(it.wgs84Lat), lng = Number(it.wgs84Lon);
      if (!it.dutyName || !lat || !lng) continue;
      const hours = [span(it, 7), span(it, 1), span(it, 2), span(it, 3), span(it, 4), span(it, 5), span(it, 6)];
      const o = { n: it.dutyName, a: it.dutyAddr || '', p: it.dutyTel1 || '', y: Number(lat.toFixed(6)), x: Number(lng.toFixed(6)) };
      if (hours.some(Boolean)) o.h = hours;
      const hol = span(it, 8);
      if (hol) o.hh = hol;
      rows.push(o);
    }
    if (!rows.length) throw new Error('약국 자료가 비어 있음');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(out, JSON.stringify(rows));
    state.pharmAt = new Date().toISOString();
    console.log(`약국 ${all.length}곳 중 ${rows.length}곳 저장`);
    return rows.length;
  } catch (e) {
    console.error('약국 조회 실패(이전 자료 유지): ' + e.message);
    return null;
  }
}

module.exports = { holidays, pharmacies };
