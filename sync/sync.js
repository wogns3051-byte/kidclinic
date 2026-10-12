/*
 * 전국 소아청소년과 데이터 갱신 스크립트 (GitHub Actions 가 매일 실행, 내 PC 에서도 실행 가능)
 *  - 건강보험심사평가원 병원정보서비스(목록) + 의료기관별상세정보서비스(진료시간)
 *  - 결과: docs/data/hospitals.json, docs/data/meta.json  (GitHub Pages 로 무료 공개)
 *  - 누적 상태: state/hospitals.json (진료시간은 하루 상한만큼 나눠서 모음)
 * Node 18 이상 (내장 fetch 사용), 외부 라이브러리 없음.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CFG = {
  key: (process.env.HIRA_SERVICE_KEY || '').trim(),
  // 주소가 바뀌면 GitHub Settings > Secrets and variables > Actions > Variables 에서 같은 이름으로 덮어쓸 수 있음
  listUrl: (process.env.HIRA_LIST_URL || '').trim() || 'https://apis.data.go.kr/B551182/hospInfoServicev2/getHospBasisList',
  detailUrl: (process.env.HIRA_DETAIL_URL || '').trim() || 'https://apis.data.go.kr/B551182/MadmDtlInfoService2.8/getDtlInfo2.8',
  deptCode: process.env.DEPT_CODE || '11', // 11 = 소아청소년과
  detailPerRun: Number(process.env.DETAIL_DAILY_LIMIT || 9000), // 심평원 일일 한도 10,000건
  detailMaxAgeDays: Number(process.env.DETAIL_MAX_AGE_DAYS || 30),
  root: process.env.KIDCLINIC_ROOT || ROOT,
};
const P = {
  state: path.join(CFG.root, 'state', 'hospitals.json'),
  moon: path.join(CFG.root, 'data', 'moonlight.json'),
  holi: path.join(CFG.root, 'data', 'holidays.json'),
  outDir: path.join(CFG.root, 'docs', 'data'),
};

const SIDO = [
  ['110000', '서울'], ['210000', '부산'], ['220000', '인천'], ['230000', '대구'],
  ['240000', '광주'], ['250000', '대전'], ['260000', '울산'], ['410000', '세종'],
  ['310000', '경기'], ['320000', '강원'], ['330000', '충북'], ['340000', '충남'],
  ['350000', '전북'], ['360000', '전남'], ['370000', '경북'], ['380000', '경남'],
  ['390000', '제주'],
];
const PEDS_NAME = /소아|아동|어린이|키즈|kids|베이비|baby/i;
const isPeds = (h) => (PEDS_NAME.test(h.name) || /상급종합|종합병원|^병원$/.test(h.type) ? 1 : 0);
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function readJson(f, d) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } }
function writeJson(f, v, pretty) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, pretty ? JSON.stringify(v, null, 1) : JSON.stringify(v));
}

// ───── API 호출 + XML 파서 ─────
function decodeXml(s) {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&').trim();
}
function parseItems(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml))) {
    const o = {};
    const fre = /<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g;
    let f;
    while ((f = fre.exec(m[1]))) o[f[1]] = decodeXml(f[2]);
    items.push(o);
  }
  return items;
}
function tagValue(xml, tag) {
  const m = new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>').exec(xml);
  return m ? decodeXml(m[1]) : '';
}
async function callApi(base, params, tries = 3) {
  // 인증키는 포털의 "Encoding" 키를 그대로 붙인다 (다시 인코딩하면 오류)
  const url = base + '?serviceKey=' + CFG.key + '&' + Object.entries(params).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 30000);
      const res = await fetch(url, { headers: { Accept: '*/*' }, signal: ctl.signal });
      clearTimeout(t);
      const body = await res.text();
      const code = tagValue(body, 'resultCode') || tagValue(body, 'returnReasonCode');
      if (!res.ok || (code && code !== '00')) {
        const msg = tagValue(body, 'resultMsg') || tagValue(body, 'returnAuthMsg') || body.slice(0, 200);
        const err = new Error(`API 오류 HTTP ${res.status} ${code} ${msg}`);
        // 인증키 미등록(30)·기한만료(31)·호출한도 초과(22) 는 다시 해도 소용없으므로 즉시 중단
        // 서비스 없음(12)도 주소 문제라 반복해도 같은 결과
        if (['12', '22', '30', '31'].includes(code) || /SERVICE_KEY|LIMITED_NUMBER|TRAFFIC|서비스가 없거나/.test(msg)) { err.fatal = true; throw err; }
        throw err;
      }
      return { items: parseItems(body), total: Number(tagValue(body, 'totalCount') || 0) };
    } catch (e) {
      lastErr = e;
      if (e.fatal) throw e;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr;
}

