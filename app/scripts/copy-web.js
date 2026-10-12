// docs 폴더(웹 화면 + 최신 자료)를 앱 안(www)으로 복사한다. 자료는 인터넷이 없을 때 쓰는 예비본이 된다.
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, '..', '..', 'docs');
const dst = path.join(__dirname, '..', 'www');
fs.rmSync(dst, { recursive: true, force: true });
fs.cpSync(src, dst, { recursive: true });
console.log('화면 복사 완료: docs → app/www');
