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
  const CONTACT_EMAIL = 'info@zenmatrix.org';
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
    try { syncSexEth(); } catch (e) { /* ignore */ }
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
      p.addEventListener('click', (e) => { if (e.target.closest('[data-fun-achv]')) achvModal(); if (e.target.closest('[data-fun-wechat]')) wechatModal(); if (e.target.closest('[data-fun-compare]')) compareModal('SGP'); });
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
      </button>
      <button class="fp-item fp-achv" data-fun-compare type="button">
        <div class="fp-k">🧭 ${tx('国家对比', 'Compare')}</div>
        <div class="fp-v">${tx('出生机率', 'Birth odds')}</div>
        <div class="fp-s">${tx('两国并排看', 'Side by side')}</div>
      </button>
      <button class="fp-item fp-achv" data-fun-wechat type="button">
        <div class="fp-k">💌 ${tx('意见反馈', 'Feedback')}</div>
        <div class="fp-v">${tx('加微信', 'WeChat')}</div>
        <div class="fp-s">${tx('扫码告诉我', 'Scan to chat')}</div>
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
    document.querySelectorAll('[data-birth-sex]').forEach(b => b.addEventListener('click', () => { STATE.birthSex = b.dataset.birthSex; store.set('sex', STATE.birthSex); syncSexEth(); }));
    $('#birthEthSelect')?.addEventListener('change', (e) => { STATE.birthEth = e.target.value; store.set('eth', STATE.birthEth); });
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
    try { certEthRow(STATE.birthCertLife); } catch (e) { /* ignore */ }
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

  /* ------------------------------------------------------------------
     7) v6.14：出生可选性别、种族（或自动）
     种族影响：本人、父母、手足、伴侣、孩子的姓名风格，以及宗教分布。
     新加坡「自动」依 2020 人口普查（华 74.3 / 马来 13.5 / 印度 9.0 / 其他 3.2）。
     其他国家「自动」沿用原本的命名逻辑。
     ------------------------------------------------------------------ */
  const pk = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const wpick = (pairs) => { let r = Math.random() * pairs.reduce((s, p) => s + p[1], 0); for (const p of pairs) { r -= p[1]; if (r <= 0) return p[0]; } return pairs[0][0]; };
  const ETHS = [
    { id: 'auto', zh: '自动', en: 'Auto' },
    { id: 'chinese', zh: '华人', en: 'Chinese' },
    { id: 'malay', zh: '马来人', en: 'Malay' },
    { id: 'indian', zh: '印度人', en: 'Indian' },
    { id: 'eurasian', zh: '欧亚裔', en: 'Eurasian' },
    { id: 'european', zh: '欧洲裔', en: 'European' },
    { id: 'african', zh: '非洲裔', en: 'African' },
    { id: 'latino', zh: '拉丁裔', en: 'Latino' },
    { id: 'arab', zh: '阿拉伯裔', en: 'Arab' },
  ];
  const ethLabel = (id) => { const e = ETHS.find(x => x.id === id); return e ? tx(e.zh, e.en) : ''; };
  const SG_ETH_W = [['chinese', 74.3], ['malay', 13.5], ['indian', 9.0], ['eurasian', 1.2], ['european', 2.0]];
  // 华人：汉字（繁体存，显示层转简）+ 新加坡常见方言拼音
  const CN_LAST = [['陳', 'Tan'], ['林', 'Lim'], ['李', 'Lee'], ['黃', 'Ng'], ['王', 'Ong'], ['吳', 'Goh'], ['張', 'Teo'], ['劉', 'Lau'], ['蔡', 'Chua'], ['許', 'Koh'], ['楊', 'Yeo'], ['鄭', 'Tay'], ['謝', 'Chia'], ['郭', 'Kwek'], ['洪', 'Ang'], ['曾', 'Chan'], ['邱', 'Khoo'], ['梁', 'Neo'], ['賴', 'Lai'], ['周', 'Chew']];
  const CN_FIRST = {
    M: [['俊傑', 'Jun Jie'], ['偉明', 'Wei Ming'], ['志強', 'Zhi Qiang'], ['家豪', 'Jia Hao'], ['明輝', 'Ming Hui'], ['子軒', 'Zi Xuan'], ['浩然', 'Hao Ran'], ['建華', 'Jian Hua'], ['國榮', 'Guo Rong'], ['宇航', 'Yu Hang']],
    F: [['美玲', 'Mei Ling'], ['慧敏', 'Hui Min'], ['雅婷', 'Ya Ting'], ['欣怡', 'Xin Yi'], ['淑芬', 'Shu Fen'], ['佳穎', 'Jia Ying'], ['詩涵', 'Shi Han'], ['麗華', 'Li Hua'], ['思琪', 'Si Qi'], ['婉清', 'Wan Qing']],
  };
  const EN_GIVEN = { M: ['Jason', 'Ryan', 'Marcus', 'Daniel', 'Ethan', 'Gabriel', 'Nicholas', 'Darren'], F: ['Rachel', 'Michelle', 'Jasmine', 'Chloe', 'Sarah', 'Vanessa', 'Natalie', 'Joanne'] };
  const MALAY_GIVEN = { M: ['Muhammad Hafiz', 'Ahmad Faizal', 'Muhammad Irfan', 'Syafiq', 'Haziq', 'Aiman', 'Danial', 'Iskandar', 'Firdaus', 'Khairul'], F: ['Nur Aisyah', 'Siti Nurhaliza', 'Nurul Huda', 'Aishah', 'Farhana', 'Syahirah', 'Amirah', 'Nadia', 'Hidayah', 'Zulaikha'] };
  const MALAY_FATHER = ['Abdullah', 'Ismail', 'Rahman', 'Hassan', 'Osman', 'Yusof', 'Ibrahim', 'Salleh', 'Kassim', 'Hamid'];
  const INDIAN_GIVEN = { M: ['Arjun', 'Rajesh', 'Suresh', 'Vikram', 'Karthik', 'Ganesh', 'Pravin', 'Dinesh', 'Naveen', 'Siva'], F: ['Priya', 'Kavitha', 'Divya', 'Lakshmi', 'Anitha', 'Shalini', 'Meena', 'Revathi', 'Deepa', 'Nithya'] };
  const INDIAN_FATHER = ['Ramasamy', 'Krishnan', 'Subramaniam', 'Muthu', 'Rajan', 'Govindasamy', 'Pillai', 'Nair', 'Selvaraj', 'Balakrishnan'];
  const WEST_GIVEN = { M: ['James', 'Daniel', 'Michael', 'Benjamin', 'Lucas', 'Oliver', 'Thomas', 'Adrian', 'Christopher', 'Matthew', 'Samuel', 'Leon'], F: ['Emma', 'Olivia', 'Charlotte', 'Sophie', 'Grace', 'Hannah', 'Isabel', 'Claire', 'Amelia', 'Laura', 'Natalie', 'Anna'] };
  const EURO_LAST = ['Smith', 'Müller', 'Martin', 'Rossi', 'Novak', 'Jensen', 'Dubois', 'Schmidt', 'Brown', 'Kowalski', 'Andersson', 'Wilson'];
  const EURASIAN_LAST = ['De Souza', 'Pereira', 'Rodrigues', 'Fernandez', 'Shepherdson', 'Westerhout', "D'Silva", 'Oliveiro', 'Scully', 'Hendricks'];
  const AFR = { M: ['Kwame', 'Chinedu', 'Tunde', 'Kofi', 'Jabari', 'Emeka', 'Sipho', 'Yaw'], F: ['Amara', 'Ngozi', 'Zuri', 'Ama', 'Adaeze', 'Thandiwe', 'Abena', 'Nia'], L: ['Okafor', 'Mensah', 'Adeyemi', 'Okeke', 'Diallo', 'Nkosi', 'Mwangi', 'Boateng'] };
  const LAT = { M: ['Diego', 'Mateo', 'Santiago', 'Carlos', 'Javier', 'Luis', 'Andrés', 'Miguel'], F: ['Sofía', 'Valentina', 'Camila', 'Lucía', 'María', 'Isabella', 'Daniela', 'Gabriela'], L: ['García', 'Rodríguez', 'Martínez', 'López', 'Hernández', 'González', 'Pérez', 'Sánchez'] };
  const ARB = { M: ['Omar', 'Youssef', 'Khalid', 'Ahmed', 'Karim', 'Tariq', 'Hamza', 'Faisal'], F: ['Layla', 'Fatima', 'Mariam', 'Noor', 'Yasmin', 'Salma', 'Huda', 'Rania'], L: ['Al-Sayed', 'Haddad', 'Nasser', 'Khalil', 'Mansour', 'Hamdan', 'Saleh', 'Darwish'] };
  function ethName(eth, sex, country, fatherGiven) {
    const S = sex === 'F' ? 'F' : 'M';
    const sg = country && country.id === 'SGP';
    if (eth === 'chinese') {
      const [lz, le] = pk(CN_LAST), [fz, fe] = pk(CN_FIRST[S]);
      const eg = (sg && Math.random() < 0.6) ? pk(EN_GIVEN[S]) : '';
      return { last: lz, first: fz, full: lz + fz, full_en: `${eg ? eg + ' ' : ''}${le} ${fe}`, en_given: eg, first_en: fe };
    }
    if (eth === 'malay') {
      const g = pk(MALAY_GIVEN[S]), f = fatherGiven || pk(MALAY_FATHER);
      const full = `${g} ${S === 'F' ? 'binti' : 'bin'} ${f}`;
      return { last: f, first: g, full, full_en: full, given: g };
    }
    if (eth === 'indian') {
      const g = pk(INDIAN_GIVEN[S]), f = fatherGiven || pk(INDIAN_FATHER);
      const full = sg ? `${g} ${S === 'F' ? 'd/o' : 's/o'} ${f}` : `${g} ${f}`;
      return { last: f, first: g, full, full_en: full, given: g };
    }
    if (eth === 'eurasian') { const g = pk(WEST_GIVEN[S]), l = pk(EURASIAN_LAST); return { last: l, first: g, full: `${g} ${l}`, full_en: `${g} ${l}` }; }
    if (eth === 'european') { const g = pk(WEST_GIVEN[S]), l = pk(EURO_LAST); return { last: l, first: g, full: `${g} ${l}`, full_en: `${g} ${l}` }; }
    if (eth === 'african') { const g = pk(AFR[S]), l = pk(AFR.L); return { last: l, first: g, full: `${g} ${l}`, full_en: `${g} ${l}` }; }
    if (eth === 'latino') { const g = pk(LAT[S]), l = pk(LAT.L) + ' ' + pk(LAT.L); return { last: l, first: g, full: `${g} ${l}`, full_en: `${g} ${l}` }; }
    if (eth === 'arab') { const g = pk(ARB[S]), l = pk(ARB.L); return { last: l, first: g, full: `${g} ${l}`, full_en: `${g} ${l}` }; }
    return null;
  }
  // 宗教（繁体存，与 pickReligion 的用语一致）
  const ETH_REL = {
    chinese: [[['佛教', 'Buddhism'], 40], [['無信仰', 'No religion'], 26], [['基督新教', 'Protestant'], 16], [['道教', 'Taoism'], 12], [['天主教', 'Catholic'], 6]],
    malay: [[['伊斯蘭', 'Islam'], 98], [['無信仰', 'No religion'], 2]],
    indian: [[['印度教', 'Hinduism'], 58], [['伊斯蘭', 'Islam'], 22], [['基督教', 'Christianity'], 13], [['錫克教', 'Sikhism'], 5], [['無信仰', 'No religion'], 2]],
    eurasian: [[['天主教', 'Catholic'], 60], [['基督新教', 'Protestant'], 28], [['無信仰', 'No religion'], 12]],
    arab: [[['伊斯蘭', 'Islam'], 90], [['基督教', 'Christianity'], 10]],
    latino: [[['天主教', 'Catholic'], 70], [['基督新教', 'Protestant'], 18], [['無信仰', 'No religion'], 12]],
  };
  function resolveEth(country) {
    const pick = STATE.birthEth || 'auto';
    if (pick !== 'auto') return pick;
    if (country && country.id === 'SGP') return wpick(SG_ETH_W);
    return null;   // 其他国家：沿用原本的命名
  }
  let ETH_CTX = null;   // newLife 期间：{ country, eth }
  const _randomName = window.randomName;
  window.randomName = function (country, sex) {
    try {
      let eth = null;
      if (ETH_CTX && country && country.id === ETH_CTX.country) eth = ETH_CTX.eth;
      else if (!ETH_CTX && STATE.life && STATE.life.ethnicity && country && country.id === STATE.life.country) eth = STATE.life.ethnicity;  // 伴侣、孩子
      else if (country && country.id === 'SGP') eth = wpick(SG_ETH_W);   // 新加坡路人也用本地名字
      if (eth) { const n = ethName(eth, sex, country); if (n) return n; }
    } catch (e) { /* fall back */ }
    return _randomName.apply(this, arguments);
  };
  const _newLife = window.newLife;
  window.newLife = function (code) {
    const c = countryById(code);
    const eth = resolveEth(c);
    STATE.forceSex = (STATE.birthSex === 'M' || STATE.birthSex === 'F') ? STATE.birthSex : null;
    ETH_CTX = eth ? { country: code, eth } : null;
    let life;
    try { life = _newLife.apply(this, arguments); } finally { ETH_CTX = null; STATE.forceSex = null; }
    if (!life || !eth) return life;
    life.ethnicity = eth;
    // 一家人的名字要合理：同父姓／父名制，而且兄弟姊妹、父亲彼此不重名
    const fam = life.family || {};
    const father = (fam.parents || []).find(p => p.sex === 'M');
    if (father) {
      const fname = String(father.name);
      const used = new Set();
      const uniq = (sex, gen) => { let n; for (let i = 0; i < 12; i++) { n = gen(sex); if (n && !used.has(n.first)) break; } if (n) used.add(n.first); return n; };
      let gen = null;
      if (eth === 'malay' || eth === 'indian') {
        const fg = fname.split(/ (?:bin|binti|s\/o|d\/o) /)[0];
        used.add(fg);
        gen = (sex) => ethName(eth, sex, c, fg);
      } else if (eth === 'chinese') {
        const ln = fname.charAt(0);
        const pair = CN_LAST.find(p => p[0] === ln);
        used.add(fname.slice(1));
        gen = (sex) => {
          const n = ethName(eth, sex, c);
          if (n && pair) { n.last = ln; n.full = ln + n.first; n.full_en = `${n.en_given ? n.en_given + ' ' : ''}${pair[1]} ${n.first_en}`; }
          return n;
        };
      } else {
        // 西式姓氏：跟父亲同姓（拉丁裔取父亲第一个姓 + 随机母姓）
        const parts = fname.split(' ');
        used.add(parts[0]);
        const fl = eth === 'latino' ? parts[1] : parts.slice(1).join(' ');
        gen = (sex) => {
          const n = ethName(eth, sex, c);
          if (n && fl) { n.last = eth === 'latino' ? `${fl} ${pk(LAT.L)}` : fl; n.full = n.full_en = `${n.first} ${n.last}`; }
          return n;
        };
      }
      const me = uniq(life.sex, gen);
      if (me) life.name = me;
      (fam.siblings || []).forEach(s => { const sn = uniq(s.sex, gen); if (sn) s.name = sn.full; });
    }
    const rel = ETH_REL[eth];
    if (rel && life.stats) { const r = wpick(rel); life.stats.religion = isEn() ? r[1] : r[0]; }
    return life;
  };
  function syncSexEth() {
    const sx = STATE.birthSex || 'auto';
    document.querySelectorAll('[data-birth-sex]').forEach(b => {
      b.classList.toggle('active', b.dataset.birthSex === sx);
      b.textContent = b.dataset.birthSex === 'auto' ? tx('🎲 自动', '🎲 Auto') : b.dataset.birthSex === 'M' ? tx('♂ 男', '♂ Male') : tx('♀ 女', '♀ Female');
    });
    const sl = $('#funSexLabel'); if (sl) sl.textContent = tx('性别', 'Sex');
    const el = $('#funEthLabel'); if (el) el.textContent = tx('种族', 'Ethnicity');
    const sel = $('#birthEthSelect');
    if (sel) {
      sel.innerHTML = ETHS.map(e => `<option value="${e.id}" ${e.id === (STATE.birthEth || 'auto') ? 'selected' : ''}>${e.id === 'auto' ? '🎲 ' : ''}${esc(tx(e.zh, e.en))}</option>`).join('');
    }
  }
  STATE.birthSex = store.get('sex', 'auto');
  STATE.birthEth = store.get('eth', 'auto');
  function certEthRow(life) {
    const body = $('#birthCertBody');
    if (!body || !life || !life.ethnicity) return;
    const rows = body.querySelectorAll('.bc-table tr');
    const sexRow = rows[1];
    if (!sexRow) return;
    sexRow.insertAdjacentHTML('afterend', `<tr class="fun-eth-row"><td class="bc-k">${tx('种族', 'Ethnicity')}</td><td class="bc-v">${esc(ethLabel(life.ethnicity))}</td></tr>`);
  }

  /* ------------------------------------------------------------------
     8) v6.14：意见反馈 —— 微信二维码
     ------------------------------------------------------------------ */
  const QR_SRC = 'assets/wechat-qr.png';
  function qrBlock() {
    return `<div class="fun-wechat">
      <img src="${QR_SRC}" alt="${esc(tx('作者的微信二维码', "Author's WeChat QR code"))}" width="200" height="241" loading="lazy">
      <div class="fw-text"><b>💬 ${tx('加我微信，直接聊', 'Add me on WeChat')}</b>
        <span>${tx('有 bug、建议或想看的新玩法，扫码加好友告诉我。', 'Bugs, ideas, new features you want — scan to reach me.')}</span>
        <span class="fw-mail">📧 <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></span></div>
    </div>`;
  }
  function wechatModal() {
    let m = $('#funWechatModal');
    if (!m) {
      m = document.createElement('div');
      m.id = 'funWechatModal';
      m.className = 'modal fun-modal';
      m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-fun-close]')) m.hidden = true; });
      document.body.appendChild(m);
    }
    m.innerHTML = `<div class="modal-card fun-card fun-wechat-card">
      <div class="fun-card-head"><h3>💌 ${tx('意见反馈', 'Feedback')}</h3><button class="ghost" data-fun-close>✕</button></div>
      ${qrBlock()}
    </div>`;
    m.hidden = false;
  }
  const _fb = window.renderFeedbackModal;
  if (typeof _fb === 'function') {
    window.renderFeedbackModal = function () {
      _fb.apply(this, arguments);
      const help = document.querySelector('#feedbackModal .modal-help');
      if (help) help.insertAdjacentHTML('beforebegin', qrBlock());
    };
  }

  /* ------------------------------------------------------------------
     9) v6.15：对齐原版 1in8billion.live（MIT）—— 人生篇章与日常叙事
     文本来自原版 content/story-v6（data/story.json，附出处）；引擎为本仓库重写的轻量版：
     12 个按年龄出现的篇章抉择（3 选 1，带后续回响），10 国在地篇章，
     8 类 × 20 句日常片段 + 10 国在地片段。
     ------------------------------------------------------------------ */
  let STORY = null;
  fetch('data/story.json').then(r => r.json()).then(d => { STORY = d; }).catch(() => { STORY = null; });
  const sDict = () => (STORY ? (isZh() ? STORY['zh-Hans'] : STORY.en) : null);
  const sText = (k) => { const d = sDict(); return d && d[k] ? d[k] : null; };
  const LOCAL_COUNTRIES = ['CHN', 'JPN', 'IND', 'USA', 'BRA', 'NGA', 'FRA', 'TWN', 'HKG', 'SGP'];
  const CHAPTERS = [
    { id: 'small-courage', min: 3, max: 5, cond: 'toy', icon: '🧸', fx: [{ knowledge: 2, happiness: -1 }, { social: 2 }, { happiness: 1 }] },
    { id: 'school-friend', min: 8, max: 11, cond: 'friend', icon: '🤝', fx: [{ social: 3, happiness: -1 }, { social: 2 }, { happiness: 1 }] },
    { id: 'first-interest', min: 13, max: 17, cond: 'interest', icon: '🎨', fx: [{ knowledge: 3, happiness: -1 }, { social: 2, knowledge: 1 }, { happiness: 1 }] },
    { id: 'words-at-home', min: 19, max: 24, cond: 'family', icon: '🏡', fx: [{ social: 2, happiness: -1 }, { social: 2 }, { knowledge: 1, happiness: 1 }] },
    { id: 'old-friend', min: 24, max: 38, cond: 'reconnect', icon: '✉️', local: 'reconnect', fx: [{ social: 3, happiness: -1 }, { social: 2 }, { happiness: 1 }], lfx: [{ social: 2, happiness: 1 }, { social: 3, happiness: -1 }, { happiness: 1 }] },
    { id: 'return-interest', min: 27, max: 44, cond: 'return', icon: '🎻', local: 'return', fx: [{ knowledge: 2, happiness: 2, social: -1 }, { knowledge: 1, happiness: 1 }, { happiness: 1 }], lfx: [{ knowledge: 2, happiness: 1 }, { knowledge: 1, social: 1 }, { happiness: 2 }] },
    { id: 'family-time', min: 31, max: 49, cond: 'visit', icon: '🍲', local: 'visit', fx: [{ social: 3, knowledge: -1 }, { social: 1, knowledge: 1 }, { knowledge: 2, social: -1 }], lfx: [{ social: 3, happiness: -1 }, { social: 2, happiness: 1 }, { happiness: 1 }] },
    { id: 'work-boundary', min: 34, max: 57, cond: 'boundary', icon: '💼', fx: [{ social: 2, happiness: -1 }, { knowledge: 2 }, { happiness: 2, social: -1 }] },
    { id: 'shared-time', min: 37, max: 63, cond: 'partner', icon: '💞', fx: [{ social: 3, happiness: -1 }, { social: 2, happiness: 1 }, { social: 1, knowledge: 1 }] },
    { id: 'friend-repair', min: 46, max: 71, cond: 'repair', icon: '🌉', fx: [{ social: 2, knowledge: 1 }, { social: 3, happiness: -1 }, { happiness: 1 }] },
    { id: 'later-letter', min: 63, max: 86, cond: 'letter', icon: '📮', fx: [{ knowledge: 2, happiness: 1 }, { happiness: 2 }, { happiness: 1 }] },
    { id: 'memory-box', min: 75, max: 105, cond: 'box', icon: '📦', fx: [{ knowledge: 1, happiness: 1 }, { happiness: 2 }, { happiness: 1 }] },
  ];
  const FX_SCALE = 2;
  const FX_NAME = { health: ['健康', 'Health'], happiness: ['幸福', 'Happiness'], knowledge: ['知识', 'Knowledge'], social: ['人际', 'Social'] };
  const fxLabel = (fx) => Object.entries(fx).map(([k, v]) => `${tx(FX_NAME[k][0], FX_NAME[k][1])} ${v > 0 ? '+' : ''}${v * FX_SCALE}`).join(' · ');
  const st = (life) => (life._story ||= { done: {}, follows: [], used: {}, friend: null, interest: null, lastContactAge: null, reconnected: false, lastAge: -1, lastChoiceAge: -9 });
  const curYear = (life) => (life.year || NOW_YEAR) + (life.age || 0);
  const aliveFamily = (life) => {
    const f = life.family || {};
    const y = curYear(life);
    return [...(f.parents || []), ...(f.siblings || []), ...(f.grandparents || [])].filter(p => p && p.name && !(p.death && p.death.year && p.death.year <= y) && !(p.birth && p.birth.year > y));
  };
  const parentsAlive = (life) => aliveFamily(life).filter(p => (life.family?.parents || []).includes(p));
  function friendOf(life) {
    const s = st(life);
    if (!s.friend) {
      const sex = Math.random() < 0.5 ? 'M' : 'F';
      let n = null;
      try { n = randomName(life.countryData, sex); } catch (e) { n = null; }
      s.friend = { name: n ? (n.full || n.full_en) : tx('同学', 'a classmate'), sex };
    }
    return s.friend;
  }
  function eligible(life, ch) {
    const s = st(life), emp = life.stats.employment;
    switch (ch.cond) {
      case 'toy': return aliveFamily(life).length > 0;
      case 'friend': return true;
      case 'interest': return true;
      case 'family': return parentsAlive(life).length > 0;
      case 'reconnect': return !!s.friend && life.age - (s.lastContactAge ?? life.age) >= 4;
      case 'return': return !!s.interest;
      case 'visit': return parentsAlive(life).length > 0 && (emp === 'employed' || emp === 'family_biz');
      case 'boundary': return emp === 'employed' || emp === 'family_biz';
      case 'partner': return !!life.stats.married && !!life.stats.partner;
      case 'repair': return !!s.friend && s.reconnected;
      case 'letter': return life.age >= 63;
      case 'box': return Object.keys(s.done).length > 0;
      default: return false;
    }
  }
  function chapterKey(life, ch) {
    if (ch.local && LOCAL_COUNTRIES.includes(life.country) && sText(`s6.${life.country}.${ch.local}`)) return { key: `s6.${life.country}.${ch.local}`, fx: ch.lfx || ch.fx };
    return { key: 's6.' + ch.id, fx: ch.fx };
  }
  function storyTokens(life, ch) {
    const s = st(life);
    let person = '';
    if (['friend', 'reconnect', 'repair'].includes(ch.cond)) person = friendOf(life).name;
    else if (ch.cond === 'partner') person = life.stats.partner?.name || '';
    else if (['family', 'visit'].includes(ch.cond)) { const p = parentsAlive(life); person = p.length ? p[Math.floor(Math.random() * p.length)].name : ''; }
    else if (ch.cond === 'toy') { const p = aliveFamily(life); person = p.length ? p[0].name : ''; }
    const interestKind = s.interest || 'making';
    return { person: String(person || tx('家人', 'family')), interest: sText('ui.interest' + interestKind[0].toUpperCase() + interestKind.slice(1)) || '', lastAge: String(s.lastContactAge ?? '') };
  }
  const fillT = (str, tok) => String(str || '').replace(/\{([A-Za-z]+)\}/g, (_, k) => tok[k] ?? '');
  function pushStory(life, text, icon, kind) {
    if (!text) return;
    life.log.push({ age: life.age, kind: kind || 'story', icon: icon || '📖', text });
    life.latestEvent = { age: life.age, icon: icon || '📖', text };
  }
  function resolveChapter(life, pend, idx, automatic) {
    const s = st(life);
    const ch = CHAPTERS.find(c => c.id === pend.id);
    const fx = pend.fx[idx] || {};
    const scaled = {};
    for (const [k, v] of Object.entries(fx)) scaled[k] = v * FX_SCALE;
    applyFx(life, { h: scaled.health, hp: scaled.happiness, k: scaled.knowledge, s: scaled.social });
    const opt = ['a', 'b', 'c'][idx];
    s.done[pend.id] = { age: life.age, opt };
    s.lastChoiceAge = life.age;
    if (ch.cond === 'friend' || ch.cond === 'reconnect') s.lastContactAge = life.age;
    if (ch.cond === 'reconnect' && opt !== 'c') s.reconnected = true;
    const title = fillT(sText(pend.key), pend.tok);
    const result = fillT(sText(`${pend.key}.${opt}.result`), pend.tok);
    pushStory(life, `「${title}」${automatic ? tx('（自动）', ' (auto)') : ''} ${result}`, ch.icon, 'story');
    (life.storyChoices ||= []).push({ id: pend.id, opt, age: life.age, automatic });
    const fol = sText(`${pend.key}.${opt}.follow`), lat = sText(`${pend.key}.${opt}.later`);
    if (fol) s.follows.push({ age: life.age + 2, key: `${pend.key}.${opt}.follow`, tok: pend.tok, icon: ch.icon });
    if (lat) s.follows.push({ age: life.age + 8, key: `${pend.key}.${opt}.later`, tok: pend.tok, icon: ch.icon });
  }
  function showChapterModal(life, pend) {
    let m = $('#funStoryModal');
    if (!m) {
      m = document.createElement('div');
      m.id = 'funStoryModal';
      m.className = 'modal fun-modal';
      document.body.appendChild(m);
    }
    const ch = CHAPTERS.find(c => c.id === pend.id);
    const wasPaused = !!STATE.paused;
    STATE.paused = true;
    try { syncPauseBtn(); } catch (e) { /* ignore */ }
    const T = (k) => esc(fillT(sText(k), pend.tok));
    m.innerHTML = `<div class="modal-card fun-card fun-story-card">
      <div class="fs-kicker">${ch.icon} ${tx('人生篇章', 'Life chapter')} · ${life.age} ${tx('岁', 'y/o')}</div>
      <h3 class="fs-h">${T(pend.key + '.preludeTitle') || T(pend.key)}</h3>
      <p class="fs-setup">${T(pend.key + '.setup')}</p>
      <p class="fs-prompt"><b>${T(pend.key)}</b><br>${T(pend.key + '.prompt')}</p>
      <div class="fs-opts">${['a', 'b', 'c'].map((o, i) => `<button class="fs-opt" data-i="${i}" type="button"><span class="fs-opt-t">${T(pend.key + '.' + o)}</span><span class="fs-opt-fx">${esc(fxLabel(pend.fx[i] || {}))}</span></button>`).join('')}</div>
      <p class="muted fs-note">${tx('没有标准答案。选择会写进这段人生，几年后还会有回响。', 'No right answer. Your choice is written into this life and echoes years later.')}</p>
    </div>`;
    m.hidden = false;
    m.querySelectorAll('.fs-opt').forEach(b => b.addEventListener('click', () => {
      m.hidden = true;
      if (!life.died) resolveChapter(life, pend, +b.dataset.i, false);
      STATE.paused = wasPaused;
      try { syncPauseBtn(); renderAll(); } catch (e) { /* ignore */ }
    }));
  }
  function otherModalOpen() {
    return !!document.querySelector('.modal:not([hidden]):not(#funStoryModal), #feedbackModal, .life-modal');
  }
  function storyYear(life) {
    if (!STORY || !life || life.died) return;
    const s = st(life);
    if (s.lastAge === life.age) return;
    s.lastAge = life.age;
    // 篇章回响
    const due = s.follows.filter(f => f.age <= life.age);
    if (due.length) {
      s.follows = s.follows.filter(f => f.age > life.age);
      due.forEach(f => pushStory(life, fillT(sText(f.key), f.tok), f.icon, 'story-echo'));
    }
    if (life.age - s.lastChoiceAge < 2) return;
    for (const ch of CHAPTERS) {
      if (s.done[ch.id] || life.age < ch.min || life.age > ch.max) continue;
      if (!eligible(life, ch)) continue;
      // 窗口内平均分布，最后一年必定出现
      if (life.age < ch.max && Math.random() > 1 / (ch.max - life.age + 1) * 1.6) continue;
      if (ch.cond === 'interest' && !s.interest) s.interest = pk(['music', 'drawing', 'making']);
      if (ch.cond === 'friend') friendOf(life);
      const { key, fx } = chapterKey(life, ch);
      if (!sText(key)) continue;
      const pend = { id: ch.id, key, fx, tok: storyTokens(life, ch) };
      if (STATE.autoDecide || STATE.view !== 'life' || STATE.fastForward || otherModalOpen() || life.lastInterruptAge === life.age) resolveChapter(life, pend, 1, true);
      else {
        // 与 app.js 的打断间隔规则共用（tryTriggerDecision 看 lastInterruptAge），避免同一年叠两个视窗
        life.lastInterruptAge = life.age;
        showChapterModal(life, pend);
      }
      return;
    }
  }
  // 日常片段
  const DAILY_ICON = { childhood: '🌧️', study: '📓', friendship: '👫', family: '👪', work: '🗂️', home: '🪴', wellbeing: '🍵', reflection: '🕯️' };
  function dailyCats(age) {
    if (age < 13) return ['childhood', 'childhood', 'family', 'home', 'friendship'];
    if (age < 23) return ['study', 'study', 'friendship', 'family', 'home', 'wellbeing'];
    if (age < 65) return ['work', 'work', 'home', 'family', 'friendship', 'wellbeing', 'reflection'];
    return ['reflection', 'reflection', 'wellbeing', 'family', 'home'];
  }
  function dailyLine(life) {
    const d = sDict();
    if (!d) return null;
    const s = st(life);
    const fam = aliveFamily(life);
    const tok = { person: fam.length ? fam[Math.floor(Math.random() * fam.length)].name : (s.friend?.name || ''), interest: s.interest ? (sText('ui.interest' + s.interest[0].toUpperCase() + s.interest.slice(1)) || '') : '', lastAge: String(s.lastContactAge ?? '') };
    const local = LOCAL_COUNTRIES.includes(life.country) && Math.random() < 0.3;
    const cat = local ? null : pk(dailyCats(life.age));
    const prefix = local ? `s6.local.${life.country}.` : `s6.daily.${cat}.`;
    const keys = Object.keys(d).filter(k => k.startsWith(prefix) && !s.used[k]);
    for (let i = 0; i < 6 && keys.length; i++) {
      const k = keys.splice(Math.floor(Math.random() * keys.length), 1)[0];
      const raw = d[k];
      if (/\{person\}/.test(raw) && !tok.person) continue;
      if (/\{interest\}/.test(raw) && !tok.interest) continue;
      if (/\{lastAge\}/.test(raw) && !tok.lastAge) continue;
      s.used[k] = life.age;
      const text = fillT(raw, tok);
      return { icon: local ? (life.countryData?.flag || '📍') : DAILY_ICON[cat], zh: text, en: text };
    }
    return null;
  }

  /* ------------------------------------------------------------------
     10) v6.15：原创配乐（移植原版 life-audio / country-music，MIT）
     8 首原版原创旋律 + 本仓库为新加坡写的一首；依出生国切换。
     ------------------------------------------------------------------ */
  const TRACKS = {
    CHN: { zh: '窗边的竹', en: 'Bamboo by the window', beat: .72, wave: 'sine', root: 48, notes: [72, 76, 79, 81, 79, 76, 74, 72, 67, 72, 74, 76, 74, 72, 67, 69], chords: [[0, 7, 12], [5, 9, 16], [2, 7, 14], [0, 7, 12]] },
    JPN: { zh: '纸灯笼', en: 'Paper lanterns', beat: .94, wave: 'triangle', root: 45, notes: [69, 71, 76, 78, 76, 71, 69, 66, 64, 66, 69, 71, 69, 66, 64, 66], chords: [[0, 7, 12], [5, 12, 16], [2, 9, 14], [0, 7, 12]] },
    USA: { zh: '黄昏的门廊', en: 'A porch at dusk', beat: .83, wave: 'triangle', root: 48, notes: [67, 72, 76, 74, 72, 67, 64, 67, 69, 72, 76, 79, 76, 72, 69, 67], chords: [[0, 7, 16], [9, 16, 19], [5, 12, 16], [7, 14, 17]] },
    GBR: { zh: '窗上的雨', en: 'Rain on the glass', beat: 1.02, wave: 'sine', root: 50, notes: [74, 77, 81, 79, 77, 74, 72, 69, 70, 74, 77, 76, 74, 70, 69, 72], chords: [[0, 7, 15], [8, 15, 19], [5, 12, 17], [7, 14, 17]] },
    FRA: { zh: '周日的信', en: 'Letters on Sunday', beat: .79, wave: 'triangle', root: 53, notes: [77, 79, 81, 84, 81, 79, 77, 76, 74, 77, 79, 81, 79, 77, 76, 72], chords: [[0, 7, 16], [5, 12, 19], [2, 9, 17], [7, 14, 21]] },
    DEU: { zh: '安静的几何', en: 'Quiet geometry', beat: 1.1, wave: 'sine', root: 48, notes: [72, 67, 76, 67, 74, 67, 79, 67, 72, 69, 76, 69, 74, 67, 71, 67], chords: [[0, 7, 12], [9, 16, 21], [5, 12, 17], [7, 14, 19]] },
    CAN: { zh: '雪后的松林', en: 'Pines after snowfall', beat: .9, wave: 'triangle', root: 43, notes: [67, 71, 74, 78, 74, 71, 69, 67, 64, 67, 71, 74, 71, 67, 66, 62], chords: [[0, 7, 16], [5, 12, 19], [9, 16, 24], [7, 14, 21]] },
    AUS: { zh: '清晨的潮', en: 'Morning tide', beat: .76, wave: 'sine', root: 50, notes: [74, 78, 81, 85, 81, 78, 76, 74, 71, 74, 78, 81, 78, 76, 74, 69], chords: [[0, 7, 16], [5, 12, 21], [9, 16, 24], [7, 14, 19]] },
    SGP: { zh: '花园城市的傍晚', en: 'Garden city evening', beat: .8, wave: 'triangle', root: 50, notes: [74, 76, 78, 81, 83, 81, 78, 76, 74, 78, 81, 83, 86, 83, 81, 78], chords: [[0, 7, 16], [9, 16, 21], [7, 14, 19], [5, 12, 17]] },
  };
  const TRACK_MAP = { TWN: 'CHN', HKG: 'CHN', MAC: 'CHN', KOR: 'JPN', MNG: 'JPN', IRL: 'GBR', BEL: 'FRA', CHE: 'FRA', LUX: 'FRA', AUT: 'DEU', NLD: 'DEU', POL: 'DEU', CZE: 'DEU', NZL: 'AUS', MYS: 'SGP', IDN: 'SGP', THA: 'SGP', VNM: 'SGP', PHL: 'SGP' };
  const trackFor = (code) => TRACKS[code] ? code : (TRACK_MAP[code] || 'USA');
  const Audio = {
    ctx: null, master: null, timer: null, playing: false, track: 'SGP', next: 0, step: 0, nodes: new Set(), volume: 0.22,
    async play() {
      if (this.playing) return true;
      try {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        await this.ctx.resume();
        if (!this.master) { this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination); }
        this.master.gain.setValueAtTime(0, this.ctx.currentTime);
        this.master.gain.linearRampToValueAtTime(1, this.ctx.currentTime + .4);
        this.playing = true; this.next = this.ctx.currentTime + .06; this.step = 0;
        this.schedule();
        this.timer = this.timer || setInterval(() => this.schedule(), 300);
        return true;
      } catch (e) { this.playing = false; return false; }
    },
    note(midi, time, len, gain) {
      const ctx = this.ctx, osc = ctx.createOscillator(), env = ctx.createGain();
      osc.type = TRACKS[this.track].wave;
      osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
      const lv = gain * this.volume;
      env.gain.setValueAtTime(0, time);
      env.gain.linearRampToValueAtTime(lv, time + .25);
      env.gain.exponentialRampToValueAtTime(Math.max(.00001, lv * .5), time + len * .65);
      env.gain.linearRampToValueAtTime(0, time + len);
      osc.connect(env).connect(this.master);
      osc.start(time); osc.stop(time + len + .02);
      this.nodes.add(osc);
      osc.onended = () => { this.nodes.delete(osc); osc.disconnect(); env.disconnect(); };
    },
    schedule() {
      if (!this.playing || document.hidden) return;
      const sc = TRACKS[this.track];
      while (this.next < this.ctx.currentTime + 1.2) {
        if (this.step % 4 === 0) sc.chords[Math.floor(this.step / 4) % 4].forEach(n => this.note(sc.root + n, this.next, sc.beat * 4, .016));
        this.note(sc.notes[this.step % 16], this.next, sc.beat * 1.8, .032);
        this.next += sc.beat; this.step = (this.step + 1) % 16;
      }
    },
    pause() {
      this.playing = false; clearInterval(this.timer); this.timer = null;
      for (const n of this.nodes) { try { n.stop(); } catch (e) { /* ignore */ } }
      this.nodes.clear();
      if (this.ctx) this.ctx.suspend().catch(() => {});
    },
    setTrack(code) {
      const t = trackFor(code);
      if (t === this.track) return;
      this.track = t; this.step = 0;
      if (this.playing) { this.pause(); this.play(); }
    },
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden && Audio.playing) { Audio._resume = true; Audio.pause(); } });
  async function toggleMusic() {
    if (Audio.playing) { Audio.pause(); syncMusicBtn(); try { toast(tx('♪ 配乐已关闭', '♪ Music off')); } catch (e) { /* ignore */ } return; }
    Audio.setTrack(STATE.life?.country || 'SGP');
    const ok = await Audio.play();
    syncMusicBtn();
    const tr = TRACKS[Audio.track];
    try { toast(ok ? `♪ ${tx('原创配乐', 'Original score')}：${tx(tr.zh, tr.en)}` : tx('此浏览器无法播放音频', 'Audio not supported')); } catch (e) { /* ignore */ }
  }
  function syncMusicBtn() {
    const b = $('#btnLifeMusic');
    if (b) { b.classList.toggle('active', Audio.playing); b.title = tx('配乐', 'Music') + (Audio.playing ? ' · ' + tx(TRACKS[Audio.track].zh, TRACKS[Audio.track].en) : ''); }
  }
  // 书架页原本的 ♪ 按钮（220Hz 单音）也改走新配乐
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('#toggleMusicBtn, #btnLifeMusic');
    if (!b) return;
    e.preventDefault(); e.stopImmediatePropagation();
    toggleMusic();
  }, true);

  /* ------------------------------------------------------------------
     11) v6.15：国家对比 + 出生机率（对齐原版 /compare 与 odds 工具）
     ------------------------------------------------------------------ */
  function compareModal(a, b) {
    let m = $('#funCompareModal');
    if (!m) {
      m = document.createElement('div');
      m.id = 'funCompareModal';
      m.className = 'modal fun-modal';
      m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-fun-close]')) m.hidden = true; });
      m.addEventListener('change', (e) => { if (e.target.matches('.fc-sel')) compareModal($('#fcA', m).value, $('#fcB', m).value); });
      m.addEventListener('click', (e) => {
        const sw = e.target.closest('[data-fc-swap]');
        if (sw) compareModal($('#fcB', m).value, $('#fcA', m).value);
        const go = e.target.closest('[data-fc-born]');
        if (go) { m.hidden = true; const c = countryById(go.dataset.fcBorn); if (c) { STATE._funGacha = false; showBirthCertModal(c); } }
      });
      document.body.appendChild(m);
    }
    a = a || 'SGP';
    b = b || (STATE.life && STATE.life.country !== a ? STATE.life.country : 'CHN');
    const A = countryById(a), B = countryById(b);
    if (!A || !B) return;
    const sorted = [...COUNTRIES].sort((x, y) => localize(x).name.localeCompare(localize(y).name, isZh() ? 'zh' : 'en'));
    const opts = (sel) => sorted.map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${c.flag} ${esc(localize(c).name)}</option>`).join('');
    const ra = rarity(A), rb = rarity(B), la = luck(A), lb = luck(B);
    const oneIn = (r) => Math.round(1 / r.share).toLocaleString();
    const num = (v, d = 1) => (v == null || isNaN(v)) ? '—' : (+v).toLocaleString(undefined, { maximumFractionDigits: d });
    const rows = [
      [tx('出生机率', 'Odds of being born here'), `1 / ${oneIn(ra)}`, `1 / ${oneIn(rb)}`, null, null, null, tx('依每年出生人数占全球比例', 'Share of world births per year')],
      [tx('稀有度', 'Rarity'), `<b class="fc-tier" style="--tier:${ra.tier.color}">${ra.tier.id}</b>`, `<b class="fc-tier" style="--tier:${rb.tier.color}">${rb.tier.id}</b>`, null, null],
      [tx('出生运气', 'Birth luck'), la.score, lb.score, la.score, lb.score, 'hi'],
      [tx('预期寿命（岁）', 'Life expectancy'), num(A.le), num(B.le), A.le, B.le, 'hi'],
      [tx('婴儿死亡率（‰）', 'Infant mortality ‰'), num(A.im), num(B.im), A.im, B.im, 'lo'],
      [tx('5 岁前死亡率（‰）', 'Under-5 mortality ‰'), num(A.u5), num(B.u5), A.u5, B.u5, 'lo'],
      [tx('人均 GDP（PPP 美元）', 'GDP per capita (PPP $)'), '$' + num(A.ppp, 0), '$' + num(B.ppp, 0), A.ppp, B.ppp, 'hi'],
      [tx('总和生育率', 'Fertility rate'), num(A.tfr, 2), num(B.tfr, 2), null, null],
      [tx('预期受教育年数', 'Expected years of school'), num(A.eys), num(B.eys), A.eys, B.eys, 'hi'],
      [tx('城市人口比例 %', 'Urban population %'), num(A.urb), num(B.urb), null, null],
      [tx('吸烟率 %', 'Smoking %'), num(A.sm), num(B.sm), A.sm, B.sm, 'lo'],
      [tx('凶杀率（每 10 万）', 'Homicide per 100k'), num(A.hom), num(B.hom), A.hom, B.hom, 'lo'],
      [tx('道路死亡（每 10 万）', 'Road deaths per 100k'), num(A.road), num(B.road), A.road, B.road, 'lo'],
    ];
    const cls = (x, y, dir, me) => { if (x == null || y == null || dir == null || x === y) return ''; const better = dir === 'hi' ? (me === 'a' ? x > y : y > x) : (me === 'a' ? x < y : y < x); return better ? 'fc-win' : ''; };
    m.innerHTML = `<div class="modal-card fun-card fun-compare-card">
      <div class="fun-card-head"><h3>🧭 ${tx('国家对比 · 出生机率', 'Compare countries · Birth odds')}</h3><button class="ghost" data-fun-close>✕</button></div>
      <div class="fc-pick"><select id="fcA" class="fc-sel fun-eth-select">${opts(a)}</select><button class="ghost" data-fc-swap type="button" title="${tx('交换', 'Swap')}">⇄</button><select id="fcB" class="fc-sel fun-eth-select">${opts(b)}</select></div>
      <div class="fc-scroll"><table class="fc-table"><thead><tr><th></th><th>${A.flag} ${esc(localize(A).name)}</th><th>${B.flag} ${esc(localize(B).name)}</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td class="fc-k">${r[0]}${r[6] ? `<div class="fc-sub">${r[6]}</div>` : ''}</td><td class="${cls(r[3], r[4], r[5], 'a')}">${r[1]}</td><td class="${cls(r[3], r[4], r[5], 'b')}">${r[2]}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="fc-actions"><button class="primary" data-fc-born="${A.id}" type="button">${tx('出生在', 'Be born in')} ${A.flag} ${esc(localize(A).name)}</button><button class="ghost" data-fc-born="${B.id}" type="button">${tx('出生在', 'Be born in')} ${B.flag} ${esc(localize(B).name)}</button></div>
      <p class="muted fc-src">${tx('游戏模型参考值（联合国 WPP、世界银行、WHO 等），不代表任何个人的真实人生。较好的一方以绿色标示。', 'Game-model reference values (UN WPP, World Bank, WHO…). Not a prediction of anyone\'s real life. Better value highlighted.')}</p>
    </div>`;
    m.hidden = false;
  }

  /* ------------------------------------------------------------------
     12) 挂钩
     ------------------------------------------------------------------ */
  const _gen2 = window.generateYearlyEvent;
  window.generateYearlyEvent = function (life) {
    // SG 事件已在前一层；这里在原事件池前插入原版叙事的日常片段
    try { if (life && Math.random() < 0.4) { const e = dailyLine(life); if (e) return e; } } catch (err) { /* fall back */ }
    return _gen2.apply(this, arguments);
  };
  const _tick = window.tick;
  window.tick = function () {
    const r = _tick.apply(this, arguments);
    try { if (STATE.life && !STATE.life.died && !STATE.paused) storyYear(STATE.life); } catch (e) { /* ignore */ }
    return r;
  };
  const _wire2 = window.wire;
  window.wire = function () {
    _wire2.apply(this, arguments);
    $('#btnStepYear')?.addEventListener('click', () => {
      if (!STATE.life || STATE.life.died) return;
      if (!STATE.paused) { STATE.paused = true; try { syncPauseBtn(); } catch (e) { /* ignore */ } }
      STATE.paused = false;
      try { window.tick(); } finally { STATE.paused = true; }
      try { syncPauseBtn(); renderAll(); } catch (e) { /* ignore */ }
    });
    syncMusicBtn();
  };
  const _startLife2 = window.startLife;
  window.startLife = function () {
    _startLife2.apply(this, arguments);
    if (STATE.life) Audio.setTrack(STATE.life.country);
  };
  // 意见反馈视窗：加上 Email
  const _fb2 = window.renderFeedbackModal;
  window.renderFeedbackModal = function () {
    _fb2.apply(this, arguments);
    // 原本的「寄出」只存在本机 localStorage —— 补一个直接寄信的按钮，把内容带进邮件
    const send = document.querySelector('#feedbackSend');
    if (send && !document.querySelector('#funFeedbackMail')) {
      send.insertAdjacentHTML('beforebegin', `<button class="ghost" id="funFeedbackMail" type="button">📧 ${tx('用邮件寄给作者', 'Email the author')}</button>`);
      document.querySelector('#funFeedbackMail').addEventListener('click', () => {
        const body = (document.querySelector('#feedbackInput')?.value || '').trim();
        location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(tx('模拟人生 意见反馈', 'Life simulator feedback'))}&body=${encodeURIComponent(body)}`;
      });
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startHans);
  else startHans();

  // 给测试 / 除错用
  window.BornFun = { rarity, luck, todayChallenge, ACHV, CHALLENGES, sgEvent, toHans, achvModal, wechatModal, ethName, compareModal, Audio, TRACKS, storyYear, dailyLine, CHAPTERS, get story() { return STORY; } };
})();
