/* 아이아플때 — 📷 약봉투 사진 → 처방약 자동 정리
 * 글자 인식(OCR)은 휴대폰 브라우저 안에서만 한다 (vendor/tesseract, 인터넷으로 사진을 보내지 않음).
 * 사진은 저장하지 않고, 이용자가 확인·고친 결과만 처방약·진료 기록에 저장한다.
 * parseBag(text) 는 sync/test 와 같은 방식으로 node 에서도 시험할 수 있게 따로 둔다.
 */
(function (root) {
  'use strict';

  // ───── 글자 → 약 정보 ─────
  var FORM = '(?:연질캡슐|캡슐|캅셀|건조시럽|시럽|현탁액|현탁|내용액|액|과립|세립|산|드롭|정|연고|크림|겔|점안액|점이액|좌제|좌약|패치|흡입제)';
  var STRENGTH = '(?:\\s*\\d+(?:\\.\\d+)?\\s*(?:mg|㎎|밀리그램|ml|mL|㎖|밀리리터|g|%|mcg|㎍))?';
  var DRUG_RE = new RegExp('([가-힣A-Za-z][가-힣A-Za-z0-9\\-·]{1,24}' + FORM + STRENGTH + ')');
  var SKIP = /약국|환자|성명|주소|전화|TEL|tel|팩스|FAX|조제|교부|처방|의료기관|복용법|복약|보관|주의|부작용|약사|면허|사업자|번호|일분|합계|금액|본인부담|영수|발행|성별|나이|생년/;
  var EFF_RE = /([가-힣·]{0,6}(?:항생|함생|항샘|해열|진통|소염|기침|가래|진해|거담|콧물|코막힘|비염|알레르기|알러지|항히스타민|소화|위장|정장|유산균|설사|지사|변비|구토|진토|기관지|천식|두드러기|가려움|피부|염증|위산|감기)[가-힣·]{0,6})/;
  function compact(s) { return String(s || '').replace(/([가-힣])\s+(?=[가-힣])/g, '$1').replace(/[|¦_~`"“”]/g, ' ').replace(/\s{2,}/g, ' ').trim(); }
  function parseBag(text) {
    var raw = String(text || '');
    var lines = raw.split(/\r?\n/).map(compact).filter(Boolean);
    var all = lines.join('\n');
    var out = { drugs: [], perDay: 0, days: 0, start: '', cold: /냉장/.test(all), pharmacy: '', hospital: '', timing: '', dose: '' };
    var m;
    if ((m = /(?:1\s*일|하루)\s*(\d)\s*(?:회|번)/.exec(all))) out.perDay = +m[1];
    if ((m = /(\d{1,2})\s*일\s*분/.exec(all)) || (m = /(?:총|투약)\s*(?:투약)?\s*(?:일수)?\s*[:：]?\s*(\d{1,2})\s*일/.exec(all))) out.days = +m[1];
    var dm = /(?:조제|교부|처방)\s*(?:일자|일)?\s*[:：]?\s*(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/.exec(all) || /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/.exec(all);
    if (dm) { var mo = +dm[2], d = +dm[3]; if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) out.start = dm[1] + '-' + (mo < 10 ? '0' : '') + mo + '-' + (d < 10 ? '0' : '') + d; }
    if ((m = /(식후|식전|식간)\s*(\d{1,2})?\s*분?/.exec(all))) out.timing = m[1] + (m[2] ? ' ' + m[2] + '분' : '');
    if (/취침\s*전|자기\s*전|잠자기/.test(all)) out.timing = (out.timing ? out.timing + ', ' : '') + '자기 전';
    if ((m = /([가-힣A-Za-z0-9]{1,14}약국)/.exec(all))) out.pharmacy = m[1];
    if ((m = /([가-힣A-Za-z0-9]{1,20}(?:소아청소년과의원|소아청소년과|소아과의원|소아과|의원|병원))/.exec(all.replace(/약국/g, '')))) out.hospital = m[1];
    var seen = {};
    lines.forEach(function (ln, i) {
      if (SKIP.test(ln) && !/(정|캡슐|시럽|액|산|과립)\s*\d/.test(ln)) return;
      var dmatch = DRUG_RE.exec(ln.replace(/^\s*[\d①-⑳]+[.)\]]?\s*/, ''));
      if (!dmatch) return;
      var name = dmatch[1].replace(/\s+/g, ' ').trim();
      var key = name.replace(/\s/g, '');
      if (key.length < 3 || seen[key]) return;
      if (/^(정|액|산)/.test(key)) return;
      seen[key] = 1;
      var rest = ln.slice(ln.indexOf(dmatch[1]) + dmatch[1].length);
      var em = EFF_RE.exec(rest) || EFF_RE.exec(lines[i + 1] && !DRUG_RE.test(lines[i + 1]) ? lines[i + 1] : '');
      var dose = '', nm;
      if ((nm = /(\d+(?:\.\d+)?)\s*(ml|mL|㎖|cc|정|포|캡슐|g|방울)\s*(?:\D{0,3}(\d)\s*(?:회)?\s*(\d{1,2})\s*(?:일)?)?/.exec(rest))) {
        dose = nm[1] + (nm[2] === '㎖' || nm[2] === 'cc' ? 'mL' : nm[2] === 'ml' ? 'mL' : nm[2]);
        if (nm[3] && !out.perDay) out.perDay = +nm[3];
        if (nm[4] && !out.days) out.days = +nm[4];
      } else if ((nm = /\s(\d+(?:\.\d+)?)\s+(\d)\s+(\d{1,2})\s*$/.exec(rest))) {
        dose = nm[1]; if (!out.perDay) out.perDay = +nm[2]; if (!out.days) out.days = +nm[3];
      }
      // 물약의 "5ml" 을 글자 인식이 "5071"·"401"·"30" 처럼 읽는 경우 되돌리기
      if (dose && /^\d+(\.\d+)?$/.test(dose) && /시럽|액|현탁/.test(name)) {
        var mm = /^(\d{1,2}?(?:\.\d)?)(071|07l|0l|01|0|1)$/.exec(dose);
        if (+dose > 20 && mm && +mm[1] > 0 && +mm[1] <= 20) dose = mm[1] + 'mL';
        else if (+dose <= 20) dose = dose + 'mL';
      }
      out.drugs.push({ n: name, eff: em ? em[1].replace(/함생|항샘/g, '항생').replace(/묶게/g, '묽게') : '', dose: dose });
    });
    out.drugs = out.drugs.slice(0, 12);
    if (out.perDay > 6) out.perDay = 0;
    if (out.days > 30) out.days = 0;
    var doses = out.drugs.map(function (d) { return d.dose; }).filter(Boolean);
    if (doses.length === 1) out.dose = doses[0];
    return out;
  }
  function slotsFor(perDay, timing) {
    var bed = /자기 전/.test(timing || '');
    if (perDay >= 4) return [0, 1, 2, 3];
    if (perDay === 3) return bed ? [0, 2, 3] : [0, 1, 2];
    if (perDay === 2) return bed ? [0, 3] : [0, 2];
    if (perDay === 1) return bed ? [3] : [0];
    return [0, 1, 2];
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = { parseBag: parseBag, slotsFor: slotsFor }; return; }

  // ───── 화면 ─────
  var K = root.KC; if (!K) return;
  var $ = K.$, $$ = K.$$, esc = K.esc, toast = K.toast;
  var BASE = new URL('vendor/tesseract/', location.href).href;
  var worker = null, libP = null;
  function loadLib() {
    if (root.Tesseract) return Promise.resolve();
    if (libP) return libP;
    libP = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = BASE + 'tesseract.min.js'; s.onload = res; s.onerror = function () { libP = null; rej(new Error('lib')); };
      document.head.appendChild(s);
    });
    return libP;
  }
  function getWorker(onProg) {
    if (worker) return Promise.resolve(worker);
    return loadLib().then(function () {
      return root.Tesseract.createWorker('kor', 1, {
        workerPath: BASE + 'worker.min.js', corePath: BASE + 'core', langPath: BASE + 'lang', gzip: true,
        logger: function (m) { if (onProg && m && typeof m.progress === 'number') onProg(m.status, m.progress); }
      });
    }).then(function (w) { worker = w; return w; });
  }
  // 사진을 글자 읽기 좋게: 긴 변 2000px, 흑백, 대비 올리기
  function prep(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var sc = Math.min(1, 2000 / Math.max(img.width, img.height));
        if (Math.max(img.width, img.height) < 1200) sc = 1200 / Math.max(img.width, img.height);
        var c = document.createElement('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
        var ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, c.width, c.height);
        try {
          var d = ctx.getImageData(0, 0, c.width, c.height), p = d.data;
          for (var i = 0; i < p.length; i += 4) {
            var g = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
            g = Math.max(0, Math.min(255, (g - 128) * 1.5 + 140));
            p[i] = p[i + 1] = p[i + 2] = g;
          }
          ctx.putImageData(d, 0, 0);
        } catch (e) {}
        URL.revokeObjectURL(url); res(c);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('img')); };
      img.src = url;
    });
  }
  function sheet(html) { $('#sheet-body').innerHTML = html; $('#sheet').hidden = false; $('#sheet-bg').hidden = false; $('#sheet').scrollTop = 0; }
  var PRIV = '<div class="priv">🔒 사진은 <b>이 휴대폰 안에서만</b> 글자를 읽고 바로 버려요. 어디에도 보내거나 저장하지 않아요. 확인을 누른 약 이름·복용 정보만 이 휴대폰에 저장돼요. <a href="privacy.html">자세히</a></div>';
  function open() {
    var kid = K.curKid();
    if (!kid) { toast('우리아이 탭에서 아이를 먼저 추가해 주세요'); return; }
    sheet('<h2>📷 약봉투로 처방약 넣기</h2>' +
      '<div class="tg-sub">약국에서 받은 <b>약봉투나 복약안내문</b>의 약 이름·복용법이 보이게 찍어 주세요. 글자를 읽어서 처방약 체크와 진료 기록에 자동으로 넣어 드려요.</div>' +
      '<div class="scan-tips"><div>💡 밝은 곳에서, 종이를 평평하게 펴고, 글자가 화면에 꽉 차게</div><div>💡 손글씨보다 인쇄된 글자를 잘 읽어요</div></div>' +
      '<div class="scan-btns"><label class="btn">📷 사진 찍기<input type="file" accept="image/*" capture="environment" id="scan-cam" hidden></label>' +
      '<label class="btn ghost">🖼 앨범에서 고르기<input type="file" accept="image/*" id="scan-pick" hidden></label></div>' +
      '<div class="muted-s">처음 한 번은 글자 읽는 도구(약 5MB)를 이 앱 사이트에서 받아요. 와이파이에서 쓰면 좋아요. 한 번 받으면 보통 다시 받지 않아요.</div>' + PRIV);
    ['#scan-cam', '#scan-pick'].forEach(function (id) { $(id).addEventListener('change', function () { var f = this.files && this.files[0]; if (f) run(kid, f); }); });
  }
  function run(kid, file) {
    sheet('<h2>📷 글자 읽는 중…</h2><div class="scan-prog"><div class="scan-bar"><i id="scan-bar"></i></div><div id="scan-st" class="muted-s">준비하는 중</div></div>' + PRIV);
    var bar = $('#scan-bar'), st = $('#scan-st');
    var LBL = { 'loading tesseract core': '글자 읽는 도구 받는 중', 'loading language traineddata': '한글 글자 모양 받는 중', 'initializing api': '준비하는 중', 'recognizing text': '글자 읽는 중' };
    var onProg = function (s, p) { if (bar) bar.style.width = Math.round(p * 100) + '%'; if (st) st.textContent = (LBL[s] || s) + ' ' + Math.round(p * 100) + '%'; };
    Promise.all([getWorker(onProg), prep(file)]).then(function (r) {
      return r[0].recognize(r[1]);
    }).then(function (res) {
      var text = (res && res.data && res.data.text) || '';
      review(kid, parseBag(text), text);
    }).catch(function () {
      sheet('<h2>글자를 읽지 못했어요</h2><div class="tg-sub">인터넷 연결을 확인하거나(처음 한 번은 도구를 받아야 해요), 더 밝고 가깝게 다시 찍어 주세요.</div>' +
        '<button class="btn" id="scan-again">다시 찍기</button><button class="btn ghost" id="scan-manual">직접 적기</button>');
      $('#scan-again').addEventListener('click', open);
      $('#scan-manual').addEventListener('click', function () { review(kid, parseBag(''), ''); });
    });
  }
  var SLOTN = ['아침', '점심', '저녁', '자기 전'];
  function review(kid, P, text) {
    var t0 = new Date(); var today = t0.getFullYear() + '-' + ('0' + (t0.getMonth() + 1)).slice(-2) + '-' + ('0' + t0.getDate()).slice(-2);
    var slots = slotsFor(P.perDay, P.timing);
    var found = P.drugs.length;
    var row = function (d) { return '<div class="scan-drug"><input class="sd-n" maxlength="30" value="' + esc(d.n || '') + '" placeholder="약 이름"><input class="sd-e" maxlength="20" value="' + esc(d.eff || '') + '" placeholder="효능"><input class="sd-d" maxlength="10" value="' + esc(d.dose || '') + '" placeholder="1회량"><button class="sd-x" aria-label="빼기">✕</button></div>'; };
    sheet('<h2>' + (found ? '✅ 약 ' + found + '개를 찾았어요' : '📝 직접 확인해 주세요') + '</h2>' +
      '<div class="scan-warn">⚠️ 사진으로 읽은 글자는 틀릴 수 있어요. <b>약봉투와 꼭 비교</b>해서 고친 뒤 넣어 주세요.</div>' +
      '<div class="g-form scan-form">' +
        '<div class="g-fh">약 목록</div><div id="sd-list">' + (P.drugs.length ? P.drugs : [{}]).map(row).join('') + '</div>' +
        '<button class="btn ghost sd-add" id="sd-add">+ 약 더하기</button>' +
        '<label>처방약 이름 (체크 화면에 보일 이름)<input id="sc-name" maxlength="30" value="' + esc((P.hospital ? P.hospital.replace(/의원$/, '') + ' ' : '') + '처방약') + '"></label>' +
        '<div class="g-two"><label>한 번에 먹는 양<input id="sc-dose" maxlength="20" value="' + esc(P.dose) + '" placeholder="' + (P.drugs.some(function (d) { return d.dose; }) ? '약마다 다름 (위 목록)' : '예: 5mL, 1포') + '"></label><label>며칠 동안<input type="number" id="sc-days" min="1" max="30" value="' + (P.days || 3) + '" inputmode="numeric"></label></div>' +
        '<div class="g-two"><label>시작한 날 (조제일)<input type="date" id="sc-start" value="' + esc(P.start && P.start <= today ? P.start : today) + '" max="' + today + '"></label><label>복용 시간<input id="sc-timing" maxlength="20" value="' + esc(P.timing) + '" placeholder="예: 식후 30분"></label></div>' +
        '<div class="rx-slots"><span>먹는 때' + (P.perDay ? ' (하루 ' + P.perDay + '번으로 읽었어요)' : '') + '</span>' + SLOTN.map(function (n, i) { return '<label><input type="checkbox" data-sslot="' + i + '"' + (slots.indexOf(i) >= 0 ? ' checked' : '') + '> ' + n + '</label>'; }).join('') + '</div>' +
        '<label class="rx-cold"><input type="checkbox" id="sc-cold"' + (P.cold ? ' checked' : '') + '> 🧊 냉장 보관하는 약</label>' +
        '<label class="rx-cold"><input type="checkbox" id="sc-visit" checked> 📒 진료 기록에도 남기기</label>' +
        '<div id="sc-vbox" class="g-two"><label>병원<input id="sc-hosp" maxlength="40" value="' + esc(P.hospital) + '" placeholder="처방한 병원"></label><label>진단(알면)<input id="sc-diag" maxlength="60" placeholder="예: 중이염"></label></div>' +
        '<button class="btn" id="sc-save">처방약에 넣기</button>' +
      '</div>' +
      (text ? '<details class="scan-raw"><summary>읽은 글자 그대로 보기</summary><pre>' + esc(text) + '</pre></details>' : '') +
      '<button class="btn ghost tg-again" id="sc-retake">📷 다시 찍기</button>' + PRIV);
    var bindRow = function (el) { el.querySelector('.sd-x').addEventListener('click', function () { el.remove(); }); };
    $$('#sd-list .scan-drug').forEach(bindRow);
    $('#sd-add').addEventListener('click', function () { var w = document.createElement('div'); w.innerHTML = row({}); var el = w.firstChild; $('#sd-list').appendChild(el); bindRow(el); el.querySelector('.sd-n').focus(); });
    $('#sc-visit').addEventListener('change', function () { $('#sc-vbox').hidden = !this.checked; });
    $('#sc-retake').addEventListener('click', open);
    $('#sc-save').addEventListener('click', function () {
      var drugs = $$('#sd-list .scan-drug').map(function (el) { return { n: el.querySelector('.sd-n').value.trim(), eff: el.querySelector('.sd-e').value.trim(), dose: el.querySelector('.sd-d').value.trim() }; }).filter(function (d) { return d.n; });
      var days = parseInt($('#sc-days').value, 10), sl = $$('#sheet-body [data-sslot]').filter(function (c) { return c.checked; }).map(function (c) { return +c.dataset.sslot; });
      var name = $('#sc-name').value.trim() || '처방약';
      if (!(days >= 1 && days <= 30)) { toast('며칠 동안 먹는지 1~30 사이로 적어 주세요'); return; }
      if (!sl.length) { toast('먹는 때를 하나 이상 골라 주세요'); return; }
      var dose = $('#sc-dose').value.trim(), timing = $('#sc-timing').value.trim();
      K.rxAdd(kid, { name: name, dose: dose + (timing ? (dose ? ' · ' : '') + timing : ''), start: $('#sc-start').value || today, days: days, slots: sl, cold: $('#sc-cold').checked, drugs: drugs });
      if ($('#sc-visit').checked && K.addVisit) {
        K.addVisit(kid, { d: $('#sc-start').value || today, next: '', hosp: $('#sc-hosp').value.trim(), diag: $('#sc-diag').value.trim(),
          rx: drugs.map(function (d) { return d.n + (d.dose ? ' ' + d.dose : '') + (d.eff ? '(' + d.eff + ')' : ''); }).join(', ') + ' · ' + (dose ? dose + ' ' : '') + '하루 ' + sl.length + '번 ' + days + '일', memo: '' });
      }
      $('#sheet').hidden = true; $('#sheet-bg').hidden = true;
      toast('처방약에 넣었어요. 먹일 때마다 칸을 눌러 주세요');
      if (K.careOpen) K.careOpen('rx');
      if (K.show) K.show('benefit');
      if (K.showPane) K.showPane('care');
    });
  }
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-scan]')) { e.preventDefault(); open(); } });
  K.openScan = open; K.parseBag = parseBag;
})(typeof window !== 'undefined' ? window : globalThis);
