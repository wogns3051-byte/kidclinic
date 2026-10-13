/* 아이아플때 — "어디로 가야 해요?" 안내
 * 진단이 아니라, 공개된 소아 응급 안내(병원 건강정보·보건복지부 안내)를 그대로 옮긴 참고용 체크리스트.
 * 위험 신호가 하나라도 있으면 더 급한 쪽으로 안내한다. 선택한 증상은 저장하지 않는다.
 * 기준을 바꿀 때는 아래 ITEMS 만 고치면 된다.
 */
(function () {
  'use strict';
  var K = window.KC; if (!K) return;
  var $ = K.$, $$ = K.$$, esc = K.esc;

  // 증상 목록 (ko 기준. en/vi/zh 는 같은 뜻의 번역)
  var ITEMS = [
    { g: 'r', id: 'r1', t: { ko: '숨쉬기 매우 힘들어함 · 입술이나 얼굴이 파래짐', en: 'Struggling to breathe · lips or face turning blue', vi: 'Rất khó thở · môi hoặc mặt tím tái', zh: '呼吸非常困难 · 嘴唇或脸发紫' } },
    { g: 'r', id: 'r2', t: { ko: '깨워도 잘 안 깨거나, 축 늘어져 반응이 없음', en: 'Hard to wake, or limp and not responding', vi: 'Khó đánh thức, hoặc lả đi, không phản ứng', zh: '很难叫醒，或瘫软没有反应' } },
    { g: 'r', id: 'r3', t: { ko: '경련이 5분 넘게 계속되거나, 멈춘 뒤에도 의식이 돌아오지 않음', en: 'Seizure lasting over 5 minutes, or not waking up after it stops', vi: 'Co giật hơn 5 phút, hoặc không tỉnh lại sau khi hết co giật', zh: '抽搐超过5分钟，或停止后仍未恢复意识' } },
    { g: 'r', id: 'r4', t: { ko: '얼굴·입술이 붓고 숨쉬기 힘들어함 (심한 알레르기)', en: 'Face or lips swelling with trouble breathing (severe allergy)', vi: 'Mặt, môi sưng và khó thở (dị ứng nặng)', zh: '脸、嘴唇肿胀并呼吸困难（严重过敏）' } },
    { g: 'o', id: 'o2', t: { ko: '경련이 있었음 (지금은 멈춤)', en: 'Had a seizure (stopped now)', vi: 'Đã bị co giật (giờ đã hết)', zh: '有过抽搐（现在已停止）' } },
    { g: 'o', id: 'o3', t: { ko: '숨이 가쁨 · 개 짖는 듯한 기침과 숨 쉴 때 쌕쌕거림', en: 'Fast breathing · barking cough or wheezing', vi: 'Thở nhanh · ho như chó sủa hoặc thở khò khè', zh: '呼吸急促 · 犬吠样咳嗽或喘鸣' } },
    { g: 'o', id: 'o4', t: { ko: '소변이 크게 줄고 입안이 마름 · 울어도 눈물이 없음', en: 'Much less urine, dry mouth · no tears when crying', vi: 'Tiểu ít hẳn, khô miệng · khóc không có nước mắt', zh: '尿量明显减少、口干 · 哭时没有眼泪' } },
    { g: 'o', id: 'o5', t: { ko: '피 섞인 변 · 녹색이나 피 섞인 구토 · 계속 토함', en: 'Bloody stool · green or bloody vomit · keeps vomiting', vi: 'Phân có máu · nôn ra dịch xanh hoặc có máu · nôn liên tục', zh: '便中带血 · 吐绿色或带血的东西 · 不停呕吐' } },
    { g: 'o', id: 'o6', t: { ko: '눈에 띄게 처지고 먹는 양이 크게 줄었음', en: 'Clearly drowsy and eating much less', vi: 'Lừ đừ rõ rệt và ăn ít hẳn', zh: '明显没精神，吃得明显变少' } },
    { g: 'o', id: 'o7', t: { ko: '머리를 다친 뒤 토하거나 처짐', en: 'Vomiting or drowsy after a head injury', vi: 'Nôn hoặc lừ đừ sau khi bị va đầu', zh: '头部受伤后呕吐或没精神' } },
    { g: 'o', id: 'o8', t: { ko: '배터리·자석·약 같은 것을 삼켰음', en: 'Swallowed a battery, magnet or medicine', vi: 'Nuốt phải pin, nam châm hoặc thuốc', zh: '误吞电池、磁铁或药物' } },
    { g: 'y', id: 'f', t: { ko: '38℃ 이상 열이 남', en: 'Fever of 38°C or higher', vi: 'Sốt từ 38°C trở lên', zh: '发烧38°C以上' } },
    { g: 'y', id: 'y1', t: { ko: '해열제를 먹여도 많이 힘들어함', en: 'Still very uncomfortable after fever medicine', vi: 'Vẫn rất mệt dù đã uống thuốc hạ sốt', zh: '吃了退烧药仍然很难受' } },
    { g: 'y', id: 'y2', t: { ko: '귀가 아프거나, 아파서 잠을 못 잠', en: 'Ear pain, or cannot sleep because of pain', vi: 'Đau tai, hoặc đau đến mức không ngủ được', zh: '耳朵痛，或痛得睡不着' } },
    { g: 'y', id: 'y3', t: { ko: '열이 3일 넘게 계속됨', en: 'Fever for more than 3 days', vi: 'Sốt kéo dài hơn 3 ngày', zh: '发烧超过3天' } }
  ];
  var L = {
    gr: { ko: '가장 위험한 신호', en: 'Most dangerous signs', vi: 'Dấu hiệu nguy hiểm nhất', zh: '最危险的信号' },
    go: { ko: '빨리 진료가 필요한 신호', en: 'Needs care soon', vi: 'Cần khám sớm', zh: '需要尽快就医的信号' },
    gy: { ko: '그 밖의 증상', en: 'Other symptoms', vi: 'Triệu chứng khác', zh: '其他症状' },
    title: { ko: '어디로 가야 해요?', en: 'Where should we go?', vi: 'Nên đưa bé đi đâu?', zh: '该去哪里？' },
    sub: { ko: '지금 아이에게 해당하는 것을 <b>모두</b> 눌러 주세요. 진단이 아니라 공개된 안내를 바탕으로 한 참고용이에요.', en: 'Tap <b>all</b> that apply to your child now. This is not a diagnosis, only a guide based on public information.', vi: 'Chạm vào <b>tất cả</b> những gì đúng với bé lúc này. Đây không phải chẩn đoán, chỉ là tham khảo dựa trên hướng dẫn công khai.', zh: '请点选孩子现在<b>所有</b>符合的情况。这不是诊断，只是基于公开信息的参考。' },
    t119: { ko: '📞 아이가 위급해 보이면 고르지 말고 바로 119', en: '📞 If your child looks critical, skip this and call 119', vi: '📞 Nếu bé có vẻ nguy kịch, đừng chọn nữa, gọi ngay 119', zh: '📞 孩子看起来很危急时，不用选择，直接拨打 119' },
    age: { ko: '아이 나이', en: 'Child\'s age', vi: 'Tuổi của bé', zh: '孩子年龄' },
    byCard: { ko: '(응급 카드 기준)', en: '(from emergency card)', vi: '(theo thẻ cấp cứu)', zh: '（根据急救卡）' },
    m1: { ko: '생후 1개월 미만', en: 'under 1 month', vi: 'dưới 1 tháng', zh: '未满1个月' },
    mo: { ko: '개월', en: ' months', vi: ' tháng', zh: '个月' },
    u3y: { ko: '생후 3개월 미만', en: 'Under 3 months', vi: 'Dưới 3 tháng', zh: '未满3个月' },
    u3n: { ko: '3개월 이상', en: '3 months or older', vi: 'Từ 3 tháng trở lên', zh: '3个月以上' },
    go_: { ko: '결과 보기', en: 'See result', vi: 'Xem kết quả', zh: '查看结果' },
    nosave: { ko: '고른 증상은 저장하지 않아요.', en: 'Your choices are not saved.', vi: 'Các lựa chọn không được lưu.', zh: '所选症状不会被保存。' },
    needAge: { ko: '아이 나이를 골라 주세요. 생후 3개월 미만은 열만 있어도 바로 진료가 필요해요', en: 'Please choose the age. Babies under 3 months need care right away for any fever.', vi: 'Hãy chọn tuổi của bé. Trẻ dưới 3 tháng bị sốt cần đi khám ngay.', zh: '请选择孩子年龄。未满3个月的婴儿只要发烧就需要立即就医。' },
    rT: { ko: '지금 바로 119에 전화하세요', en: 'Call 119 right now', vi: 'Gọi 119 ngay bây giờ', zh: '请立即拨打 119' },
    rB: { ko: '고른 증상은 가장 위험한 신호예요. 병원을 찾아가지 말고 119의 안내를 받으세요.', en: 'These are the most dangerous signs. Do not drive to a hospital yourself; follow 119\'s instructions.', vi: 'Đây là các dấu hiệu nguy hiểm nhất. Đừng tự đến bệnh viện, hãy làm theo hướng dẫn của 119.', zh: '这些是最危险的信号。不要自己去医院，请听从 119 的指示。' },
    r119: { ko: '📞 119 전화하기', en: '📞 Call 119', vi: '📞 Gọi 119', zh: '📞 拨打 119' },
    card: { ko: '🪪 응급 카드 열어 두기', en: '🪪 Open emergency card', vi: '🪪 Mở thẻ cấp cứu', zh: '🪪 打开急救卡' },
    oT: { ko: '지금 응급실 진료가 필요해요', en: 'Your child needs the emergency room now', vi: 'Bé cần đến phòng cấp cứu ngay', zh: '现在需要去急诊' },
    oU3: { ko: '생후 3개월 미만 아기의 38℃ 이상 열은 바로 진료가 필요해요. ', en: 'A fever of 38°C or higher in a baby under 3 months needs care right away. ', vi: 'Trẻ dưới 3 tháng sốt từ 38°C cần được khám ngay. ', zh: '未满3个月的婴儿发烧38°C以上需要立即就医。' },
    oB: { ko: '가까운 응급실로 가세요. 가는 동안 상태가 나빠지면 119에 전화하세요.', en: 'Go to the nearest ER. If things get worse on the way, call 119.', vi: 'Hãy đến phòng cấp cứu gần nhất. Nếu bé xấu đi trên đường, hãy gọi 119.', zh: '请去最近的急诊。途中情况变差请拨打 119。' },
    oEr: { ko: '🏥 가까운 야간 응급실 보기', en: '🏥 Nearby emergency rooms', vi: '🏥 Phòng cấp cứu gần đây', zh: '🏥 查看附近急诊' },
    oBed: { ko: '🛏 응급실 실시간 병상', en: '🛏 ER beds right now', vi: '🛏 Giường cấp cứu hiện có', zh: '🛏 急诊实时床位' },
    o119: { ko: '📞 119 (가는 길·상담)', en: '📞 119 (advice on the way)', vi: '📞 119 (tư vấn trên đường)', zh: '📞 119（途中咨询）' },
    yTd: { ko: '오늘 소아과 진료를 받아 보세요', en: 'See a pediatrician today', vi: 'Hãy cho bé khám nhi hôm nay', zh: '今天去看儿科' },
    yTn: { ko: '오늘 밤 문 연 소아과나 달빛어린이병원으로 가세요', en: 'Go to a pediatric clinic open tonight or a Moonlight Children\'s Hospital', vi: 'Hãy đến phòng khám nhi mở cửa tối nay hoặc Bệnh viện nhi Ánh Trăng (달빛어린이병원)', zh: '今晚去营业的儿科或"月光儿童医院"' },
    yBd: { ko: '지금 진료 중인 가까운 소아과를 찾아보세요.', en: 'Find a nearby pediatric clinic open now.', vi: 'Tìm phòng khám nhi gần đây đang mở cửa.', zh: '查找附近正在营业的儿科。' },
    yBn: { ko: '응급실보다 비용과 대기가 적은 달빛어린이병원이나 야간 진료 의원을 먼저 찾아보세요.', en: 'Moonlight Children\'s Hospitals and night clinics cost less and have shorter waits than the ER.', vi: 'Bệnh viện nhi Ánh Trăng và phòng khám đêm rẻ hơn và chờ ít hơn phòng cấp cứu.', zh: '"月光儿童医院"和夜间诊所比急诊费用低、等待时间短。' },
    yOpen: { ko: '🕘 지금 문 연 곳 보기', en: '🕘 Open now', vi: '🕘 Đang mở cửa', zh: '🕘 现在营业的地方' },
    yMoon: { ko: '🌙 달빛어린이병원 보기', en: '🌙 Moonlight Children\'s Hospitals', vi: '🌙 Bệnh viện nhi Ánh Trăng', zh: '🌙 月光儿童医院' },
    gT: { ko: '집에서 지켜봐도 괜찮을 수 있어요', en: 'It may be OK to watch at home', vi: 'Có thể theo dõi tại nhà', zh: '可以先在家观察' },
    gB: { ko: '열이 있어도 잘 먹고 잘 놀고 소변을 잘 보면 지켜볼 수 있어요. 열이 3일 넘게 가거나 위 증상이 하나라도 생기면 다시 확인하세요.', en: 'Even with a fever, if your child eats, plays and pees well, you can watch at home. Check again if the fever lasts over 3 days or any sign above appears.', vi: 'Dù sốt, nếu bé ăn, chơi và đi tiểu bình thường thì có thể theo dõi. Kiểm tra lại nếu sốt quá 3 ngày hoặc có bất kỳ dấu hiệu nào ở trên.', zh: '即使发烧，只要孩子吃得好、玩得好、尿量正常就可以观察。发烧超过3天或出现上述任何症状时请再次确认。' },
    gMed: { ko: '💊 해열제·체온 기록하기', en: '💊 Log fever medicine & temperature', vi: '💊 Ghi thuốc hạ sốt & nhiệt độ', zh: '💊 记录退烧药和体温' },
    gReg: { ko: '내일 갈 소아과 찾기', en: 'Find a clinic for tomorrow', vi: 'Tìm phòng khám cho ngày mai', zh: '查找明天去的儿科' },
    bringR: { ko: '구급대를 기다리며 챙길 것', en: 'While waiting for the ambulance, bring', vi: 'Trong khi chờ xe cấp cứu, hãy chuẩn bị', zh: '等救护车时准备' },
    bring: { ko: '챙겨 갈 것', en: 'What to bring', vi: 'Mang theo', zh: '需要带的东西' },
    bl: { ko: ['응급 카드 (알레르기·먹는 약)', '해열제·체온 기록', '먹던 약이나 약봉투', '보호자 신분증 (건강보험 확인)', '기저귀·물티슈·여벌 옷', '휴대폰 충전기'], en: ['Emergency card (allergies, medicines)', 'Fever medicine & temperature log', 'Current medicines or pill bags', 'Your ID (for health insurance)', 'Diapers, wipes, spare clothes', 'Phone charger'], vi: ['Thẻ cấp cứu (dị ứng, thuốc đang dùng)', 'Nhật ký thuốc hạ sốt & nhiệt độ', 'Thuốc đang dùng hoặc túi thuốc', 'Giấy tờ tùy thân của bạn (bảo hiểm y tế)', 'Tã, khăn ướt, quần áo dự phòng', 'Sạc điện thoại'], zh: ['急救卡（过敏、正在吃的药）', '退烧药和体温记录', '正在吃的药或药袋', '监护人身份证（确认医保）', '尿布、湿巾、备用衣服', '手机充电器'] },
    bCard: { ko: '🪪 응급 카드', en: '🪪 Emergency card', vi: '🪪 Thẻ cấp cứu', zh: '🪪 急救卡' },
    bLog: { ko: '💊 기록 보기', en: '💊 View log', vi: '💊 Xem nhật ký', zh: '💊 查看记录' },
    chosen: { ko: '고른 증상', en: 'Selected', vi: 'Đã chọn', zh: '所选症状' },
    helpH: { ko: '판단이 어려우면', en: 'Not sure?', vi: 'Không chắc chắn?', zh: '难以判断时' },
    help1: { ko: '보건복지부 <b>「응급똑똑」 앱 → 아이안심톡</b>: 만 12세 이하 아이 증상을 소아전문응급센터 의사·간호사에게 24시간 물어볼 수 있어요.', en: 'Ministry of Health app <b>"응급똑똑" → 아이안심톡</b>: ask pediatric emergency doctors and nurses about children up to 12, 24/7 (in Korean).', vi: 'Ứng dụng của Bộ Y tế <b>"응급똑똑" → 아이안심톡</b>: hỏi bác sĩ, y tá cấp cứu nhi về trẻ đến 12 tuổi, 24/7 (bằng tiếng Hàn).', zh: '保健福祉部 <b>"응급똑똑" 应用 → 아이안심톡</b>：可24小时向儿童急诊医生、护士咨询12岁以下孩子的症状（韩语）。' },
    helpApp: { ko: '응급똑똑 앱 찾기 (플레이스토어)', en: 'Find the 응급똑똑 app (Play Store)', vi: 'Tìm ứng dụng 응급똑똑 (Play Store)', zh: '查找 응급똑똑 应用（Play 商店）' },
    helpIos: { ko: '아이폰은 앱스토어에서 "응급똑똑"을 검색하세요.', en: 'On iPhone, search "응급똑똑" in the App Store.', vi: 'Trên iPhone, tìm "응급똑똑" trong App Store.', zh: 'iPhone 请在 App Store 搜索"응급똑똑"。' },
    help119: { ko: '📞 119 의료상담', en: '📞 119 medical advice', vi: '📞 119 tư vấn y tế', zh: '📞 119 医疗咨询' },
    again: { ko: '← 다시 고르기', en: '← Choose again', vi: '← Chọn lại', zh: '← 重新选择' },
    final: { ko: '이 안내는 진단이 아니에요. 아이 상태가 걱정되면 망설이지 말고 119에 전화하세요. 고른 증상은 저장하지 않아요.', en: 'This is not a diagnosis. If you are worried about your child, do not hesitate to call 119. Your choices are not saved.', vi: 'Đây không phải chẩn đoán. Nếu lo lắng cho bé, đừng ngần ngại gọi 119. Các lựa chọn không được lưu.', zh: '本指南不是诊断。如果担心孩子，请不要犹豫，拨打 119。所选症状不会被保存。' },
    src: { ko: '참고: 한양대학교병원 건강정보(2026.1), 보건복지부 아이안심톡 안내(2025.7) 등 공개 자료', en: 'Sources: Hanyang University Hospital health info (Jan 2026), Ministry of Health 아이안심톡 guide (Jul 2025), and other public materials', vi: 'Nguồn: Thông tin sức khỏe Bệnh viện ĐH Hanyang (1/2026), hướng dẫn 아이안심톡 của Bộ Y tế (7/2025) và các tài liệu công khai khác', zh: '参考：汉阳大学医院健康信息（2026.1）、保健福祉部 아이안심톡 指南（2025.7）等公开资料' },
    home: { ko: '', en: '<details class="homecare" open><summary>🏠 Caring for a fever at home</summary><ul><li>Dress lightly. If shivering, cover with a thin blanket.</li><li>Give small sips of water, breast milk or formula often, and watch how often they pee.</li><li>Give fever medicine only when the child is uncomfortable, following the label dose and interval.</li><li>Do not wipe with cold water or alcohol.</li><li>Keeping a log of temperature, medicine and pee helps the doctor.</li></ul></details>', vi: '<details class="homecare" open><summary>🏠 Chăm sóc trẻ sốt tại nhà</summary><ul><li>Mặc quần áo mỏng. Nếu bé run, đắp chăn mỏng.</li><li>Cho bé uống nước, bú mẹ hoặc sữa công thức từng chút một, thường xuyên; theo dõi số lần đi tiểu.</li><li>Chỉ cho uống thuốc hạ sốt khi bé mệt, theo đúng liều và khoảng cách trên hướng dẫn.</li><li>Không lau người bằng nước lạnh hoặc cồn.</li><li>Ghi lại nhiệt độ, thuốc và số lần đi tiểu sẽ giúp bác sĩ.</li></ul></details>', zh: '<details class="homecare" open><summary>🏠 在家照顾发烧的孩子</summary><ul><li>穿薄一点。如果孩子发抖，盖一条薄被。</li><li>少量多次地喂水、母乳或奶粉，注意尿的次数。</li><li>只有在孩子难受时才吃退烧药，按说明书的剂量和间隔服用。</li><li>不要用冷水或酒精擦身。</li><li>记录体温、用药和尿的次数对医生有帮助。</li></ul></details>' }
  };
  function tr(k) { var v = L[k], lg = K.lang ? K.lang() : 'ko'; return v ? (v[lg] || v.ko) : k; }
  function it(x) { var lg = K.lang ? K.lang() : 'ko'; return x.t[lg] || x.t.ko; }
  var GROUPS = { r: 'gr', o: 'go', y: 'gy' };

  var picked = {}, under3 = null;

  function kidAge() {
    var k = K.curKid && K.curKid();
    if (!k || !k.birth) return null;
    var b = new Date(k.birth + 'T00:00:00'), n = new Date();
    var m = (n.getFullYear() - b.getFullYear()) * 12 + (n.getMonth() - b.getMonth()) - (n.getDate() < b.getDate() ? 1 : 0);
    return { name: k.name, months: m };
  }
  function open() {
    picked = {};
    var a = kidAge();
    under3 = a ? a.months < 3 : null;
    show(a);
  }
  function show(a) {
    $('#sheet-body').innerHTML = form(a);
    $('#sheet').hidden = false; $('#sheet-bg').hidden = false;
    $('#sheet').scrollTop = 0;
    bind();
    if (K.bindLang) K.bindLang(function () { show(a); });
  }
  function form(a) {
    var html = (K.langBar ? K.langBar() : '') + '<h2>' + tr('title') + '</h2>' +
      '<div class="tg-sub">' + tr('sub') + '</div>' +
      '<a class="tg-119" href="tel:119">' + tr('t119') + '</a>';
    html += '<div class="tg-age"><div class="tg-age-h">' + tr('age') + '</div>' +
      (a ? '<div class="tg-age-v">' + esc(a.name) + ' · ' + (a.months < 1 ? tr('m1') : a.months + tr('mo')) + ' ' + tr('byCard') + '</div>' : '') +
      '<div class="seg tg-seg"><button data-u3="1" class="' + (under3 === true ? 'on' : '') + '">' + tr('u3y') + '</button><button data-u3="0" class="' + (under3 === false ? 'on' : '') + '">' + tr('u3n') + '</button></div></div>';
    ['r', 'o', 'y'].forEach(function (g) {
      html += '<div class="tg-gh tg-' + g + '">' + tr(GROUPS[g]) + '</div><div class="tg-list">' +
        ITEMS.filter(function (x) { return x.g === g; }).map(function (x) {
          return '<button class="tg-item tg-' + g + (picked[x.id] ? ' on' : '') + '" data-tg="' + x.id + '"><span class="tg-box"></span>' + esc(it(x)) + '</button>';
        }).join('') + '</div>';
    });
    html += '<button class="btn tg-go" id="tg-go">' + tr('go_') + '</button>' +
      '<div class="note">' + tr('nosave') + ' ' + tr('src') + '</div>';
    return html;
  }
  function bind() {
    $$('#sheet-body [data-tg]').forEach(function (b) {
      b.addEventListener('click', function () { b.classList.toggle('on'); picked[b.dataset.tg] = b.classList.contains('on'); });
    });
    $$('#sheet-body [data-u3]').forEach(function (b) {
      b.addEventListener('click', function () {
        under3 = b.dataset.u3 === '1';
        $$('#sheet-body [data-u3]').forEach(function (x) { x.classList.toggle('on', x === b); });
      });
    });
    $('#tg-go').addEventListener('click', result);
  }
  function isDaytimeClinic() {
    var n = K.kstNow(), db = K.db;
    var holi = db && db.holis && db.holis[n.date];
    return !holi && n.dow >= 1 && n.dow <= 5 && n.hhmm >= 900 && n.hhmm < 1730;
  }
  function result() {
    var any = function (g) { return ITEMS.some(function (x) { return x.g === g && picked[x.id]; }); };
    var level;
    if (any('r')) level = 'r';
    else if (any('o') || (picked.f && under3 === true)) level = 'o';
    else if (any('y')) level = 'y';
    else level = 'g';
    if (picked.f && under3 === null && level !== 'r' && level !== 'o') {
      K.toast(tr('needAge'));
      return;
    }
    var day = isDaytimeClinic();
    var R = {
      r: { cls: 'r', t: tr('rT'), b: tr('rB'),
        acts: '<a class="btn big red" href="tel:119">' + tr('r119') + '</a>' +
              '<button class="btn ghost" data-go-tab="benefit" data-go-pane="card">' + tr('card') + '</button>' },
      o: { cls: 'o', t: tr('oT'), b: (picked.f && under3 ? tr('oU3') : '') + tr('oB'),
        acts: '<button class="btn big" data-go-tab="night" data-go-filter="er">' + tr('oEr') + '</button>' +
              '<a class="btn ghost" href="' + (K.ER_BEDS_URL || 'https://mediboard.nemc.or.kr/emergency_room_in_hand') + '" target="_blank" rel="noopener">' + tr('oBed') + '</a>' +
              '<a class="btn ghost" href="tel:119">' + tr('o119') + '</a>' },
      y: { cls: 'y', t: day ? tr('yTd') : tr('yTn'), b: day ? tr('yBd') : tr('yBn'),
        acts: '<button class="btn big" data-go-tab="night" data-go-filter="openNow">' + tr('yOpen') + '</button>' +
              '<button class="btn ghost" data-go-tab="night" data-go-filter="moonlight">' + tr('yMoon') + '</button>' },
      g: { cls: 'g', t: tr('gT'), b: tr('gB'),
        acts: '<button class="btn big" data-go-tab="benefit" data-go-pane="med">' + tr('gMed') + '</button>' +
              '<button class="btn ghost" data-go-tab="region">' + tr('gReg') + '</button>' }
    }[level];
    var BRING = '<div class="tg-bring"><b>🎒 ' + (level === 'r' ? tr('bringR') : tr('bring')) + '</b>' +
      tr('bl').map(function (x) { return '<label><input type="checkbox"> ' + x + '</label>'; }).join('') +
      '<div class="tg-bring-btns"><button class="btn ghost" data-go-tab="benefit" data-go-pane="card">' + tr('bCard') + '</button><button class="btn ghost" data-go-tab="benefit" data-go-pane="med">' + tr('bLog') + '</button></div></div>';
    if (level === 'r' || level === 'o') R.acts += BRING;
    var lg = K.lang ? K.lang() : 'ko';
    if (level === 'g') R.acts += lg === 'ko' ? (K.HOMECARE ? K.HOMECARE.replace('<details class="homecare">', '<details class="homecare" open>') : '') : tr('home');
    var chosen = ITEMS.filter(function (x) { return picked[x.id]; }).map(function (x) { return esc(it(x)); });
    $('#sheet-body').innerHTML =
      '<div class="tg-res tg-' + R.cls + '"><div class="tg-res-t">' + R.t + '</div><div class="tg-res-b">' + R.b + '</div></div>' +
      '<div class="tg-acts">' + R.acts + '</div>' +
      (chosen.length ? '<div class="tg-chosen"><b>' + tr('chosen') + '</b><br>' + chosen.join('<br>') + (under3 === true ? '<br>' + tr('u3y') : '') + '</div>' : '') +
      '<div class="tg-help"><b>' + tr('helpH') + '</b>' +
        '<div>' + tr('help1') + '</div>' +
        '<a class="btn ghost" href="https://play.google.com/store/search?q=%EC%9D%91%EA%B8%89%EB%98%91%EB%98%91&c=apps" target="_blank" rel="noopener">' + tr('helpApp') + '</a>' +
        '<div class="muted-s">' + tr('helpIos') + '</div>' +
        (lg !== 'ko' && K.t ? '<a class="btn ghost" href="tel:15771366">' + K.t('danuri') + '</a><button class="btn ghost" data-phrases>' + K.t('phrases') + '</button>' : '') +
        '<a class="btn ghost" href="tel:119">' + tr('help119') + '</a></div>' +
      '<button class="btn ghost tg-again" id="tg-again">' + tr('again') + '</button>' +
      '<div class="note">' + tr('final') + '<br>' + tr('src') + '</div>';
    $('#sheet').scrollTop = 0;
    $('#tg-again').addEventListener('click', function () { show(kidAge()); });
  }
  // 안내 화면 안의 이동 버튼을 누르면 창을 닫는다
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('#sheet [data-go-tab]')) { $('#sheet').hidden = true; $('#sheet-bg').hidden = true; }
  }, true);
  $$('[data-triage]').forEach(function (b) { b.addEventListener('click', open); });
  K.openTriage = open;
})();
