/*
 * 더 받는 자료 (활용신청이 따로 필요한 것 포함 — 신청 전이면 조용히 건너뛴다)
 *  1) 우리 지역 혜택: 행정안전부 「대한민국 공공서비스(혜택) 정보」 (공공데이터포털 15113968, 7일마다)
 *     → docs/data/lb/<시도코드>.json  (시·군·구별 출산·육아·아동 혜택)
 *  2) 유행 감염병 (하루 1번)
 *     - 질병관리청 「전수신고 감염병 발생현황」 (공공데이터포털 15139178): 수두·볼거리·성홍열·백일해·홍역 전국 주별 신고 수
 *     - 질병관리청 감염병포털 인플루엔자 표본감시 화면 자료: 연령별 독감 의사환자 분율 (외래 1,000명당)
 *     → docs/data/epi.json
 * 같은 공공데이터포털 인증키(HIRA_SERVICE_KEY)를 쓴다. 키는 로그에 남기지 않는다.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const GOV24_URL = (process.env.GOV24_URL || '').trim() || 'https://api.odcloud.kr/api/gov24/v3/serviceList';
const EID_URL = (process.env.EID_URL || '').trim() || 'https://apis.data.go.kr/1790387/EIDAPIService/PeriodBasic';
const PORTAL = (process.env.KDCA_PORTAL || '').trim() || 'https://dportal.kdca.go.kr/pot/is/st/';
const LB_EVERY_DAYS = 7;
// 독감 유행기준 (전체 연령, 외래 1,000명당). 절기마다 질병관리청 발표를 보고 고친다.
const FLU_THRESHOLD = { season: 2026, v: 12.9 };
const EPI_DISEASES = ['수두', '유행성이하선염', '성홍열', '백일해', '홍역'];
const EPI_LABEL = { 유행성이하선염: '볼거리(유행성이하선염)' };

const SIDO_FULL = [
  [/^서울/, '110000'], [/^부산/, '210000'], [/^인천/, '220000'], [/^대구/, '230000'], [/^광주/, '240000'], [/^대전/, '250000'],
  [/^울산/, '260000'], [/^세종/, '410000'], [/^경기/, '310000'], [/^강원/, '320000'], [/^충청북도|^충북/, '330000'],
  [/^충청남도|^충남/, '340000'], [/^전라북도|^전북/, '350000'], [/^전라남도|^전남/, '360000'], [/^경상북도|^경북/, '370000'],
  [/^경상남도|^경남/, '380000'], [/^제주/, '390000'],
];
const KID = /영유아|영아|유아|아동|어린이|아이|출산|출생|임신|임산부|산모|산후|신생아|육아|보육|양육|다자녀|소아|난임|돌봄|아기/;
const NOT_KID = /노인|어르신|경로|청년(?!.*(출산|육아))|대학생|장애인연금|기초연금|농업인|어업인|소상공인|퇴직/;

async function getJson(url, opt) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 40000);
  try {
    const res = await fetch(url, Object.assign({ signal: ctl.signal }, opt || {}));
    const body = await res.text();
    if (body.trim().startsWith('<')) {
      const reason = (/<returnAuthMsg>([^<]*)/.exec(body) || /<errMsg>([^<]*)/.exec(body) || [])[1] || ('HTTP ' + res.status);
      const e = new Error(reason); e.auth = /SERVICE_KEY|NOT_REGISTERED|등록되지/.test(body); throw e;
    }
    const j = JSON.parse(body);
    if (!res.ok) { const e = new Error((j && (j.msg || j.message)) || 'HTTP ' + res.status); e.auth = res.status === 401 || res.status === 403 || (j && j.code === -4); throw e; }
    return { j, res };
  } finally { clearTimeout(t); }
}
const cut = (v, n) => { const s = String(v || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

// ───── 1) 우리 지역 혜택 ─────
function mapRegion(agency, regions) {
  const a = String(agency || '').trim();
  let sidoCd = '';
  for (const [re, cd] of SIDO_FULL) if (re.test(a)) { sidoCd = cd; break; }
  const rest = (sidoCd ? a.replace(/^\S+/, '') : a).replace(/\s/g, '');
  const matchSg = (cd) => {
    const r = regions[cd]; if (!r || !rest) return [];
    const city = rest.replace(/(시|군|구)$/, '');
    return Object.entries(r.sggu || {}).filter(([, nm]) => {
      const n = String(nm).replace(/\s/g, '');
      return n === rest || (rest.length >= 3 && n.startsWith(rest)) || (/시$/.test(rest) && city.length >= 2 && n.startsWith(city));
    }).map(([c]) => c);
  };
  if (sidoCd) {
    if (!rest) return { sidoCd, sg: [] };           // 도·광역시 전체 혜택
    const sg = matchSg(sidoCd);
    return sg.length ? { sidoCd, sg } : null;
  }
  // 시도 이름 없이 "김천시"처럼 온 경우: 전국에서 한 곳으로만 맞을 때만
  const hits = [];
  for (const cd of Object.keys(regions)) { const sg = matchSg(cd); if (sg.length) hits.push({ sidoCd: cd, sg }); }
  return hits.length === 1 ? hits[0] : null;
}
async function localBenefits(key, state, outDir, regions) {
  const dir = path.join(outDir, 'lb');
  const last = state.lbAt ? Date.parse(state.lbAt) : 0;
  if (fs.existsSync(dir) && Date.now() - last < LB_EVERY_DAYS * 86400000) { console.log(`지역 혜택: ${LB_EVERY_DAYS}일 이내에 받아서 건너뜀`); return; }
  try {
    const all = [];
    let page = 1, total = 0;
    do {
      const { j } = await getJson(`${GOV24_URL}?page=${page}&perPage=1000&returnType=JSON&serviceKey=${key}`);
      total = Number(j.totalCount || j.matchCount || 0);
      const data = Array.isArray(j.data) ? j.data : [];
      if (page === 1 && data[0]) console.log('  (지역 혜택 응답 항목: ' + Object.keys(data[0]).join(', ') + ')');
      all.push(...data);
      if (!data.length) break;
      page++;
    } while (all.length < total && page <= 40);
    const out = {};
    let kept = 0;
    for (const it of all) {
      const text = [it['서비스명'], it['서비스목적요약'], it['지원대상'], it['서비스분야']].join(' ');
      if (!KID.test(String(it['서비스명'] || '') + ' ' + String(it['지원대상'] || ''))) continue;
      if (NOT_KID.test(String(it['서비스명'] || ''))) continue;
      const type = String(it['소관기관유형'] || '');
      if (type && !/지자체|지방|시|군|구|도/.test(type)) continue; // 중앙부처 혜택은 benefits.json 에서 따로 안내
      const reg = mapRegion(it['소관기관명'], regions);
      if (!reg) continue;
      const row = {
        n: cut(it['서비스명'], 60), s: cut(it['서비스목적요약'], 120), t: cut(it['지원대상'], 140), c: cut(it['지원내용'], 160),
        how: cut(it['신청방법'], 80), u: String(it['상세조회URL'] || '').trim(), ag: cut(it['소관기관명'], 40), tel: cut(it['전화문의'], 40),
        v: Number(it['조회수'] || 0), f: cut(it['서비스분야'], 20),
      };
      if (!/^https?:\/\//.test(row.u)) row.u = '';
      if (!/(?:출산|임신|산모|산후|신생아|난임)/.test(text) && !/(?:영유아|영아|유아|아동|어린이|보육|양육|육아|아이|아기|다자녀|소아|돌봄)/.test(text)) continue;
      const o = (out[reg.sidoCd] = out[reg.sidoCd] || { all: [], sg: {} });
      if (reg.sg.length) reg.sg.forEach((c) => { (o.sg[c] = o.sg[c] || []).push(row); });
      else o.all.push(row);
      kept++;
    }
    if (!kept) throw new Error('맞는 혜택이 없음 (응답 형식이 바뀌었을 수 있음)');
    fs.mkdirSync(dir, { recursive: true });
    const at = new Date().toISOString();
    for (const [cd, o] of Object.entries(out)) {
      const top = (arr) => arr.sort((a, b) => b.v - a.v).slice(0, 40).map((r) => { const x = Object.assign({}, r); delete x.v; return x; });
      o.all = top(o.all); for (const c of Object.keys(o.sg)) o.sg[c] = top(o.sg[c]);
      fs.writeFileSync(path.join(dir, cd + '.json'), JSON.stringify({ at, src: '행정안전부 대한민국 공공서비스(혜택) 정보', name: (regions[cd] || {}).name || '', all: o.all, sg: o.sg }));
    }
    state.lbAt = at;
    console.log(`지역 혜택: 전체 ${all.length}개 중 출산·육아·아동 ${kept}개 저장 (${Object.keys(out).length}개 시도)`);
  } catch (e) {
    if (e.auth) console.log('지역 혜택: 아직 활용신청 전이거나 승인 대기 중이에요 (공공데이터포털 15113968) — 건너뜀');
    else console.error('지역 혜택 조회 실패(이전 자료 유지): ' + e.message);
  }
}

// ───── 2) 유행 감염병 ─────
function num(v) { const s = String(v == null ? '' : v).replace(/,/g, '').trim(); return /^\d+(\.\d+)?$/.test(s) ? Number(s) : null; }
async function notifiable(key) {
  const y = new Date(Date.now() + 9 * 3600000).getUTCFullYear();
  const rows = [];
  for (const yr of [y - 1, y]) {
    const { j } = await getJson(`${EID_URL}?serviceKey=${key}&resType=2&searchPeriodType=3&searchStartYear=${yr}&searchEndYear=${yr}&pageNo=1&numOfRows=5000`);
    const hdr = (j.response && j.response.header) || j.header || {};
    if (hdr.resultCode && hdr.resultCode !== '00') throw new Error('전수신고 API ' + hdr.resultCode + ' ' + (hdr.resultMsg || ''));
    let items = j.response && j.response.body && j.response.body.items && j.response.body.items.item;
    if (items && !Array.isArray(items)) items = [items];
    for (const it of items || []) {
      const m = /(\d{4})년\s*(\d{1,2})주/.exec(it.period || '');
      if (!m) continue; // "계" 행 버림
      const name = String(it.icdNm || '').replace(/^@/, '').trim();
      if (!EPI_DISEASES.includes(name)) continue;
      rows.push({ n: name, y: +m[1], w: +m[2], v: num(it.resultVal) || 0 });
    }
  }
  if (!rows.length) throw new Error('전수신고 자료가 비어 있음');
  // 기준 주 = 가장 최근 주에서 2주 전 (최근 주는 신고가 늦게 들어와 줄어 보임)
  const weeks = Array.from(new Set(rows.map((r) => r.y * 100 + r.w))).sort((a, b) => a - b);
  const ref = weeks[weeks.length - 3];
  const prevWeeks = weeks.filter((w) => w < ref).slice(-4);
  const out = EPI_DISEASES.map((n) => {
    const at = (w) => rows.filter((r) => r.n === n && r.y * 100 + r.w === w).reduce((s, r) => s + r.v, 0);
    const v = at(ref), prev = prevWeeks.length ? prevWeeks.map(at).reduce((s, x) => s + x, 0) / prevWeeks.length : 0;
    const lastYr = at(ref - 100);
    const trend = v >= 10 && v > prev * 1.2 ? 'up' : prev >= 10 && v < prev * 0.8 ? 'down' : 'flat';
    return { n: EPI_LABEL[n] || n, v, prev: Math.round(prev * 10) / 10, ly: lastYr, trend };
  });
  return { week: `${Math.floor(ref / 100)}년 ${ref % 100}주`, items: out };
}
async function influenza() {
  const now = new Date(Date.now() + 9 * 3600000);
  const y = now.getUTCFullYear(), start = now.getUTCMonth() >= 8 ? y : y - 1;
  const r0 = await fetch(PORTAL + 'influ.do', { headers: { 'User-Agent': 'Mozilla/5.0 (aiapulttae sync)' } });
  const ck = (typeof r0.headers.getSetCookie === 'function' ? r0.headers.getSetCookie() : [r0.headers.get('set-cookie') || ''])
    .map((c) => String(c).split(';')[0]).filter(Boolean).join('; ');
  await r0.text();
  const body = new URLSearchParams({ startYear: String(start), endYear: String(start + 1), age: '', intoDivi: '1', sido: '' }).toString();
  const { j } = await getJson(PORTAL + 'influListAjax.do', {
    method: 'POST', body,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest', Cookie: ck, Referer: PORTAL + 'influ.do', 'User-Agent': 'Mozilla/5.0 (aiapulttae sync)' },
  });
  const v = j && j.value; if (!v || !Array.isArray(v.headerList) || !Array.isArray(v.data)) throw new Error('독감 자료 형식이 달라요');
  const weeks = v.headerList.map((h) => String(h.TITLE || ''));
  const rows = {};
  for (const r of v.data) rows[String(r.TITLE || '').replace(/\s/g, '')] = r;
  const pick = (age) => {
    const r = rows[age]; if (!r) return null;
    const vals = weeks.map((_, i) => num(r['COLUMN' + (i + 1)]));
    let k = vals.length - 1; while (k >= 0 && vals[k] == null) k--;
    if (k < 0) return null;
    return { v: vals[k], prev: k > 0 ? vals[k - 1] : null, wk: weeks[k] };
  };
  const ages = {};
  for (const a of ['0세', '1-6세', '7-12세', '13-18세']) { const p = pick(a); if (p) ages[a] = p; }
  if (!Object.keys(ages).length) throw new Error('독감 연령별 자료가 비어 있음');
  const wk = (ages['1-6세'] || ages['7-12세'] || Object.values(ages)[0]).wk;
  return { season: `${start}-${start + 1}`, week: wk, ages, threshold: FLU_THRESHOLD.season === start ? FLU_THRESHOLD.v : null };
}
async function epidemic(key, outDir) {
  const out = path.join(outDir, 'epi.json');
  const prev = (() => { try { return JSON.parse(fs.readFileSync(out, 'utf8')); } catch (e) { return {}; } })();
  const res = { at: new Date().toISOString(), src: '질병관리청 (전수신고 감염병 발생현황 · 인플루엔자 표본감시)', nat: prev.nat || null, flu: prev.flu || null };
  let ok = 0;
  try { res.nat = await notifiable(key); ok++; console.log(`유행 감염병(전수신고): ${res.nat.week} 기준 ` + res.nat.items.map((x) => `${x.n} ${x.v}`).join(', ')); }
  catch (e) { if (e.auth) console.log('유행 감염병: 「질병관리청_전수신고 감염병 발생현황」 활용신청 전이거나 승인 대기 중이에요 (15139178) — 건너뜀'); else console.error('전수신고 감염병 조회 실패(이전 자료 유지): ' + e.message); }
  try { res.flu = await influenza(); ok++; console.log(`독감 표본감시: ${res.flu.season} ${res.flu.week} ` + Object.entries(res.flu.ages).map(([a, x]) => `${a} ${x.v}`).join(', ')); }
  catch (e) { console.error('독감 표본감시 조회 실패(이전 자료 유지): ' + e.message); }
  if (ok || res.nat || res.flu) { fs.mkdirSync(outDir, { recursive: true }); fs.writeFileSync(out, JSON.stringify(res)); }
}

module.exports = { localBenefits, epidemic, mapRegion, notifiable, influenza, KID };
