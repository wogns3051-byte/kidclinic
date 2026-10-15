// 가짜 심평원 API 로 갱신 스크립트를 검사한다.  실행: node sync/test.js
'use strict';
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const H = [
  { ykiho: 'A1', yadmNm: '김천튼튼소아청소년과의원', clCdNm: '의원', sidoCd: '370000', sidoCdNm: '경북', sgguCd: '370100', sgguCdNm: '김천시', addr: '경북 김천시 A로 1', telno: '054-000-0001', XPos: '128.1131234567', YPos: '36.139', drTotCnt: '3', mdeptSdrCnt: '2', mdeptGdrCnt: '1', mdeptResdntCnt: '0', mdeptIntnCnt: '0',
    d: { trmtMonStart: '0900', trmtMonEnd: '2100', trmtSunStart: '1000', trmtSunEnd: '1700', noTrmtHoli: '정상진료', lunchWeek: '13:00~14:00', emyNgtYn: 'Y', emyNgtTelNo1: '054-000-9999', parkQty: '12', parkXpnsYn: 'N', plcNm: '김천역', plcDir: '정문 맞은편', plcDist: '100m', rcvWeek: '08:30~20:30', rcvSat: '09:00~12:30' } },
  { ykiho: 'A2', yadmNm: '구미아동병원', clCdNm: '병원', sidoCd: '370000', sidoCdNm: '경북', sgguCd: '370200', sgguCdNm: '구미시', addr: '경북 구미시 B로 2', telno: '054-000-0002', XPos: '128.344', YPos: '36.119',
    d: { trmtMonStart: '900', trmtMonEnd: '1800', noTrmtHoli: '휴진' } },
  { ykiho: 'C1', yadmNm: '튼튼가정의원', clCdNm: '의원', sidoCd: '370000', sidoCdNm: '경북', sgguCd: '370100', sgguCdNm: '김천시', addr: '경북 김천시 D로 4', telno: '054-000-0004', XPos: '128.12', YPos: '36.13', d: null },
  { ykiho: 'B1', yadmNm: '서울&amp;하늘소아과의원', clCdNm: '의원', sidoCd: '110000', sidoCdNm: '서울', sgguCd: '110001', sgguCdNm: '강남구', addr: '서울 강남구 C로 3', telno: '02-000-0003', XPos: '127.03', YPos: '37.5', d: null },
];
const D = [
  { ykiho: 'D1', yadmNm: '김천튼튼어린이치과의원', clCdNm: '치과의원', sidoCd: '370000', sidoCdNm: '경북', sgguCd: '370100', sgguCdNm: '김천시', addr: '경북 김천시 E로 5', telno: '054-000-0005', XPos: '128.11', YPos: '36.13', drTotCnt: '2', detySdrCnt: '1', detyGdrCnt: '1',
    d: { trmtMonStart: '0930', trmtMonEnd: '1830', trmtSatStart: '0930', trmtSatEnd: '1300', lunchWeek: '13:00~14:00' } },
  { ykiho: 'D2', yadmNm: '바른치과의원', clCdNm: '치과의원', sidoCd: '370000', sidoCdNm: '경북', sgguCd: '370300', sgguCdNm: '상주시', addr: '경북 상주시 F로 6', telno: '054-000-0006', XPos: '128.15', YPos: '36.41', d: null },
];
const xml = (items, total, code = '00') => `<?xml version="1.0"?><response><header><resultCode>${code}</resultCode><resultMsg>OK</resultMsg></header><body><items>${
  items.map((o) => '<item>' + Object.entries(o).map(([k, v]) => `<${k}>${v}</${k}>`).join('') + '</item>').join('')
}</items><totalCount>${total}</totalCount></body></response>`;
let subjCalls = 0, gov24Calls = 0, gov24Auth = false, detailCalls = 0, fullCalls = 0, pharmCalls = 0, transCalls = 0, sdrCalls = 0, failSeoul = false, brokenDetail = false;
const mock = http.createServer((req, res) => {
  const q = new URL(req.url, 'http://x').searchParams;
  if (!req.url.startsWith('/portal')) assert.strictEqual(q.get('serviceKey'), 'TESTKEY');
  if (req.url.startsWith('/list')) {
    if (failSeoul && q.get('sidoCd') === '110000') { res.statusCode = 500; return res.end('err'); }
    const rows = (q.get('dgsbjtCd') === '53' ? D : H).filter((h) => h.sidoCd === q.get('sidoCd')).map(({ d, ...r }) => r);
    return res.end(xml(rows, rows.length));
  }
  if (req.url.startsWith('/nmc/getBabyListInfoInqire')) {
    return res.end(xml([
      { dutyName: '구미아동병원', dutyDivNam: '달빛어린이병원', wgs84Lat: '36.1191', wgs84Lon: '128.3441', dutyTime1s: '0900', dutyTime1c: '2300' },
      { dutyName: '서울하늘소아과의원', dutyDivNam: '소아전문센터', wgs84Lat: '37.5001', wgs84Lon: '127.0301' },
      { dutyName: '없는병원', dutyDivNam: '달빛어린이병원', wgs84Lat: '35.1', wgs84Lon: '129.0' },
    ], 3));
  }
  if (req.url.startsWith('/trans')) {
    transCalls++;
    return res.end(xml([{ trafNm: '버스', lineNo: '11', arivPlc: '김천역', dist: '200' }], 1));
  }
  if (req.url.startsWith('/sdr')) {
    sdrCalls++;
    const id = q.get('ykiho');
    if (id === 'D1') return res.end(xml([{ dgsbjtCdNm: '소아치과', dtlSdrCnt: '1' }], 1));
    const rows = id === 'C1' ? [{ dgsbjtCdNm: '가정의학과', dtlSdrCnt: '1' }, { dgsbjtCdNm: '소아청소년과', dtlSdrCnt: '1' }] : id === 'A1' ? [{ dgsbjtCd: '11', dgsbjtCdNm: '소아청소년과', dtlSdrCnt: '2' }] : [{ dgsbjtCdNm: '내과', dtlSdrCnt: '2' }];
    return res.end(xml(rows, rows.length));
  }
  if (req.url.startsWith('/subj')) {
    subjCalls++;
    return res.end(xml([{ dgsbjtCd: '11', dgsbjtCdNm: '소아청소년과', dgsbjtPrSdrCnt: '2' }, { dgsbjtCd: '13', dgsbjtCdNm: '이비인후과', dgsbjtPrSdrCnt: '0' }, { dgsbjtCd: '11', dgsbjtCdNm: '소아청소년과' }], 3));
  }
  if (req.url.startsWith('/holi')) {
    const m = q.get('solMonth');
    return res.end(m === '12' ? xml([{ locdate: q.get('solYear') + '1225', dateName: '기독탄신일', isHoliday: 'Y' }], 1) : xml([], 0));
  }
  if (req.url.startsWith('/pharm')) {
    pharmCalls++;
    return res.end(xml([
      { dutyName: '김천온누리약국', dutyAddr: '경북 김천시', dutyTel1: '054-1', wgs84Lat: '36.14', wgs84Lon: '128.11', dutyTime1s: '0900', dutyTime1c: '2300', dutyTime8s: '1000', dutyTime8c: '1800' },
      { dutyName: '좌표없는약국', dutyAddr: 'x' },
    ], 2));
  }
  if (req.url.startsWith('/er/getEgytListInfoInqire')) {
    return res.end(xml([
      { dutyName: '서울&하늘소아과의원', dutyEmclsName: '지역응급의료기관', dutyEryn: '1', dutyTel3: '02-119-0000', wgs84Lat: '37.5001', wgs84Lon: '127.0301' },
      { dutyName: '구미아동병원', dutyEmclsName: '지역응급의료기관', dutyEryn: '2', wgs84Lat: '36.119', wgs84Lon: '128.344' },
    ], 2));
  }
  if (req.url.startsWith('/nmc/getHsptlMdcncFullDown')) {
    fullCalls++;
    return res.end(xml([
      { dutyName: '서울하늘소아과의원', wgs84Lat: '37.5002', wgs84Lon: '127.0302', dutyTime1s: '0900', dutyTime1c: '2030', dutyTime7s: '1000', dutyTime7c: '1400', dutyTime8s: '1000', dutyTime8c: '1300' },
      { dutyName: '다른내과의원', wgs84Lat: '37.5002', wgs84Lon: '127.0302', dutyTime1s: '0900', dutyTime1c: '1800' },
    ], 2));
  }
  if (req.url.startsWith('/gov24')) {
    gov24Calls++;
    if (gov24Auth) { res.statusCode = 401; return res.end(JSON.stringify({ code: -4, msg: '등록되지 않은 인증키 입니다.' })); }
    const data = [
      { 서비스ID: '1', 서비스명: '김천시 출산축하금', 서비스목적요약: '출산 가정 지원', 지원대상: '김천시 출생아 부모', 지원내용: '첫째 100만원', 신청방법: '읍면동 방문', 상세조회URL: 'https://www.gov.kr/x', 소관기관명: '경상북도 김천시', 소관기관유형: '지자체', 전화문의: '054-1', 서비스분야: '임신·출산', 조회수: '50' },
      { 서비스ID: '2', 서비스명: '경상북도 다자녀 지원', 서비스목적요약: '다자녀 가정', 지원대상: '도내 다자녀', 지원내용: '바우처', 소관기관명: '경상북도', 소관기관유형: '지자체', 조회수: '10' },
      { 서비스ID: '3', 서비스명: '어르신 교통비', 지원대상: '65세 이상', 소관기관명: '경상북도 김천시', 소관기관유형: '지자체', 조회수: '99' },
      { 서비스ID: '4', 서비스명: '부모급여', 지원대상: '영아 부모', 소관기관명: '보건복지부', 소관기관유형: '중앙행정기관', 조회수: '999' },
      { 서비스ID: '5', 서비스명: '중구 아동수당 추가', 지원대상: '아동', 소관기관명: '중구', 소관기관유형: '지자체', 조회수: '5' },
    ];
    return res.end(JSON.stringify({ currentCount: data.length, data, matchCount: data.length, page: 1, perPage: 1000, totalCount: data.length }));
  }
  if (req.url.startsWith('/eid')) {
    const yr = +q.get('searchStartYear');
    const item = [];
    for (let w = 30; w <= 40; w++) {
      item.push({ period: `${yr}년 ${String(w).padStart(2, '0')}주`, icdGroupNm: '제2급', icdNm: '수두', resultVal: String(w === 38 ? '1,200' : 500) });
      item.push({ period: `${yr}년 ${String(w).padStart(2, '0')}주`, icdGroupNm: '제2급', icdNm: '@홍역', resultVal: '0' });
    }
    item.push({ period: '계', icdGroupNm: '제2급', icdNm: '수두', resultVal: '99999' });
    return res.end(JSON.stringify({ response: { header: { resultCode: '00' }, body: { items: { item }, totalCount: String(item.length) } } }));
  }
  if (req.url.startsWith('/portal/influ.do')) { res.setHeader('Set-Cookie', 'JSESSIONID=abc; Path=/'); return res.end('<html></html>'); }
  if (req.url.startsWith('/portal/influListAjax.do')) {
    assert.ok(/JSESSIONID=abc/.test(req.headers.cookie || ''), '쿠키 전달');
    return res.end(JSON.stringify({ result: true, value: { headerList: [{ GR2: '36', TITLE: '36주' }, { GR2: '37', TITLE: '37주' }, { GR2: '38', TITLE: '38주' }],
      data: [{ TITLE: '0세', COLUMN1: '10', COLUMN2: '12', COLUMN3: '집계 중' }, { TITLE: '1-6세', COLUMN1: '40.1', COLUMN2: '49.8', COLUMN3: '집계 중' }, { TITLE: '7-12세', COLUMN1: '60', COLUMN2: '75.1', COLUMN3: '집계 중' }] } }));
  }
  detailCalls++;
  if (brokenDetail) { res.statusCode = 400; return res.end(xml([], 0, '12').replace('<resultMsg>OK</resultMsg>', '<resultMsg>해당 오픈API 서비스가 없거나 폐기됨</resultMsg>')); }
  const h = H.concat(D).find((x) => x.ykiho === q.get('ykiho'));
  res.end(xml(h && h.d ? [h.d] : [], h && h.d ? 1 : 0));
});

