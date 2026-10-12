// npx cap add/sync android 뒤에 실행: 위치 권한을 AndroidManifest 에 넣는다.
const fs = require('fs');
const path = require('path');
const f = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
if (!fs.existsSync(f)) { console.error('android 폴더가 없습니다. 먼저 npm run android:init'); process.exit(1); }
let s = fs.readFileSync(f, 'utf8');
const perms = [
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION',
];
let added = 0;
for (const p of perms) {
  if (!s.includes(p)) {
    s = s.replace('</manifest>', `    <uses-permission android:name="${p}" />\n</manifest>`);
    added++;
  }
}
fs.writeFileSync(f, s);
console.log(added ? `위치 권한 ${added}개 추가 완료` : '위치 권한 이미 있음');
