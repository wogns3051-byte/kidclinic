/* 아이아플때 — 🆘 응급처치 안내 · 🌏 다국어(English / Tiếng Việt / 中文)
 * 응급처치 안내는 인터넷이 없어도 열리도록 이 파일 안에 모두 들어 있다 (서비스워커가 저장).
 * 다국어는 "어디로 가야 해요?", 응급처치 안내, 119에 보여 줄 한국어 문장에만 적용한다.
 * 고른 언어(lang)만 이 휴대폰에 저장한다.
 */
(function () {
  'use strict';
  var K = window.KC; if (!K) return;
  var $ = K.$, $$ = K.$$, esc = K.esc, load = K.load, save = K.save;

  var LANGS = [['ko', '한국어'], ['en', 'English'], ['vi', 'Tiếng Việt'], ['zh', '中文']];
  var lang = load('lang', 'ko');
  if (!LANGS.some(function (l) { return l[0] === lang; })) lang = 'ko';
  K.lang = function () { return lang; };

  // ───── 공통 문구 ─────
  var UI = {
    faTitle: { ko: '응급처치 안내', en: 'First aid', vi: 'Sơ cứu', zh: '急救指南' },
    faSub: { ko: '상황을 고르면 할 일을 순서대로 알려 드려요. 인터넷이 없어도 열려요.', en: 'Choose what happened to see what to do, step by step. Works offline.', vi: 'Chọn tình huống để xem cần làm gì, từng bước. Dùng được khi không có mạng.', zh: '选择情况，按步骤查看该怎么做。没有网络也能打开。' },
    call119: { ko: '📞 위급하면 바로 119', en: '📞 Emergency? Call 119 now', vi: '📞 Nguy cấp? Gọi ngay 119', zh: '📞 情况危急请立即拨打 119' },
    when119: { ko: '이럴 땐 바로 119·응급실', en: 'Call 119 / go to the ER if', vi: 'Gọi 119 / đến phòng cấp cứu khi', zh: '出现以下情况请拨打 119 / 去急诊' },
    back: { ko: '← 다른 상황 보기', en: '← Other situations', vi: '← Tình huống khác', zh: '← 其他情况' },
    faNote: { ko: '이 안내는 진단이 아니에요. 아이 상태가 걱정되면 119에 전화해 상담원의 안내를 따르세요. 심폐소생술은 119 상담원이 전화로 알려 줘요.', en: 'This is not medical advice. If you are worried, call 119 and follow the dispatcher. The 119 dispatcher can guide you through CPR by phone.', vi: 'Đây không phải là chẩn đoán. Nếu lo lắng, hãy gọi 119 và làm theo hướng dẫn. Nhân viên 119 có thể hướng dẫn hồi sức tim phổi (CPR) qua điện thoại.', zh: '本指南不是诊断。如果担心孩子，请拨打 119 并按接线员的指示操作。119 接线员可以通过电话指导心肺复苏。' },
    faSrc: { ko: '참고: 질병관리청 국가건강정보포털, 대학병원 공개 건강정보 등 (2026.10 확인)', en: 'Based on public guidance from the Korea Disease Control and Prevention Agency and university hospitals (checked Oct 2026)', vi: 'Dựa trên hướng dẫn công khai của Cơ quan Kiểm soát và Phòng ngừa Dịch bệnh Hàn Quốc và các bệnh viện đại học (10/2026)', zh: '参考：韩国疾病管理厅国家健康信息门户、大学医院公开的健康信息等（2026年10月）' },
    phraseTitle: { ko: '119·병원에 보여 줄 한국어', en: 'Show this Korean to 119 or the hospital', vi: 'Đưa câu tiếng Hàn này cho 119 hoặc bệnh viện', zh: '给 119 或医院看的韩语句子' },
    phraseSub: { ko: '문장을 누르면 크게 보여요.', en: 'Tap a sentence to show it in large text.', vi: 'Chạm vào câu để hiện chữ lớn.', zh: '点击句子可放大显示。' },
    danuri: { ko: '📞 다누리콜센터 1577-1366 · 24시간 13개 언어 상담·통역', en: '📞 Danuri Call Center 1577-1366 · 24/7, 13 languages (counseling & interpretation)', vi: '📞 Tổng đài Danuri 1577-1366 · 24/7, 13 ngôn ngữ (tư vấn & phiên dịch)', zh: '📞 Danuri 呼叫中心 1577-1366 · 24小时，13种语言（咨询·翻译）' },
    showCard: { ko: '🪪 응급 카드 보여 주기', en: '🪪 Show emergency card', vi: '🪪 Hiện thẻ cấp cứu', zh: '🪪 出示急救卡' },
    langTitle: { ko: '언어 고르기', en: 'Language', vi: 'Ngôn ngữ', zh: '语言' },
    langNote: { ko: '"어디로 가야 해요?", 응급처치 안내, 119에 보여 줄 한국어 문장이 고른 언어로 나와요. 병원 목록 같은 다른 화면은 한국어로 나와요.', en: '"Where should we go?", First aid and the Korean phrases for 119 will be shown in this language. Other screens (hospital lists, etc.) stay in Korean.', vi: '"Nên đi đâu?", Sơ cứu và các câu tiếng Hàn cho 119 sẽ hiện bằng ngôn ngữ này. Các màn hình khác (danh sách bệnh viện…) vẫn bằng tiếng Hàn.', zh: '"该去哪里？"、急救指南和给 119 看的韩语句子会以所选语言显示。医院列表等其他页面仍为韩语。' },
    langPriv: { ko: '🔒 고른 언어만 이 휴대폰에 저장돼요.', en: '🔒 Only your language choice is saved, on this phone.', vi: '🔒 Chỉ lựa chọn ngôn ngữ được lưu trên điện thoại này.', zh: '🔒 只在本手机上保存所选语言。' },
    triage: { ko: '🤒 어디로 가야 해요?', en: '🤒 Where should we go?', vi: '🤒 Nên đưa bé đi đâu?', zh: '🤒 该去哪里？' },
    firstaid: { ko: '🆘 응급처치 안내', en: '🆘 First aid', vi: '🆘 Sơ cứu', zh: '🆘 急救指南' },
    phrases: { ko: '🗣 한국어 문장 카드', en: '🗣 Korean phrase cards', vi: '🗣 Thẻ câu tiếng Hàn', zh: '🗣 韩语句子卡' },
    translateNote: { ko: '', en: 'Translated by the app team. If anything is unclear, ask a medical professional.', vi: 'Bản dịch do nhóm phát triển thực hiện. Nếu có gì chưa rõ, hãy hỏi nhân viên y tế.', zh: '本翻译由开发团队提供。如有不清楚的地方，请咨询医护人员。' }
  };
  function t(key) { var v = UI[key]; return v ? (v[lang] || v.ko) : key; }
  K.t = t;

  // ───── 응급처치 내용 ─────
  var FA = [
    { id: 'choke0', ic: '👶',
      t: { ko: '돌 전 아기가 목에 뭐가 걸렸어요', en: 'Baby (under 1) is choking', vi: 'Bé dưới 1 tuổi bị hóc', zh: '1岁以下婴儿被异物卡住' },
      s: {
        ko: ['기침하거나 울 수 있으면 억지로 꺼내지 말고 기침하게 두세요.', '소리를 못 내고 숨을 못 쉬면 바로 119에 전화해 스피커폰으로 켜 두세요.', '아기를 팔 위에 엎드리게 하고, 머리를 몸보다 낮게 해 턱을 손으로 받쳐요.', '손바닥 아래쪽으로 등 가운데(양쪽 어깨뼈 사이)를 세게 5번 두드려요.', '아기를 뒤집어 머리를 낮게 하고, 가슴 가운데(젖꼭지를 이은 선 바로 아래)를 두 손가락으로 5번 빠르게 눌러요.', '나올 때까지 등 5번 → 가슴 5번을 반복해요. 입안에 보이면 꺼내되, 보이지 않는데 손가락으로 훑지 마세요.', '아기가 축 늘어지고 반응이 없으면 119 상담원의 안내에 따라 심폐소생술을 해요.'],
        en: ['If the baby can cough or cry, let them keep coughing. Do not try to pull it out.', 'If the baby cannot make a sound or breathe, call 119 right away and put it on speaker.', 'Lay the baby face down along your forearm, head lower than the body, supporting the jaw with your hand.', 'Give 5 firm back blows between the shoulder blades with the heel of your hand.', 'Turn the baby face up, head low, and give 5 quick chest thrusts with two fingers in the middle of the chest, just below the nipple line.', 'Repeat 5 back blows and 5 chest thrusts until it comes out. Remove the object only if you can see it. Do not sweep blindly with your finger.', 'If the baby becomes limp and unresponsive, start CPR as the 119 dispatcher instructs.'],
        vi: ['Nếu bé còn ho hoặc khóc được, hãy để bé ho. Đừng cố móc dị vật ra.', 'Nếu bé không phát ra tiếng hoặc không thở được, gọi ngay 119 và bật loa ngoài.', 'Đặt bé nằm sấp dọc theo cẳng tay, đầu thấp hơn thân, dùng tay đỡ cằm bé.', 'Dùng gót bàn tay vỗ mạnh 5 lần vào giữa lưng (giữa hai xương bả vai).', 'Lật bé nằm ngửa, đầu thấp, dùng hai ngón tay ấn nhanh 5 lần vào giữa ngực, ngay dưới đường nối hai núm vú.', 'Lặp lại 5 lần vỗ lưng → 5 lần ấn ngực cho đến khi dị vật ra. Chỉ lấy ra khi nhìn thấy, không dùng ngón tay móc mò.', 'Nếu bé lả đi và không phản ứng, hãy làm hồi sức tim phổi (CPR) theo hướng dẫn của nhân viên 119.'],
        zh: ['如果婴儿还能咳嗽或哭，就让他继续咳，不要强行去抠。', '如果婴儿发不出声音、无法呼吸，立即拨打 119 并打开免提。', '让婴儿趴在你的前臂上，头低于身体，用手托住下巴。', '用掌根用力拍打背部中间（两侧肩胛骨之间）5次。', '把婴儿翻过来，头保持低位，用两根手指在胸部中间（两乳头连线正下方）快速按压5次。', '重复"拍背5次→按胸5次"，直到异物排出。只有看得见时才取出，看不见时不要用手指盲目去抠。', '如果婴儿瘫软、没有反应，请按 119 接线员的指示进行心肺复苏。']
      },
      w: { ko: ['소리를 못 내고 숨을 못 쉴 때', '입술이 파래질 때', '축 늘어지고 반응이 없을 때'], en: ['Cannot make a sound or breathe', 'Lips turn blue', 'Limp or unresponsive'], vi: ['Không phát ra tiếng hoặc không thở được', 'Môi tím tái', 'Lả đi, không phản ứng'], zh: ['发不出声音或无法呼吸', '嘴唇发紫', '瘫软、没有反应'] } },
    { id: 'choke1', ic: '🧒',
      t: { ko: '돌 지난 아이가 목에 뭐가 걸렸어요', en: 'Child (1 or older) is choking', vi: 'Trẻ từ 1 tuổi bị hóc', zh: '1岁以上孩子被异物卡住' },
      s: {
        ko: ['기침할 수 있으면 계속 기침하게 해요.', '말을 못 하고 숨을 못 쉬면 119에 전화해 스피커폰으로 켜 두세요.', '아이 뒤에서 무릎을 꿇거나 서서 허리를 감싸 안아요.', '한 손은 주먹을 쥐어 배꼽과 명치 사이에 대고, 다른 손으로 주먹을 감싸 쥐어요.', '안쪽 위로 세게 밀쳐 올려요(하임리히법). 나올 때까지 반복해요.', '의식을 잃으면 바닥에 눕히고 119 상담원의 안내에 따라 심폐소생술을 해요.'],
        en: ['If the child can cough, encourage them to keep coughing.', 'If the child cannot speak or breathe, call 119 and put it on speaker.', 'Kneel or stand behind the child and wrap your arms around their waist.', 'Make a fist with one hand and place it between the belly button and the bottom of the breastbone. Grab the fist with your other hand.', 'Give quick, firm thrusts inward and upward (Heimlich maneuver). Repeat until the object comes out.', 'If the child becomes unconscious, lay them on the floor and start CPR as the 119 dispatcher instructs.'],
        vi: ['Nếu trẻ còn ho được, hãy khuyến khích trẻ tiếp tục ho.', 'Nếu trẻ không nói được hoặc không thở được, gọi 119 và bật loa ngoài.', 'Quỳ hoặc đứng sau lưng trẻ, vòng tay ôm quanh eo trẻ.', 'Nắm một tay thành nắm đấm, đặt giữa rốn và mỏm ức (dưới xương ức). Tay kia nắm lấy nắm đấm.', 'Ấn mạnh và nhanh vào trong và lên trên (thủ thuật Heimlich). Lặp lại cho đến khi dị vật ra.', 'Nếu trẻ bất tỉnh, đặt trẻ nằm xuống sàn và làm CPR theo hướng dẫn của nhân viên 119.'],
        zh: ['如果孩子还能咳嗽，鼓励他继续咳。', '如果孩子说不出话、无法呼吸，拨打 119 并打开免提。', '跪或站在孩子身后，双臂环抱孩子腰部。', '一手握拳，放在肚脐与胸骨下端之间，另一只手包住拳头。', '快速用力向内上方冲击（海姆立克法），重复直到异物排出。', '如果孩子失去意识，让他平躺在地上，按 119 接线员的指示进行心肺复苏。']
      },
      w: { ko: ['말을 못 하고 숨을 못 쉴 때', '얼굴·입술이 파래질 때', '의식을 잃었을 때'], en: ['Cannot speak or breathe', 'Face or lips turn blue', 'Loses consciousness'], vi: ['Không nói được hoặc không thở được', 'Mặt hoặc môi tím tái', 'Bất tỉnh'], zh: ['说不出话或无法呼吸', '脸或嘴唇发紫', '失去意识'] } },
    { id: 'seizure', ic: '⚡',
      t: { ko: '경련을 해요', en: 'Having a seizure', vi: 'Bé bị co giật', zh: '孩子抽搐（惊厥）' },
      s: {
        ko: ['침착하게 경련이 시작된 시각을 확인해요.', '바닥 같은 안전한 곳에 옆으로 눕혀요. 토해도 숨이 막히지 않게 해요.', '주변의 딱딱하거나 날카로운 물건을 치우고, 꽉 끼는 옷은 풀어 줘요.', '입에 손가락·수건·약·물을 넣지 마세요. 몸을 꽉 붙잡지 마세요.', '가능하면 경련하는 모습을 휴대폰으로 찍어 두면 진료에 도움이 돼요.', '멈춘 뒤에는 옆으로 눕힌 채 지켜보고, 꼭 진료를 받아요.'],
        en: ['Stay calm and note the time the seizure started.', 'Lay the child on their side in a safe place, like the floor, so they will not choke if they vomit.', 'Move hard or sharp objects away and loosen tight clothing.', 'Do not put fingers, a towel, medicine or water in their mouth. Do not hold them down.', 'If you can, record a video of the seizure. It helps the doctor.', 'After it stops, keep them on their side, watch them, and see a doctor.'],
        vi: ['Bình tĩnh và ghi nhớ thời điểm bắt đầu co giật.', 'Đặt bé nằm nghiêng ở nơi an toàn như sàn nhà để bé không bị sặc nếu nôn.', 'Dọn các vật cứng, sắc nhọn xung quanh và nới lỏng quần áo chật.', 'Không cho ngón tay, khăn, thuốc hay nước vào miệng bé. Không giữ chặt người bé.', 'Nếu có thể, hãy quay video lúc bé co giật để giúp bác sĩ.', 'Sau khi hết co giật, để bé nằm nghiêng, theo dõi và đưa bé đi khám.'],
        zh: ['保持冷静，记下抽搐开始的时间。', '让孩子侧躺在地板等安全的地方，以免呕吐时窒息。', '移开周围坚硬或尖锐的物品，解开过紧的衣服。', '不要把手指、毛巾、药或水放进孩子嘴里，也不要用力按住孩子。', '如果可以，用手机拍下抽搐的样子，对医生诊断有帮助。', '抽搐停止后，让孩子保持侧躺并观察，一定要去看医生。']
      },
      w: { ko: ['5분 넘게 계속될 때', '처음 하는 경련일 때', '멈춘 뒤에도 깨어나지 않거나 숨쉬기 힘들어할 때', '경련하다 다쳤을 때'], en: ['Lasts more than 5 minutes', 'It is the first seizure', 'Does not wake up or has trouble breathing after it stops', 'Got injured during the seizure'], vi: ['Kéo dài hơn 5 phút', 'Là lần co giật đầu tiên', 'Không tỉnh lại hoặc khó thở sau khi hết co giật', 'Bị thương khi co giật'], zh: ['持续超过5分钟', '第一次抽搐', '停止后仍不清醒或呼吸困难', '抽搐时受伤'] } },
    { id: 'burn', ic: '🔥',
      t: { ko: '뜨거운 것에 데었어요', en: 'Burned by something hot', vi: 'Bị bỏng', zh: '被烫伤' },
      s: {
        ko: ['흐르는 시원한 수돗물(차가운 얼음물 말고)에 15~20분 동안 식혀요.', '얼음, 된장, 치약, 소주 같은 것을 바르지 마세요.', '물집은 터뜨리지 마세요.', '옷이 살에 붙었으면 억지로 떼지 말고 그 위로 물을 흘려요. 반지·팔찌는 붓기 전에 빼요.', '깨끗한 거즈나 랩으로 느슨하게 덮고 병원에 가요.'],
        en: ['Cool the burn under cool running tap water (not ice water) for 15–20 minutes.', 'Do not put ice, toothpaste, soybean paste, alcohol or similar on it.', 'Do not pop blisters.', 'If clothing is stuck to the skin, do not pull it off; run water over it. Remove rings or bracelets before swelling starts.', 'Cover loosely with clean gauze or plastic wrap and see a doctor.'],
        vi: ['Làm mát vết bỏng dưới vòi nước mát (không dùng nước đá) trong 15–20 phút.', 'Không bôi đá, kem đánh răng, tương, rượu hay các thứ tương tự.', 'Không làm vỡ bọng nước.', 'Nếu quần áo dính vào da, đừng kéo ra mà xả nước lên trên. Tháo nhẫn, vòng trước khi sưng.', 'Che nhẹ bằng gạc sạch hoặc màng bọc thực phẩm và đi khám.'],
        zh: ['用流动的凉自来水（不要用冰水）冲15～20分钟。', '不要涂冰块、牙膏、大酱、白酒等。', '不要弄破水泡。', '衣服粘在皮肤上时不要硬撕，直接在衣服上冲水。肿起来之前取下戒指、手镯。', '用干净的纱布或保鲜膜轻轻盖住，然后去医院。']
      },
      w: { ko: ['얼굴·손·발·생식기를 데었을 때', '아이 손바닥보다 넓게 데었을 때', '전기나 화학약품에 데었을 때', '피부가 하얗거나 검게 변했을 때'], en: ['Burn on the face, hands, feet or genitals', 'Burn larger than the child\'s palm', 'Electrical or chemical burn', 'Skin looks white or black'], vi: ['Bỏng ở mặt, tay, chân hoặc bộ phận sinh dục', 'Vết bỏng rộng hơn lòng bàn tay của trẻ', 'Bỏng điện hoặc hóa chất', 'Da chuyển trắng hoặc đen'], zh: ['烫伤在脸、手、脚或生殖器', '面积比孩子手掌大', '电击或化学品烧伤', '皮肤发白或发黑'] } },
    { id: 'nose', ic: '🩸',
      t: { ko: '코피가 나요', en: 'Nosebleed', vi: 'Chảy máu cam', zh: '流鼻血' },
      s: {
        ko: ['앉혀서 고개를 살짝 앞으로 숙여요.', '콧방울(코의 부드러운 부분)을 엄지와 검지로 10분 동안 꼭 잡아요. 중간에 떼어 보지 마세요.', '고개를 뒤로 젖히지 마세요. 피를 삼키면 토할 수 있어요.', '휴지를 코 깊이 쑤셔 넣지 마세요.'],
        en: ['Sit the child up and lean the head slightly forward.', 'Pinch the soft part of the nose firmly with your thumb and finger for 10 minutes. Do not let go to check.', 'Do not tilt the head back. Swallowed blood can cause vomiting.', 'Do not push tissue deep into the nose.'],
        vi: ['Cho trẻ ngồi và hơi cúi đầu về phía trước.', 'Dùng ngón cái và ngón trỏ bóp chặt phần mềm của mũi trong 10 phút. Đừng buông ra để kiểm tra.', 'Không ngửa đầu ra sau. Nuốt máu có thể gây nôn.', 'Không nhét giấy sâu vào mũi.'],
        zh: ['让孩子坐下，头稍微向前低。', '用拇指和食指捏紧鼻翼（鼻子柔软的部分）10分钟，中途不要松开查看。', '不要让头向后仰，吞下血可能会引起呕吐。', '不要把纸巾深深塞进鼻子里。']
      },
      w: { ko: ['20분 넘게 멈추지 않을 때', '머리·얼굴을 다친 뒤 코피가 날 때', '어지러워하거나 창백할 때'], en: ['Does not stop after 20 minutes', 'Started after a head or face injury', 'Child is dizzy or pale'], vi: ['Không cầm sau 20 phút', 'Chảy máu sau khi bị thương ở đầu hoặc mặt', 'Trẻ chóng mặt hoặc xanh xao'], zh: ['20分钟以上止不住', '头部或脸部受伤后流鼻血', '孩子头晕或脸色苍白'] } },
    { id: 'head', ic: '🤕',
      t: { ko: '머리를 부딪혔어요', en: 'Hit their head', vi: 'Bị va đập đầu', zh: '头部撞伤' },
      s: {
        ko: ['혹이 나면 차가운 수건이나 냉찜질팩(수건으로 감싸서)을 10~20분 대 주세요.', '24시간 동안 아이를 잘 지켜봐요. 낮잠은 괜찮지만 평소처럼 깨울 수 있는지 확인해요.', '아이 키보다 높은 곳에서 떨어졌거나 세게 부딪혔으면 증상이 없어도 진료를 받아요.'],
        en: ['For a bump, hold a cold towel or a wrapped cold pack on it for 10–20 minutes.', 'Watch the child closely for 24 hours. Naps are fine, but check that you can wake them as usual.', 'If they fell from higher than their own height or hit hard, see a doctor even without symptoms.'],
        vi: ['Nếu bị u, chườm khăn lạnh hoặc túi chườm lạnh (bọc trong khăn) 10–20 phút.', 'Theo dõi trẻ kỹ trong 24 giờ. Ngủ trưa vẫn được nhưng hãy kiểm tra xem có đánh thức trẻ như bình thường được không.', 'Nếu trẻ ngã từ nơi cao hơn chiều cao của trẻ hoặc va đập mạnh, hãy đi khám dù không có triệu chứng.'],
        zh: ['起包时用冷毛巾或包着毛巾的冰袋冷敷10～20分钟。', '24小时内仔细观察孩子。可以午睡，但要确认能像平时一样叫醒。', '如果从比孩子身高更高的地方摔下或撞得很重，即使没有症状也要去看医生。']
      },
      w: { ko: ['정신을 잃었을 때', '2번 이상 토할 때', '심하게 처지거나 깨우기 힘들 때', '경련할 때', '귀·코에서 피나 맑은 물이 나올 때', '걷기·말하기가 평소와 다를 때', '돌 전 아기가 머리를 다쳤을 때'], en: ['Lost consciousness', 'Vomited twice or more', 'Very drowsy or hard to wake', 'Has a seizure', 'Blood or clear fluid from the ears or nose', 'Walking or talking is not normal', 'A baby under 1 hit their head'], vi: ['Bất tỉnh', 'Nôn từ 2 lần trở lên', 'Lừ đừ hoặc khó đánh thức', 'Co giật', 'Chảy máu hoặc dịch trong từ tai, mũi', 'Đi lại hoặc nói năng khác thường', 'Bé dưới 1 tuổi bị va đầu'], zh: ['失去意识', '呕吐2次以上', '非常嗜睡或很难叫醒', '抽搐', '耳朵或鼻子流血或流清水', '走路或说话和平时不一样', '1岁以下婴儿头部受伤'] } },
    { id: 'poison', ic: '🧴',
      t: { ko: '약·세제·건전지를 삼켰어요', en: 'Swallowed medicine, detergent or a battery', vi: 'Nuốt phải thuốc, chất tẩy rửa hoặc pin', zh: '误吞药物、洗涤剂或电池' },
      s: {
        ko: ['억지로 토하게 하지 마세요.', '입안에 남은 것은 닦아 내요.', '삼킨 약·제품 통을 챙겨서 바로 응급실에 가거나 119에 전화해요.', '단추 모양 건전지나 자석은 증상이 없어도 바로 응급실에 가요.', '눈에 들어갔으면 흐르는 물로 15분 넘게 씻어요.'],
        en: ['Do not make the child vomit.', 'Wipe out anything left in the mouth.', 'Take the medicine or product container and go to the ER right away, or call 119.', 'Button batteries and magnets need the ER right away, even with no symptoms.', 'If it got in the eyes, rinse with running water for more than 15 minutes.'],
        vi: ['Không gây nôn cho trẻ.', 'Lau sạch những gì còn trong miệng.', 'Mang theo hộp thuốc hoặc bao bì sản phẩm, đến phòng cấp cứu ngay hoặc gọi 119.', 'Pin cúc áo và nam châm: đến phòng cấp cứu ngay dù không có triệu chứng.', 'Nếu bị dính vào mắt, rửa dưới vòi nước chảy hơn 15 phút.'],
        zh: ['不要催吐。', '擦掉嘴里残留的东西。', '带上药品或产品的包装，立即去急诊或拨打 119。', '纽扣电池和磁铁即使没有症状也要立即去急诊。', '如果进入眼睛，用流动的水冲洗15分钟以上。']
      },
      w: { ko: ['숨쉬기 힘들어하거나 처질 때', '경련할 때', '단추형 건전지·자석·강한 세제를 삼켰을 때'], en: ['Trouble breathing or very drowsy', 'Has a seizure', 'Swallowed a button battery, magnet or strong cleaner'], vi: ['Khó thở hoặc lừ đừ', 'Co giật', 'Nuốt pin cúc áo, nam châm hoặc chất tẩy mạnh'], zh: ['呼吸困难或精神很差', '抽搐', '误吞纽扣电池、磁铁或强力清洁剂'] } }
  ];

  // ───── 119·병원에 보여 줄 한국어 문장 ─────
  var PHRASES = [
    { ko: '아이가 숨을 못 쉬어요.', en: 'My child cannot breathe.', vi: 'Con tôi không thở được.', zh: '我的孩子不能呼吸。' },
    { ko: '아이가 경련을 해요.', en: 'My child is having a seizure.', vi: 'Con tôi đang bị co giật.', zh: '我的孩子在抽搐。' },
    { ko: '아이가 정신을 잃었어요.', en: 'My child is unconscious.', vi: 'Con tôi bị bất tỉnh.', zh: '我的孩子失去了意识。' },
    { ko: '아이 열이 아주 높아요.', en: 'My child has a very high fever.', vi: 'Con tôi bị sốt rất cao.', zh: '我的孩子发高烧。' },
    { ko: '아이가 약(물건)을 삼켰어요.', en: 'My child swallowed medicine (an object).', vi: 'Con tôi đã nuốt phải thuốc (đồ vật).', zh: '我的孩子误吞了药（东西）。' },
    { ko: '아이가 다쳤어요. 피가 많이 나요.', en: 'My child is injured and bleeding a lot.', vi: 'Con tôi bị thương, chảy nhiều máu.', zh: '我的孩子受伤了，流了很多血。' },
    { ko: '아이가 계속 토해요.', en: 'My child keeps vomiting.', vi: 'Con tôi nôn liên tục.', zh: '我的孩子一直在吐。' },
    { ko: '아이가 알레르기가 있어요.', en: 'My child has an allergy.', vi: 'Con tôi bị dị ứng.', zh: '我的孩子有过敏。' },
    { ko: '저는 한국어를 잘 못해요. 통역이 필요해요.', en: 'I do not speak Korean well. I need an interpreter.', vi: 'Tôi không giỏi tiếng Hàn. Tôi cần phiên dịch.', zh: '我韩语不好，需要翻译。' },
    { ko: '천천히 말해 주세요.', en: 'Please speak slowly.', vi: 'Xin hãy nói chậm.', zh: '请说慢一点。' }
  ];

  function sheet(html) {
    $('#sheet-body').innerHTML = html;
    $('#sheet').hidden = false; $('#sheet-bg').hidden = false; $('#sheet').scrollTop = 0;
  }
  function langBar() {
    return '<div class="lang-bar">' + LANGS.map(function (l) { return '<button class="' + (l[0] === lang ? 'on' : '') + '" data-setlang="' + l[0] + '">' + l[1] + '</button>'; }).join('') + '</div>';
  }
  function bindLang(after) {
    $$('#sheet-body [data-setlang]').forEach(function (b) {
      b.addEventListener('click', function () { lang = b.dataset.setlang; save('lang', lang); document.documentElement.setAttribute('data-lang', lang); after(); });
    });
  }

  function openFA(id) {
    var it = id && FA.filter(function (x) { return x.id === id; })[0];
    if (!it) {
      sheet(langBar() + '<h2>🆘 ' + t('faTitle') + '</h2><div class="tg-sub">' + t('faSub') + '</div>' +
        '<a class="tg-119" href="tel:119">' + t('call119') + '</a>' +
        '<div class="fa-list">' + FA.map(function (x) { return '<button class="fa-item" data-fa="' + x.id + '"><span class="fa-ic">' + x.ic + '</span><span>' + esc(x.t[lang] || x.t.ko) + '</span><span class="tb-ar">›</span></button>'; }).join('') + '</div>' +
        '<button class="btn ghost fa-phr" data-phrases>' + t('phrases') + '</button>' +
        '<div class="note">' + t('faNote') + '<br>' + t('faSrc') + (lang !== 'ko' ? '<br>' + t('translateNote') : '') + '</div>');
      bindLang(function () { openFA(); });
      $$('#sheet-body [data-fa]').forEach(function (b) { b.addEventListener('click', function () { openFA(b.dataset.fa); }); });
      return;
    }
    var steps = it.s[lang] || it.s.ko, warn = it.w[lang] || it.w.ko;
    sheet(langBar() + '<h2>' + it.ic + ' ' + esc(it.t[lang] || it.t.ko) + '</h2>' +
      '<a class="tg-119" href="tel:119">' + t('call119') + '</a>' +
      '<ol class="fa-steps">' + steps.map(function (x, i) { return '<li><b>' + (i + 1) + '</b><span>' + esc(x) + '</span></li>'; }).join('') + '</ol>' +
      '<div class="fa-warn"><b>🚨 ' + t('when119') + '</b><ul>' + warn.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
      '<button class="btn ghost tg-again" data-fa-back>' + t('back') + '</button>' +
      '<div class="note">' + t('faNote') + '<br>' + t('faSrc') + (lang !== 'ko' ? '<br>' + t('translateNote') : '') + '</div>');
    bindLang(function () { openFA(id); });
    $('#sheet-body [data-fa-back]').addEventListener('click', function () { openFA(); });
  }
  function openPhrases() {
    sheet(langBar() + '<h2>🗣 ' + t('phraseTitle') + '</h2><div class="tg-sub">' + t('phraseSub') + '</div>' +
      '<div class="phr-list">' + PHRASES.map(function (p, i) { return '<button class="phr" data-phr="' + i + '"><b lang="ko">' + esc(p.ko) + '</b>' + (lang !== 'ko' ? '<span>' + esc(p[lang]) + '</span>' : '') + '</button>'; }).join('') + '</div>' +
      '<button class="btn ghost" data-go-tab="benefit" data-go-pane="card">' + t('showCard') + '</button>' +
      '<a class="btn ghost phr-call" href="tel:15771366">' + t('danuri') + '</a>' +
      '<a class="tg-119" href="tel:119">' + t('call119') + '</a>' +
      (lang !== 'ko' ? '<div class="note">' + t('translateNote') + '</div>' : ''));
    bindLang(openPhrases);
    $$('#sheet-body [data-phr]').forEach(function (b) {
      b.addEventListener('click', function () {
        var p = PHRASES[+b.dataset.phr];
        sheet('<div class="phr-big" lang="ko">' + esc(p.ko) + '</div>' + (lang !== 'ko' ? '<div class="phr-big-t">' + esc(p[lang]) + '</div>' : '') +
          '<button class="btn ghost tg-again" data-phr-back>' + t('back') + '</button>');
        $('#sheet-body [data-phr-back]').addEventListener('click', openPhrases);
      });
    });
  }
  function openLang() {
    sheet('<h2>🌏 ' + t('langTitle') + '</h2>' +
      '<div class="lang-big">' + LANGS.map(function (l) { return '<button class="' + (l[0] === lang ? 'on' : '') + '" data-setlang="' + l[0] + '">' + l[1] + '</button>'; }).join('') + '</div>' +
      '<div class="tg-sub">' + t('langNote') + '</div>' +
      '<div class="lang-go"><button class="btn" data-triage-go>' + t('triage') + '</button><button class="btn ghost" data-fa-go>' + t('firstaid') + '</button><button class="btn ghost" data-phr-go>' + t('phrases') + '</button></div>' +
      '<div class="priv">' + t('langPriv') + '</div>');
    bindLang(openLang);
    $('#sheet-body [data-triage-go]').addEventListener('click', function () { if (K.openTriage) K.openTriage(); });
    $('#sheet-body [data-fa-go]').addEventListener('click', function () { openFA(); });
    $('#sheet-body [data-phr-go]').addEventListener('click', openPhrases);
  }
  document.addEventListener('click', function (e) {
    var c = e.target.closest ? e.target : null; if (!c) return;
    if (c.closest('[data-firstaid]')) { openFA(); return; }
    if (c.closest('[data-phrases]')) { openPhrases(); return; }
    if (c.closest('[data-lang-open]')) { openLang(); return; }
  });
  K.openFirstAid = openFA;
  K.langBar = langBar; K.bindLang = bindLang;
  document.documentElement.setAttribute('data-lang', lang);
})();
