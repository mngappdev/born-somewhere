/* v6.32：「我的真实人生」对照 + 长寿小测
 *
 * 玩家输入自己真实的出生年、国家、性别：
 *   1) 对照全世界：出生国的人均收入 / 预期寿命，高于全球百分之几的新生儿
 *      （用各国每年出生人数加权）；同年全球出生人数、活不到 5 岁的比例；已经活了几天。
 *   2) 10 题健康小测：在「同国同龄同性别」的剩余寿命上，加减生活习惯的影响，
 *      估算大约能活到几岁，以及改掉可改变的习惯大约还能多活几年。
 *   3) 生成一张分享卡（1080×1350），带二维码回到游戏。
 * 全部在本机计算，不上传。
 */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const isZh = () => typeof LANG === 'undefined' || /^zh/.test(LANG);
  const tx = (zh, en) => (window.BornXL ? BornXL.t(zh, en) : (isZh() ? zh : en));
  const H = (s) => (typeof LANG !== 'undefined' && LANG === 'zh-Hans' && window.BornFun && BornFun.toHans) ? BornFun.toHans(String(s ?? '')) : String(s ?? '');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const track = (n, p) => { try { window.BornFun?.track?.(n, p); } catch (e) { /* ignore */ } };
  const KEY = 'born-somewhere-v2:real';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
  const save = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* ignore */ } };
  const NOW = new Date().getFullYear();
  const SITE = 'https://life.zenmatrix.org/';

  /* ---------- 世界对照 ---------- */
  // 全球每年出生人数（百万）与 5 岁前死亡率（%），联合国 WPP 2024 / UN IGME 的约略值，年份间线性插值
  const WORLD = [[1940, 85, 26], [1950, 97, 22.5], [1960, 113, 18.5], [1970, 122, 14.5], [1980, 125, 11.6], [1990, 139, 9.3], [2000, 133, 7.6], [2010, 140, 5.6], [2020, 135, 3.8], [2025, 132, 3.6]];
  function world(year) {
    const y = Math.max(1940, Math.min(2025, year));
    for (let i = 1; i < WORLD.length; i++) {
      const [y1, b1, u1] = WORLD[i - 1], [y2, b2, u2] = WORLD[i];
      if (y <= y2) { const t = (y - y1) / (y2 - y1); return { births: b1 + (b2 - b1) * t, u5: u1 + (u2 - u1) * t }; }
    }
    return { births: 132, u5: 3.6 };
  }
  // 出生人数加权的百分位：全球新生儿中，出生国「指标比你低」的比例（自己国家算一半）
  function pct(c, field, higherIsBetter = true) {
    let below = 0, same = 0, tot = 0;
    for (const x of COUNTRIES) {
      const v = x[field], w = x.births || 0;
      if (v == null || !w) continue;
      tot += w;
      if (x.id === c.id) { same += w; continue; }
      if (higherIsBetter ? v < c[field] : v > c[field]) below += w;
    }
    return tot ? Math.round((below + same / 2) / tot * 100) : 50;
  }
  // 同国、同出生年、同性别的人，在目前年龄的预期寿命（a + e(a)）
  function cohortExpect(c, sex, year, age) {
    const life = { year, countryData: c, ethnicity: null };
    const lt = lifeTable(c, sex, life);
    const a = Math.max(0, Math.min(109, age));
    if (!lt.l[a]) return { exp: a, p80: 0, p90: 0 };
    let e = 0;
    for (let x = a; x <= 110; x++) e += lt.l[x + 1] / lt.l[a];
    return { exp: a + e + 0.5, p80: lt.l[80] / lt.l[a], p90: lt.l[90] / lt.l[a] };
  }

  /* ---------- 长寿小测 ---------- */
  // 每个选项：[文字(中), 文字(英), 年数影响]。第一个选项是「最好」的习惯，用来估算「改掉可多活几年」。
  // 年数是公开研究的平均效果粗估（吸烟约 −10 年、规律运动约 +3–4 年、孤独约等于每天 15 支烟……），只用来比较轻重。
  const QUIZ = [
    { k: 'smoke', icon: '🚬', q: ['你吸烟吗？', 'Do you smoke?'], fix: 0.9, o: [['从不吸', 'Never', 0], ['以前吸，已经戒了', 'Quit', -1], ['偶尔吸', 'Occasionally', -4], ['每天吸', 'Every day', -10]] },
    { k: 'move', icon: '🏃', q: ['每周运动多少？（快走也算）', 'How much do you exercise a week? (brisk walking counts)'], fix: 0.8, o: [['150 分钟以上', '150+ minutes', 3], ['偶尔动一动', 'Now and then', 0], ['几乎不动', 'Almost never', -3]] },
    { k: 'sleep', icon: '😴', q: ['平常一晚睡几小时？', 'How many hours do you usually sleep?'], fix: 0.7, o: [['7–8 小时', '7–8 hours', 0], ['6 小时左右', 'About 6', -1], ['不到 6 小时', 'Under 6', -2], ['9 小时以上', '9 or more', -1]] },
    { k: 'drink', icon: '🍺', q: ['你喝酒吗？', 'Do you drink alcohol?'], fix: 0.8, o: [['不喝或很少', 'Never or rarely', 0], ['每周几次，适量', 'A few times a week, moderately', -1], ['经常喝很多', 'Often and heavily', -5]] },
    { k: 'food', icon: '🥦', q: ['每天吃蔬菜水果吗？', 'Do you eat vegetables and fruit every day?'], fix: 0.7, o: [['每天都吃很多', 'Plenty every day', 1], ['有时候', 'Sometimes', 0], ['很少，外卖、甜食多', 'Rarely; lots of takeaway and sweets', -2]] },
    { k: 'body', icon: '⚖️', q: ['你的体型？', 'Your body shape?'], fix: 0.6, o: [['标准', 'Healthy weight', 0], ['有点胖', 'A bit overweight', -1], ['明显肥胖', 'Obese', -4], ['偏瘦', 'Underweight', -1]] },
    { k: 'social', icon: '🤝', q: ['常和朋友家人见面、聊天吗？', 'Do you often see or talk with friends and family?'], fix: 0.7, o: [['经常', 'Often', 2], ['偶尔', 'Sometimes', 0], ['很少，常觉得孤单', 'Rarely; often lonely', -4]] },
    { k: 'mood', icon: '😊', q: ['最近一年的心情？', 'Your mood over the past year?'], fix: 0.6, o: [['大多开心', 'Mostly happy', 1], ['普通', 'So-so', 0], ['长期压力大', 'Stressed most of the time', -2]] },
    { k: 'ill', icon: '🩺', q: ['有没有慢性病？', 'Any chronic conditions?'], fix: 0.4, o: [['没有', 'None', 0], ['高血压或高血脂', 'High blood pressure or cholesterol', -2], ['糖尿病', 'Diabetes', -5], ['心脏病或中风过', 'Heart disease or stroke', -6]] },
    { k: 'check', icon: '🏥', q: ['多久做一次体检？', 'How often do you get a health check?'], fix: 0.8, o: [['每年', 'Every year', 1], ['几年一次', 'Every few years', 0], ['从来没做过', 'Never', -1]] },
  ];
  const TIPS = {
    smoke: ['戒烟：任何年纪戒都有用，戒烟门诊和尼古丁替代品能让成功率翻倍。', 'Quit smoking: it helps at any age; quit clinics and nicotine replacement double your odds.'],
    move: ['每周快走 150 分钟，加 2 次肌力训练；从每天饭后走 15 分钟开始。', 'Brisk walk 150 minutes a week plus 2 strength sessions; start with 15 minutes after meals.'],
    sleep: ['固定时间上床，睡前 1 小时放下手机，睡满 7–8 小时。', 'Keep a fixed bedtime, put the phone down an hour before, aim for 7–8 hours.'],
    drink: ['少喝酒：每周至少 3 天不喝，聚会时一杯酒配一杯水。', 'Drink less: at least 3 alcohol-free days a week, one glass of water per drink.'],
    food: ['每餐半盘蔬菜，用水果代替甜点，少喝含糖饮料。', 'Half a plate of vegetables each meal, fruit instead of dessert, fewer sugary drinks.'],
    body: ['腰围男 < 90 cm、女 < 80 cm；每月减 1–2 公斤最容易维持。', 'Waist under 90 cm (men) / 80 cm (women); losing 1–2 kg a month lasts best.'],
    social: ['每周至少和朋友或家人见面一次，加入一个兴趣团体或当义工。', 'See friends or family at least weekly; join a club or volunteer.'],
    mood: ['每天留 15 分钟给自己；压力大到影响睡眠或食欲时，找专业人士谈谈。', 'Give yourself 15 minutes a day; if stress affects sleep or appetite, talk to a professional.'],
    ill: ['按时吃药、定期复诊：血压 < 130/80、糖化血色素 < 7%。', 'Take medicine and keep follow-ups: blood pressure < 130/80, HbA1c < 7%.'],
    check: ['40 岁起每年量血压、血糖、血脂，按年龄做癌症筛检。', 'From 40, check blood pressure, sugar and cholesterol yearly, plus age-appropriate cancer screening.'],
  };

  function score(st) {
    const c = countryById(st.country);
    const age = Math.max(0, NOW - st.year);
    const base = cohortExpect(c, st.sex, st.year, age);
    // 坏习惯往往同时出现、效果互相重叠，不能直接相加：
    // 研究（Li et al., Circulation 2018）五项健康习惯全做到 vs 全没做到，差约 12–14 年。
    // 所以负面合计用 −20·(1−e^(s/20)) 压缩（单一吸烟 −10 → 约 −7.9；全部最差 −27 → 约 −15），正面合计上限 +5。
    const total = (vals) => {
      const neg = vals.filter(v => v < 0).reduce((a, v) => a + v, 0);
      const pos = vals.filter(v => v > 0).reduce((a, v) => a + v, 0);
      return -20 * (1 - Math.exp(neg / 20)) + Math.min(5, pos);
    };
    const cur = [], better = [];
    QUIZ.forEach((q, i) => {
      const a = st.ans?.[i]; if (a == null) return;
      const v = q.o[a][2], best = q.o[0][2];
      cur.push(v); better.push(q.k === 'smoke' && a === 1 ? v : v + (best - v) * q.fix);
    });
    const adj = Math.round(total(cur));
    const clampAge = (x) => Math.max(age + 1, Math.min(100, x));
    const predicted = Math.round(clampAge(base.exp + total(cur)));
    const gain = Math.max(0, Math.round(clampAge(base.exp + total(better)) - clampAge(base.exp + total(cur))));
    // 每个习惯分到的年数：总增益按各自的「可改善量」比例分配，加起来等于总数
    const raw = [];
    QUIZ.forEach((q, i) => {
      const a = st.ans?.[i]; if (a == null) return;
      if (q.k === 'smoke' && a === 1) return;   // 已经戒烟，不算可改的
      const d = (q.o[0][2] - q.o[a][2]) * q.fix;
      if (d > 0) raw.push({ k: q.k, icon: q.icon, d });
    });
    const sum = raw.reduce((s, x) => s + x.d, 0);
    const fixes = raw.map(x => ({ k: x.k, icon: x.icon, g: sum ? Math.round(gain * x.d / sum * 10) / 10 : 0 }))
      .filter(x => x.g >= 0.5).sort((a, b) => b.g - a.g);
    return { c, age, base, adj, predicted, gain, fixes };
  }

  /* ---------- 画面 ---------- */
  let st = null;
  function modal() {
    let m = $('#realModal');
    if (!m) {
      m = document.createElement('div');
      m.id = 'realModal';
      m.className = 'modal fun-modal rl-modal';
      m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-rl-close]')) { m.hidden = true; } });
      document.body.appendChild(m);
    }
    m.hidden = false;
    return m;
  }
  function head(title) {
    return `<div class="fun-card-head"><h3>${title}</h3><button class="ghost" data-rl-close type="button">✕</button></div>`;
  }
  function countryOptions(sel) {
    const list = COUNTRIES.slice().sort((a, b) => (b.births || 0) - (a.births || 0));
    const top = ['SGP', 'CHN', 'MYS', 'TWN', 'HKG', 'USA', 'IND', 'IDN', 'JPN', 'KOR', 'GBR', 'AUS'];
    const nm = (c) => `${c.flag} ${esc(localize(c).name)}`;
    const topHtml = top.map(countryById).filter(Boolean).map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${nm(c)}</option>`).join('');
    const rest = list.filter(c => !top.includes(c.id)).sort((a, b) => localize(a).name.localeCompare(localize(b).name, typeof LANG === 'undefined' ? 'zh' : LANG))
      .map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${nm(c)}</option>`).join('');
    return topHtml + `<option disabled>──────</option>` + rest;
  }

  function open(src) {
    if (!COUNTRIES.length) { setTimeout(() => open(src), 300); return; }
    const saved = load();
    st = { year: saved.year || 1990, country: saved.country || 'SGP', sex: saved.sex || 'F', ans: [] };
    track('real_open', { src: src || 'intro' });
    stepInput();
  }
  function stepInput() {
    const m = modal();
    const years = []; for (let y = NOW; y >= 1930; y--) years.push(y);
    m.innerHTML = `<div class="modal-card fun-card rl-card">
      ${head(`🔍 ${tx('我的真实人生', 'My real life')}`)}
      <p class="rl-lead">${tx('游戏里的人生是随机的，你的真实人生呢？输入三个资料，看看你在全世界排第几，再做 10 题小测，估算你能活到几岁。', 'Game lives are random. What about yours? Enter three things to see where you stand in the world, then take a 10-question quiz to estimate how long you could live.')}</p>
      <label class="rl-f"><span>${tx('出生年', 'Birth year')}</span><select id="rlYear">${years.map(y => `<option ${y === st.year ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
      <label class="rl-f"><span>${tx('出生国家', 'Born in')}</span><select id="rlCountry">${countryOptions(st.country)}</select></label>
      <div class="rl-f"><span>${tx('性别', 'Sex')}</span><div class="rl-seg">
        <button type="button" data-sex="F" class="${st.sex === 'F' ? 'on' : ''}">${tx('女', 'Female')}</button>
        <button type="button" data-sex="M" class="${st.sex === 'M' ? 'on' : ''}">${tx('男', 'Male')}</button></div></div>
      <div class="ks-actions"><button class="primary" id="rlGo" type="button">${tx('看看我的人生 →', 'Show my life →')}</button></div>
      <p class="muted rl-note">🔒 ${tx('只在你的装置上计算，不会上传。', 'Calculated on your device. Nothing is uploaded.')}</p>
    </div>`;
    m.querySelectorAll('[data-sex]').forEach(b => b.addEventListener('click', () => { st.sex = b.dataset.sex; m.querySelectorAll('[data-sex]').forEach(x => x.classList.toggle('on', x === b)); }));
    $('#rlGo').addEventListener('click', () => {
      st.year = +$('#rlYear').value; st.country = $('#rlCountry').value;
      save({ year: st.year, country: st.country, sex: st.sex });
      track('real_world', { country: st.country, decade: Math.floor(st.year / 10) * 10 });
      stepWorld();
    });
  }
  function worldFacts() {
    const c = countryById(st.country), name = localize(c).name, age = Math.max(0, NOW - st.year);
    const w = world(st.year);
    const pIncome = pct(c, 'ppp'), pLe = pct(c, 'le'), pU5 = pct(c, 'u5', false);
    const born = new Date(st.year, 6, 1);
    const days = Math.max(1, Math.round((Date.now() - born) / 864e5));
    const beats = days * 24 * 60 * 72;
    const base = cohortExpect(c, st.sex, st.year, age);
    return { c, name, age, w, pIncome, pLe, pU5, days, beats, base };
  }
  const yi = (n) => window.BornXL ? BornXL.big(n) : (isZh() ? (n >= 1e8 ? `${(n / 1e8).toFixed(1)}亿` : `${Math.round(n / 1e4).toLocaleString()}万`) : (n >= 1e9 ? `${(n / 1e9).toFixed(1)} billion` : `${(n / 1e6).toFixed(0)} million`));
  function stepWorld() {
    const f = worldFacts(), m = modal();
    const luckier = Math.max(f.pIncome, 1);
    m.innerHTML = `<div class="modal-card fun-card rl-card">
      ${head(`🌏 ${tx('你在全世界的位置', 'Where you stand in the world')}`)}
      <div class="rl-hero"><div class="rl-big">${luckier}%</div><div>${tx(`出生在${esc(f.name)}，你的出生条件好过全世界 <b>${luckier}%</b> 的新生儿`, `Born in ${esc(f.name)}, you started out better off than <b>${luckier}%</b> of the world's newborns`)}</div></div>
      <ul class="rl-facts">
        <li>💰 ${tx(`${esc(f.name)}的人均收入，高于全球 ${f.pIncome}% 新生儿的出生国`, `${esc(f.name)}'s income per person is higher than the birth country of ${f.pIncome}% of newborns`)}</li>
        <li>❤️ ${tx(`预期寿命高于全球 ${f.pLe}% 新生儿的出生国`, `Life expectancy higher than for ${f.pLe}% of newborns`)}</li>
        <li>👶 ${tx(`${st.year} 年全世界大约出生了 ${yi(f.w.births * 1e6)} 个婴儿，其中约 ${f.w.u5.toFixed(1)}% 没能活过 5 岁`, `About ${yi(f.w.births * 1e6)} babies were born in ${st.year}; about ${f.w.u5.toFixed(1)}% did not reach age 5`)}</li>
        <li>📅 ${tx(`你已经活了大约 ${f.days.toLocaleString()} 天，心脏跳了大约 ${yi(f.beats)} 次`, `You have lived about ${f.days.toLocaleString()} days; your heart has beaten about ${yi(f.beats)} times`)}</li>
        <li>🎂 ${tx(`和你同年、同国、同性别的人，平均能活到约 ${Math.round(f.base.exp)} 岁；${Math.round(f.base.p80 * 100)}% 能活过 80 岁`, `People born the same year, country and sex live to about ${Math.round(f.base.exp)} on average; ${Math.round(f.base.p80 * 100)}% pass 80`)}</li>
      </ul>
      <div class="ks-actions"><button class="primary" id="rlQuiz" type="button">${tx('🩺 做 10 题小测，算算我能活到几岁', '🩺 Take the 10-question quiz')}</button>
        <button class="ghost" id="rlBack" type="button">${tx('← 修改资料', '← Edit')}</button></div>
    </div>`;
    $('#rlQuiz').addEventListener('click', () => { st.ans = []; stepQuiz(0); });
    $('#rlBack').addEventListener('click', stepInput);
  }
  function stepQuiz(i) {
    if (i >= QUIZ.length) { stepResult(); return; }
    const q = QUIZ[i], m = modal();
    m.innerHTML = `<div class="modal-card fun-card rl-card">
      ${head(`🩺 ${tx('长寿小测', 'Longevity quiz')} <small class="muted">${i + 1} / ${QUIZ.length}</small>`)}
      <div class="rl-prog"><i style="width:${(i / QUIZ.length * 100).toFixed(0)}%"></i></div>
      <h4 class="rl-q">${q.icon} ${tx(q.q[0], q.q[1])}</h4>
      <div class="rl-opts">${q.o.map((o, j) => `<button type="button" class="rl-opt ${st.ans[i] === j ? 'on' : ''}" data-j="${j}">${esc(tx(o[0], o[1]))}</button>`).join('')}</div>
      ${i > 0 ? `<button class="ghost rl-prev" id="rlPrev" type="button">← ${tx('上一题', 'Back')}</button>` : ''}
    </div>`;
    m.querySelectorAll('.rl-opt').forEach(b => b.addEventListener('click', () => { st.ans[i] = +b.dataset.j; stepQuiz(i + 1); }));
    $('#rlPrev')?.addEventListener('click', () => stepQuiz(i - 1));
  }
  function stepResult() {
    const r = score(st), f = worldFacts(), m = modal();
    track('real_result', { predicted: r.predicted, gain: r.gain, country: st.country });
    const habits = r.fixes.slice(0, 4);
    m.innerHTML = `<div class="modal-card fun-card rl-card">
      ${head(`🎯 ${tx('你的长寿预测', 'Your longevity estimate')}`)}
      <div class="rl-hero"><div class="rl-big">${r.predicted}</div><div>${tx(`照现在的习惯，你大约能活到 <b>${r.predicted} 岁</b>`, `At your current habits, you could live to about <b>${r.predicted}</b>`)}<div class="muted">${tx(`同年同国同性别的平均：约 ${Math.round(r.base.exp)} 岁（${r.adj >= 0 ? '+' : ''}${r.adj} 年）`, `Average for your cohort: about ${Math.round(r.base.exp)} (${r.adj >= 0 ? '+' : ''}${r.adj} years)`)}</div></div></div>
      ${r.gain > 0 ? `<div class="rl-gain">⏳ ${tx(`改掉 ${habits.length} 个习惯，大约还能多活 <b>${r.gain} 年</b>`, `Changing ${habits.length} habits could add about <b>${r.gain} years</b>`)}</div>` : `<div class="rl-gain">🌿 ${tx('你的生活习惯已经很好了，继续保持！', 'Your habits are already great. Keep it up!')}</div>`}
      ${habits.length ? `<h4>🌱 ${tx('最值得先改的', 'Start with these')}</h4><ol class="rl-tips">${habits.map(h => `<li>${h.icon} ${esc(tx(TIPS[h.k][0], TIPS[h.k][1]))} <span class="fun-hr-y">+${h.g} ${tx('年', 'y')}</span></li>`).join('')}</ol>` : ''}
      <div id="rlCardWrap" class="rl-cardwrap"><div class="ks-loading">${tx('正在生成分享卡⋯', 'Making your card…')}</div></div>
      <div class="ks-actions">
        <button class="primary" id="rlShare" type="button">💚 ${tx('分享给朋友，看谁活得久', 'Share — who lives longest?')}</button>
        <button class="ghost" id="rlPlay" type="button">🎲 ${tx('去模拟另一种人生', 'Live another life')}</button>
        <button class="ghost" id="rlAgain" type="button">↺ ${tx('重新测', 'Retake')}</button>
      </div>
      <p class="muted fun-cause-note">${tx('依各国生命表与公开研究的平均效果粗估，只供参考，不是医学诊断。', 'Rough estimate from national life tables and published average effects. Not medical advice.')}</p>
    </div>`;
    let blob = null, url = null;
    makeCard(r, f).then(cv => {
      url = cv.toDataURL('image/jpeg', 0.9);
      const w = $('#rlCardWrap'); if (w) w.innerHTML = `<img src="${url}" alt="" class="rl-cardimg"><p class="muted rl-note">${/MicroMessenger/i.test(navigator.userAgent) ? tx('长按图片，发送给朋友或保存', 'Long-press the image to send or save') : ''}</p>`;
      cv.toBlob(b => { blob = b; }, 'image/jpeg', 0.9);
    });
    const cap = () => H(tx(`我测了一下：照现在的习惯能活到 ${r.predicted} 岁，出生条件好过全世界 ${f.pIncome}% 的人。你呢？${SITE}?real=1`, `I could live to ${r.predicted}, and I started out better off than ${f.pIncome}% of the world. You? ${SITE}?real=1`));
    $('#rlShare').addEventListener('click', async () => {
      track('real_share', {});
      const text = cap();
      try { await navigator.clipboard?.writeText(text); } catch (e) { /* ignore */ }
      if (blob && navigator.canShare && navigator.canShare({ files: [new File([blob], 'my-life.jpg', { type: 'image/jpeg' })] })) {
        try { await navigator.share({ files: [new File([blob], 'my-life.jpg', { type: 'image/jpeg' })], text, title: tx('我的真实人生', 'My real life') }); return; } catch (e) { return; }
      }
      if (navigator.share) { try { await navigator.share({ text, url: SITE + '?real=1' }); return; } catch (e) { return; } }
      if (url) { const a = document.createElement('a'); a.href = url; a.download = 'my-life.jpg'; a.click(); }
      alert(tx('分享文字已复制，图片已下载。', 'Caption copied and image downloaded.'));
    });
    $('#rlPlay').addEventListener('click', () => {
      m.hidden = true; track('real_play', {});
      try { if (typeof setView === 'function') setView('intro'); } catch (e) { /* ignore */ }
      setTimeout(() => $('#btnStart')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    });
    $('#rlAgain').addEventListener('click', stepInput);
  }

  /* ---------- 分享卡 ---------- */
  function wrapText(ctx, text, x, y, maxW, lh) {
    const chars = window.BornXL ? BornXL.segs(text) : (/[㐀-鿿]/.test(text) ? [...text] : text.split(/(\s+)/));
    let line = '';
    for (const ch of chars) {
      const t = line + ch;
      if (ctx.measureText(H(t)).width > maxW && line) { ctx.fillText(line.trim(), x, y); y += lh; line = ch.trimStart(); } else line = t;
    }
    if (line) { ctx.fillText(line.trim(), x, y); y += lh; }
    return y;
  }
  async function makeCard(r, f) {
    const W = 1080, Hh = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = Hh;
    const ctx = cv.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, Hh); g.addColorStop(0, '#8C1D3C'); g.addColorStop(1, '#3d0c1c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hh);
    ctx.textAlign = 'center'; ctx.fillStyle = '#faf7f0';
    const font = (s, w = 700) => `${w} ${s}px "PingFang SC","Noto Sans SC","Microsoft YaHei",sans-serif`;
    ctx.font = font(44); ctx.fillText(tx('我的真实人生', 'My real life'), W / 2, 110);
    ctx.font = font(34, 400); ctx.globalAlpha = .85;
    ctx.fillText(`${localize(f.c).name} · ${st.year} · ${st.sex === 'M' ? tx('男', 'male') : tx('女', 'female')}`, W / 2, 170); ctx.globalAlpha = 1;
    // 两个大数字
    const box = (x, big, small) => {
      ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, 230, 440, 330, 28); else ctx.rect(x, 230, 440, 330); ctx.fill();
      ctx.fillStyle = '#ffd27a'; ctx.font = font(150); ctx.fillText(big, x + 220, 410);
      ctx.fillStyle = '#faf7f0'; ctx.font = font(32, 400); wrapText(ctx, small, x + 220, 480, 380, 44);
    };
    box(80, `${Math.max(1, f.pIncome)}%`, tx('出生条件好过全世界的人', 'of the world started out worse off'));
    box(560, `${r.predicted}`, tx('照现在的习惯，能活到的岁数', 'the age I could live to'));
    ctx.textAlign = 'left'; ctx.font = font(34, 400); ctx.fillStyle = '#faf7f0';
    let y = 650;
    const lines = [
      `👶 ${tx(`${st.year} 年全球出生 ${yi(f.w.births * 1e6)} 人，${f.w.u5.toFixed(1)}% 活不过 5 岁`, `${yi(f.w.births * 1e6)} born in ${st.year}; ${f.w.u5.toFixed(1)}% died before 5`)}`,
      `📅 ${tx(`已经活了 ${f.days.toLocaleString()} 天，心跳约 ${yi(f.beats)} 次`, `${f.days.toLocaleString()} days lived, ~${yi(f.beats)} heartbeats`)}`,
      `🎂 ${tx(`同年同国同性别的人，平均活到约 ${Math.round(r.base.exp)} 岁`, `My cohort's average: about ${Math.round(r.base.exp)}`)}`,
      r.gain > 0 ? `⏳ ${tx(`改掉 ${Math.min(4, r.fixes.length)} 个习惯，还能多活 ${r.gain} 年`, `Changing ${Math.min(4, r.fixes.length)} habits could add ${r.gain} years`)}` : `🌿 ${tx('生活习惯很健康', 'Healthy habits')}`,
    ];
    for (const l of lines) y = wrapText(ctx, l, 90, y, W - 180, 50) + 22;
    // 底部钩子 + 二维码
    ctx.fillStyle = '#faf7f0'; ctx.fillRect(0, Hh - 300, W, 300);
    ctx.fillStyle = '#8C1D3C'; ctx.font = font(46);
    ctx.fillText(tx('你能活到几岁？', 'How long could you live?'), 80, Hh - 190);
    ctx.font = font(32, 400); ctx.fillStyle = '#333';
    ctx.fillText(tx('扫码 1 分钟测一测 · 还能模拟另一种人生', 'Scan to find out in a minute'), 80, Hh - 130);
    ctx.fillText('life.zenmatrix.org', 80, Hh - 80);
    try {
      const q = qrcode(0, 'M'); q.addData(SITE + '?real=1&utm_source=realcard'); q.make();
      const n = q.getModuleCount(), size = 230, cell = size / n, qx = W - 80 - size, qy = Hh - 265;
      ctx.fillStyle = '#fff'; ctx.fillRect(qx - 10, qy - 10, size + 20, size + 20); ctx.fillStyle = '#000';
      for (let r2 = 0; r2 < n; r2++) for (let c2 = 0; c2 < n; c2++) if (q.isDark(r2, c2)) ctx.fillRect(qx + c2 * cell, qy + r2 * cell, Math.ceil(cell), Math.ceil(cell));
    } catch (e) { /* ignore */ }
    return cv;
  }

  /* ---------- 入口 ---------- */
  function addEntry() {
    if ($('#rlEntry')) return;
    const row = $('#btnStart')?.parentNode; if (!row) return;
    const b = document.createElement('button');
    b.id = 'rlEntry'; b.type = 'button'; b.className = 'ghost rl-entry';
    b.innerHTML = `🔍 ${tx('测测我的真实人生 · 我能活到几岁？', 'My real life · how long could I live?')}`;
    b.addEventListener('click', () => open('intro'));
    $('#btnStart').insertAdjacentElement('afterend', b);
  }
  function boot() {
    addEntry();
    let q = null; try { q = new URLSearchParams(location.search).get('real'); } catch (e) { /* ignore */ }
    if (q) open('link');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  const _setLang = window.setLang;
  if (typeof _setLang === 'function') window.setLang = function () { const r = _setLang.apply(this, arguments); $('#rlEntry')?.remove(); addEntry(); return r; };
  window.BornReal = { open, score, world, pct, cohortExpect, QUIZ };
})();
