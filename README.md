# 우리아이 소아과 — 전국 소아청소년과 찾기 (완전 무료 구성)

서버·호스팅 비용 0원. GitHub 무료 기능만 씁니다.

```
매일 새벽 4시  GitHub Actions ──▶ 심평원 공공데이터 API
                     │  (인증키는 GitHub Secret 에만 보관)
                     ▼
               docs/data/*.json  ──▶  GitHub Pages (https://아이디.github.io/kidclinic)
                                            │
                          ┌─────────────────┴─────────────────┐
                    휴대폰 앱 (안드로이드)              웹 버전 (같은 주소)
```

## 폴더

| 폴더 | 내용 |
|---|---|
| `docs/` | 앱 화면(웹) + `data/` 자료. GitHub Pages 가 이 폴더를 그대로 공개 |
| `sync/` | 심평원 자료 갱신 스크립트 (`sync.js`), 자체검사 (`test.js`) |
| `data/` | **직접 관리**: `moonlight.json`(달빛어린이병원 명단), `holidays.json`(공휴일) |
| `state/` | 갱신 누적 상태 (자동) |
| `app/` | 안드로이드 앱 포장 (Capacitor) |
| `.github/workflows/sync.yml` | 매일 자동 갱신 설정 |

## 처음 설정 (한 번만)

1. **공공데이터포털(data.go.kr) 활용신청** — 둘 다 무료
   - 건강보험심사평가원_병원정보서비스
   - 건강보험심사평가원_의료기관별상세정보서비스
2. **GitHub 가입** (github.com) → 새 저장소 `kidclinic`, **Public**
3. 이 폴더를 저장소에 올리기 (`git push`)
4. 저장소 **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `HIRA_SERVICE_KEY` / Secret: 포털의 **일반 인증키(Encoding)**
5. **Settings → Pages** → Source: *Deploy from a branch* → Branch: `main` / 폴더: `/docs` → Save
6. **Actions 탭** → "소아과 데이터 갱신" → **Run workflow**
7. 몇 분 뒤 `https://아이디.github.io/kidclinic` 접속 → 웹 버전 확인

## 진료시간 수집

개발계정은 하루 호출량이 제한되어, 진료시간은 하루 900곳씩 나눠 모읍니다(전국 수천 곳 → 며칠 걸림).
목록·주소·전화·위치는 첫날 전부 들어옵니다. 운영계정 승인 후에는
Settings → Secrets and variables → Actions → **Variables** 에 `DETAIL_DAILY_LIMIT` 를 큰 값으로 넣으세요.

## GitHub 에서 심평원 접속이 안 될 때

Actions 실행이 "API 오류"로 실패하면(해외 서버 접속 차단 등), 내 PC 에서 갱신해 올립니다. 이것도 무료입니다.

```powershell
powershell -ExecutionPolicy Bypass -File .\sync-local.ps1
```

## 안드로이드 앱 만들기 (내 PC)

준비물: Node.js 20 이상, Android Studio

1. `docs/config.js` 의 `PAGES_URL` 을 내 Pages 주소로 변경
2. ```powershell
   cd app
   npm install
   npm run android:init     # 처음 한 번
   npm run android:open     # Android Studio 열림 → Build → Build APK(s)
   ```
3. 화면을 고친 뒤에는 `npm run android:sync` 후 다시 빌드
4. 앱은 매번 Pages 에서 최신 자료를 받고, 인터넷이 없으면 마지막에 받은 자료(또는 앱에 들어 있는 자료)로 보여줍니다.

> 무료 아닌 것은 단 하나: 플레이스토어 개발자 등록비(1회 25달러). APK 파일을 직접 나눠 설치하면 0원입니다.

## 관리

- 달빛어린이병원: GitHub 웹에서 `data/moonlight.json` 을 바로 편집 → `[{"name":"병원명 일부","sido":"경북"}]`
- 공휴일: 매년 말 `data/holidays.json` 에 다음 해 날짜 추가
- 지도: OpenStreetMap 타일 사용. 사용자가 크게 늘면 타일 정책상 카카오맵 등으로 교체 검토
- 자료 출처: 건강보험심사평가원 (앱 상세화면에 표기됨). 진료시간은 바뀔 수 있어 방문 전 전화 확인 안내 포함
