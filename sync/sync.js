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
  transUrl: (process.env.HIRA_TRANS_URL || '').trim() || 'https://apis.data.go.kr/B551182/MadmDtlInfoService2.8/getTrnsprtInfo2.8',
  sdrUrl: (process.env.HIRA_SDR_URL || '').trim() || 'https://apis.data.go.kr/B551182/MadmDtlInfoService2.8/getSpcSbjtSdrInfo2.8',
  transPerRun: Number(process.env.TRANS_DAILY_LIMIT || 4000),   // 소아과·병원급만, 90일마다
  sdrPerRun: Number(process.env.SDR_DAILY_LIMIT || 6000),       // 전체 (소아과·병원급 먼저), 90일마다
  extraMaxAgeDays: 90,
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
// 심평원은 초당 요청 수를 제한함(오류 23 / HTTP 429). 요청 사이 간격을 두고, 걸리면 쉬었다가 다시.
const GAP_MS = Number(process.env.API_GAP_MS || 250);
let lastCall = 0;
async function throttle() {
  const wait = lastCall + GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}
async function callApi(base, params, tries = 3) {
  // 인증키는 포털의 "Encoding" 키를 그대로 붙인다 (다시 인코딩하면 오류)
  const url = base + '?serviceKey=' + CFG.key + '&' + Object.entries(params).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
  let lastErr, limited = 0;
  for (let i = 0; i < tries; i++) {
    try {
      await throttle();
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 30000);
      const res = await fetch(url, { headers: { Accept: '*/*' }, signal: ctl.signal });
      clearTimeout(t);
      const body = await res.text();
      const code = tagValue(body, 'resultCode') || tagValue(body, 'returnReasonCode');
      if (!res.ok || (code && code !== '00')) {
        const msg = tagValue(body, 'resultMsg') || tagValue(body, 'returnAuthMsg') || body.slice(0, 200);
        if ((code === '23' || res.status === 429) && limited < 8) {
          limited++; i--; // 횟수에 안 셈
          await new Promise((r) => setTimeout(r, 1000 * limited));
          continue;
        }
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
function parkText(d) {
  const q = Number(String(d.parkQty || '').replace(/[^0-9]/g, '')) || 0;
  const parts = [];
  if (q > 0) parts.push('주차 ' + q + '대');
  if (d.parkXpnsYn === 'Y') parts.push('유료'); else if (d.parkXpnsYn === 'N' && q > 0) parts.push('무료');
  const etc = String(d.parkEtc || '').trim();
  if (etc && etc.length <= 60) parts.push(etc);
  return parts.join(' · ');
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
    // 응급실 운영 (외래가 끝난 뒤 소아 환자를 받는 곳 — 외래 야간 진료와는 다름)
    erDay: d.emyDayYn === 'Y', erNight: d.emyNgtYn === 'Y',
    erTel: d.emyNgtTelNo1 || d.emyDayTelNo1 || '',
    // 주차: parkQty 대수, parkXpnsYn 주차비 부담 여부(Y=유료), parkEtc 기타 안내
    park: parkText(d),
    v: 3,
    at: new Date().toISOString(),
  };
}

// ───── 부가 조회 (교통·전문의) ─────
async function runQueue(label, url, targets, onItems) {
  let n = 0, logged = false;
  for (const h of targets) {
    try {
      const r = await callApi(url, { ykiho: h.id, pageNo: 1, numOfRows: 50 }, 2);
      if (r.items[0] && !logged) { logged = true; console.log(`  (${label} 응답 항목 예시: ` + Object.keys(r.items[0]).join(', ') + ')'); }
      onItems(h, r.items);
      n++;
      if (n % 500 === 0) console.log(`  ${label} ${n}곳 조회…`);
    } catch (e) {
      if (e.fatal) { console.error(`${label} 조회 중단: ${e.message}`); break; }
    }
  }
  console.log(`${label} 이번에 ${n}곳 갱신`);
}
function transLine(it) {
  const kind = it.trafNm || '';
  const line = it.lineNo || '';
  const stop = it.arivPlc || '';
  const dir = it.dir || '';
  const dist = String(it.dist || '').replace(/[^0-9]/g, '');
  const txt = [kind, line, stop ? stop + ' 하차' : '', dir, dist ? '약 ' + dist + 'm' : ''].filter(Boolean).join(' ');
  return txt || Object.values(it).filter((v) => typeof v === 'string' && v.length < 40).join(' ').slice(0, 80);
}
function pedsSpecialists(items) {
  let n = 0;
  for (const it of items) {
    const name = Object.values(it).find((v) => typeof v === 'string' && /소아청소년과|소아과/.test(v));
    if (!name) continue;
    const cntKey = Object.keys(it).find((k) => /cnt$/i.test(k) && /^\d+$/.test(String(it[k]).trim()));
    n += cntKey ? Number(it[cntKey]) : 1;
  }
  return n;
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
    .filter((h) => !h.detail || h.detail.v !== 3 || Date.now() - Date.parse(h.detail.at) > maxAge) // v3: 주차 항목 추가로 한 번 다시 받음
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
        h.detail = r.items[0] ? parseDetail(r.items[0]) : { hours: null, v: 3, at: new Date().toISOString() };
        n++;
      } catch (e) {
        if (e.fatal) { if (!stop) console.error('상세 조회 중단: ' + e.message); stop = true; break; }
        console.error(`상세 실패 ${h.name}: ${e.message}`);
      }
      if (++done % 500 === 0) { console.log(`  진료시간 ${done}곳 조회…`); writeJson(P.state, state, true); }
    }
  };
  await worker(); // 한 곳씩 차례로 (초당 제한 때문)
  const all = Object.values(state.items);
  const withHours = all.filter((h) => h.detail && h.detail.hours).length;
  const peds = all.filter(isPeds);
  console.log(`진료시간 이번에 ${n}곳 갱신 / 전체 ${all.length}곳 중 ${withHours}곳 보유 (소아과·병원급 ${peds.length}곳 중 ${peds.filter((h) => h.detail && h.detail.hours).length}곳)`);
  writeJson(P.state, state, true);

  // 2-b) 교통정보(소아과·병원급) · 전문의 수(소아청소년과 전문의 있는지) — 작업마다 하루 한도가 따로 있음
  const extraAge = CFG.extraMaxAgeDays * 86400000;
  const stale = (x) => !x || Date.now() - Date.parse(x.at) > extraAge;
  await runQueue('교통정보', CFG.transUrl,
    Object.values(state.items).filter((h) => isPeds(h) && stale(h.trans)).slice(0, CFG.transPerRun),
    (h, items) => { h.trans = { lines: items.map(transLine).filter(Boolean).slice(0, 3), at: new Date().toISOString() }; });
  await runQueue('전문의 수', CFG.sdrUrl,
    Object.values(state.items).filter((h) => stale(h.sdr)).sort((a, b) => isPeds(b) - isPeds(a)).slice(0, CFG.sdrPerRun),
    (h, items) => { h.sdr = { peds: pedsSpecialists(items), at: new Date().toISOString() }; });
  writeJson(P.state, state, true);
  const sdrDone = Object.values(state.items).filter((h) => h.sdr).length;
  console.log(`소아청소년과 전문의 확인: 전체 ${Object.keys(state.items).length}곳 중 ${sdrDone}곳 조회, ${Object.values(state.items).filter((h) => h.sdr && h.sdr.peds > 0).length}곳 전문의 있음`);

  // 3) 국립중앙의료원 보충 (달빛어린이병원, 심평원에 없는 진료시간)
  await require('./nmc.js').supplement(state, callApi);
  writeJson(P.state, state, true);

  // 4) 공휴일(자동) · 약국
  const extra = require('./extra.js');
  state.holidays = await extra.holidays(callApi, readJson(P.holi, []));
  const pc = await extra.pharmacies(callApi, state, P.outDir);
  if (pc) state.pharmCount = pc;
  writeJson(P.state, state, true);

  // 5) 앱용 파일
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
    if (h.moon) o.m = h.moon; else if (isMoon(h)) o.m = 1; // 1=달빛어린이병원, 2=소아전문센터
    // 분류: 1=소아 전문(이름 또는 소아청소년과 전문의 있음), 2=병원급(소아청소년과 있음), 3=일반 의원(진료과목에 소아청소년과만 등록)
    if (/요양병원|정신병원|치과|한방|한의원/.test(h.type)) continue;
    const sd = h.sdr ? h.sdr.peds : 0;
    if (sd > 0) o.sd = sd;
    if (PEDS_NAME.test(h.name)) o.k = 1;
    else if (/상급종합|종합병원|^병원$/.test(h.type)) o.k = 2;
    else if (sd > 0) o.k = 1;
    else o.k = 3;
    if (o.k !== 3 && h.detail && h.detail.park) o.pk = h.detail.park;
    if (o.k !== 3 && h.trans && h.trans.lines && h.trans.lines.length) o.tr = h.trans.lines;
    const d = h.detail, nm = h.nmc;
    if (d && d.erNight) { o.er = 1; if (d.erTel) o.et = d.erTel; }
    if (h.erInfo) { o.er = 1; if (h.erInfo.tel) o.et = h.erInfo.tel; if (h.erInfo.level) o.el = h.erInfo.level; } // 국립중앙의료원 지정 응급실
    if (d && d.hours) {
      o.h = d.hours;
      if (d.holidayOpen) o.ho = 1;
      if (d.lunch) o.l = d.lunch;
      if (d.lunchSat) o.ls = d.lunchSat;
      if (d.holiNote) o.hn = d.holiNote;
      if (d.sunNote) o.sn = d.sunNote;
    } else if (nm && nm.hours) {
      o.h = nm.hours; o.hs = 'n'; // 국립중앙의료원 자료
    }
    if (nm && nm.holiday) {         // 공휴일 진료시간이 따로 있으면 그걸 씀
      o.hh = nm.holiday; o.ho = 1;
      if (!o.hn) o.hn = '공휴일 ' + nm.holiday.replace(/(\d\d)(\d\d)-(\d\d)(\d\d)/, '$1:$2~$3:$4') + ' 진료';
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
    holidays: state.holidays && state.holidays.length ? state.holidays : readJson(P.holi, []),
    pharmCount: state.pharmCount || 0,
    pharmAt: state.pharmAt || null,
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