(async () => {
  await new Promise((r) => mock.listen(0, r));
  const port = mock.address().port;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-'));
  fs.mkdirSync(path.join(root, 'data'));
  fs.writeFileSync(path.join(root, 'data', 'moonlight.json'), JSON.stringify([{ _설명: 'x' }, { name: '구미아동병원', sido: '경북' }]));
  fs.writeFileSync(path.join(root, 'data', 'holidays.json'), '["2026-10-09"]');
  Object.assign(process.env, { KIDCLINIC_ROOT: root, HIRA_SERVICE_KEY: 'TESTKEY', HIRA_LIST_URL: `http://127.0.0.1:${port}/list`, HIRA_DETAIL_URL: `http://127.0.0.1:${port}/detail`, DETAIL_DAILY_LIMIT: '2', NMC_BASE_URL: `http://127.0.0.1:${port}/nmc`, NMC_ER_BASE_URL: `http://127.0.0.1:${port}/er`, HOLIDAY_URL: `http://127.0.0.1:${port}/holi`, PHARM_URL: `http://127.0.0.1:${port}/pharm`, HIRA_TRANS_URL: `http://127.0.0.1:${port}/trans`, HIRA_SDR_URL: `http://127.0.0.1:${port}/sdr`, HIRA_SUBJ_URL: `http://127.0.0.1:${port}/subj`, GOV24_URL: `http://127.0.0.1:${port}/gov24`, EID_URL: `http://127.0.0.1:${port}/eid`, KDCA_PORTAL: `http://127.0.0.1:${port}/portal/` });
  const s = require('./sync.js');
  let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ✓ ' + m); };
  const out = () => JSON.parse(fs.readFileSync(path.join(root, 'docs', 'data', 'hospitals.json'), 'utf8'));
  const meta = () => JSON.parse(fs.readFileSync(path.join(root, 'docs', 'data', 'meta.json'), 'utf8'));
  const log = console.log; console.log = () => {};
  await s.main();
  console.log = log;
  ok(out().length === 4, '전국 4곳 저장');
  ok(detailCalls === 2, '진료시간 1회 상한(2) 지킴');
  ok(out().find((r) => r.i === 'B1').n === '서울&하늘소아과의원', 'XML 특수문자 복원');
  ok(out().find((r) => r.i === 'A2').m === 1, '달빛어린이병원 표시');
  ok(meta().regions['370000'].sggu['370100'] === '김천시' && meta().holidays[0] === '2026-10-09', '지역·공휴일 메타');
  console.log = () => {};
  await s.main(); // 두 번째 날: 나머지 진료시간
  console.log = log;
  const a1 = out().find((r) => r.i === 'A1'), a2 = out().find((r) => r.i === 'A2');
  ok(a1.h[1] === '0900-2100' && a1.h[0] === '1000-1700' && a1.ho === 1 && a1.l, '진료시간 누적·휴일진료');
  ok(a2.h[1] === '0900-1800' && !a2.ho, '3자리 시간 보정·공휴일 휴진');
  ok(a1.er === 1 && a1.et === '054-000-9999' && !a2.er, '야간 응급실 표시·전화');
  ok(a1.x === 128.113123, '좌표 6자리로 축소');
  const b1 = out().find((r) => r.i === 'B1');
  ok(b1.h && b1.hs === 'n' && b1.h[1] === '0900-2030' && b1.h[0] === '1000-1400', '심평원에 없는 진료시간을 국립중앙의료원으로 채움');
  ok(b1.hh === '1000-1300' && b1.ho === 1 && /공휴일 10:00~13:00/.test(b1.hn), '공휴일 진료시간');
  ok(b1.m === 2 && a2.m === 1, '달빛어린이병원·소아전문센터 구분');
  ok(fullCalls === 1, '전국 진료시간은 7일에 한 번만 받음');
  ok(b1.er === 1 && b1.el === '지역응급의료기관' && b1.et === '02-119-0000', '지정 응급의료기관·응급실 전화');
  ok(!a2.er, '응급실 운영 안 함(2)은 제외');
  const y = new Date(Date.now() + 9 * 3600000).getUTCFullYear();
  ok(meta().holidays.includes(y + '-12-25') && meta().holidays.includes('2026-10-09'), '공휴일 자동 + 손으로 넣은 날짜 합침');
  const ph = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'data', 'pharmacies.json'), 'utf8'));
  ok(ph.length === 1 && ph[0].h[1] === '0900-2300' && ph[0].hh === '1000-1800' && meta().pharmCount === 1, '약국 영업시간·공휴일');
  ok(pharmCalls === 1, '약국은 7일에 한 번만 받음');
  ok(!a1.hs && a1.h[1] === '0900-2100', '심평원 진료시간이 있으면 그대로 사용');
  ok(a1.pk === '주차 12대 · 무료', '주차 정보');
  ok(a1.tr && a1.tr[0] === '버스 11 김천역 하차 약 200m', '교통 정보(소아과·병원급)');
  const c1 = out().find((r) => r.i === 'C1');
  ok(c1.k === 1 && c1.sd === 1 && !c1.tr, '이름에 소아 없어도 소아청소년과 전문의 있으면 소아과로 분류');
  ok(transCalls >= 2 && sdrCalls >= 4, '교통·전문의 조회');
  ok(a1.pl === '김천역 정문 맞은편 100m', '위치 안내');
  ok(a1.rw === '08:30~20:30' && a1.rs === '09:00~12:30', '접수시간');
  ok(a1.dr === 3 && a1.dz.join() === '2,1,0,0', '의사 구성(전문의·일반의)');
  const dj = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'data', 'dental.json'), 'utf8'));
  const d1 = dj.find((r) => r.i === 'D1'), d2 = dj.find((r) => r.i === 'D2');
  ok(dj.length === 2 && d1.k === 1 && d1.pd === 1 && d2.k === 3, '소아치과 목록·분류(어린이치과·전문의 / 일반 치과)');
  ok(d1.h && d1.h[1] === '0930-1830' && d1.dz.join() === '1,1,0,0' && d1.l, '소아치과 진료시간·치과 인원');
  ok(meta().regions['370000'].sggu['370300'] === '상주시' && meta().dentalCount === 2, '치과만 있는 지역도 지역 목록에');
  ok(a1.sp && a1.sp[0][0] === '소아청소년과' && a1.sp[0][1] === 2 && c1.sp.length === 2, '과목별 전문의');
  ok(a1.sj && a1.sj.join() === '소아청소년과,이비인후과' && subjCalls >= 1, '진료과목 (소아과·병원급)');
  const lb = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'data', 'lb', '370000.json'), 'utf8'));
  ok(lb.sg['370100'] && lb.sg['370100'][0].n === '김천시 출산축하금' && lb.sg['370100'][0].u === 'https://www.gov.kr/x', '지역 혜택: 시·군·구별 출산·육아');
  ok(lb.all.length === 1 && lb.all[0].n === '경상북도 다자녀 지원', '지역 혜택: 도 전체');
  ok(!JSON.stringify(lb).includes('어르신') && !JSON.stringify(lb).includes('부모급여') && !JSON.stringify(lb).includes('중구'), '지역 혜택: 어르신·중앙부처·애매한 지역 제외');
  ok(gov24Calls === 1, '지역 혜택은 7일에 한 번만 받음');
  const epi = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'data', 'epi.json'), 'utf8'));
  const chick = epi.nat.items.find((x) => x.n === '수두');
  ok(epi.nat.week.endsWith('38주') && chick.v === 1200 && chick.prev === 500 && chick.trend === 'up', '유행 감염병: 2주 전 기준·쉼표·계 행 제외·증가 표시');
  ok(epi.nat.items.some((x) => x.n === '홍역' && x.v === 0), '유행 감염병: 이름 앞 @ 정리');
  ok(epi.flu.week === '37주' && epi.flu.ages['1-6세'].v === 49.8 && epi.flu.ages['1-6세'].prev === 40.1, '독감 표본감시: 집계 중 주 건너뜀');
  const scan = require('../docs/scan.js');
  const bag = scan.parseBag('복약안내문\n조제일자: 2026-10-11\n처방의료기관: 튼튼소아청소년과의원\n타세파건조시럽   5071   3   5\n해열진통제\n세프라딘건조시럽 30 3 5\n함생제\n복용법: 1일 3회 식후 30분ㆍ5일분\n보관: 냉장 보관');
  ok(bag.drugs.length === 2 && bag.drugs[0].dose === '5mL' && bag.drugs[1].eff === '항생제' && bag.perDay === 3 && bag.days === 5 && bag.start === '2026-10-11' && bag.cold && bag.hospital === '튼튼소아청소년과의원', '약봉투 글자 → 약 목록');
  ok(scan.slotsFor(2, '식후') + '' === '0,2' && scan.slotsFor(3, '식후, 자기 전') + '' === '0,2,3', '하루 횟수 → 먹는 때');
  failSeoul = true; H.splice(1, 1);
  console.log = () => {}; console.error = () => {};
  await s.main();
  console.log = log;
  ok(out().some((r) => r.i === 'B1'), '한 시도 조회 실패 시 이전 자료 유지');
  ok(!out().some((r) => r.i === 'A2'), '목록에서 빠진 병원 제외');
  // 상세 API 가 '서비스 없음(12)' 이면 첫 호출에서 바로 멈추고 목록은 저장
  const before = detailCalls; brokenDetail = true;
  for (const h of Object.values(JSON.parse(fs.readFileSync(path.join(root, 'state', 'hospitals.json'), 'utf8')).items)) delete h.detail;
  const st = JSON.parse(fs.readFileSync(path.join(root, 'state', 'hospitals.json'), 'utf8'));
  for (const h of Object.values(st.items)) delete h.detail;
  fs.writeFileSync(path.join(root, 'state', 'hospitals.json'), JSON.stringify(st));
  console.log = () => {}; console.error = () => {};
  await s.main();
  console.log = log;
  ok(detailCalls - before <= 4 && out().length === 3, '상세 서비스 없음(12) → 즉시 중단, 목록은 저장');
  console.log(`\n${pass}건 통과`);
  mock.close(); fs.rmSync(root, { recursive: true, force: true });
})().catch((e) => { console.error('실패:', e); process.exit(1); });
