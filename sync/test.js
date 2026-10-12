// 가짜 심평원 API 로 갱신 스크립트를 검사한다.  실행: node sync/test.js
'use strict';
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const H = [
  { ykiho: 'A1', yadmNm: '김천튼튼소아청소년과의원', clCdNm: '의원', sidoCd: '370000', sidoCdNm: '경북', sgguCd: '370100', sgguCdNm: '김천시', addr: '경북 김천시 A로 1', telno: '054-000-0001', XPos: '128.1131234567', YPos: '36.139', drTotCnt: '2',
    d: { trmtMonStart: '0900', trmtMonEnd: '2100', trmtSunStart: '1000', trmtSunEnd: '1700', noTrmtHoli: '정상진료', lunchWeek: '13:00~14:00', emyNgtYn: 'Y', emyNgtTelNo1: '054-000-9999' } },
  { ykiho: 'A2', yadmNm: '구미아동병원', clCdNm: '병원', sidoCd: '370000', sidoCdNm: '경북', sgguCd: '370200', sgguCdNm: '구미시', addr: '경북 구미시 B로 2', telno: '054-000-0002', XPos: '128.344', YPos: '36.119',
    d: { trmtMonStart: '900', trmtMonEnd: '1800', noTrmtHoli: '휴진' } },
  { ykiho: 'B1', yadmNm: '서울&amp;하늘소아과의원', clCdNm: '의원', sidoCd: '110000', sidoCdNm: '서울', sgguCd: '110001', sgguCdNm: '강남구', addr: '서울 강남구 C로 3', telno: '02-000-0003', XPos: '127.03', YPos: '37.5', d: null },
];
const xml = (items, total, code = '00') => `<?xml version="1.0"?><response><header><resultCode>${code}</resultCode><resultMsg>OK</resultMsg></header><body><items>${
  items.map((o) => '<item>' + Object.entries(o).map(([k, v]) => `<${k}>${v}</${k}>`).join('') + '</item>').join('')
}</items><totalCount>${total}</totalCount></body></response>`;
let detailCalls = 0, failSeoul = false, brokenDetail = false;
const mock = http.createServer((req, res) => {
  const q = new URL(req.url, 'http://x').searchParams;
  assert.strictEqual(q.get('serviceKey'), 'TESTKEY');
  if (req.url.startsWith('/list')) {
    if (failSeoul && q.get('sidoCd') === '110000') { res.statusCode = 500; return res.end('err'); }
    const rows = H.filter((h) => h.sidoCd === q.get('sidoCd')).map(({ d, ...r }) => r);
    return res.end(xml(rows, rows.length));
  }
  detailCalls++;
  if (brokenDetail) { res.statusCode = 400; return res.end(xml([], 0, '12').replace('<resultMsg>OK</resultMsg>', '<resultMsg>해당 오픈API 서비스가 없거나 폐기됨</resultMsg>')); }
  const h = H.find((x) => x.ykiho === q.get('ykiho'));
  res.end(xml(h && h.d ? [h.d] : [], h && h.d ? 1 : 0));
});

(async () => {
  await new Promise((r) => mock.listen(0, r));
  const port = mock.address().port;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-'));
  fs.mkdirSync(path.join(root, 'data'));
  fs.writeFileSync(path.join(root, 'data', 'moonlight.json'), JSON.stringify([{ _설명: 'x' }, { name: '구미아동병원', sido: '경북' }]));
  fs.writeFileSync(path.join(root, 'data', 'holidays.json'), '["2026-10-09"]');
  Object.assign(process.env, { KIDCLINIC_ROOT: root, HIRA_SERVICE_KEY: 'TESTKEY', HIRA_LIST_URL: `http://127.0.0.1:${port}/list`, HIRA_DETAIL_URL: `http://127.0.0.1:${port}/detail`, DETAIL_DAILY_LIMIT: '2' });
  const s = require('./sync.js');
  let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ✓ ' + m); };
  const out = () => JSON.parse(fs.readFileSync(path.join(root, 'docs', 'data', 'hospitals.json'), 'utf8'));
  const meta = () => JSON.parse(fs.readFileSync(path.join(root, 'docs', 'data', 'meta.json'), 'utf8'));
  const log = console.log; console.log = () => {};
  await s.main();
  console.log = log;
  ok(out().length === 3, '전국 3곳 저장');
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
  ok(detailCalls - before <= 4 && out().length === 2, '상세 서비스 없음(12) → 즉시 중단, 목록은 저장');
  console.log(`\n${pass}건 통과`);
  mock.close(); fs.rmSync(root, { recursive: true, force: true });
})().catch((e) => { console.error('실패:', e); process.exit(1); });
