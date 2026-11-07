/* v6.35：real.js / challenge.js / dynasty.js 的多语言字典
 *
 * 这三个功能的文案写成 tx('简体', 'English')。这里以英文模板为键，{0}{1}… 是英文里 ${} 的位置，
 * 译文可以调换顺序。zh-Hans 直接用简体原文，en 用英文原文，其他语言查这张表，查不到就用英文。
 * 同一个英文要按中文区分时，键写成「英文|中文」。
 * 每行顺序：[繁體中文, 한국어, 日本語, Tiếng Việt, Français, ไทย, Español]
 */
(function () {
  'use strict';
  const ORDER = ['zh-Hant', 'ko', 'ja', 'vi', 'fr', 'th', 'es'];
  const D = {
    /* ---------- real.js：小测题目 ---------- */
    "Do you smoke?": ["你吸菸嗎？", "담배를 피우시나요?", "タバコを吸いますか？", "Bạn có hút thuốc không?", "Fumez-vous ?", "คุณสูบบุหรี่ไหม?", "¿Fumas?"],
    "Never": ["從不吸", "피우지 않음", "吸わない", "Không bao giờ", "Jamais", "ไม่เคย", "Nunca"],
    "Quit": ["以前吸，已經戒了", "피웠지만 끊었음", "以前吸っていたがやめた", "Đã bỏ", "J’ai arrêté", "เคยสูบ แต่เลิกแล้ว", "Lo dejé"],
    "Occasionally": ["偶爾吸", "가끔", "ときどき", "Thỉnh thoảng", "De temps en temps", "บางครั้ง", "A veces"],
    "Every day": ["每天吸", "매일", "毎日", "Hằng ngày", "Tous les jours", "ทุกวัน", "Todos los días"],
    "How much do you exercise a week? (brisk walking counts)": ["每週運動多少？（快走也算）", "일주일에 운동을 얼마나 하나요? (빠르게 걷기도 포함)", "1週間にどれくらい運動しますか？（早歩きも含む）", "Mỗi tuần bạn tập thể dục bao nhiêu? (đi bộ nhanh cũng tính)", "Combien faites-vous d’exercice par semaine ? (la marche rapide compte)", "ออกกำลังกายสัปดาห์ละเท่าไร? (เดินเร็วก็นับ)", "¿Cuánto ejercicio haces a la semana? (caminar rápido cuenta)"],
    "150+ minutes": ["150 分鐘以上", "150분 이상", "150分以上", "Trên 150 phút", "150 minutes ou plus", "150 นาทีขึ้นไป", "150 minutos o más"],
    "Now and then": ["偶爾動一動", "가끔 움직임", "たまに動く", "Thỉnh thoảng vận động", "De temps en temps", "ขยับบ้างเป็นครั้งคราว", "De vez en cuando"],
    "Almost never": ["幾乎不動", "거의 안 함", "ほとんど動かない", "Hầu như không", "Presque jamais", "แทบไม่ขยับ", "Casi nunca"],
    "How many hours do you usually sleep?": ["平常一晚睡幾小時？", "보통 하룻밤에 몇 시간 자나요?", "ふだん一晩に何時間寝ますか？", "Bạn thường ngủ mấy tiếng mỗi đêm?", "Combien d’heures dormez-vous en général ?", "ปกติคุณนอนคืนละกี่ชั่วโมง?", "¿Cuántas horas sueles dormir?"],
    "7–8 hours": ["7–8 小時", "7–8시간", "7〜8時間", "7–8 tiếng", "7 à 8 heures", "7–8 ชั่วโมง", "7–8 horas"],
    "About 6": ["6 小時左右", "6시간 정도", "6時間くらい", "Khoảng 6 tiếng", "Environ 6", "ประมาณ 6 ชั่วโมง", "Unas 6"],
    "Under 6": ["不到 6 小時", "6시간 미만", "6時間未満", "Dưới 6 tiếng", "Moins de 6", "น้อยกว่า 6 ชั่วโมง", "Menos de 6"],
    "9 or more": ["9 小時以上", "9시간 이상", "9時間以上", "9 tiếng trở lên", "9 ou plus", "9 ชั่วโมงขึ้นไป", "9 o más"],
    "Do you drink alcohol?": ["你喝酒嗎？", "술을 마시나요?", "お酒を飲みますか？", "Bạn có uống rượu bia không?", "Buvez-vous de l’alcool ?", "คุณดื่มแอลกอฮอล์ไหม?", "¿Bebes alcohol?"],
    "Never or rarely": ["不喝或很少", "안 마시거나 거의 안 마심", "飲まない・ほとんど飲まない", "Không hoặc rất ít", "Jamais ou rarement", "ไม่ดื่มหรือดื่มน้อยมาก", "Nunca o casi nunca"],
    "A few times a week, moderately": ["每週幾次，適量", "일주일에 몇 번, 적당히", "週に数回、適量", "Vài lần một tuần, vừa phải", "Quelques fois par semaine, avec modération", "สัปดาห์ละไม่กี่ครั้ง พอประมาณ", "Algunas veces por semana, con moderación"],
    "Often and heavily": ["經常喝很多", "자주, 많이", "よく、たくさん飲む", "Thường xuyên và nhiều", "Souvent et beaucoup", "ดื่มบ่อยและดื่มหนัก", "A menudo y mucho"],
    "Do you eat vegetables and fruit every day?": ["每天吃蔬菜水果嗎？", "매일 채소와 과일을 먹나요?", "毎日野菜や果物を食べますか？", "Bạn có ăn rau và trái cây mỗi ngày không?", "Mangez-vous des fruits et légumes chaque jour ?", "คุณกินผักผลไม้ทุกวันไหม?", "¿Comes frutas y verduras todos los días?"],
    "Plenty every day": ["每天都吃很多", "매일 충분히", "毎日たっぷり", "Ăn nhiều mỗi ngày", "Beaucoup, tous les jours", "กินเยอะทุกวัน", "Mucho, todos los días"],
    "Sometimes": ["有時候", "가끔", "ときどき", "Thỉnh thoảng", "Parfois", "บางครั้ง", "A veces"],
    "Rarely; lots of takeaway and sweets": ["很少，外賣、甜食多", "거의 안 먹음, 배달음식·단 것 많이", "あまり食べない。外食や甘い物が多い", "Hiếm khi; ăn đồ mua sẵn và đồ ngọt nhiều", "Rarement ; beaucoup de plats à emporter et de sucreries", "แทบไม่กิน กินอาหารสั่งและของหวานเยอะ", "Casi nunca; mucha comida para llevar y dulces"],
    "Your body shape?": ["你的體型？", "체형은 어떤가요?", "あなたの体型は？", "Vóc dáng của bạn?", "Votre silhouette ?", "รูปร่างของคุณ?", "¿Tu complexión?"],
    "Healthy weight": ["標準", "표준", "標準", "Cân nặng chuẩn", "Poids normal", "น้ำหนักปกติ", "Peso saludable"],
    "A bit overweight": ["有點胖", "약간 과체중", "少し太め", "Hơi thừa cân", "Un peu de surpoids", "ท้วมนิดหน่อย", "Un poco de sobrepeso"],
    "Obese": ["明顯肥胖", "비만", "肥満", "Béo phì", "Obèse", "อ้วนชัดเจน", "Obesidad"],
    "Underweight": ["偏瘦", "저체중", "やせ型", "Thiếu cân", "Maigre", "ผอมเกินไป", "Bajo peso"],
    "Do you often see or talk with friends and family?": ["常和朋友家人見面、聊天嗎？", "친구나 가족을 자주 만나거나 이야기하나요?", "友人や家族とよく会ったり話したりしますか？", "Bạn có thường gặp gỡ, trò chuyện với bạn bè và gia đình không?", "Voyez-vous souvent vos proches ou vos amis ?", "คุณเจอหรือคุยกับเพื่อนและครอบครัวบ่อยไหม?", "¿Ves o hablas a menudo con amigos y familia?"],
    "Often": ["經常", "자주", "よく", "Thường xuyên", "Souvent", "บ่อย", "A menudo"],
    "Rarely; often lonely": ["很少，常覺得孤單", "거의 안 함, 자주 외로움", "あまりない。よく孤独を感じる", "Hiếm khi; thường thấy cô đơn", "Rarement ; souvent seul(e)", "แทบไม่ ชอบรู้สึกเหงา", "Casi nunca; a menudo me siento solo/a"],
    "Your mood over the past year?": ["最近一年的心情？", "지난 1년 동안의 기분은?", "この1年の気分は？", "Tâm trạng của bạn trong năm qua?", "Votre humeur cette année ?", "อารมณ์ของคุณในปีที่ผ่านมา?", "¿Tu estado de ánimo este último año?"],
    "Mostly happy": ["大多開心", "대체로 즐거움", "おおむね楽しい", "Phần lớn vui vẻ", "Plutôt heureux(se)", "ส่วนใหญ่มีความสุข", "Casi siempre feliz"],
    "So-so": ["普通", "보통", "ふつう", "Bình thường", "Moyenne", "เฉยๆ", "Regular"],
    "Stressed most of the time": ["長期壓力大", "늘 스트레스가 많음", "いつもストレスが大きい", "Căng thẳng phần lớn thời gian", "Stressé(e) la plupart du temps", "เครียดเกือบตลอดเวลา", "Estresado/a casi siempre"],
    "Any chronic conditions?": ["有沒有慢性病？", "만성질환이 있나요?", "持病はありますか？", "Bạn có bệnh mãn tính không?", "Une maladie chronique ?", "มีโรคเรื้อรังไหม?", "¿Alguna enfermedad crónica?"],
    "None": ["沒有", "없음", "なし", "Không", "Aucune", "ไม่มี", "Ninguna"],
    "High blood pressure or cholesterol": ["高血壓或高血脂", "고혈압 또는 고지혈증", "高血圧または脂質異常症", "Cao huyết áp hoặc mỡ máu cao", "Hypertension ou cholestérol", "ความดันสูงหรือไขมันในเลือดสูง", "Hipertensión o colesterol alto"],
    "Diabetes": ["糖尿病", "당뇨병", "糖尿病", "Tiểu đường", "Diabète", "เบาหวาน", "Diabetes"],
    "Heart disease or stroke": ["心臟病或中風過", "심장병 또는 뇌졸중 경험", "心臓病または脳卒中の経験", "Bệnh tim hoặc từng đột quỵ", "Maladie cardiaque ou AVC", "โรคหัวใจหรือเคยเป็นอัมพาต", "Enfermedad cardíaca o ictus"],
    "How often do you get a health check?": ["多久做一次體檢？", "건강검진은 얼마나 자주 받나요?", "健康診断はどのくらいの頻度で受けますか？", "Bao lâu bạn khám sức khỏe một lần?", "À quelle fréquence faites-vous un bilan de santé ?", "คุณตรวจสุขภาพบ่อยแค่ไหน?", "¿Cada cuánto te haces un chequeo?"],
    "Every year": ["每年", "매년", "毎年", "Mỗi năm", "Chaque année", "ทุกปี", "Cada año"],
    "Every few years": ["幾年一次", "몇 년에 한 번", "数年に一度", "Vài năm một lần", "Tous les quelques ans", "หลายปีครั้ง", "Cada pocos años"],

    /* ---------- real.js：建议 ---------- */
    "Quit smoking: it helps at any age; quit clinics and nicotine replacement double your odds.": ["戒菸：任何年紀戒都有用，戒菸門診和尼古丁替代品能讓成功率翻倍。", "금연: 몇 살에 끊어도 효과가 있어요. 금연 클리닉과 니코틴 대체요법은 성공률을 두 배로 높여요.", "禁煙：何歳でやめても効果があります。禁煙外来やニコチン代替療法で成功率が倍になります。", "Bỏ thuốc lá: bỏ ở tuổi nào cũng có ích; phòng khám cai thuốc và liệu pháp thay thế nicotine giúp tăng gấp đôi cơ hội thành công.", "Arrêtez de fumer : c’est utile à tout âge ; une consultation de sevrage et les substituts nicotiniques doublent vos chances.", "เลิกบุหรี่: เลิกตอนอายุเท่าไรก็ได้ผล คลินิกเลิกบุหรี่และนิโคตินทดแทนช่วยให้สำเร็จได้มากขึ้นเป็นสองเท่า", "Deja de fumar: ayuda a cualquier edad; las consultas para dejarlo y la terapia de nicotina duplican tus posibilidades."],
    "Brisk walk 150 minutes a week plus 2 strength sessions; start with 15 minutes after meals.": ["每週快走 150 分鐘，加 2 次肌力訓練；從每天飯後走 15 分鐘開始。", "일주일에 빠르게 걷기 150분과 근력운동 2회. 식후 15분 걷기부터 시작하세요.", "週150分の早歩きと2回の筋トレを。まずは毎食後15分歩くことから。", "Đi bộ nhanh 150 phút mỗi tuần và tập sức mạnh 2 buổi; bắt đầu bằng 15 phút đi bộ sau bữa ăn.", "Marchez vite 150 minutes par semaine et faites 2 séances de renforcement ; commencez par 15 minutes après les repas.", "เดินเร็วสัปดาห์ละ 150 นาที บวกเวทเทรนนิ่ง 2 ครั้ง เริ่มจากเดิน 15 นาทีหลังอาหาร", "Camina rápido 150 minutos a la semana y haz 2 sesiones de fuerza; empieza con 15 minutos después de comer."],
    "Keep a fixed bedtime, put the phone down an hour before, aim for 7–8 hours.": ["固定時間上床，睡前 1 小時放下手機，睡滿 7–8 小時。", "같은 시간에 잠자리에 들고, 자기 1시간 전에 휴대폰을 내려놓고, 7–8시간 주무세요.", "決まった時間に寝て、寝る1時間前にスマホを置き、7〜8時間眠りましょう。", "Đi ngủ đúng giờ, bỏ điện thoại xuống một tiếng trước khi ngủ, ngủ đủ 7–8 tiếng.", "Couchez-vous à heure fixe, lâchez le téléphone une heure avant, visez 7 à 8 heures.", "เข้านอนเวลาเดิม วางมือถือก่อนนอน 1 ชั่วโมง นอนให้ได้ 7–8 ชั่วโมง", "Acuéstate a la misma hora, deja el móvil una hora antes y apunta a 7–8 horas."],
    "Drink less: at least 3 alcohol-free days a week, one glass of water per drink.": ["少喝酒：每週至少 3 天不喝，聚會時一杯酒配一杯水。", "술 줄이기: 일주일에 최소 3일은 마시지 말고, 술 한 잔에 물 한 잔.", "お酒を減らす：週に3日以上の休肝日、お酒1杯に水1杯。", "Uống ít lại: mỗi tuần ít nhất 3 ngày không uống, mỗi ly rượu kèm một ly nước.", "Buvez moins : au moins 3 jours sans alcool par semaine, un verre d’eau par verre d’alcool.", "ดื่มให้น้อยลง: งดดื่มอย่างน้อยสัปดาห์ละ 3 วัน ดื่มน้ำหนึ่งแก้วต่อเหล้าหนึ่งแก้ว", "Bebe menos: al menos 3 días sin alcohol a la semana y un vaso de agua por cada copa."],
    "Half a plate of vegetables each meal, fruit instead of dessert, fewer sugary drinks.": ["每餐半盤蔬菜，用水果代替甜點，少喝含糖飲料。", "매 끼니 접시의 절반은 채소로, 디저트 대신 과일, 단 음료는 줄이기.", "毎食お皿の半分を野菜に、デザートは果物に、甘い飲み物は控えめに。", "Mỗi bữa nửa đĩa rau, ăn trái cây thay đồ ngọt, bớt nước ngọt.", "La moitié de l’assiette en légumes, un fruit au lieu du dessert, moins de boissons sucrées.", "ผักครึ่งจานทุกมื้อ กินผลไม้แทนของหวาน ลดเครื่องดื่มหวาน", "Medio plato de verduras en cada comida, fruta en vez de postre y menos bebidas azucaradas."],
    "Waist under 90 cm (men) / 80 cm (women); losing 1–2 kg a month lasts best.": ["腰圍男 < 90 cm、女 < 80 cm；每月減 1–2 公斤最容易維持。", "허리둘레 남성 90cm, 여성 80cm 미만. 한 달에 1–2kg씩 빼는 것이 가장 오래 유지돼요.", "腹囲は男性90cm・女性80cm未満に。月1〜2kgの減量がいちばん続きます。", "Vòng eo nam dưới 90 cm, nữ dưới 80 cm; giảm 1–2 kg mỗi tháng là dễ duy trì nhất.", "Tour de taille sous 90 cm (hommes) / 80 cm (femmes) ; perdre 1 à 2 kg par mois tient le mieux.", "รอบเอวชายไม่เกิน 90 ซม. หญิงไม่เกิน 80 ซม. ลดเดือนละ 1–2 กก. รักษาไว้ได้ง่ายที่สุด", "Cintura por debajo de 90 cm (hombres) / 80 cm (mujeres); bajar 1–2 kg al mes es lo que mejor se mantiene."],
    "See friends or family at least weekly; join a club or volunteer.": ["每週至少和朋友或家人見面一次，加入一個興趣團體或當義工。", "일주일에 한 번은 친구나 가족을 만나고, 동호회나 봉사활동에 참여해 보세요.", "週に1回は友人や家族と会い、サークルやボランティアに参加しましょう。", "Gặp bạn bè hoặc gia đình ít nhất mỗi tuần một lần; tham gia câu lạc bộ hoặc làm tình nguyện.", "Voyez vos proches au moins une fois par semaine ; rejoignez un club ou faites du bénévolat.", "เจอเพื่อนหรือครอบครัวอย่างน้อยสัปดาห์ละครั้ง เข้าชมรมหรือทำงานอาสา", "Ve a amigos o familia al menos una vez por semana; únete a un club o haz voluntariado."],
    "Give yourself 15 minutes a day; if stress affects sleep or appetite, talk to a professional.": ["每天留 15 分鐘給自己；壓力大到影響睡眠或食慾時，找專業人士談談。", "하루 15분은 자신을 위해 쓰세요. 스트레스로 잠이나 식욕에 문제가 생기면 전문가와 상담하세요.", "1日15分は自分のための時間を。ストレスで睡眠や食欲に影響が出たら専門家に相談を。", "Dành 15 phút mỗi ngày cho bản thân; nếu căng thẳng ảnh hưởng giấc ngủ hay ăn uống, hãy nói chuyện với chuyên gia.", "Accordez-vous 15 minutes par jour ; si le stress touche le sommeil ou l’appétit, parlez-en à un professionnel.", "ให้เวลาตัวเองวันละ 15 นาที ถ้าความเครียดกระทบการนอนหรือการกิน ให้ปรึกษาผู้เชี่ยวชาญ", "Dedícate 15 minutos al día; si el estrés afecta al sueño o al apetito, habla con un profesional."],
    "Take medicine and keep follow-ups: blood pressure < 130/80, HbA1c < 7%.": ["按時吃藥、定期回診：血壓 < 130/80、糖化血色素 < 7%。", "약을 제때 먹고 정기적으로 진료받으세요: 혈압 < 130/80, 당화혈색소 < 7%.", "薬をきちんと飲み、定期的に受診を：血圧 < 130/80、HbA1c < 7%。", "Uống thuốc đúng giờ và tái khám định kỳ: huyết áp < 130/80, HbA1c < 7%.", "Prenez vos traitements et faites vos suivis : tension < 130/80, HbA1c < 7 %.", "กินยาตรงเวลาและไปพบแพทย์ตามนัด: ความดัน < 130/80, HbA1c < 7%", "Toma tu medicación y acude a los controles: tensión < 130/80, HbA1c < 7 %."],
    "From 40, check blood pressure, sugar and cholesterol yearly, plus age-appropriate cancer screening.": ["40 歲起每年量血壓、血糖、血脂，按年齡做癌症篩檢。", "40세부터는 매년 혈압·혈당·콜레스테롤을 재고, 나이에 맞는 암 검진을 받으세요.", "40歳からは毎年血圧・血糖・コレステロールを測り、年齢に合ったがん検診を。", "Từ 40 tuổi, mỗi năm đo huyết áp, đường huyết, mỡ máu và tầm soát ung thư theo độ tuổi.", "Dès 40 ans, contrôlez chaque année tension, glycémie et cholestérol, et faites les dépistages adaptés à votre âge.", "ตั้งแต่อายุ 40 ตรวจความดัน น้ำตาล และไขมันทุกปี และตรวจคัดกรองมะเร็งตามวัย", "Desde los 40, revisa cada año tensión, azúcar y colesterol, y hazte los cribados de cáncer según tu edad."],

    /* ---------- real.js：画面 ---------- */
    "My real life": ["我的真實人生", "나의 진짜 인생", "わたしの本当の人生", "Cuộc đời thật của tôi", "Ma vraie vie", "ชีวิตจริงของฉัน", "Mi vida real"],
    "Game lives are random. What about yours? Enter three things to see where you stand in the world, then take a 10-question quiz to estimate how long you could live.": ["遊戲裡的人生是隨機的，你的真實人生呢？輸入三個資料，看看你在全世界排第幾，再做 10 題小測，估算你能活到幾歲。", "게임 속 인생은 무작위예요. 당신의 진짜 인생은요? 세 가지만 입력하면 세계에서 어디쯤인지 알 수 있고, 10문항 퀴즈로 몇 살까지 살 수 있을지 추정해 드려요.", "ゲームの人生はランダム。では、あなたの本当の人生は？3つ入力すると世界のどこにいるかがわかり、10問のクイズで何歳まで生きられるかを推定します。", "Cuộc đời trong game là ngẫu nhiên. Còn cuộc đời thật của bạn? Nhập ba thông tin để xem bạn đứng ở đâu trên thế giới, rồi làm bài trắc nghiệm 10 câu để ước tính bạn sống được bao lâu.", "Les vies du jeu sont tirées au hasard. Et la vôtre ? Indiquez trois choses pour voir où vous vous situez dans le monde, puis répondez à 10 questions pour estimer jusqu’à quel âge vous pourriez vivre.", "ชีวิตในเกมเป็นแบบสุ่ม แล้วชีวิตจริงของคุณล่ะ? กรอกข้อมูล 3 อย่างเพื่อดูว่าคุณอยู่ตรงไหนของโลก แล้วทำแบบทดสอบ 10 ข้อเพื่อประเมินว่าคุณจะอยู่ได้ถึงอายุเท่าไร", "Las vidas del juego son aleatorias. ¿Y la tuya? Introduce tres datos para ver dónde estás en el mundo y responde 10 preguntas para estimar cuánto podrías vivir."],
    "Birth year": ["出生年", "출생 연도", "生まれた年", "Năm sinh", "Année de naissance", "ปีเกิด", "Año de nacimiento"],
    "Born in": ["出生國家", "출생 국가", "生まれた国", "Nơi sinh", "Pays de naissance", "ประเทศที่เกิด", "País de nacimiento"],
    "Sex": ["性別", "성별", "性別", "Giới tính", "Sexe", "เพศ", "Sexo"],
    "Female": ["女", "여성", "女性", "Nữ", "Femme", "หญิง", "Mujer"],
    "Male": ["男", "남성", "男性", "Nam", "Homme", "ชาย", "Hombre"],
    "Show my life →": ["看看我的人生 →", "내 인생 보기 →", "わたしの人生を見る →", "Xem cuộc đời tôi →", "Voir ma vie →", "ดูชีวิตของฉัน →", "Ver mi vida →"],
    "Calculated on your device. Nothing is uploaded.": ["只在你的裝置上計算，不會上傳。", "기기에서만 계산되며 업로드되지 않아요.", "端末の中だけで計算し、アップロードしません。", "Chỉ tính trên thiết bị của bạn, không tải lên đâu cả.", "Calculé sur votre appareil. Rien n’est envoyé.", "คำนวณบนเครื่องของคุณเท่านั้น ไม่มีการอัปโหลด", "Se calcula en tu dispositivo. No se sube nada."],
    "Where you stand in the world": ["你在全世界的位置", "세계 속 나의 위치", "世界の中のあなたの位置", "Vị trí của bạn trên thế giới", "Votre place dans le monde", "ตำแหน่งของคุณในโลก", "Tu lugar en el mundo"],
    "Born in {0}, you started out better off than <b>{1}%</b> of the world's newborns": ["出生在{0}，你的出生條件好過全世界 <b>{1}%</b> 的新生兒", "{0}에서 태어난 당신은 전 세계 신생아의 <b>{1}%</b>보다 좋은 조건에서 출발했어요", "{0}で生まれたあなたは、世界の新生児の <b>{1}%</b> より恵まれたスタートでした", "Sinh ra ở {0}, bạn khởi đầu tốt hơn <b>{1}%</b> trẻ sơ sinh trên thế giới", "Pays de naissance : {0}. Vous avez démarré mieux que <b>{1} %</b> des nouveau-nés du monde", "เกิดที่{0} คุณเริ่มต้นได้ดีกว่าทารกแรกเกิด <b>{1}%</b> ของโลก", "Al nacer en {0}, empezaste mejor que el <b>{1} %</b> de los recién nacidos del mundo"],
    "{0}'s income per person is higher than the birth country of {1}% of newborns": ["{0}的人均收入，高於全球 {1}% 新生兒的出生國", "{0}의 1인당 소득은 전 세계 신생아 {1}%의 출생국보다 높아요", "{0}の1人あたり所得は、世界の新生児の {1}% が生まれた国より高い", "Thu nhập bình quân của {0} cao hơn quốc gia nơi {1}% trẻ sơ sinh chào đời", "Le revenu par habitant de ce pays ({0}) dépasse celui du pays de naissance de {1} % des nouveau-nés", "รายได้ต่อหัวของ{0} สูงกว่าประเทศที่ทารก {1}% ของโลกเกิด", "La renta por persona de {0} supera la del país de nacimiento del {1} % de los recién nacidos"],
    "Life expectancy higher than for {0}% of newborns": ["預期壽命高於全球 {0}% 新生兒的出生國", "기대수명은 전 세계 신생아 {0}%의 출생국보다 높아요", "平均寿命は、世界の新生児の {0}% が生まれた国より長い", "Tuổi thọ trung bình cao hơn nơi {0}% trẻ sơ sinh chào đời", "Espérance de vie plus élevée que pour {0} % des nouveau-nés", "อายุคาดเฉลี่ยสูงกว่าประเทศที่ทารก {0}% ของโลกเกิด", "Esperanza de vida mayor que la del {0} % de los recién nacidos"],
    "About {0} babies were born in {1}; about {2}% did not reach age 5": ["{1} 年全世界大約出生了 {0} 個嬰兒，其中約 {2}% 沒能活過 5 歲", "{1}년에 전 세계에서 약 {0}명의 아기가 태어났고, 그중 약 {2}%는 5살을 넘기지 못했어요", "{1}年には世界で約{0}人の赤ちゃんが生まれ、そのうち約{2}%が5歳まで生きられませんでした", "Năm {1} có khoảng {0} em bé chào đời; khoảng {2}% không sống quá 5 tuổi", "Environ {0} bébés sont nés en {1} ; environ {2} % n’ont pas atteint 5 ans", "ปี {1} มีทารกเกิดทั่วโลกราว {0} คน ราว {2}% อยู่ไม่ถึง 5 ขวบ", "En {1} nacieron unos {0} bebés; alrededor del {2} % no llegó a los 5 años"],
    "You have lived about {0} days; your heart has beaten about {1} times": ["你已經活了大約 {0} 天，心臟跳了大約 {1} 次", "당신은 약 {0}일을 살았고, 심장은 약 {1}번 뛰었어요", "あなたは約{0}日生き、心臓は約{1}回鼓動しました", "Bạn đã sống khoảng {0} ngày; tim bạn đã đập khoảng {1} lần", "Vous avez vécu environ {0} jours ; votre cœur a battu environ {1} fois", "คุณมีชีวิตมาแล้วราว {0} วัน หัวใจเต้นไปแล้วราว {1} ครั้ง", "Has vivido unos {0} días; tu corazón ha latido unas {1} veces"],
    "People born the same year, country and sex live to about {0} on average; {1}% pass 80": ["和你同年、同國、同性別的人，平均能活到約 {0} 歲；{1}% 能活過 80 歲", "같은 해, 같은 나라, 같은 성별로 태어난 사람은 평균 약 {0}세까지 살고, {1}%는 80세를 넘겨요", "同じ年・同じ国・同じ性別の人は平均約{0}歳まで生き、{1}%が80歳を超えます", "Người cùng năm sinh, quốc gia và giới tính sống trung bình khoảng {0} tuổi; {1}% sống quá 80", "Les personnes du même âge, pays et sexe vivent en moyenne jusqu’à {0} ans ; {1} % dépassent 80 ans", "คนที่เกิดปีเดียวกัน ประเทศเดียวกัน เพศเดียวกัน อยู่ได้เฉลี่ยราว {0} ปี และ {1}% อายุเกิน 80", "Las personas del mismo año, país y sexo viven de media unos {0} años; el {1} % pasa de los 80"],
    "🩺 Take the 10-question quiz": ["🩺 做 10 題小測，算算我能活到幾歲", "🩺 10문항 퀴즈로 몇 살까지 살지 알아보기", "🩺 10問のクイズで何歳まで生きられるか調べる", "🩺 Làm trắc nghiệm 10 câu", "🩺 Répondre aux 10 questions", "🩺 ทำแบบทดสอบ 10 ข้อ", "🩺 Haz el test de 10 preguntas"],
    "← Edit": ["← 修改資料", "← 수정", "← 修正", "← Sửa", "← Modifier", "← แก้ไข", "← Editar"],
    "Longevity quiz": ["長壽小測", "장수 퀴즈", "長寿クイズ", "Trắc nghiệm tuổi thọ", "Quiz longévité", "แบบทดสอบอายุยืน", "Test de longevidad"],
    "Back": ["上一題", "이전", "前へ", "Quay lại", "Retour", "ย้อนกลับ", "Atrás"],
    "Your longevity estimate": ["你的長壽預測", "당신의 장수 예측", "あなたの長寿予測", "Dự đoán tuổi thọ của bạn", "Votre estimation de longévité", "การคาดการณ์อายุของคุณ", "Tu estimación de longevidad"],
    "At your current habits, you could live to about <b>{0}</b>": ["照現在的習慣，你大約能活到 <b>{0} 歲</b>", "지금 습관대로라면 약 <b>{0}세</b>까지 살 수 있어요", "今の習慣のままなら、約 <b>{0}歳</b> まで生きられそうです", "Với thói quen hiện tại, bạn có thể sống đến khoảng <b>{0} tuổi</b>", "Avec vos habitudes actuelles, vous pourriez vivre jusqu’à environ <b>{0} ans</b>", "ถ้าใช้ชีวิตแบบนี้ต่อไป คุณอาจอยู่ได้ถึงราว <b>{0} ปี</b>", "Con tus hábitos actuales, podrías vivir hasta unos <b>{0} años</b>"],
    "Average for your cohort: about {0} ({1}{2} years)": ["同年同國同性別的平均：約 {0} 歲（{1}{2} 年）", "같은 해·나라·성별 평균: 약 {0}세 ({1}{2}년)", "同じ年・国・性別の平均：約{0}歳（{1}{2}年）", "Trung bình cùng năm, nước, giới tính: khoảng {0} tuổi ({1}{2} năm)", "Moyenne de votre génération : environ {0} ans ({1}{2} ans)", "ค่าเฉลี่ยของคนรุ่นเดียวกัน: ราว {0} ปี ({1}{2} ปี)", "Media de tu generación: unos {0} años ({1}{2} años)"],
    "Changing {0} habits could add about <b>{1} years</b>": ["改掉 {0} 個習慣，大約還能多活 <b>{1} 年</b>", "습관 {0}개를 바꾸면 약 <b>{1}년</b> 더 살 수 있어요", "{0}つの習慣を変えれば、あと約 <b>{1}年</b> 長く生きられそうです", "Thay đổi {0} thói quen có thể sống thêm khoảng <b>{1} năm</b>", "Changer {0} habitudes pourrait ajouter environ <b>{1} ans</b>", "เปลี่ยน {0} นิสัย อาจอยู่ได้นานขึ้นราว <b>{1} ปี</b>", "Cambiar {0} hábitos podría sumar unos <b>{1} años</b>"],
    "Your habits are already great. Keep it up!": ["你的生活習慣已經很好了，繼續保持！", "생활 습관이 이미 훌륭해요. 계속 유지하세요!", "生活習慣はもう十分すばらしい。この調子で！", "Thói quen của bạn đã rất tốt. Cứ thế phát huy nhé!", "Vos habitudes sont déjà excellentes. Continuez !", "นิสัยการใช้ชีวิตของคุณดีอยู่แล้ว รักษาไว้นะ!", "Tus hábitos ya son muy buenos. ¡Sigue así!"],
    "Start with these": ["最值得先改的", "이것부터 바꿔 보세요", "まずはここから", "Hãy bắt đầu từ đây", "Commencez par ceux-ci", "เริ่มจากสิ่งเหล่านี้", "Empieza por estos"],
    "y": ["年", "년", "年", "năm", "ans", "ปี", "años"],
    // 同一个英文、中文不同时，用「英文|中文」当键区分（「岁」是年龄，「年」是年数）
    "y|岁": ["歲", "세", "歳", "tuổi", "ans", "ปี", "años"],
    "Making your card…": ["正在生成分享卡⋯", "카드를 만드는 중…", "カードを作成中…", "Đang tạo thẻ…", "Création de la carte…", "กำลังสร้างการ์ด…", "Creando tu tarjeta…"],
    "Share — who lives longest?": ["分享給朋友，看誰活得久", "공유하기 — 누가 더 오래 살까?", "シェアして、誰が長生きか比べよう", "Chia sẻ — ai sống lâu hơn?", "Partager — qui vivra le plus longtemps ?", "แชร์ให้เพื่อน ดูว่าใครอยู่นานกว่า", "Comparte: ¿quién vivirá más?"],
    "Live another life": ["去模擬另一種人生", "다른 인생 살아보기", "別の人生を生きてみる", "Sống một cuộc đời khác", "Vivre une autre vie", "ลองใช้ชีวิตอื่น", "Vive otra vida"],
    "Retake": ["重新測", "다시 하기", "もう一度", "Làm lại", "Recommencer", "ทำใหม่", "Repetir"],
    "Rough estimate from national life tables and published average effects. Not medical advice.": ["依各國生命表與公開研究的平均效果粗估，只供參考，不是醫學診斷。", "각국 생명표와 공개 연구의 평균 효과로 대략 추정한 값이에요. 의학적 진단이 아니에요.", "各国の生命表と公表研究の平均的な効果による大まかな推定です。医学的な診断ではありません。", "Ước tính sơ bộ từ bảng sống của các nước và hiệu quả trung bình trong các nghiên cứu công bố. Không phải tư vấn y khoa.", "Estimation approximative à partir des tables de mortalité nationales et des effets moyens publiés. Ce n’est pas un avis médical.", "ประมาณการคร่าวๆ จากตารางชีพของแต่ละประเทศและผลเฉลี่ยจากงานวิจัย ไม่ใช่คำวินิจฉัยทางการแพทย์", "Estimación aproximada a partir de tablas de vida nacionales y efectos medios publicados. No es consejo médico."],
    "Long-press the image to send or save": ["長按圖片，發送給朋友或儲存", "이미지를 길게 눌러 보내거나 저장하세요", "画像を長押しして送信・保存", "Nhấn giữ ảnh để gửi hoặc lưu", "Appui long sur l’image pour l’envoyer ou l’enregistrer", "กดค้างที่รูปเพื่อส่งหรือบันทึก", "Mantén pulsada la imagen para enviarla o guardarla"],
    "I could live to {0}, and I started out better off than {1}% of the world. You? {2}?real=1": ["我測了一下：照現在的習慣能活到 {0} 歲，出生條件好過全世界 {1}% 的人。你呢？{2}?real=1", "테스트해 보니 지금 습관대로면 {0}세까지 살고, 전 세계 {1}%보다 좋은 조건에서 태어났대요. 당신은? {2}?real=1", "測ってみたら、今の習慣なら{0}歳まで生きられて、世界の{1}%より恵まれた生まれでした。あなたは？{2}?real=1", "Mình có thể sống đến {0} tuổi và khởi đầu tốt hơn {1}% thế giới. Còn bạn? {2}?real=1", "Je pourrais vivre jusqu’à {0} ans, et j’ai démarré mieux que {1} % du monde. Et vous ? {2}?real=1", "ฉันลองแล้ว ถ้าใช้ชีวิตแบบนี้จะอยู่ได้ถึง {0} ปี และเกิดมาดีกว่า {1}% ของโลก แล้วคุณล่ะ? {2}?real=1", "Podría vivir hasta los {0} y empecé mejor que el {1} % del mundo. ¿Y tú? {2}?real=1"],
    "Caption copied and image downloaded.": ["分享文字已複製，圖片已下載。", "공유 문구를 복사했고 이미지를 내려받았어요.", "シェア文をコピーし、画像をダウンロードしました。", "Đã sao chép lời chia sẻ và tải ảnh xuống.", "Texte copié et image téléchargée.", "คัดลอกข้อความและดาวน์โหลดรูปแล้ว", "Texto copiado e imagen descargada."],
    "male": ["男", "남성", "男性", "nam", "homme", "ชาย", "hombre"],
    "female": ["女", "여성", "女性", "nữ", "femme", "หญิง", "mujer"],
    "of the world started out worse off": ["出生條件好過全世界的人", "전 세계에서 나보다 불리하게 태어난 사람", "世界で自分より恵まれない生まれの人", "dân số thế giới khởi đầu kém hơn tôi", "du monde a démarré moins bien que moi", "ของคนทั้งโลกเกิดมาลำบากกว่าฉัน", "del mundo empezó peor que yo"],
    "the age I could live to": ["照現在的習慣，能活到的歲數", "지금 습관대로 살 수 있는 나이", "今の習慣で生きられる年齢", "tuổi tôi có thể sống tới", "l’âge que je pourrais atteindre", "อายุที่ฉันอาจอยู่ได้ถึง", "la edad que podría alcanzar"],
    "{0} born in {1}; {2}% died before 5": ["{1} 年全球出生 {0} 人，{2}% 活不過 5 歲", "{1}년 전 세계 출생 {0}명, {2}%는 5살 전에 사망", "{1}年に世界で{0}人誕生、{2}%が5歳前に死亡", "{0} trẻ chào đời năm {1}; {2}% mất trước 5 tuổi", "{0} naissances en {1} ; {2} % sont morts avant 5 ans", "ปี {1} มีเด็กเกิด {0} คน {2}% เสียชีวิตก่อน 5 ขวบ", "{0} nacimientos en {1}; el {2} % murió antes de los 5"],
    "{0} days lived, ~{1} heartbeats": ["已經活了 {0} 天，心跳約 {1} 次", "{0}일을 살았고, 심장 박동 약 {1}회", "生きた日数{0}日、心拍約{1}回", "Đã sống {0} ngày, ~{1} nhịp tim", "{0} jours vécus, ~{1} battements de cœur", "อยู่มาแล้ว {0} วัน หัวใจเต้นราว {1} ครั้ง", "{0} días vividos, ~{1} latidos"],
    "My cohort's average: about {0}": ["同年同國同性別的人，平均活到約 {0} 歲", "같은 해·나라·성별 평균: 약 {0}세", "同じ年・国・性別の平均：約{0}歳", "Trung bình thế hệ của tôi: khoảng {0} tuổi", "Moyenne de ma génération : environ {0} ans", "ค่าเฉลี่ยคนรุ่นเดียวกัน: ราว {0} ปี", "Media de mi generación: unos {0} años"],
    "Changing {0} habits could add {1} years": ["改掉 {0} 個習慣，還能多活 {1} 年", "습관 {0}개를 바꾸면 {1}년 더", "{0}つの習慣を変えれば、あと{1}年", "Đổi {0} thói quen, sống thêm {1} năm", "Changer {0} habitudes : +{1} ans", "เปลี่ยน {0} นิสัย อยู่ได้นานขึ้น {1} ปี", "Cambiar {0} hábitos: +{1} años"],
    "Healthy habits": ["生活習慣很健康", "건강한 생활 습관", "健康的な生活習慣", "Thói quen lành mạnh", "Habitudes saines", "นิสัยสุขภาพดี", "Hábitos saludables"],
    "How long could you live?": ["你能活到幾歲？", "당신은 몇 살까지 살까요?", "あなたは何歳まで生きられる？", "Bạn có thể sống bao lâu?", "Jusqu’à quel âge vivrez-vous ?", "คุณจะอยู่ได้ถึงอายุเท่าไร?", "¿Cuánto podrías vivir?"],
    "Scan to find out in a minute": ["掃碼 1 分鐘測一測 · 還能模擬另一種人生", "스캔해서 1분 만에 알아보기", "スキャンして1分でチェック", "Quét mã để biết trong 1 phút", "Scannez pour le savoir en une minute", "สแกนเพื่อลองใน 1 นาที", "Escanea y descúbrelo en un minuto"],
    "My real life · how long could I live?": ["測測我的真實人生 · 我能活到幾歲？", "나의 진짜 인생 · 몇 살까지 살 수 있을까?", "わたしの本当の人生 · 何歳まで生きられる？", "Cuộc đời thật của tôi · tôi sống được bao lâu?", "Ma vraie vie · jusqu’à quel âge ?", "ชีวิตจริงของฉัน · ฉันจะอยู่ได้ถึงกี่ปี?", "Mi vida real · ¿cuánto podría vivir?"],

    /* ---------- challenge.js ---------- */
    "Lifespan": ["壽命", "수명", "寿命", "Tuổi thọ", "Longévité", "อายุ", "Vida"],
    "Wealth": ["財富", "재산", "財産", "Tài sản", "Richesse", "ความมั่งคั่ง", "Riqueza"],
    "Happiness": ["幸福", "행복", "幸福", "Hạnh phúc", "Bonheur", "ความสุข", "Felicidad"],
    "Relationships": ["人際", "인간관계", "人間関係", "Quan hệ", "Relations", "ความสัมพันธ์", "Relaciones"],
    "Knowledge": ["知識", "지식", "知識", "Tri thức", "Savoir", "ความรู้", "Conocimiento"],
    "You've been challenged!": ["有人向你挑戰！", "도전장이 도착했어요!", "挑戦状が届きました！", "Bạn vừa bị thách đấu!", "On vous lance un défi !", "มีคนท้าคุณ!", "¡Te han retado!"],
    "Your friend lived <b>{0}</b>'s life to <b>{1}</b>. Now it's your turn: <b>the same start</b> — same name, country, family and parents. Can you do better?": ["你的朋友把「<b>{0}</b>」的一生活到了 <b>{1} 歲</b>。現在換你來過這一生：<b>同一個起點</b>——同樣的名字、國家、家庭、父母，你能活得更好嗎？", "친구가 <b>{0}</b>의 인생을 <b>{1}세</b>까지 살았어요. 이제 당신 차례예요. <b>같은 출발점</b> — 같은 이름, 나라, 가족, 부모. 더 잘 살 수 있을까요?", "友だちは「<b>{0}</b>」の人生を <b>{1}歳</b> まで生きました。次はあなたの番：<b>同じスタート</b>——同じ名前、国、家族、両親。もっとうまく生きられる？", "Bạn của bạn đã sống cuộc đời của <b>{0}</b> đến <b>{1} tuổi</b>. Giờ đến lượt bạn: <b>cùng một khởi đầu</b> — cùng tên, quốc gia, gia đình và cha mẹ. Bạn có làm tốt hơn không?", "Votre ami(e) a mené la vie de <b>{0}</b> jusqu’à <b>{1} ans</b>. À vous : <b>le même départ</b> — même nom, pays, famille et parents. Ferez-vous mieux ?", "เพื่อนของคุณใช้ชีวิตของ <b>{0}</b> จนถึงอายุ <b>{1} ปี</b> ตอนนี้ถึงตาคุณ: <b>จุดเริ่มต้นเดียวกัน</b> — ชื่อ ประเทศ ครอบครัว และพ่อแม่เหมือนกัน คุณจะทำได้ดีกว่าไหม?", "Tu amigo/a vivió la vida de <b>{0}</b> hasta los <b>{1}</b>. Ahora te toca: <b>el mismo comienzo</b> — mismo nombre, país, familia y padres. ¿Lo harás mejor?"],
    "Your start": ["你的起點", "당신의 출발점", "あなたのスタート", "Khởi đầu của bạn", "Votre départ", "จุดเริ่มต้นของคุณ", "Tu comienzo"],
    "Accept and be born!": ["接受挑戰，出生！", "도전 수락, 태어나기!", "挑戦を受けて誕生！", "Nhận lời và chào đời!", "Relever le défi et naître !", "รับคำท้าแล้วเกิดเลย!", "¡Acepto y nazco!"],
    "Maybe later": ["先看看", "나중에", "あとで", "Để sau", "Plus tard", "ไว้ก่อน", "Quizá luego"],
    "After birth, every choice and every bit of luck is yours.": ["出生之後的每一個選擇、每一次運氣都不一樣。", "태어난 뒤의 모든 선택과 운은 당신의 것이에요.", "生まれてからの選択も運も、すべてあなた次第。", "Sau khi chào đời, mọi lựa chọn và vận may đều là của bạn.", "Après la naissance, chaque choix et chaque coup de chance vous appartiennent.", "หลังเกิด ทุกการตัดสินใจและโชคชะตาเป็นของคุณ", "Después de nacer, cada decisión y cada golpe de suerte son tuyos."],
    "🏆 You win! {0} : {1}": ["🏆 你贏了！{0} : {1}", "🏆 승리! {0} : {1}", "🏆 あなたの勝ち！{0} : {1}", "🏆 Bạn thắng! {0} : {1}", "🏆 Gagné ! {0} : {1}", "🏆 คุณชนะ! {0} : {1}", "🏆 ¡Ganaste! {0} : {1}"],
    "😤 So close! {0} : {1}": ["😤 差一點！{0} : {1}", "😤 아깝다! {0} : {1}", "😤 惜しい！{0} : {1}", "😤 Suýt nữa! {0} : {1}", "😤 Presque ! {0} : {1}", "😤 เกือบแล้ว! {0} : {1}", "😤 ¡Por poco! {0} : {1}"],
    "🤝 A tie!": ["🤝 平手！", "🤝 무승부!", "🤝 引き分け！", "🤝 Hòa!", "🤝 Égalité !", "🤝 เสมอ!", "🤝 ¡Empate!"],
    "Same start — you lived {0} years longer than your friend": ["同一個起點，你比朋友多活了 {0} 年", "같은 출발점에서 당신이 친구보다 {0}년 더 살았어요", "同じスタートで、あなたは友だちより{0}年長く生きました", "Cùng khởi đầu — bạn sống lâu hơn bạn mình {0} năm", "Même départ — vous avez vécu {0} ans de plus que votre ami(e)", "จุดเริ่มต้นเดียวกัน คุณอยู่นานกว่าเพื่อน {0} ปี", "Mismo comienzo: viviste {0} años más que tu amigo/a"],
    "Same start — your friend lived {0} years longer": ["同一個起點，朋友比你多活了 {0} 年", "같은 출발점에서 친구가 {0}년 더 살았어요", "同じスタートで、友だちのほうが{0}年長く生きました", "Cùng khởi đầu — bạn của bạn sống lâu hơn {0} năm", "Même départ — votre ami(e) a vécu {0} ans de plus", "จุดเริ่มต้นเดียวกัน เพื่อนอยู่นานกว่าคุณ {0} ปี", "Mismo comienzo: tu amigo/a vivió {0} años más"],
    "Same start, same lifespan": ["同一個起點，你們活得一樣久", "같은 출발점, 같은 수명", "同じスタート、同じ寿命", "Cùng khởi đầu, cùng tuổi thọ", "Même départ, même longévité", "จุดเริ่มต้นเดียวกัน อายุเท่ากัน", "Mismo comienzo, misma vida"],
    "You": ["你", "나", "あなた", "Bạn", "Vous", "คุณ", "Tú"],
    "Friend": ["朋友", "친구", "友だち", "Bạn bè", "Ami(e)", "เพื่อน", "Amigo/a"],
    "Cause": ["落幕原因", "사인", "最期の原因", "Nguyên nhân", "Cause", "สาเหตุ", "Causa"],
    "Challenge them back": ["回敬一個挑戰", "반격 도전 보내기", "挑戦を返す", "Thách đấu lại", "Relancer le défi", "ท้ากลับ", "Devolver el reto"],
    "Retry the same start": ["同一個起點再來一次", "같은 출발점으로 다시", "同じスタートでもう一度", "Thử lại cùng khởi đầu", "Rejouer le même départ", "เริ่มใหม่จากจุดเดิม", "Repetir el mismo comienzo"],
    "Same start — who lives better?": ["同一個起點，誰活得更好？", "같은 출발점 — 누가 더 잘 살까?", "同じスタート、どちらがよく生きる？", "Cùng khởi đầu — ai sống tốt hơn?", "Même départ — qui vivra le mieux ?", "จุดเริ่มต้นเดียวกัน ใครจะอยู่ได้ดีกว่า?", "Mismo comienzo: ¿quién vive mejor?"],
    "Send this life's starting point to a friend: same country, family and parents. Can they live longer or happier?": ["把這一生的起點發給朋友：同樣的國家、家庭、父母，看看 TA 能不能比你活得更久、更幸福。", "이 인생의 출발점을 친구에게 보내세요. 같은 나라, 가족, 부모로 더 오래, 더 행복하게 살 수 있을까요?", "この人生のスタートを友だちに送ろう。同じ国、家族、両親で、もっと長く幸せに生きられる？", "Gửi khởi đầu của cuộc đời này cho bạn bè: cùng quốc gia, gia đình và cha mẹ. Họ có sống lâu hơn hay hạnh phúc hơn không?", "Envoyez le point de départ de cette vie à un(e) ami(e) : même pays, famille et parents. Vivra-t-il/elle plus longtemps ou plus heureux ?", "ส่งจุดเริ่มต้นของชีวิตนี้ให้เพื่อน: ประเทศ ครอบครัว และพ่อแม่เหมือนกัน ดูว่าเขาจะอยู่ได้นานกว่าหรือมีความสุขกว่าไหม", "Envía el punto de partida de esta vida a un amigo: mismo país, familia y padres. ¿Vivirá más o más feliz?"],
    "Challenge a friend": ["挑戰朋友", "친구에게 도전", "友だちに挑戦", "Thách đấu bạn bè", "Défier un(e) ami(e)", "ท้าเพื่อน", "Reta a un amigo"],
    "⚔️ Same-start challenge": ["⚔️ 同一個起點挑戰", "⚔️ 같은 출발점 도전", "⚔️ 同じスタート対決", "⚔️ Thách đấu cùng khởi đầu", "⚔️ Défi même départ", "⚔️ ท้าดวลจุดเริ่มต้นเดียวกัน", "⚔️ Reto del mismo comienzo"],
    "Same start. Can you live better than me?": ["同一個起點，你能活得比我好嗎？", "같은 출발점. 나보다 잘 살 수 있어?", "同じスタート。わたしよりうまく生きられる？", "Cùng khởi đầu. Bạn có sống tốt hơn tôi không?", "Même départ. Ferez-vous mieux que moi ?", "จุดเริ่มต้นเดียวกัน คุณจะอยู่ได้ดีกว่าฉันไหม?", "Mismo comienzo. ¿Vivirás mejor que yo?"],
    "Scan to accept": ["掃碼接受挑戰", "스캔해서 도전 수락", "スキャンして挑戦を受ける", "Quét mã để nhận lời", "Scannez pour relever le défi", "สแกนเพื่อรับคำท้า", "Escanea para aceptar"],
    "Same country, family and parents": ["同樣的國家、家庭、父母，看誰活得更好", "같은 나라, 가족, 부모", "同じ国、家族、両親", "Cùng quốc gia, gia đình và cha mẹ", "Même pays, famille et parents", "ประเทศ ครอบครัว พ่อแม่เหมือนกัน", "Mismo país, familia y padres"],
    "I was born in {0} and lived to {1} in Life Simulator. Same start — can you do better? ⚔️ {2}": ["我在《模擬人生》出生在{0}，活到了 {1} 歲。同一個起點，你能活得比我好嗎？⚔️ {2}", "〈태어난 곳〉에서 {0}에 태어나 {1}세까지 살았어요. 같은 출발점 — 나보다 잘할 수 있어? ⚔️ {2}", "『出生地』で{0}に生まれ、{1}歳まで生きました。同じスタートで、わたしよりうまく生きられる？⚔️ {2}", "Trong game Nơi sinh, tôi sinh ra ở {0} và sống đến {1} tuổi. Cùng khởi đầu — bạn làm tốt hơn được không? ⚔️ {2}", "Dans Né quelque part, pays de naissance : {0}, j’ai vécu jusqu’à {1} ans. Même départ — ferez-vous mieux ? ⚔️ {2}", "ในเกม เกิดที่ไหน ฉันเกิดที่{0} และอยู่ถึง {1} ปี จุดเริ่มต้นเดียวกัน คุณจะทำได้ดีกว่าไหม? ⚔️ {2}", "En Nacido en algún lugar nací en {0} y viví hasta los {1}. Mismo comienzo: ¿lo harás mejor? ⚔️ {2}"],
    "Long-press the image to send it, or copy the link.": ["長按圖片發給朋友；或複製連結貼到聊天裡。", "이미지를 길게 눌러 보내거나 링크를 복사하세요.", "画像を長押しして送るか、リンクをコピー。", "Nhấn giữ ảnh để gửi, hoặc sao chép liên kết.", "Appui long sur l’image pour l’envoyer, ou copiez le lien.", "กดค้างที่รูปเพื่อส่ง หรือคัดลอกลิงก์", "Mantén pulsada la imagen para enviarla o copia el enlace."],
    "Send the image or link; your friend will be born from the same start.": ["把圖片或連結發給朋友，朋友打開就從同一個起點出生。", "이미지나 링크를 보내면 친구가 같은 출발점에서 태어나요.", "画像かリンクを送れば、友だちは同じスタートで生まれます。", "Gửi ảnh hoặc liên kết; bạn của bạn sẽ chào đời từ cùng một khởi đầu.", "Envoyez l’image ou le lien ; votre ami(e) naîtra avec le même départ.", "ส่งรูปหรือลิงก์ให้เพื่อน เพื่อนจะเกิดจากจุดเริ่มต้นเดียวกัน", "Envía la imagen o el enlace; tu amigo nacerá con el mismo comienzo."],
    "Share": ["分享", "공유", "シェア", "Chia sẻ", "Partager", "แชร์", "Compartir"],
    "Copy link": ["複製連結", "링크 복사", "リンクをコピー", "Sao chép liên kết", "Copier le lien", "คัดลอกลิงก์", "Copiar enlace"],
    "Download image": ["下載圖片", "이미지 저장", "画像をダウンロード", "Tải ảnh xuống", "Télécharger l’image", "ดาวน์โหลดรูป", "Descargar imagen"],
    "Copied": ["已複製", "복사됨", "コピーしました", "Đã sao chép", "Copié", "คัดลอกแล้ว", "Copiado"],
    "Same-start challenge": ["同一個起點挑戰", "같은 출발점 도전", "同じスタート対決", "Thách đấu cùng khởi đầu", "Défi même départ", "ท้าดวลจุดเริ่มต้นเดียวกัน", "Reto del mismo comienzo"],

    /* ---------- dynasty.js ---------- */
    "father": ["父親", "아버지", "父", "cha", "père", "พ่อ", "padre"],
    "mother": ["母親", "어머니", "母", "mẹ", "mère", "แม่", "madre"],
    "👪 You are the child of your {0} {1} — generation {2}": ["👪 你是{0} {1} 的孩子，家族第 {2} 代", "👪 당신은 {0} {1}의 자녀, 가문의 {2}대째예요", "👪 あなたは{0}・{1}の子、一族の{2}代目です", "👪 Bạn là con của {0} {1} — thế hệ thứ {2}", "👪 Vous êtes l’enfant de votre {0} {1} — génération {2}", "👪 คุณเป็นลูกของ{0} {1} — รุ่นที่ {2} ของตระกูล", "👪 Eres hijo/a de tu {0} {1}: generación {2}"],
    "Your father": ["父親", "아버지", "父", "Cha", "Votre père", "พ่อ", "Tu padre"],
    "Your mother": ["母親", "어머니", "母", "Mẹ", "Votre mère", "แม่", "Tu madre"],
    "🕊️ {0} {1} passed away at {2}; you inherited {3}": ["🕊️ {0} {1} 走完了一生（{2} 歲），你繼承了 {3}", "🕊️ {0} {1}님이 {2}세로 생을 마치셨고, {3}을(를) 상속받았어요", "🕊️ {0}・{1}が{2}歳で生涯を終え、あなたは{3}を相続しました", "🕊️ {0} {1} đã qua đời ở tuổi {2}; bạn được thừa kế {3}", "🕊️ {0} {1} s’est éteint(e) à {2} ans ; vous héritez de {3}", "🕊️ {0} {1} จากไปเมื่ออายุ {2} ปี คุณได้รับมรดก {3}", "🕊️ {0} {1} falleció a los {2}; heredaste {3}"],
    "🕊️ {0} {1} passed away at {2}": ["🕊️ {0} {1} 走完了一生（{2} 歲）", "🕊️ {0} {1}님이 {2}세로 생을 마치셨어요", "🕊️ {0}・{1}が{2}歳で生涯を終えました", "🕊️ {0} {1} đã qua đời ở tuổi {2}", "🕊️ {0} {1} s’est éteint(e) à {2} ans", "🕊️ {0} {1} จากไปเมื่ออายุ {2} ปี", "🕊️ {0} {1} falleció a los {2}"],
    "Gen {0}": ["第 {0} 代", "{0}대", "{0}代目", "Đời {0}", "Gén. {0}", "รุ่นที่ {0}", "Gen. {0}"],
    "M": ["男", "남", "男", "Nam", "H", "ช", "H"],
    "F": ["女", "여", "女", "Nữ", "F", "ญ", "M"],
    "{0} generations of my family": ["我家 {0} 代", "우리 집안 {0}대", "わが家の{0}代", "{0} thế hệ nhà tôi", "{0} générations de ma famille", "{0} รุ่นของครอบครัวฉัน", "{0} generaciones de mi familia"],
    "Share family card": ["分享族譜卡", "가계도 카드 공유", "家系図カードをシェア", "Chia sẻ thẻ gia phả", "Partager la carte de famille", "แชร์การ์ดผังตระกูล", "Compartir tarjeta familiar"],
    "Download family tree (GEDCOM)": ["下載族譜（GEDCOM）", "가계도 내려받기 (GEDCOM)", "家系図をダウンロード（GEDCOM）", "Tải gia phả (GEDCOM)", "Télécharger l’arbre (GEDCOM)", "ดาวน์โหลดผังตระกูล (GEDCOM)", "Descargar árbol (GEDCOM)"],
    "Family legacy: live the next generation": ["家族傳承：成為下一代", "가문 잇기: 다음 세대로 살기", "家族の継承：次の世代を生きる", "Nối dõi: sống thế hệ tiếp theo", "Héritage familial : vivre la génération suivante", "สืบทอดตระกูล: ใช้ชีวิตรุ่นต่อไป", "Legado familiar: vive la siguiente generación"],
    "Be born as one of your children and continue the family story (generation {0}).": ["成為你的孩子，繼續這個家族的故事（第 {0} 代）。", "자녀 중 한 명으로 태어나 가문의 이야기를 이어가세요 ({0}대).", "子どもの一人として生まれ、一族の物語を続けよう（{0}代目）。", "Hãy sinh ra làm một trong những người con của bạn và viết tiếp câu chuyện gia đình (thế hệ {0}).", "Renaissez comme l’un de vos enfants et poursuivez l’histoire de la famille (génération {0}).", "เกิดเป็นลูกคนหนึ่งของคุณ แล้วเล่าเรื่องราวของตระกูลต่อ (รุ่นที่ {0})", "Nace como uno de tus hijos y continúa la historia familiar (generación {0})."],
    " Each child inherits about {0} when you pass away.": ["你走完一生那年，每個孩子會繼承約 {0}。", " 당신이 생을 마치면 자녀 한 명당 약 {0}을(를) 상속받아요.", "あなたが生涯を終える年、子ども一人あたり約{0}を相続します。", " Khi bạn qua đời, mỗi người con sẽ thừa kế khoảng {0}.", " À votre décès, chaque enfant héritera d’environ {0}.", " เมื่อคุณจากไป ลูกแต่ละคนจะได้รับมรดกราว {0}", " Al fallecer, cada hijo heredará unos {0}."],
    "Be": ["成為", "되기:", "になる：", "Làm", "Devenir", "เป็น", "Ser"],
    "son": ["兒子", "아들", "息子", "con trai", "fils", "ลูกชาย", "hijo"],
    "daughter": ["女兒", "딸", "娘", "con gái", "fille", "ลูกสาว", "hija"],
    "No children this time — the family story ends at generation {0}.": ["這一代沒有留下孩子，家族的故事在第 {0} 代畫下句點。", "이번 생에는 자녀가 없어요. 가문의 이야기는 {0}대에서 마침표를 찍어요.", "この代には子どもがいません。一族の物語は{0}代目で幕を閉じます。", "Đời này không có con — câu chuyện gia đình khép lại ở thế hệ {0}.", "Pas d’enfant cette fois : l’histoire de la famille s’arrête à la génération {0}.", "รุ่นนี้ไม่มีลูก เรื่องราวของตระกูลจบลงที่รุ่นที่ {0}", "Esta vez no hubo hijos: la historia familiar termina en la generación {0}."],
    "{0} generations": ["我家 {0} 代", "우리 집안 {0}대", "わが家の{0}代", "{0} thế hệ", "{0} générations", "{0} รุ่น", "{0} generaciones"],
    "A family in Life Simulator · {0}–{1}": ["《模擬人生》裡的一個家族 · {0}–{1}", "〈태어난 곳〉의 한 가문 · {0}–{1}", "『出生地』のある一族 · {0}–{1}", "Một gia đình trong Nơi sinh · {0}–{1}", "Une famille de Né quelque part · {0}–{1}", "ครอบครัวหนึ่งในเกม เกิดที่ไหน · {0}–{1}", "Una familia de Nacido en algún lugar · {0}–{1}"],
    "How many generations can you go?": ["你的家族能傳幾代？", "당신의 가문은 몇 대까지 이어질까요?", "あなたの一族は何代続く？", "Gia đình bạn truyền được mấy đời?", "Combien de générations tiendrez-vous ?", "ตระกูลของคุณจะสืบได้กี่รุ่น?", "¿Cuántas generaciones durará tu familia?"],
    "Family card": ["族譜卡", "가계도 카드", "家系図カード", "Thẻ gia phả", "Carte de famille", "การ์ดผังตระกูล", "Tarjeta familiar"],
    "Long-press to send or save": ["長按圖片發給朋友或儲存", "길게 눌러 보내거나 저장", "長押しで送信・保存", "Nhấn giữ để gửi hoặc lưu", "Appui long pour envoyer ou enregistrer", "กดค้างเพื่อส่งหรือบันทึก", "Mantén pulsado para enviar o guardar"],
    "My family lasted {0} generations in Life Simulator. How about yours? {1}": ["我在《模擬人生》裡傳了 {0} 代。你的家族能傳幾代？{1}", "〈태어난 곳〉에서 우리 집안은 {0}대까지 이어졌어요. 당신의 가문은? {1}", "『出生地』でわが家は{0}代続きました。あなたの一族は？{1}", "Trong Nơi sinh, gia đình tôi truyền được {0} đời. Còn nhà bạn? {1}", "Dans Né quelque part, ma famille a tenu {0} générations. Et la vôtre ? {1}", "ในเกม เกิดที่ไหน ตระกูลของฉันสืบได้ {0} รุ่น แล้วของคุณล่ะ? {1}", "En Nacido en algún lugar mi familia duró {0} generaciones. ¿Y la tuya? {1}"],
    /* ---------- keepsake.js：自动发布到人生星光馆 ---------- */
    "Automatically add every finished life to the memorial hall": ["以後每段人生結束時，自動放進人生星光館", "인생이 끝날 때마다 자동으로 추모관에 올리기", "人生が終わるたびに自動で星光館に加える", "Tự động đưa mỗi cuộc đời đã kết thúc vào nhà tưởng niệm", "Ajouter automatiquement chaque vie terminée au mémorial", "เพิ่มทุกชีวิตที่จบลงเข้าหอรำลึกโดยอัตโนมัติ", "Añadir automáticamente cada vida terminada al memorial"],
    "Auto-publish on": ["已開啟自動發布", "자동 공개 켜짐", "自動公開オン", "Đã bật tự động đăng", "Publication automatique activée", "เปิดการเผยแพร่อัตโนมัติแล้ว", "Publicación automática activada"],
    "Auto-publish off": ["已關閉自動發布，之後要手動發布", "자동 공개 꺼짐 — 앞으로는 직접 공개하세요", "自動公開オフ。今後は手動で公開します", "Đã tắt tự động đăng — từ giờ hãy đăng thủ công", "Publication automatique désactivée — publiez à la main", "ปิดการเผยแพร่อัตโนมัติแล้ว ต่อไปต้องเผยแพร่เอง", "Publicación automática desactivada: publica a mano"],
    "This life is now in the memorial hall (Keepsakes → Public memorial to delete it or turn this off)": ["這段人生已放進人生星光館（紀念品 → 星光館可刪除或關閉自動發布）", "이 인생이 추모관에 올라갔어요 (기념품 → 공개 추모에서 삭제하거나 자동 공개를 끌 수 있어요)", "この人生を星光館に加えました（記念品 → 公開ページで削除・自動公開オフができます）", "Cuộc đời này đã vào nhà tưởng niệm (Kỷ niệm → Tưởng niệm công khai để xóa hoặc tắt tự động)", "Cette vie est maintenant au mémorial (Souvenirs → Mémorial public pour la supprimer ou désactiver)", "ชีวิตนี้อยู่ในหอรำลึกแล้ว (ของที่ระลึก → หอรำลึกสาธารณะ เพื่อลบหรือปิดอัตโนมัติ)", "Esta vida ya está en el memorial (Recuerdos → Memorial público para borrarla o desactivarlo)"],
    "No one has shared a life publicly yet. Finished lives appear here automatically.": ["還沒有其他玩家公開人生。人生結束後會自動出現在這裡。", "아직 공개된 인생이 없어요. 끝난 인생은 자동으로 여기에 나타나요.", "まだ公開された人生はありません。終わった人生は自動でここに表示されます。", "Chưa có ai chia sẻ cuộc đời công khai. Các cuộc đời đã kết thúc sẽ tự động hiện ở đây.", "Personne n’a encore partagé de vie. Les vies terminées apparaissent ici automatiquement.", "ยังไม่มีใครแชร์ชีวิตสาธารณะ ชีวิตที่จบลงจะขึ้นที่นี่โดยอัตโนมัติ", "Nadie ha compartido una vida todavía. Las vidas terminadas aparecen aquí automáticamente."],

    "Family tree": ["族譜", "가계도", "家系図", "Gia phả", "Arbre généalogique", "ผังตระกูล", "Árbol familiar"]
  };

  const lang = () => (typeof LANG === 'undefined' ? 'zh-Hans' : LANG);
  let pats = null;   // 带占位符的模板，编译成正则
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function compile() {
    pats = [];
    for (const k of Object.keys(D)) {
      if (!/\{\d\}/.test(k)) continue;
      const idx = [];
      const src = k.split(/(\{\d\})/).map(p => { const m = /^\{(\d)\}$/.exec(p); if (m) { idx.push(+m[1]); return '([\\s\\S]*?)'; } return reEsc(p); }).join('');
      pats.push({ re: new RegExp('^' + src + '$'), idx, row: D[k] });
    }
  }
  function fill(tpl, vals) { return tpl.replace(/\{(\d)\}/g, (_, n) => vals[+n] ?? ''); }
  function lookup(en, li, zh) {
    const row = D[en + '|' + zh] || D[en];
    if (row) return row[li] || en;
    if (!pats) compile();
    for (const p of pats) {
      const m = p.re.exec(en);
      if (!m) continue;
      const vals = []; p.idx.forEach((n, i) => { vals[n] = m[i + 1]; });
      return p.row[li] ? fill(p.row[li], vals) : en;
    }
    return en;
  }
  function t(zh, en) {
    const L = lang();
    if (L === 'zh-Hans') return zh;
    if (L === 'en') return en;
    const li = ORDER.indexOf(L);
    if (li < 0) return en;
    const out = lookup(String(en), li, String(zh));
    // zh-Hant 查不到时退回简体原文（至少是中文）
    return (L === 'zh-Hant' && out === en) ? zh : out;
  }
  // 数字：中文用 万/亿，其他语言用当地的紧凑写法（1.3 billion / 13억 / 1億3000万…）
  function big(n) {
    const L = lang();
    if (/^zh/.test(L)) return n >= 1e8 ? `${(n / 1e8).toFixed(1)}${L === 'zh-Hant' ? '億' : '亿'}` : `${Math.round(n / 1e4).toLocaleString()}${L === 'zh-Hant' ? '萬' : '万'}`;
    try { return new Intl.NumberFormat(L, { notation: 'compact', maximumFractionDigits: 1 }).format(n); } catch (e) { return n >= 1e9 ? `${(n / 1e9).toFixed(1)} billion` : `${(n / 1e6).toFixed(0)} million`; }
  }
  // 画布换行用的切分：Intl.Segmenter 能切泰文、日文；没有就退回逐字（中日）或按空格
  function segs(text) {
    try { if (window.Intl && Intl.Segmenter) return [...new Intl.Segmenter(lang(), { granularity: 'word' }).segment(text)].map(s => s.segment); } catch (e) { /* ignore */ }
    return /[㐀-鿿぀-ヿ฀-๿]/.test(text) ? [...text] : text.split(/(\s+)/);
  }
  window.BornXL = { t, big, segs, dict: D, ORDER };
})();
