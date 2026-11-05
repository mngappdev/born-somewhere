/* =====================================================================
   born-somewhere v6.13 —— 好玩模組（fun.js）
   在 app.js 之後載入，透過重新指派全域函式掛上新功能，不改動原有資料層。
   1) 简体中文显示层：zh-Hans 时把 DOM / canvas / alert 里的繁体字即时转成简体
   2) 出生地默认新加坡 + 「🎲 随机扭蛋」转盘动画
   3) 出生稀有度（N / R / SR / SSR / UR）+ 出生运气指数
   4) 新加坡专属人生事件（PSLE、国民服役、BTO 组屋、CPF⋯）
   5) 成就系统（成就墙）
   6) 每日挑战（同一天所有人同一题，连胜天数）
   ===================================================================== */
(function () {
  'use strict';
  const SK = 'born-somewhere-v2:fun';
  const $ = (s, r = document) => r.querySelector(s);
  const isEn = () => typeof LANG !== 'undefined' && LANG === 'en';
  const isZh = () => typeof LANG !== 'undefined' && (LANG === 'zh-Hans' || LANG === 'zh-Hant');
  // 非中文介面一律用英文（新功能只提供中英两种文案）
  const tx = (zh, en) => (isZh() ? zh : en);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(SK + ':' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(SK + ':' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const clamp = (n) => Math.max(0, Math.min(100, n));

  /* ------------------------------------------------------------------
     1) 简体中文显示层
     app.js 里大量事件文案以繁体硬编码（applyEventEffects 还拿繁体关键字判断效果），
     所以资料层保持繁体，只在「显示」时转换：DOM 文本节点、title/placeholder、
     canvas 文字（出生卡 / 证书 PNG）、alert/confirm/prompt。
     ------------------------------------------------------------------ */
  let t2s = null;
  try { if (window.OpenCC) t2s = window.OpenCC.Converter({ from: 'tw', to: 'cn' }); } catch (e) { t2s = null; }
  const convCache = new Map();
  const HAN = /[㐀-鿿]/;
  function toHans(s) {
    if (!t2s || !s || typeof s !== 'string' || !HAN.test(s)) return s;
    let out = convCache.get(s);
    if (out === undefined) {
      try { out = t2s(s); } catch (e) { out = s; }
      if (convCache.size > 20000) convCache.clear();
      convCache.set(s, out);
    }
    return out;
  }
  const hansOn = () => t2s && typeof LANG !== 'undefined' && LANG === 'zh-Hans';
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT']);
  const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
  function convText(n) {
    const v = n.nodeValue;
    if (!v || !HAN.test(v)) return;
    const p = n.parentNode;
    if (p && SKIP_TAGS.has(p.nodeName)) return;
    if (p && p.isContentEditable) return;
    const o = toHans(v);
    if (o !== v) n.nodeValue = o;
  }
  function convEl(el) {
    for (const a of ATTRS) {
      const v = el.getAttribute && el.getAttribute(a);
      if (v && HAN.test(v)) { const o = toHans(v); if (o !== v) el.setAttribute(a, o); }
    }
  }
  function convTree(root) {
    if (!root) return;
    if (root.nodeType === 3) { convText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) { if (SKIP_TAGS.has(root.nodeName)) return; convEl(root); }
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(n) { return (n.nodeType === 1 && SKIP_TAGS.has(n.nodeName)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; },
    });
    let n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) convText(n); else convEl(n); }
  }
  const mo = new MutationObserver((muts) => {
    if (!hansOn()) return;
    for (const m of muts) {
      if (m.type === 'characterData') convText(m.target);
      else if (m.type === 'attributes') convEl(m.target);
      else m.addedNodes.forEach(convTree);
    }
  });
  function startHans() {
    mo.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    if (hansOn()) { convTree(document.documentElement); document.title = toHans(document.title); }
  }
  // canvas（出生卡 / 人生证书 PNG）
  ['fillText', 'strokeText', 'measureText'].forEach((fn) => {
    const proto = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
    if (!proto || !proto[fn]) return;
    const orig = proto[fn];
    proto[fn] = function (text, ...rest) { return orig.call(this, hansOn() ? toHans(String(text)) : text, ...rest); };
  });
  ['alert', 'confirm', 'prompt'].forEach((fn) => {
    const orig = window[fn];
    if (typeof orig !== 'function') return;
    window[fn] = function (msg, ...rest) { return orig.call(window, hansOn() ? toHans(String(msg ?? '')) : msg, ...rest); };
  });

  /* ------------------------------------------------------------------
     3) 出生稀有度 + 运气指数
     ------------------------------------------------------------------ */
  const birthW = (c) => Math.max(1, c.births || c.pop || 1);
  let _totalBirths = 0;
  function totalBirths() {
    if (!_totalBirths) _totalBirths = COUNTRIES.reduce((s, c) => s + birthW(c), 0);
    return _totalBirths;
  }
  const TIERS = [
    { id: 'UR', min: 0, max: 0.0005, color: '#e0457b', zh: '传说', en: 'Legendary' },
    { id: 'SSR', min: 0.0005, max: 0.002, color: '#d99a1f', zh: '超稀有', en: 'Super rare' },
    { id: 'SR', min: 0.002, max: 0.01, color: '#8a4fd1', zh: '稀有', en: 'Rare' },
    { id: 'R', min: 0.01, max: 0.04, color: '#2f7fd0', zh: '少见', en: 'Uncommon' },
    { id: 'N', min: 0.04, max: 1.01, color: '#7a7a7a', zh: '常见', en: 'Common' },
  ];
  function rarity(c) {
    const share = birthW(c) / totalBirths();
    const tier = TIERS.find(t => share >= t.min && share < t.max) || TIERS[TIERS.length - 1];
    return { share, tier, per10k: share * 10000 };
  }
  const TIER_RANK = { N: 0, R: 1, SR: 2, SSR: 3, UR: 4 };
  // 运气：以全球新生儿为母体，这个国家在「预期寿命」「人均 PPP」「5 岁前存活」上赢过多少比例的新生儿
  function luck(c) {
    const tot = totalBirths();
    const pct = (key, higherIsBetter) => {
      let beat = 0;
      const v = +c[key] || 0;
      for (const o of COUNTRIES) {
        const ov = +o[key] || 0;
        if (higherIsBetter ? ov < v : ov > v) beat += birthW(o);
      }
      return beat / tot * 100;
    };
    const le = pct('le', true), ppp = pct('ppp', true), u5 = pct('u5', false);
    return { le, ppp, u5, score: Math.round((le + ppp + u5) / 3) };
  }
  function luckLabel(score) {
    if (score >= 90) return tx('天选之子 🌟', 'Born lucky 🌟');
    if (score >= 70) return tx('好命 🍀', 'Fortunate 🍀');
    if (score >= 40) return tx('普普通通 🙂', 'Average 🙂');
    if (score >= 15) return tx('有点辛苦 🌧️', 'A hard start 🌧️');
    return tx('开局地狱模式 ⛈️', 'Hard mode ⛈️');
  }
  function rarityBlock(c) {
    const r = rarity(c), l = luck(c);
    const per = r.per10k >= 10 ? Math.round(r.per10k) : r.per10k.toFixed(1);
    return `<div class="fun-rarity" style="--tier:${r.tier.color}">
      <div class="fr-tier"><span class="fr-badge">${r.tier.id}</span><span>${tx(r.tier.zh, r.tier.en)}</span></div>
      <div class="fr-line">${tx(`全球每 1 万个新生儿，只有 ${per} 个出生在这里`, `Only ${per} in every 10,000 newborns are born here`)}</div>
      <div class="fr-luck">
        <div class="fr-luck-head"><span>${tx('出生运气', 'Birth luck')}</span><b>${l.score}</b><span class="fr-luck-lbl">${luckLabel(l.score)}</span></div>
        <div class="fr-bar"><i style="width:${l.score}%"></i></div>
        <div class="fr-sub">${tx(`你的起点比全球 ${l.score}% 的新生儿更好`, `Your start beats ${l.score}% of the world's newborns`)}
          · ${tx('寿命', 'lifespan')} ${Math.round(l.le)}% · ${tx('财富', 'wealth')} ${Math.round(l.ppp)}% · ${tx('童年存活', 'child survival')} ${Math.round(l.u5)}%</div>
      </div>
    </div>`;
  }

  /* ------------------------------------------------------------------
     2) 出生地默认新加坡 + 扭蛋转盘
     ------------------------------------------------------------------ */
  function syncBirthPick() {
    document.querySelectorAll('[data-birth-pick]').forEach(b => b.classList.toggle('active', b.dataset.birthPick === (STATE.birthPick === 'random' ? 'random' : 'SGP')));
    const btn = $('#btnStart');
    if (btn) btn.dataset.funPick = STATE.birthPick;
    const lbl = $('#funPickLabel');
    if (lbl) lbl.textContent = tx('出生地', 'Birthplace');
    const rb = $('[data-birth-pick="random"]'), sb = $('[data-birth-pick="SGP"]');
    if (rb) rb.textContent = tx('🎲 随机扭蛋', '🎲 Gacha');
    if (sb) sb.textContent = `🇸🇬 ${countryById('SGP') ? localize(countryById('SGP')).name : 'Singapore'}`;
    const hint = $('#funPickHint');
    if (hint) {
      const sg = countryById('SGP');
      hint.textContent = STATE.birthPick === 'random'
        ? tx('🎲 扭蛋模式：依真实出生人数比例随机抽出生地（新加坡出生的机率只有约 0.03%）', '🎲 Gacha mode: birthplace drawn by real birth counts')
        : tx(`🇸🇬 默认出生在新加坡 · 预期寿命 ${sg ? sg.le : 83} 岁。想试试运气？切到「随机扭蛋」`, '🇸🇬 Born in Singapore by default. Switch to gacha to try your luck.');
    }
  }
  function setBirthPick(v) {
    STATE.birthPick = v === 'random' ? 'random' : 'SGP';
    try { localStorage.setItem('born-somewhere-v2:birthPick', STATE.birthPick); } catch (e) { /* ignore */ }
    syncBirthPick();
  }
  function weightedRandomCountry() { return chooseCountry(STATE.birthMode); }
  function spinThen(target, done) {
    let ov = $('#funSpin');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'funSpin';
      ov.className = 'fun-spin';
      ov.innerHTML = `<div class="fs-card"><div class="fs-title"></div><div class="fs-flag"></div><div class="fs-name"></div><div class="fs-tier"></div></div>`;
      document.body.appendChild(ov);
    }
    const flag = $('.fs-flag', ov), name = $('.fs-name', ov), tierEl = $('.fs-tier', ov);
    $('.fs-title', ov).textContent = tx('命运扭蛋转动中⋯', 'Spinning the wheel of fate…');
    tierEl.textContent = '';
    ov.classList.remove('fs-done');
    ov.hidden = false;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const steps = reduce ? 1 : 22;
    let i = 0;
    const show = (c) => { flag.textContent = c.flag; name.textContent = localize(c).name; };
    const next = () => {
      i++;
      if (i >= steps) {
        show(target);
        const r = rarity(target);
        ov.classList.add('fs-done');
        ov.style.setProperty('--tier', r.tier.color);
        tierEl.innerHTML = `<b>${r.tier.id}</b> ${esc(tx(r.tier.zh, r.tier.en))}`;
        $('.fs-title', ov).textContent = tx('你出生在⋯', 'You were born in…');
        setTimeout(() => { ov.hidden = true; done(target); }, reduce ? 400 : 1100);
        return;
      }
      show(weightedRandomCountry());
      setTimeout(next, 40 + Math.pow(i / steps, 3) * 260);
    };
    next();
  }

  /* ------------------------------------------------------------------
     4) 新加坡专属人生事件
     fx: h=健康 hp=幸福 k=知识 s=人际 m=净资产（PPP 美元）
     ------------------------------------------------------------------ */
  const SG_MILESTONES = [
    { id: 'p1', min: 6, max: 7, icon: '🎫', zh: '小一报名要抽签，爸妈为了心仪的学校紧张了一整个月', en: 'Primary 1 registration went to a ballot; your parents were on edge for a month', fx: { hp: 1 } },
    { id: 'psle', min: 12, max: 13, icon: '📝', zh: '考完小六会考（PSLE），全家松了一口气', en: 'Sat the PSLE; the whole family exhaled', fx: { k: 5, hp: -1 } },
    { id: 'olevel', min: 16, max: 17, icon: '📚', zh: 'O 水准放榜，拿着成绩单在初级学院和理工学院之间纠结', en: 'O-Level results out — junior college or polytechnic?', fx: { k: 4 } },
    { id: 'ns', min: 18, max: 19, sex: 'M', icon: '🪖', zh: '收到兵役通知，剃了光头去德光岛报到——国民服役开始', en: 'Enlisted for National Service at Pulau Tekong', fx: { h: 4, s: 4, hp: -2 } },
    { id: 'ord', min: 20, max: 21, sex: 'M', need: 'ns', icon: '🎉', zh: 'ORD 啰！两年国民服役结束，和同梯兄弟去吃了一顿大餐', en: 'ORD! Two years of National Service done', fx: { hp: 6, s: 3 } },
    { id: 'alevel', min: 18, max: 19, sex: 'F', icon: '🎓', zh: 'A 水准考完，开始填大学志愿', en: 'Finished A-Levels and applied to university', fx: { k: 4 } },
    { id: 'uni', min: 22, max: 26, icon: '🎓', zh: '大学毕业典礼上，家人拿着花在会场外等了好久', en: 'University graduation — your family waited outside with flowers', fx: { k: 5, hp: 3, m: 2000 }, cond: (l) => (l.stats.education || 0) >= 12 || (l.eduTarget || 0) >= 14 },
    { id: 'bto', min: 26, max: 33, icon: '🏠', zh: '和另一半申请 BTO 组屋，抽签抽到第三次才中', en: 'Applied for a BTO flat with your partner — got it on the third ballot', fx: { hp: 5, m: -6000 } },
    { id: 'keys', min: 31, max: 38, need: 'bto', icon: '🔑', zh: '等了四年，终于拿到组屋钥匙，第一晚睡在没有家具的客厅', en: 'Four years later, you finally collected the keys to your HDB flat', fx: { hp: 7 } },
    { id: 'cpf55', min: 55, max: 57, icon: '🏦', zh: '55 岁了，可以从公积金（CPF）提出一部分存款', en: 'Turned 55 — part of your CPF savings can now be withdrawn', fx: { m: 12000, hp: 2 } },
    { id: 'retire', min: 63, max: 66, icon: '🌅', zh: '到了退休年龄，在组屋楼下的咖啡店有了固定座位', en: 'Reached retirement age; you now have a regular seat at the kopitiam downstairs', fx: { hp: 5, s: 2 } },
    { id: 'linedance', min: 67, max: 75, icon: '💃', zh: '在社区俱乐部学跳排舞，交到一群新朋友', en: 'Took up line dancing at the community club', fx: { h: 2, s: 5, hp: 3 } },
  ];
  const SG_FLAVOR = [
    { id: 'chicken', min: 4, icon: '🍗', zh: '在小贩中心吃了一盘海南鸡饭，配一杯冰美禄', en: 'Hainanese chicken rice and iced Milo at the hawker centre', fx: { hp: 1 } },
    { id: 'chope', min: 8, icon: '🧻', zh: '用一包纸巾「chope」了位子，回来时位子还在', en: 'Reserved a table with a tissue packet — it was still there', fx: { hp: 1 } },
    { id: 'rain', min: 4, icon: '⛈️', zh: '下午四点准时雷阵雨，躲在组屋楼下等雨停', en: 'The 4pm thunderstorm arrived right on time', fx: {} },
    { id: 'mrt', min: 10, icon: '🚇', zh: '地铁又延误了，在群组里抱怨了二十分钟', en: 'The MRT was delayed again', fx: { hp: -1 } },
    { id: 'kiasu', min: 10, icon: '🛍️', zh: '怕输！为了限量版排了两个小时的队', en: 'Kiasu! Queued two hours for a limited edition', fx: { hp: 1, m: -100 } },
    { id: 'ndp', min: 6, icon: '🎆', zh: '国庆日庆典（NDP）门票居然抽中了！', en: 'Won tickets to the National Day Parade!', fx: { hp: 3, s: 1 } },
    { id: 'jewel', min: 5, icon: '✈️', zh: '周末去星耀樟宜看室内瀑布', en: 'Weekend trip to see the indoor waterfall at Jewel Changi', fx: { hp: 2 } },
    { id: 'merlion', min: 12, icon: '🦁', zh: '在鱼尾狮前面帮游客拍了十张照片', en: 'Took photos for tourists at the Merlion', fx: { s: 1 } },
    { id: 'bkt', min: 16, icon: '🍜', zh: '半夜和朋友去吃肉骨茶', en: 'Late-night bak kut teh with friends', fx: { s: 2 } },
    { id: 'jb', min: 18, icon: '🚗', zh: '过长堤去新山加油、买东西，回程塞了三个小时', en: 'Drove across the Causeway to JB; three hours in traffic home', fx: { m: 80, hp: -1 } },
    { id: 'crab', min: 14, icon: '🦀', zh: '和朋友争论哪一家的辣椒螃蟹最好吃', en: 'Argued with friends about the best chilli crab', fx: { s: 2 } },
    { id: 'ecp', min: 8, icon: '🚲', zh: '在东海岸公园骑脚车，吃了一包椰浆饭', en: 'Cycled at East Coast Park and had nasi lemak', fx: { h: 2, hp: 1 } },
    { id: 'singlish', min: 6, icon: '🗣️', zh: '一句话里混了华语、英语和马来语，外国朋友听得一脸问号', en: 'Mixed three languages in one sentence, can lah', fx: { s: 1 } },
    { id: 'toto', min: 21, icon: '🎰', zh: '跟同事合买了一张多多（TOTO），中了 S$30', en: 'Went in on a TOTO ticket with colleagues and won S$30', fx: { m: 22, hp: 1 } },
  ];
  function applyFx(life, fx) {
    const s = life.stats;
    if (!s || !fx) return;
    if (fx.h) s.health = clamp((s.health || 0) + fx.h);
    if (fx.hp) s.happiness = clamp((s.happiness || 0) + fx.hp);
    if (fx.k) s.knowledge = clamp((s.knowledge || 0) + fx.k);
    if (fx.s) s.social = clamp((s.social || 0) + fx.s);
    if (fx.m) s.netAssets = (s.netAssets || 0) + fx.m;
  }
  function sgEvent(life) {
    if (!life || life.country !== 'SGP') return null;
    const age = life.age;
    life._sg = life._sg || { done: {}, last: null };
    const done = life._sg.done;
    for (const m of SG_MILESTONES) {
      if (done[m.id] || age < m.min || age > m.max) continue;
      if (m.sex && m.sex !== life.sex) continue;
      if (m.need && !done[m.need]) continue;
      if (m.cond && !m.cond(life)) continue;
      // 在窗口最后一年一定触发；之前每年 60%
      if (age < m.max && Math.random() > 0.6) continue;
      done[m.id] = age;
      applyFx(life, m.fx);
      return { icon: m.icon, zh: m.zh, en: m.en };
    }
    if (Math.random() < 0.3) {
      const pool = SG_FLAVOR.filter(f => age >= f.min && f.id !== life._sg.last);
      if (pool.length) {
        const f = pool[Math.floor(Math.random() * pool.length)];
        life._sg.last = f.id;
        applyFx(life, f.fx);
        return { icon: f.icon, zh: f.zh, en: f.en };
      }
    }
    return null;
  }

  /* ------------------------------------------------------------------
     6) 每日挑战
     ------------------------------------------------------------------ */
  const CHALLENGES = [
    { id: 'age80', zh: '活到 80 岁以上', en: 'Live to 80 or older', test: (l) => l.deathAge >= 80 },
    { id: 'age90', zh: '活到 90 岁以上', en: 'Live to 90 or older', test: (l) => l.deathAge >= 90 },
    { id: 'rich', zh: '离世时净资产超过 US$300,000', en: 'Die with net worth over US$300,000', test: (l) => (l.stats.netAssets || 0) >= 300000 },
    { id: 'happy', zh: '离世时幸福度 ≥ 80', en: 'End life with happiness ≥ 80', test: (l) => (l.stats.happiness || 0) >= 80 },
    { id: 'social', zh: '离世时人际 ≥ 85', en: 'End life with social ≥ 85', test: (l) => (l.stats.social || 0) >= 85 },
    { id: 'know', zh: '离世时知识 ≥ 85', en: 'End life with knowledge ≥ 85', test: (l) => (l.stats.knowledge || 0) >= 85 },
    { id: 'family', zh: '结婚并且有孩子', en: 'Get married and have children', test: (l) => !!l.stats.married && (l.stats.kids || []).length > 0 },
    { id: 'beatle', zh: '比出生国平均寿命多活 5 年', en: 'Outlive your country\'s life expectancy by 5 years', test: (l) => l.deathAge >= (l.countryData?.le || 99) + 5 },
    { id: 'abroad70', zh: '在新加坡以外的地方出生，并活过 70 岁', en: 'Be born outside Singapore and live past 70', test: (l) => l.country !== 'SGP' && l.deathAge >= 70 },
    { id: 'rare60', zh: '抽到 SSR 以上稀有度的出生地，并活过 60 岁', en: 'Be born somewhere SSR or rarer and live past 60', test: (l) => TIER_RANK[rarity(l.countryData).tier.id] >= 3 && l.deathAge >= 60 },
    { id: 'hardmode', zh: '在「出生运气」低于 30 的国家活过 65 岁', en: 'Live past 65 where birth luck is under 30', test: (l) => luck(l.countryData).score < 30 && l.deathAge >= 65 },
  ];
  const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  function todayChallenge() {
    const k = todayKey();
    const h = typeof hashStringToInt === 'function' ? hashStringToInt('fun:' + k) : k.split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0) >>> 0, 7);
    return CHALLENGES[h % CHALLENGES.length];
  }
  function dailyStreak() {
    const doneDays = store.get('daily', {});
    let n = 0;
    const d = new Date();
    if (!doneDays[todayKey()]) d.setDate(d.getDate() - 1);
    for (;;) {
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!doneDays[k]) break;
      n++; d.setDate(d.getDate() - 1);
    }
    return n;
  }

  /* ------------------------------------------------------------------
     5) 成就
     ------------------------------------------------------------------ */
  const ACHV = [
    { id: 'first', icon: '🐣', zh: '初来乍到', en: 'First breath', dzh: '走完第一段人生', den: 'Finish your first life', test: (l, g) => g.lives >= 1 },
    { id: 'lion', icon: '🦁', zh: '狮城之子', en: 'Child of the Lion City', dzh: '在新加坡出生并走完一生', den: 'Live a full life born in Singapore', test: (l) => l.country === 'SGP' },
    { id: 'ns', icon: '🪖', zh: '保家卫国', en: 'Served the nation', dzh: '在新加坡完成国民服役', den: 'Complete National Service', test: (l) => !!l._sg?.done?.ord },
    { id: 'hdb', icon: '🔑', zh: '有房一族', en: 'Keys in hand', dzh: '拿到自己的组屋钥匙', den: 'Collect the keys to your HDB flat', test: (l) => !!l._sg?.done?.keys },
    { id: 'gacha', icon: '🎲', zh: '赌徒之心', en: 'Gambler', dzh: '用随机扭蛋出生一次', den: 'Be born via the gacha', test: (l) => !!l._fun?.gacha },
    { id: 'ur', icon: '💎', zh: '传说出生', en: 'Legendary birth', dzh: '出生在 UR 稀有度的国家', den: 'Be born in a UR-rarity country', test: (l) => rarity(l.countryData).tier.id === 'UR' },
    { id: 'common', icon: '🌏', zh: '芸芸众生', en: 'One of billions', dzh: '出生在 N 稀有度（人口大国）', den: 'Be born in a Common-rarity country', test: (l) => rarity(l.countryData).tier.id === 'N' },
    { id: 'age90', icon: '🐢', zh: '寿比南山', en: 'Long life', dzh: '活到 90 岁', den: 'Live to 90', test: (l) => l.deathAge >= 90 },
    { id: 'age100', icon: '🎂', zh: '百岁人瑞', en: 'Centenarian', dzh: '活到 100 岁', den: 'Live to 100', test: (l) => l.deathAge >= 100 },
    { id: 'beatle', icon: '🏃', zh: '跑赢命运', en: 'Beat the odds', dzh: '比出生国平均寿命多活 15 年', den: 'Outlive life expectancy by 15 years', test: (l) => l.deathAge >= (l.countryData?.le || 99) + 15 },
    { id: 'rich', icon: '💰', zh: '百万富翁', en: 'Millionaire', dzh: '净资产达到 US$1,000,000', den: 'Reach US$1,000,000 net worth', test: (l) => (l.stats.netAssets || 0) >= 1000000 },
    { id: 'broke', icon: '🍃', zh: '两袖清风', en: 'Travelled light', dzh: '离世时净资产不到 US$1,000', den: 'Die with under US$1,000', test: (l) => (l.stats.netAssets || 0) < 1000 },
    { id: 'scholar', icon: '🧠', zh: '学霸', en: 'Scholar', dzh: '知识达到 95', den: 'Knowledge 95+', test: (l) => (l.stats.knowledge || 0) >= 95 },
    { id: 'charmer', icon: '💞', zh: '万人迷', en: 'Charmer', dzh: '人际达到 95', den: 'Social 95+', test: (l) => (l.stats.social || 0) >= 95 },
    { id: 'joy', icon: '😊', zh: '快乐至上', en: 'Pure joy', dzh: '离世时幸福度达到 95', den: 'Happiness 95+ at the end', test: (l) => (l.stats.happiness || 0) >= 95 },
    { id: 'family', icon: '👨‍👩‍👧‍👦', zh: '儿孙满堂', en: 'Big family', dzh: '有 3 个以上孩子', den: 'Have 3+ children', test: (l) => (l.stats.kids || []).length >= 3 },
    { id: 'hard', icon: '⛰️', zh: '逆境求生', en: 'Against all odds', dzh: '在出生运气 < 20 的国家活过 70 岁', den: 'Live past 70 where birth luck < 20', test: (l) => luck(l.countryData).score < 20 && l.deathAge >= 70 },
    { id: 'world5', icon: '🧳', zh: '环游人间', en: 'Wanderer', dzh: '在 5 个不同国家出生过', den: 'Be born in 5 different countries', test: (l, g) => g.countries.length >= 5 },
    { id: 'world15', icon: '🗺️', zh: '地球公民', en: 'Citizen of Earth', dzh: '在 15 个不同国家出生过', den: 'Be born in 15 different countries', test: (l, g) => g.countries.length >= 15 },
    { id: 'lives10', icon: '♾️', zh: '十世轮回', en: 'Ten lives', dzh: '走完 10 段人生', den: 'Finish 10 lives', test: (l, g) => g.lives >= 10 },
    { id: 'daily', icon: '🎯', zh: '今日达标', en: 'Daily done', dzh: '完成一次每日挑战', den: 'Complete a daily challenge', test: (l, g) => g.dailyDone },
    { id: 'streak3', icon: '🔥', zh: '三天连胜', en: 'On fire', dzh: '每日挑战连续完成 3 天', den: '3-day daily challenge streak', test: () => dailyStreak() >= 3 },
  ];
  function evaluate(life) {
    const g = store.get('global', { lives: 0, countries: [] });
    g.lives += 1;
    if (!g.countries.includes(life.country)) g.countries.push(life.country);
    store.set('global', g);
    // 每日挑战
    const ch = todayChallenge();
    let dailyNew = false;
    let dailyOk = false;
    try { dailyOk = !!ch.test(life); } catch (e) { dailyOk = false; }
    if (dailyOk) {
      const days = store.get('daily', {});
      if (!days[todayKey()]) { days[todayKey()] = ch.id; store.set('daily', days); dailyNew = true; }
    }
    g.dailyDone = dailyOk;
    const got = store.get('achv', {});
    const fresh = [];
    for (const a of ACHV) {
      if (got[a.id]) continue;
      let ok = false;
      try { ok = !!a.test(life, g); } catch (e) { ok = false; }
      if (ok) { got[a.id] = Date.now(); fresh.push(a); }
    }
    store.set('achv', got);
    life._fun = Object.assign(life._fun || {}, { evaluated: true, fresh: fresh.map(a => a.id), dailyOk, dailyNew, challenge: ch.id });
    return { fresh, dailyOk, dailyNew, ch };
  }
  function achvModal() {
    const got = store.get('achv', {});
    const g = store.get('global', { lives: 0, countries: [] });
    let m = $('#funAchvModal');
    if (!m) {
      m = document.createElement('div');
      m.id = 'funAchvModal';
      m.className = 'modal fun-modal';
      m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-fun-close]')) m.hidden = true; });
      document.body.appendChild(m);
    }
    const n = ACHV.filter(a => got[a.id]).length;
    m.innerHTML = `<div class="modal-card fun-card">
      <div class="fun-card-head"><h3>🏆 ${tx('成就墙', 'Achievements')} <span class="muted">${n} / ${ACHV.length}</span></h3>
        <button class="ghost" data-fun-close>✕</button></div>
      <p class="muted">${tx(`已走完 ${g.lives} 段人生 · 出生过 ${g.countries.length} 个国家 · 每日挑战连胜 ${dailyStreak()} 天`, `${g.lives} lives · ${g.countries.length} countries · ${dailyStreak()}-day streak`)}</p>
      <div class="fun-achv-grid">${ACHV.map(a => `<div class="fun-achv ${got[a.id] ? 'on' : ''}" title="${esc(tx(a.dzh, a.den))}">
        <div class="fa-icon">${got[a.id] ? a.icon : '🔒'}</div>
        <div class="fa-name">${esc(tx(a.zh, a.en))}</div>
        <div class="fa-desc">${esc(tx(a.dzh, a.den))}</div></div>`).join('')}</div>
    </div>`;
    m.hidden = false;
  }

  /* ------------------------------------------------------------------
     UI 注入
     ------------------------------------------------------------------ */
  function renderIntroPanel() {
    const host = $('#view-intro .cta-row');
    if (!host) return;
    let p = $('#funIntroPanel');
    if (!p) {
      p = document.createElement('div');
      p.id = 'funIntroPanel';
      p.className = 'fun-panel';
      host.insertAdjacentElement('afterend', p);
      p.addEventListener('click', (e) => { if (e.target.closest('[data-fun-achv]')) achvModal(); });
    }
    const ch = todayChallenge();
    const days = store.get('daily', {});
    const done = !!days[todayKey()];
    const got = store.get('achv', {});
    const n = ACHV.filter(a => got[a.id]).length;
    const streak = dailyStreak();
    p.innerHTML = `
      <div class="fp-item fp-daily ${done ? 'done' : ''}">
        <div class="fp-k">🎯 ${tx('今日挑战', "Today's challenge")}</div>
        <div class="fp-v">${esc(tx(ch.zh, ch.en))}</div>
        <div class="fp-s">${done ? tx('✅ 今天已完成！', '✅ Done today!') : tx('走完一生后自动判定', 'Checked when a life ends')}${streak ? ` · 🔥 ${tx(`连胜 ${streak} 天`, `${streak}-day streak`)}` : ''}</div>
      </div>
      <button class="fp-item fp-achv" data-fun-achv type="button">
        <div class="fp-k">🏆 ${tx('成就', 'Achievements')}</div>
        <div class="fp-v">${n} / ${ACHV.length}</div>
        <div class="fp-s">${tx('点开看成就墙', 'Open the wall')}</div>
      </button>`;
    syncBirthPick();
  }
  function renderEndPanel() {
    const life = STATE.life;
    const view = $('#view-end');
    if (!life || !life.died || !view) return;
    let p = $('#funEndPanel');
    if (!p) {
      p = document.createElement('div');
      p.id = 'funEndPanel';
      p.className = 'fun-end';
      view.insertBefore(p, view.firstChild);
      p.addEventListener('click', (e) => { if (e.target.closest('[data-fun-achv]')) achvModal(); });
    }
    const f = life._fun || {};
    const ch = CHALLENGES.find(c => c.id === f.challenge) || todayChallenge();
    const fresh = (f.fresh || []).map(id => ACHV.find(a => a.id === id)).filter(Boolean);
    const r = rarity(life.countryData);
    p.innerHTML = `
      <div class="fe-row">
        <span class="fe-chip" style="--tier:${r.tier.color}"><b>${r.tier.id}</b> ${esc(localize(life.countryData).name)}</span>
        <span class="fe-chip ${f.dailyOk ? 'ok' : 'no'}">🎯 ${esc(tx(ch.zh, ch.en))} — ${f.dailyOk ? tx('达成！', 'done!') : tx('未达成', 'not this time')}</span>
        <button class="fe-chip fe-btn" data-fun-achv type="button">🏆 ${tx('成就墙', 'Achievements')}</button>
      </div>
      ${fresh.length ? `<div class="fe-fresh"><span class="fe-lbl">${tx('本次解锁', 'Unlocked')}</span>${fresh.map(a => `<span class="fe-badge" title="${esc(tx(a.dzh, a.den))}">${a.icon} ${esc(tx(a.zh, a.en))}</span>`).join('')}</div>` : ''}`;
  }
  function celebrate(res) {
    const msgs = [];
    if (res.dailyNew) msgs.push(tx('🎯 每日挑战完成！', '🎯 Daily challenge complete!'));
    res.fresh.forEach(a => msgs.push(`${a.icon} ${tx('解锁成就', 'Unlocked')}：${tx(a.zh, a.en)}`));
    msgs.forEach((m, i) => setTimeout(() => { try { toast(m, 2600); } catch (e) { /* ignore */ } }, 400 + i * 2700));
    if (msgs.length && !matchMedia('(prefers-reduced-motion: reduce)').matches) confetti();
  }
  function confetti() {
    const box = document.createElement('div');
    box.className = 'fun-confetti';
    const colors = ['#e0457b', '#d99a1f', '#8a4fd1', '#2f7fd0', '#2B7A4E'];
    for (let i = 0; i < 60; i++) {
      const s = document.createElement('i');
      s.style.left = Math.random() * 100 + '%';
      s.style.background = colors[i % colors.length];
      s.style.animationDelay = (Math.random() * 0.6) + 's';
      s.style.animationDuration = (1.8 + Math.random() * 1.4) + 's';
      s.style.transform = `rotate(${Math.random() * 360}deg)`;
      box.appendChild(s);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 4000);
  }

  /* ------------------------------------------------------------------
     掛鉤：重新指派 app.js 的全域函式
     ------------------------------------------------------------------ */
  const _wire = window.wire;
  window.wire = function () {
    _wire.apply(this, arguments);
    document.querySelectorAll('[data-birth-pick]').forEach(b => b.addEventListener('click', () => setBirthPick(b.dataset.birthPick)));
    const hint = document.createElement('p');
    hint.id = 'funPickHint';
    hint.className = 'fun-pick-hint';
    $('#btnStart')?.insertAdjacentElement('afterend', hint);
    // 「换一个国家」也走扭蛋动画（替换按钮以移除原监听）
    const rr = $('#birthCertReroll');
    if (rr) {
      const nb = rr.cloneNode(true);
      rr.replaceWith(nb);
      nb.addEventListener('click', () => {
        hideBirthCertModal();
        STATE._funGacha = true;
        spinThen(weightedRandomCountry(), (c) => showBirthCertModal(c));
      });
    }
    syncBirthPick();
  };

  window.startLifeWithCert = function () {
    if (STATE.birthPick !== 'random') { STATE._funGacha = false; const c = pickBirthCountry(); if (c) showBirthCertModal(c); return; }
    STATE._funGacha = true;
    spinThen(weightedRandomCountry(), (c) => showBirthCertModal(c));
  };

  const _showCert = window.showBirthCertModal;
  window.showBirthCertModal = function (c) {
    _showCert.apply(this, arguments);
    const body = $('#birthCertBody');
    if (body && c) body.insertAdjacentHTML('afterbegin', rarityBlock(c));
  };

  const _startLife = window.startLife;
  window.startLife = function (code) {
    const gacha = !!STATE._funGacha;
    STATE._funGacha = false;
    _startLife.apply(this, arguments);
    const life = STATE.life;
    if (!life) return;
    life._fun = { gacha };
    if (life.country === 'SGP') {
      try {
        setCurrency('S$');
        const lbl = $('#currencyLabel');
        if (lbl) lbl.textContent = 'S$';
      } catch (e) { /* ignore */ }
    }
    const r = rarity(life.countryData);
    if (TIER_RANK[r.tier.id] >= 3) { try { toast(`✨ ${r.tier.id}！${tx('稀有出生地', 'Rare birthplace')}`, 2400); } catch (e) { /* ignore */ } }
  };

  const _gen = window.generateYearlyEvent;
  window.generateYearlyEvent = function (life) {
    try { const e = sgEvent(life); if (e) return e; } catch (err) { /* fall back */ }
    return _gen.apply(this, arguments);
  };

  const _die = window.dieNow;
  window.dieNow = function () {
    const life = STATE.life;
    // 先判定成就，让 savePastLife 存下 _fun 资料、renderEnd 画出面板
    let res = null;
    if (life && !life.died) {
      const age = life.age;
      life.deathAge = age;  // 测试用（原函数会再设一次）
      try { res = evaluate(life); } catch (e) { res = null; }
    }
    _die.apply(this, arguments);
    if (res) celebrate(res);
  };

  const _renderEnd = window.renderEnd;
  window.renderEnd = function () {
    _renderEnd.apply(this, arguments);
    try { renderEndPanel(); } catch (e) { /* ignore */ }
  };
  const _renderIntro = window.renderIntro;
  window.renderIntro = function () {
    _renderIntro.apply(this, arguments);
    try { renderIntroPanel(); } catch (e) { /* ignore */ }
  };
  const _setLang = window.setLang;
  window.setLang = function (lang) {
    _setLang.apply(this, arguments);
    if (lang === 'zh-Hans') convTree(document.documentElement);
    syncBirthPick();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startHans);
  else startHans();

  // 给测试 / 除错用
  window.BornFun = { rarity, luck, todayChallenge, ACHV, CHALLENGES, sgEvent, toHans, achvModal };
})();