// ───── 진료시간 ─────
function hhmm(v) {
  const s = String(v || '').replace(/[^0-9]/g, '');
  if (s.length < 3) return null;
  return s.padStart(4, '0').slice(0, 4);
}
function parseDetail(d) {
  const hours = DAYS.map((K) => {
    const s = hhmm(d['trmt' + K + 'Start']), e = hhmm(d['trmt' + K + 'End']);
    return s && e && Number(e) > Number(s) ? s + '-' + e : '';
  });
  const holi = d.noTrmtHoli || '';
  return {
    hours: hours.some(Boolean) ? hours : null, // 시간이 하나도 없으면 '모름'으로 (전부 휴진으로 잘못 보이지 않게) // [일,월,화,수,목,금,토] "0900-1800" 또는 ""
    lunch: d.lunchWeek || '', lunchSat: d.lunchSat || '',
    sunNote: d.noTrmtSun || '', holiNote: holi,
    holidayOpen: !!holi && !/휴진|휴무|없음/.test(holi),
    at: new Date().toISOString(),
  };
}

// ───── 실행 ─────
async function main() {
  if (!CFG.key) throw new Error('HIRA_SERVICE_KEY 가 없습니다. (GitHub: Settings > Secrets and variables > Actions)');
  const state = readJson(P.state, { listUpdatedAt: null, items: {} });

  // 1) 전국 목록
  const seen = new Set();
  let listOk = 0;
  for (const [sidoCd, sidoNm] of SIDO) {
    let page = 1, got = 0, total = 0;
    try {
      do {
        const r = await callApi(CFG.listUrl, { pageNo: page, numOfRows: 1000, sidoCd, dgsbjtCd: CFG.deptCode });
        total = r.total;
        for (const it of r.items) {
          if (!it.ykiho) continue;
          seen.add(it.ykiho);
          const prev = state.items[it.ykiho] || {};
          state.items[it.ykiho] = Object.assign(prev, {
            id: it.ykiho, name: it.yadmNm || '', type: it.clCdNm || '',
            sidoCd: it.sidoCd || sidoCd, sido: it.sidoCdNm || sidoNm,
            sgguCd: it.sgguCd || '', sggu: it.sgguCdNm || '',
            addr: it.addr || '', tel: it.telno || '', url: it.hospUrl || '',
            lng: it.XPos ? Number(Number(it.XPos).toFixed(6)) : null,
            lat: it.YPos ? Number(Number(it.YPos).toFixed(6)) : null,
            doctors: it.drTotCnt ? Number(it.drTotCnt) : null,
          });
        }
        got += r.items.length;
        page++;
      } while (got < total && page < 50);
      listOk++;
      console.log(`목록 ${sidoNm}: ${got}곳`);
    } catch (e) {
      if (e.fatal) throw e;
      console.error(`목록 ${sidoNm} 실패: ${e.message} (이 시도는 이전 자료 유지)`);
      for (const h of Object.values(state.items)) if (h.sidoCd === sidoCd) seen.add(h.id);
    }
  }
  if (!listOk) throw new Error('모든 시도의 목록 조회에 실패했습니다.');
  console.log(`목록 합계: ${seen.size}곳`);
  let removed = 0;
  for (const id of Object.keys(state.items)) if (!seen.has(id)) { delete state.items[id]; removed++; }
  state.listUpdatedAt = new Date().toISOString();
  if (removed) console.log(`폐업·과목폐지 ${removed}곳 제외`);

  // 2) 진료시간 (오래된 것부터, 상한만큼)
  const maxAge = CFG.detailMaxAgeDays * 86400000;
  const targets = Object.values(state.items)
    .filter((h) => !h.detail || Date.now() - Date.parse(h.detail.at) > maxAge)
    // 소아과 전문·병원급 먼저, 그다음 오래된 순
    .sort((a, b) => (isPeds(b) - isPeds(a)) || ((a.detail ? Date.parse(a.detail.at) : 0) - (b.detail ? Date.parse(b.detail.at) : 0)))
    .slice(0, CFG.detailPerRun);
  let n = 0, stop = false, done = 0, loggedKeys = false;
  const worker = async () => {
    while (!stop && targets.length) {
      const h = targets.shift();
      try {
        const r = await callApi(CFG.detailUrl, { ykiho: h.id, pageNo: 1, numOfRows: 1 }, 2);
        if (r.items[0] && !loggedKeys) { loggedKeys = true; console.log('  (응답 항목 예시: ' + Object.keys(r.items[0]).join(', ') + ')'); }
        h.detail = r.items[0] ? parseDetail(r.items[0]) : { hours: null, at: new Date().toISOString() };
        n++;
      } catch (e) {
        if (e.fatal) { if (!stop) console.error('상세 조회 중단: ' + e.message); stop = true; break; }
        console.error(`상세 실패 ${h.name}: ${e.message}`);
      }
      if (++done % 500 === 0) { console.log(`  진료시간 ${done}곳 조회…`); writeJson(P.state, state, true); }
    }
  };
  await Promise.all([1, 2, 3, 4].map(worker)); // 4곳씩 동시에
  const all = Object.values(state.items);
  const withHours = all.filter((h) => h.detail && h.detail.hours).length;
  const peds = all.filter(isPeds);
  console.log(`진료시간 이번에 ${n}곳 갱신 / 전체 ${all.length}곳 중 ${withHours}곳 보유 (소아과·병원급 ${peds.length}곳 중 ${peds.filter((h) => h.detail && h.detail.hours).length}곳)`);
  writeJson(P.state, state, true);

  // 3) 앱용 파일
  buildOutputs(state);
}

function buildOutputs(state) {
  const moon = readJson(P.moon, []).filter((m) => m && m.name);
  const isMoon = (h) => {
    const n = h.name.replace(/\s/g, '');
    return moon.some((m) => n.includes(String(m.name).replace(/\s/g, '')) && (!m.sido || h.sido.startsWith(m.sido)));
  };
  const regions = {};
  const rows = [];
  const order = SIDO.map((s) => s[0]);
  const list = Object.values(state.items).sort((a, b) => order.indexOf(a.sidoCd) - order.indexOf(b.sidoCd) || a.name.localeCompare(b.name, 'ko'));
  for (const h of list) {
    const r = (regions[h.sidoCd] = regions[h.sidoCd] || { name: h.sido, sggu: {} });
    if (h.sgguCd) r.sggu[h.sgguCd] = h.sggu;
    const o = { i: h.id, n: h.name, t: h.type, s: h.sidoCd, g: h.sgguCd, a: h.addr, p: h.tel };
    if (h.lat != null) { o.y = h.lat; o.x = h.lng; }
    if (h.doctors) o.dr = h.doctors;
    if (h.url) o.u = h.url;
    if (isMoon(h)) o.m = 1;
    // 분류: 1=소아 전문(이름), 2=병원급(소아청소년과 있음), 3=일반 의원(진료과목에 소아청소년과만 등록)
    if (PEDS_NAME.test(h.name)) o.k = 1;
    else if (/상급종합|종합병원|^병원$/.test(h.type)) o.k = 2;
    else if (/요양병원|정신병원|치과|한방|한의원/.test(h.type)) continue;
    else o.k = 3;
    const d = h.detail;
    if (d && d.hours) {
      o.h = d.hours;
      if (d.holidayOpen) o.ho = 1;
      if (d.lunch) o.l = d.lunch;
      if (d.lunchSat) o.ls = d.lunchSat;
      if (d.holiNote) o.hn = d.holiNote;
      if (d.sunNote) o.sn = d.sunNote;
    }
    rows.push(o);
  }
  const meta = {
    updatedAt: state.listUpdatedAt,
    count: rows.length,
    withHours: rows.filter((r) => r.h).length,
    pedsCount: rows.filter((r) => r.k !== 3).length,
    regions,
    sidoOrder: order,
    holidays: readJson(P.holi, []),
    source: '건강보험심사평가원 병원정보서비스·의료기관별상세정보서비스',
  };
  writeJson(path.join(P.outDir, 'hospitals.json'), rows);
  writeJson(path.join(P.outDir, 'meta.json'), meta, true);
  console.log(`앱용 파일 저장: ${rows.length}곳`);
}

module.exports = { main, buildOutputs, parseItems, parseDetail, CFG, P };

if (require.main === module) {
  main().catch((e) => { console.error('실패: ' + e.message); process.exit(1); });
}
