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
  const tx = (zh, en) => (window.BornXL ? BornXL.t(zh, en) : (isZh() ? zh : en));
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
  /* v6.29：华人忌讳「死」——简体显示时换成较吉祥的说法。
   * 只动显示层（DOM / canvas / 分享文案），资料层与 API 不变。
   * 统计用语（死亡率、死亡机率）与求助提示保留原意，不改。 */
  const SOFT = [
    [/公开追思馆/g, '人生星光馆'], [/公开追思页/g, '星光页'], [/公开追思/g, '人生星光馆'],
    [/追思馆/g, '星光馆'], [/追思页/g, '星光页'], [/最近的追思/g, '最近点亮的人生'], [/可追思的人生/g, '可回顾的人生'], [/追思/g, '星光'],
    [/点一[根支]蜡烛/g, '点亮一颗星'], [/已点 ?(\d+) ?支蜡烛/g, '已点亮 $1 颗星'], [/点过蜡烛/g, '点亮过星星'], [/蜡烛/g, '星星'],
    [/🕯️?/gu, '🌟'],
    [/讣闻/g, '人生谢幕'], [/死亡证书/g, '人生证书'], [/死亡记录/g, '人生记录'],
    [/死亡原因/g, '落幕原因'], [/死因/g, '落幕原因'], [/寿终正寝/g, '福寿双全'],
    [/因 ?([^\s，。]+?) ?离世/g, '因$1走完一生'], [/离世时/g, '人生落幕时'], [/离世/g, '远行'],
    [/去世前/g, '人生最后'], [/去世/g, '远行'], [/过世/g, '离开'], [/逝世/g, '谢幕'],
  ];
  const soften = (s) => { for (const [re, to] of SOFT) s = s.replace(re, to); return s; };
  function toHans(s) {
    if (!t2s || !s || typeof s !== 'string' || !HAN.test(s)) return s;
    let out = convCache.get(s);
    if (out === undefined) {
      try { out = soften(t2s(s)); } catch (e) { out = s; }
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
    const isRandom = STATE.birthPick === 'random';
    const chosen = countryById(isRandom ? lastCountry() : STATE.birthPick) || countryById('SGP');
    document.querySelectorAll('[data-birth-pick]').forEach(b => b.classList.toggle('active', isRandom && b.dataset.birthPick === 'random'));
    const btn = $('#btnStart');
    if (btn) btn.dataset.funPick = STATE.birthPick;
    const lbl = $('#funPickLabel');
    if (lbl) lbl.textContent = tx('出生地', 'Birthplace');
    const rb = $('[data-birth-pick="random"]');
    if (rb) rb.textContent = tx('🎲 随机扭蛋', '🎲 Gacha');
    // v6.21：出生国家可选（常用国家置顶，其余依名称排序）
    const cs = $('#birthCountrySelect');
    if (cs && chosen) {
      if (cs.dataset.lang !== LANG || cs.options.length < 10) {
        const name = (c) => localize(c).name;
        const top = TOP_COUNTRIES.map(countryById).filter(Boolean);
        const rest = COUNTRIES.filter(c => !TOP_COUNTRIES.includes(c.id)).sort((a, b) => name(a).localeCompare(name(b), isZh() ? 'zh-Hans-CN' : undefined));
        const opt = (c) => `<option value="${c.id}">${c.flag} ${esc(name(c))}</option>`;
        cs.innerHTML = `<optgroup label="${tx('常用', 'Popular')}">${top.map(opt).join('')}</optgroup><optgroup label="${tx('全部国家和地区', 'All countries')}">${rest.map(opt).join('')}</optgroup>`;
        cs.dataset.lang = LANG;
      }
      cs.value = chosen.id;
      cs.classList.toggle('active', !isRandom);
      cs.setAttribute('aria-label', tx('出生国家', 'Birth country'));
    }
    const lower = $('#countrySelect');
    if (lower && !isRandom && lower.value !== chosen.id && [...lower.options].some(o => o.value === chosen.id)) { lower.value = chosen.id; STATE.selectedCountry = chosen.id; }
    const hint = $('#funPickHint');
    if (hint && chosen) {
      const nm = localize(chosen).name;
      hint.textContent = isRandom
        ? tx('🎲 扭蛋模式：依真实出生人数比例随机抽出生地（新加坡出生的机率只有约 0.03%）', '🎲 Gacha mode: birthplace drawn by real birth counts')
        : tx(`${chosen.flag} 将出生在${nm} · 预期寿命约 ${Math.round(effectiveLe(chosen, { countryData: chosen, ethnicity: STATE.birthEth && STATE.birthEth !== 'auto' ? STATE.birthEth : null }))} 岁。可以从下拉选单换成任何国家，或切到「随机扭蛋」碰运气`, `${chosen.flag} You'll be born in ${nm}. Pick any country from the list, or switch to gacha.`);
    }
  }
  const TOP_COUNTRIES = ['SGP', 'CHN', 'MYS', 'TWN', 'HKG', 'MAC', 'JPN', 'KOR', 'THA', 'VNM', 'IDN', 'PHL', 'IND', 'USA', 'CAN', 'GBR', 'AUS', 'NZL', 'DEU', 'FRA'];
  const lastCountry = () => { try { return localStorage.getItem('born-somewhere-v2:birthCountry') || 'SGP'; } catch (e) { return 'SGP'; } };
  function setBirthPick(v) {
    const c = v !== 'random' ? countryById(v) : null;
    STATE.birthPick = c ? c.id : 'random';
    try {
      localStorage.setItem('born-somewhere-v2:birthPick', STATE.birthPick);
      if (c) localStorage.setItem('born-somewhere-v2:birthCountry', c.id);
    } catch (e) { /* ignore */ }
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
    const cs = $('#birthCountrySelect');
    if (cs) {
      cs.addEventListener('change', () => setBirthPick(cs.value));
      // 扭蛋模式下点一下下拉选单，就回到「指定国家」
      cs.addEventListener('pointerdown', () => { if (STATE.birthPick === 'random') setBirthPick(cs.value); });
      cs.addEventListener('focus', () => { if (STATE.birthPick === 'random') setBirthPick(cs.value); });
    }
    // 页面下方原有的「或者选一个国家」也同步成出生地
    $('#countrySelect')?.addEventListener('change', (e) => setBirthPick(e.target.value));
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
  // v6.34：一家人的取名规则（父姓／父名制），出生时的家人与之后出生的孩子共用
  function familyGen(eth, c, fname, used) {
    if (eth === 'malay' || eth === 'indian') {
      const fg = fname.split(/ (?:bin|binti|s\/o|d\/o) /)[0];
      used.add(fg);
      return (sex) => ethName(eth, sex, c, fg);
    } else if (eth === 'chinese') {
      const ln = fname.charAt(0);
      const pair = CN_LAST.find(p => p[0] === ln);
      used.add(fname.slice(1));
      return (sex) => {
        const n = ethName(eth, sex, c);
        if (n && pair) { n.last = ln; n.full = ln + n.first; n.full_en = `${n.en_given ? n.en_given + ' ' : ''}${pair[1]} ${n.first_en}`; }
        return n;
      };
    } else {
      // 西式姓氏：跟父亲同姓（拉丁裔取父亲第一个姓 + 随机母姓）
      const parts = fname.split(' ');
      used.add(parts[0]);
      const fl = eth === 'latino' ? parts[1] : parts.slice(1).join(' ');
      return (sex) => {
        const n = ethName(eth, sex, c);
        if (n && fl) { n.last = eth === 'latino' ? `${fl} ${pk(LAT.L)}` : fl; n.full = n.full_en = `${n.first} ${n.last}`; }
        return n;
      };
    }
    return null;
  }
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
      const gen = familyGen(eth, c, fname, used);
      const me = uniq(life.sex, gen);
      if (me) life.name = me;
      (fam.siblings || []).forEach(s => { const sn = uniq(s.sex, gen); if (sn) s.name = sn.full; });
    }
    const rel = ETH_REL[eth];
    if (rel && life.stats) { const r = wpick(rel); life.stats.religion = isEn() ? r[1] : r[0]; }
    return life;
  };

  // v6.34：人生里之后出生的孩子也照家族规则取名（以前是随机的：马来族孩子的 binti 后面不是父亲的名字）
  const _tickKids = window.tick;
  window.tick = function () {
    const r = _tickKids.apply(this, arguments);
    try {
      const L = STATE.life, eth = L && L.ethnicity, fam = L && L.family;
      const kids = fam && fam.kids;
      if (eth && kids && kids.some(k => !k._fn)) {
        const father = L.sex === 'M' ? (L.name && (L.name.full || L.name.full_en)) : (fam.partner && (fam.partner.name || fam.partner.nameEn));
        const used = new Set([L.name && L.name.first, fam.partner && String(fam.partner.name).split(/ (?:bin|binti|s\/o|d\/o) /)[0]].filter(Boolean));
        kids.forEach(k => { if (k._fn) { used.add(String(k.name).split(' ')[0]); } });
        const gen = father ? familyGen(eth, L.countryData, String(father), used) : null;
        const uniq = (sex) => { let n; for (let i = 0; i < 12; i++) { n = gen(sex); if (n && !used.has(n.first)) break; } if (n) used.add(n.first); return n; };
        kids.forEach(k => {
          if (k._fn) return;
          k._fn = 1;
          if (!gen) return;
          const n = uniq(k.sex); if (!n) return;
          const old = k.name;
          k.name = n.full; k.nameEn = n.full_en;
          (L.log || []).forEach(e => { if (e.text && old && e.text.includes(old)) e.text = e.text.split(old).join(n.full); });
        });
      }
    } catch (e) { /* ignore */ }
    return r;
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
  // 姓名可能是字串，也可能是 randomName() 回传的 {full, full_en}（伴侣、孩子就是这样存的）
  const nameStr = (n) => (typeof n === 'string' ? n : (n && (n.full || n.full_en)) || '');
  function storyTokens(life, ch) {
    const s = st(life);
    let person = '';
    if (['friend', 'reconnect', 'repair'].includes(ch.cond)) person = nameStr(friendOf(life).name);
    else if (ch.cond === 'partner') person = nameStr(life.stats.partner?.name);
    else if (['family', 'visit'].includes(ch.cond)) { const p = parentsAlive(life); person = p.length ? nameStr(p[Math.floor(Math.random() * p.length)].name) : ''; }
    else if (ch.cond === 'toy') { const p = aliveFamily(life); person = p.length ? nameStr(p[0].name) : ''; }
    const interestKind = s.interest || 'making';
    return { person: person || tx('家人', 'family'), interest: sText('ui.interest' + interestKind[0].toUpperCase() + interestKind.slice(1)) || '', lastAge: String(s.lastContactAge ?? '') };
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
    const tok = { person: fam.length ? nameStr(fam[Math.floor(Math.random() * fam.length)].name) : nameStr(s.friend?.name), interest: s.interest ? (sText('ui.interest' + s.interest[0].toUpperCase() + s.interest.slice(1)) || '') : '', lastAge: String(s.lastContactAge ?? '') };
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

  /* ------------------------------------------------------------------
     13) v6.16：Azure Application Insights 匿名访问统计
     - 只在正式网域载入（localhost / 档案开启不送）
     - 尊重 Do Not Track / Global Privacy Control，以及隐私视窗里的「关闭统计」
     - 不送姓名、自写文字、IP（App Insights 预设不存 IP，只推估国家/地区）
     ------------------------------------------------------------------ */
  const AI_CONN = 'InstrumentationKey=dd5128b5-1eb1-460d-abd3-ac1b33b93a5e;IngestionEndpoint=https://eastasia-0.in.applicationinsights.azure.com/;LiveEndpoint=https://eastasia.livediagnostics.monitor.azure.com/;ApplicationId=e5071cdd-79a1-4777-bf3b-91e86636ceac';
  const AI_SDK = 'https://js.monitor.azure.com/scripts/b/ai.3.3.4.gbl.min.js';
  const OPTOUT_KEY = 'born-somewhere-v2:analytics-optout';
  let ai = null;
  const aiQueue = [];
  const optedOut = () => { try { return localStorage.getItem(OPTOUT_KEY) === '1'; } catch (e) { return false; } };
  const browserSaysNo = () => navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true;
  const analyticsAllowed = () => !optedOut() && !browserSaysNo() && /^https:$/.test(location.protocol) && !/^(localhost|127\.|\[::1\])/.test(location.hostname);
  function track(name, props) {
    if (!analyticsAllowed()) return;
    const p = Object.assign({ lang: typeof LANG !== 'undefined' ? LANG : '' }, props || {});
    for (const k of Object.keys(p)) p[k] = p[k] == null ? '' : String(p[k]);   // 0 / false 也要送出
    if (ai) { try { ai.trackEvent({ name }, p); } catch (e) { /* ignore */ } } else if (aiQueue.length < 50) aiQueue.push([name, p]);
  }
  function loadAnalytics() {
    if (ai || !analyticsAllowed()) return;
    const s = document.createElement('script');
    s.src = AI_SDK; s.async = true; s.crossOrigin = 'anonymous';
    s.onload = () => {
      try {
        const NS = window.Microsoft && window.Microsoft.ApplicationInsights;
        if (!NS) return;
        ai = new NS.ApplicationInsights({ config: {
          connectionString: AI_CONN,
          disableAjaxTracking: true, disableFetchTracking: true,   // 只要页面与游戏事件，不追踪资料请求
          enableAutoRouteTracking: false, disableExceptionTracking: false,
          samplingPercentage: 100,
        } });
        ai.loadAppInsights();
        ai.addTelemetryInitializer((env) => { env.data = env.data || {}; env.data.lang = typeof LANG !== 'undefined' ? LANG : ''; env.data.app = APP_VERSION; });
        ai.trackPageView({ name: 'home' });
        aiQueue.splice(0).forEach(([n, p]) => ai.trackEvent({ name: n }, p));
      } catch (e) { ai = null; }
    };
    document.head.appendChild(s);
  }
  window.addEventListener('load', () => setTimeout(loadAnalytics, 1200));
  // 游戏事件（只含国家代码、模式、年龄等匿名栏位）
  const _startLife3 = window.startLife;
  window.startLife = function (code) {
    _startLife3.apply(this, arguments);
    const L = STATE.life;
    if (L) track('life_start', { country: L.country, pick: STATE.birthPick, sex: L.sex, ethnicity: L.ethnicity || 'auto', era: STATE.era, rarity: rarity(L.countryData).tier.id });
  };
  const _die3 = window.dieNow;
  window.dieNow = function () {
    const L = STATE.life;
    const alive = L && !L.died;
    _die3.apply(this, arguments);
    if (alive && L.died) track('life_end', { country: L.country, age: L.deathAge, chapters: Object.keys(L._story?.done || {}).length, dailyOk: !!L._fun?.dailyOk, newAchievements: (L._fun?.fresh || []).length });
  };
  document.addEventListener('click', (e) => {
    const el = e.target.closest && e.target.closest('[data-fun-compare],[data-fun-wechat],[data-fun-achv],#btnLifeMusic,#funFeedbackMail,#btnContact,.fs-opt');
    if (!el) return;
    const name = el.matches('[data-fun-compare]') ? 'open_compare' : el.matches('[data-fun-wechat]') ? 'open_wechat' : el.matches('[data-fun-achv]') ? 'open_achievements'
      : el.id === 'btnLifeMusic' ? 'toggle_music' : el.id === 'funFeedbackMail' ? 'feedback_email' : el.id === 'btnContact' ? 'contact_email' : 'chapter_choice';
    track(name, name === 'chapter_choice' ? { option: ['a', 'b', 'c'][+el.dataset.i] || '' } : {});
  }, true);
  // 隐私视窗：可关闭统计
  const _priv = window.renderPrivacyModal;
  if (typeof _priv === 'function') {
    window.renderPrivacyModal = function () {
      _priv.apply(this, arguments);
      const box = document.querySelector('#privacyModal .legal-helpline');
      if (!box || document.querySelector('#funOptOut')) return;
      const dnt = browserSaysNo();
      box.insertAdjacentHTML('beforebegin', `<p class="fun-optout"><label><input type="checkbox" id="funOptOut" ${optedOut() || dnt ? '' : 'checked'} ${dnt ? 'disabled' : ''}> ${tx('允许匿名访问统计（帮助我改进游戏）', 'Allow anonymous usage statistics (helps improve the game)')}</label>${dnt ? `<br><span class="muted">${tx('你的浏览器已开启「请勿追踪」，统计不会载入。', 'Your browser sends Do Not Track, so statistics never load.')}</span>` : ''}</p>`);
      document.querySelector('#funOptOut').addEventListener('change', (e) => {
        try { localStorage.setItem(OPTOUT_KEY, e.target.checked ? '0' : '1'); } catch (err) { /* ignore */ }
        if (!e.target.checked && ai) { try { ai.config.disableTelemetry = true; } catch (err) { /* ignore */ } }
        if (e.target.checked) { if (ai) { try { ai.config.disableTelemetry = false; } catch (err) { /* ignore */ } } else loadAnalytics(); }
        try { toast(e.target.checked ? tx('已开启匿名统计', 'Statistics on') : tx('已关闭统计', 'Statistics off')); } catch (err) { /* ignore */ }
      });
    };
  }

  /* ------------------------------------------------------------------
     14) v6.17：ZenMatrix 公司宣传（www.zenmatrix.org）
     ------------------------------------------------------------------ */
  const ZM_URL = (medium) => `https://www.zenmatrix.org/?utm_source=born-somewhere&utm_medium=referral&utm_campaign=${medium}`;
  function zmCard(medium) {
    return `<a class="fun-zm" href="${ZM_URL(medium)}" target="_blank" rel="noopener" data-zm="${medium}">
      <span class="zm-logo"><img src="assets/zenmatrix-logo.jpg" alt="ZenMatrix" width="150" height="78" loading="lazy" decoding="async"></span>
      <span class="zm-body">
        <span class="zm-k">${tx('本游戏由 ZenMatrix 制作', 'Made by ZenMatrix')}</span>
        <b class="zm-name">${tx('平衡科技', 'Balance in Technology')}</b>
        <span class="zm-desc">${tx('云端、AI 与软件顾问 · ZenERP 云端会计 · Microsoft 授权 · 移动应用', 'Cloud, AI & software consulting · ZenERP cloud accounting · Microsoft licensing · Mobile apps')}</span>
      </span>
      <span class="zm-go">www.zenmatrix.org →</span>
    </a>`;
  }
  function renderZm() {
    const intro = $('#funIntroPanel');
    if (intro && !$('#funZmIntro')) { intro.insertAdjacentHTML('afterend', `<div id="funZmIntro">${zmCard('home')}</div>`); }
    else if ($('#funZmIntro')) $('#funZmIntro').innerHTML = zmCard('home');
    const footerLink = $('#funZmFooter');
    if (footerLink) footerLink.innerHTML = `<img class="zm-coin" src="assets/zenmatrix-coin-96.png" alt="" width="18" height="18">${esc(tx('ZenMatrix 出品', 'By ZenMatrix'))} · www.zenmatrix.org`;
  }
  const _ri4 = window.renderIntro;
  window.renderIntro = function () { _ri4.apply(this, arguments); try { renderZm(); } catch (e) { /* ignore */ } };
  const _re4 = window.renderEnd;
  window.renderEnd = function () {
    _re4.apply(this, arguments);
    try {
      const view = $('#view-end');
      if (view) { $('#funZmEnd')?.remove(); view.insertAdjacentHTML('beforeend', `<div id="funZmEnd" class="fun-zm-end">${zmCard('obituary')}</div>`); }
    } catch (e) { /* ignore */ }
  };
  // 反馈 / 微信视窗：加官网（视窗是动态建立的，用 MutationObserver 补上）

  const addZmToWechat = () => {
    document.querySelectorAll('.fun-wechat .fw-text').forEach(el => {
      if (el.querySelector('.fw-site')) return;
      el.insertAdjacentHTML('beforeend', `<span class="fw-site">🏢 <a href="${ZM_URL('feedback')}" target="_blank" rel="noopener" data-zm="feedback">www.zenmatrix.org</a></span>`);
    });
  };
  new MutationObserver(addZmToWechat).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('[data-zm], #funZmFooter');
    if (a) track('open_zenmatrix', { from: a.dataset.zm || 'footer' });
  }, true);


  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startHans);
  else startHans();

  // 给测试 / 除错用
  /* ------------------------------------------------------------------
     v6.22：死因说明 —— 为什么会这样？怎么预防？
     结束页在「死亡原因分析」上方加一张卡：这个死因是什么、这一生里有哪些因素推高了它、
     现实中可以怎么预防。80 岁以上的「其他／自然衰老」改称「寿终正寝」。
     ------------------------------------------------------------------ */
  const _pickCause = window.pickCause;
  window.pickCause = function (c, age) {
    const k = _pickCause.apply(this, arguments);
    return (age >= 80 && k === '其他') ? '壽終正寢' : k;
  };
  const _die5 = window.dieNow;
  window.dieNow = function (forced) {
    const L = STATE.life;
    if (forced === '自然衰老' && L && L.age >= 80) return _die5.call(this, '壽終正寢');
    return _die5.apply(this, arguments);
  };
  const CAUSE_INFO = {
    '壽終正寢': { i: '🕊️', zh: ['走完了完整的一生，身体自然老去，安详地离开。这是大多数人心中最好的结局。', ['保持规律作息、适量运动和社交，让晚年过得有质量', '定期体检，慢性病早发现早控制', '想说的话、想做的事趁早完成，不留遗憾']], en: ['A full life, ending peacefully as the body aged. For most people this is the best ending there is.', ['Keep active, sleep well and stay social', 'Regular check-ups to catch chronic disease early', 'Say and do the things that matter while you can']] },
    '自然衰老': { i: '🕊️', zh: ['身体机能随年龄自然衰退。', ['规律运动、均衡饮食', '定期体检', '保持社交与兴趣']], en: ['The body wore out with age.', ['Exercise and eat well', 'Regular check-ups', 'Stay social and curious']] },
    '其他': { i: '🩺', zh: ['包括肾病、肝病、消化系统疾病、并发症等较少见的原因，合起来也占不小的比例。', ['每年体检，留意血压、血糖、肝肾功能', '身体持续异常（疼痛、消瘦、出血）尽早就医', '不滥用药物和酒精']], en: ['A mix of less common causes: kidney, liver and digestive disease, complications and more.', ['Yearly check-ups (blood pressure, sugar, liver and kidney)', 'See a doctor early for persistent symptoms', 'Avoid misuse of alcohol and medicines']] },
    '心血管': { i: '❤️', zh: ['心脏病与血管疾病，是全世界第一大死因。高血压、高胆固醇、吸烟、肥胖、缺乏运动、长期压力都会让风险一点点累积。', ['定期量血压、验血脂和血糖，有问题按医嘱服药', '戒烟、少盐少油、多蔬果，保持健康体重', '每周至少 150 分钟中等强度运动', '认得胸痛、呼吸困难等心梗征兆，立刻求医']], en: ['Heart and blood-vessel disease is the world\'s leading cause of death. Blood pressure, cholesterol, smoking, weight, inactivity and stress all add up.', ['Check blood pressure, lipids and sugar; take prescribed meds', 'Quit smoking, eat less salt and fat, more vegetables', '150 minutes of moderate exercise a week', 'Know the warning signs of a heart attack and act fast']] },
    '中風': { i: '🧠', zh: ['脑部血管阻塞或破裂。最大的危险因素是高血压，其次是吸烟、糖尿病、心房颤动。', ['控制血压是最有效的预防', '戒烟限酒、控制血糖', '记住「中风 120」：脸歪、手臂无力、说话不清，立刻打急救电话']], en: ['A blocked or burst blood vessel in the brain. High blood pressure is the biggest risk, then smoking, diabetes and atrial fibrillation.', ['Control blood pressure: the single best prevention', 'Quit smoking, limit alcohol, manage blood sugar', 'FAST: face, arm, speech, time to call emergency services']] },
    '癌症': { i: '🎗️', zh: ['细胞失控增生。年龄越大风险越高；吸烟、饮酒、肥胖、某些感染（乙肝、HPV）与环境致癌物都会增加风险。', ['不吸烟是最重要的一步，也避开二手烟', '接种乙肝与 HPV 疫苗', '按年龄做筛查：大肠镜、乳房摄影、子宫颈抹片、低剂量肺 CT 等', '少吃加工肉、控制体重、做好防晒']], en: ['Cells growing out of control. Risk rises with age; smoking, alcohol, obesity, some infections (hepatitis B, HPV) and carcinogens add to it.', ['Don\'t smoke, and avoid second-hand smoke', 'Get hepatitis B and HPV vaccines', 'Age-based screening: colonoscopy, mammogram, Pap test, lung CT', 'Less processed meat, healthy weight, sun protection']] },
    '呼吸系統': { i: '🫁', zh: ['慢性阻塞性肺病（COPD）、肺炎等。吸烟、空气污染、烧柴煮饭的室内烟雾是主要原因。', ['戒烟，远离二手烟', '空气差时戴口罩、减少户外活动', '老人每年打流感疫苗，65 岁以上接种肺炎球菌疫苗']], en: ['COPD, pneumonia and similar. Smoking, air pollution and indoor smoke from cooking fires are the main drivers.', ['Quit smoking and avoid second-hand smoke', 'Mask up and stay in on bad-air days', 'Yearly flu shots; pneumococcal vaccine after 65']] },
    '糖尿病': { i: '🩸', zh: ['血糖长期过高，会伤害心、肾、眼睛和神经。肥胖、久坐、高糖饮食与家族史是主要风险。', ['少喝含糖饮料，多吃全谷物与蔬菜', '规律运动、控制腰围', '40 岁后每年验血糖；确诊后按时服药、定期复诊']], en: ['Long-term high blood sugar damages the heart, kidneys, eyes and nerves. Weight, inactivity, sugary diets and family history raise the risk.', ['Cut sugary drinks; eat whole grains and vegetables', 'Exercise regularly and watch your waistline', 'Yearly glucose test after 40; follow treatment if diagnosed']] },
    '感染性疾病': { i: '🦠', zh: ['肺炎、腹泻、结核、艾滋病等。在医疗资源不足、饮水卫生差的地方尤其致命。', ['按时接种疫苗', '勤洗手、喝干净的水', '发烧不退、腹泻脱水要及早就医', '安全性行为，必要时做 HIV 检测']], en: ['Pneumonia, diarrhoea, TB, HIV and more. Deadliest where clean water and healthcare are scarce.', ['Stay up to date on vaccines', 'Wash hands; drink safe water', 'Seek care early for persistent fever or dehydration', 'Safer sex and HIV testing']] },
    '瘧疾': { i: '🦟', zh: ['由蚊子传播的寄生虫病，在热带非洲最常见，5 岁以下儿童最危险。', ['睡觉挂药浸蚊帐', '住所喷防蚊药、清除积水', '发烧尽快验疟疾并治疗；高风险地区可预防性服药']], en: ['A mosquito-borne parasite, most common in tropical Africa and deadliest for children under 5.', ['Sleep under insecticide-treated nets', 'Indoor spraying; remove standing water', 'Test and treat fever quickly; preventive drugs in high-risk areas']] },
    '事故': { i: '🚗', zh: ['交通事故、跌倒、烧烫伤、中毒等，是年轻人最常见的死因之一；道路越危险的国家越多。', ['系安全带、骑车戴头盔、不酒驾、开车不看手机', '家里装扶手和防滑垫，预防老人跌倒', '危险物品放在孩子拿不到的地方']], en: ['Road crashes, falls, burns, poisoning. A top killer of young people, especially where roads are dangerous.', ['Seatbelts, helmets, no drink-driving, no phone at the wheel', 'Grab bars and non-slip mats to prevent falls', 'Keep hazards out of children\'s reach']] },
    '溺水': { i: '🌊', zh: ['儿童最常见的意外死因之一，往往安静而迅速地发生。', ['孩子在水边一定要有大人「盯着」，而不只是「在附近」', '学游泳，水池加围栏', '不在没有救生员的野外水域游泳']], en: ['One of the most common accidental deaths for children, and it happens quickly and quietly.', ['Active adult supervision near water', 'Learn to swim; fence pools', 'Avoid unguarded open water']] },
    '周產期問題': { i: '👶', zh: ['早产、出生时缺氧、新生儿感染等，和产检、接生条件高度相关。', ['怀孕期间定期产检', '在有专业人员的医院分娩', '新生儿保暖、母乳喂养、按时接种疫苗']], en: ['Prematurity, birth asphyxia, newborn infections. Strongly tied to prenatal care and delivery conditions.', ['Regular prenatal check-ups', 'Give birth with skilled attendants', 'Keep newborns warm, breastfeed, vaccinate']] },
    '先天異常': { i: '🧬', zh: ['出生时就有的结构或功能异常，例如先天性心脏病。部分可以预防或治疗。', ['孕前与孕早期补充叶酸', '孕期避免烟酒与不明药物', '做产前筛检；很多先天性心脏病可以手术矫正']], en: ['Conditions present from birth, such as congenital heart defects. Some can be prevented or treated.', ['Folic acid before and in early pregnancy', 'No smoking, alcohol or unprescribed drugs in pregnancy', 'Prenatal screening; many heart defects can be repaired']] },
    '嬰兒猝死': { i: '🍼', zh: ['一岁以下婴儿在睡眠中突然离世，原因仍不完全清楚。', ['让婴儿仰睡，睡在自己的婴儿床', '床上不放枕头、厚被、玩偶', '室内不吸烟，避免过热']], en: ['Sudden unexplained death of an infant during sleep.', ['Back to sleep, in their own cot', 'No pillows, duvets or toys in the cot', 'Smoke-free home; avoid overheating']] },
    '營養不良': { i: '🍚', zh: ['长期吃不饱或营养不均衡，使身体抵抗力下降，多发生在贫困与粮食不足的地区。', ['孩子出生头六个月纯母乳喂养', '补充维生素 A、铁、锌等微量营养素', '定期测量孩子身高体重']], en: ['Not enough food or the wrong balance, weakening the body. Concentrated where poverty and food shortages are.', ['Exclusive breastfeeding for six months', 'Micronutrients: vitamin A, iron, zinc', 'Regular growth checks for children']] },
    '自殺': { i: '💛', zh: ['许多人在最痛苦的时候，看不到其他出路。但这种状态是可以被陪伴、被治疗的。', ['留意身边人的变化：退缩、说绝望的话、交代后事', '主动问一句「你还好吗？」，认真倾听', '心理困扰可以就医，就像身体生病一样', '新加坡 SOS 热线 1767；中国大陆心理援助热线 12356']], en: ['In their darkest moments many people can\'t see another way out. That state can be supported and treated.', ['Notice changes: withdrawal, hopeless talk, giving things away', 'Ask "are you okay?" and really listen', 'Mental health care is real health care', 'Reach a local crisis line (e.g. 988 in the US, 1767 in Singapore)']] },
    '他殺': { i: '🕯️', zh: ['人际暴力，和所在地的治安、贫富差距、枪支与帮派有关。', ['远离暴力冲突与危险场所', '家暴不是家务事，可以求助与报警', '社区与教育投入能长期降低暴力']], en: ['Interpersonal violence, tied to local safety, inequality, guns and gangs.', ['Avoid violent situations and places', 'Domestic violence is not private; seek help', 'Community and education reduce violence over time']] },
    '戰爭/衝突': { i: '🕊️', zh: ['出生在战乱或冲突地区，个人很难选择。', ['尽量远离冲突区域，寻求人道援助', '关注与支持和平与难民援助', '这一生让我们看到：和平本身就是一种幸运']], en: ['Born where war or conflict is happening, which no one chooses.', ['Move away from conflict zones; seek humanitarian aid', 'Support peace and refugee relief', 'Peace itself is a kind of luck']] },
    '自行結束': { i: '⏹️', zh: ['你在中途按下了结束。随时可以再来一次，看看另一种人生。', ['再出生一次，试试不同的国家', '或者让这一生自然走完']], en: ['You ended this life early. You can always start another.', ['Be born again somewhere else', 'Or let a life run its full course']] },
  };
  function causeFactors(life) {
    const c = life.countryData || {}, k = life.cause, age = life.deathAge ?? life.age, out = [];
    const nm = (typeof localize === 'function' && c.id) ? localize(c).name : '';
    const add = (zh, en) => out.push(tx(zh, en));
    if (life.smoker && ['癌症', '心血管', '呼吸系統', '中風'].includes(k)) add('这一生有吸烟习惯，风险约高出 30–50%', 'This person smoked, raising the risk by roughly 30–50%');
    if (life.conditions?.diabetes && ['糖尿病', '心血管', '中風'].includes(k)) add('本身有糖尿病', 'Had diabetes');
    if (life.conditions?.heart && ['心血管', '中風'].includes(k)) add('本身有心脏病史', 'Had a history of heart disease');
    if ((c.sm || 0) > 30 && ['癌症', '心血管', '呼吸系統'].includes(k)) add(`${nm}的吸烟率高（${c.sm}%），二手烟也多`, `High smoking rate in ${nm} (${c.sm}%)`);
    if ((c.road || 0) > 15 && k === '事故') add(`${nm}的道路交通死亡率偏高（每 10 万人 ${c.road}）`, `Dangerous roads in ${nm} (${c.road} per 100k)`);
    if ((c.hom || 0) > 5 && k === '他殺') add(`${nm}的凶杀率偏高（每 10 万人 ${c.hom}）`, `High homicide rate in ${nm} (${c.hom} per 100k)`);
    if ((c.hiv || 0) > 1 && k === '感染性疾病') add(`${nm}的 HIV 感染率较高（${c.hiv}%）`, `High HIV prevalence in ${nm} (${c.hiv}%)`);
    if ((c.mal || 0) > 0.5 && k === '瘧疾') add(`${nm}是疟疾流行区`, `${nm} is a malaria-endemic area`);
    if ((c.u5 || 0) > 30 && age < 5) add(`${nm}的 5 岁以下儿童死亡率是每千人 ${c.u5}，医疗与卫生条件有限`, `Under-5 mortality in ${nm} is ${c.u5} per 1,000`);
    if (life.stats?.birthPlaceType === 'rural' && age < 15 && ['感染性疾病', '周產期問題', '營養不良', '瘧疾'].includes(k)) add('出生在乡村，离医院比较远', 'Born rural, far from hospitals');
    if ((life.stats?.incomeQuartile || 4) <= 1 && age < 50 && k !== '自行結束') add('家境较困难，看病与营养都受限', 'A poorer household, with less access to care and nutrition');
    if (typeof life.stats?.health === 'number' && life.stats.health < 35 && age >= 30 && k !== '自行結束') add(`去世前健康值只剩 ${Math.round(life.stats.health)}`, `Health had dropped to ${Math.round(life.stats.health)}`);
    if (age >= 70 && k !== '自行結束') add(`活到 ${age} 岁，年龄本身就是最大的风险因素`, `At ${age}, age itself is the biggest risk factor`);
    return out;
  }
  function causeCard(life) {
    const k = life.cause; const info = CAUSE_INFO[k] || CAUSE_INFO['其他'];
    const [what, tips] = isZh() ? info.zh : info.en;
    const f = causeFactors(life);
    const label = typeof causeLabel === 'function' ? causeLabel(k) : k;
    return `<div class="fun-cause" id="funCause">
      <h3>${info.i} ${tx('为什么会这样？', 'Why did this happen?')} <span class="fun-cause-k">${esc(label)}</span></h3>
      <p>${esc(what)}</p>
      ${f.length ? `<h4>${tx('这一生里的影响因素', 'What played a part in this life')}</h4><ul>${f.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <h4>${tx('现实中可以怎么预防', 'How to lower the risk in real life')}</h4>
      <ul class="fun-cause-tips">${tips.map(x => `<li>✅ ${esc(x)}</li>`).join('')}</ul>
      <p class="muted fun-cause-note">${tx('依世界卫生组织等公开资料整理，仅供参考，不能替代医生的建议。', 'Based on WHO and other public sources. General information, not medical advice.')}</p>
    </div>`;
  }
  /* v6.28：健康分析 + 长寿建议
   * 依这一生的资料（吸烟、慢性病、人际、婚姻、幸福、教育、收入、健康焦点、国家）
   * 逐项评估，并用公开研究的大致数字估算「可改变的因素」影响几年寿命。 */
  function healthReport(life) {
    const s = life.stats || {}, c = life.countryData || {}, age = life.deathAge ?? life.age;
    const le = typeof effectiveLe === 'function' ? Math.round(effectiveLe(c, life)) : Math.round(c.le || 75);
    const traj = (life.trajectory || []).filter(p => typeof p.health === 'number');
    const healthYears = (life.log || []).filter(e => e.kind === 'focus' && /健康|養生|Health|healthy|🧘|🏃|🥗/i.test((e.text || '') + ' ' + (e.icon || ''))).length;   // v6.36：其他语言的文字也算得到（看图示）
    const kids = Array.isArray(s.kids) ? s.kids.length : (s.kids || 0);
    const items = []; // {g:'good'|'warn'|'bad', icon, title, text, yrs (+ 有利 / − 不利), fix(可改变)}
    const add = (g, icon, title, text, yrs, fix) => items.push({ g, icon, title, text, yrs, fix });
    if (life.smoker) add('bad', '🚬', tx('吸烟', 'Smoking'), tx('长期吸烟平均减寿约 10 年；40 岁前戒烟，几乎能把这 10 年全部赚回来。', 'Smoking costs about 10 years on average; quitting before 40 wins back almost all of it.'), -10, true);
    else add('good', '🚭', tx('不吸烟', 'Non-smoker'), tx('一辈子不吸烟，是这一生最大的健康资产之一。', 'Never smoking is one of the biggest health assets in this life.'), 0, false);
    if (life.conditions?.diabetes) add('bad', '🩸', tx('糖尿病', 'Diabetes'), tx('糖尿病约减寿 6 年。控制血糖、体重、定期检查眼睛、肾脏与足部，可以大幅降低并发症。', 'Diabetes costs about 6 years. Controlling sugar and weight, and checking eyes, kidneys and feet, cuts complications a lot.'), -6, true);
    if (life.conditions?.heart) add('bad', '❤️‍🩹', tx('心脏病史', 'Heart disease'), tx('按时吃药、控制血压与血脂、做心脏复健，复发风险可降低约三成。', 'Taking medicine, controlling blood pressure and cholesterol, and cardiac rehab cut recurrence by about a third.'), -5, true);
    const soc = s.social ?? 50;
    if (soc >= 65) add('good', '🤝', tx('人际关系好', 'Strong relationships'), tx(`人际值 ${Math.round(soc)}。研究发现，社交关系紧密的人存活率高约 50%，效果和戒烟相当。`, `Social score ${Math.round(soc)}. People with strong ties have ~50% better survival, similar to quitting smoking.`), +3, false);
    else if (soc < 40) add('warn', '🫂', tx('比较孤单', 'Lonely'), tx(`人际值只有 ${Math.round(soc)}。长期孤独的伤害约等于每天抽 15 支烟。多见朋友、参加社团或做义工都有帮助。`, `Social score only ${Math.round(soc)}. Chronic loneliness is about as harmful as 15 cigarettes a day. Friends, clubs and volunteering help.`), -3, true);
    if (s.married || s.partner) add('good', '💑', tx('有伴侣', 'Had a partner'), tx('有稳定伴侣的人平均更长寿，彼此提醒看病、吃药、少冒险。', 'People with a stable partner tend to live longer — they remind each other to see doctors and take fewer risks.'), +2, false);
    const hap = s.happiness ?? 50;
    if (hap < 35) add('warn', '😔', tx('压力与情绪', 'Stress and mood'), tx(`幸福值只有 ${Math.round(hap)}。长期压力会推高血压和心脏病风险。规律睡眠、运动、找人倾诉，必要时看心理医生。`, `Happiness only ${Math.round(hap)}. Long-term stress raises blood pressure and heart risk. Sleep, exercise, talk to someone, see a professional if needed.`), -2, true);
    else if (hap >= 70) add('good', '😊', tx('心情开朗', 'Good mood'), tx(`幸福值 ${Math.round(hap)}。乐观的人心血管疾病风险较低，平均多活几年。`, `Happiness ${Math.round(hap)}. Optimistic people have lower heart risk and tend to live longer.`), +2, false);
    if (healthYears >= 3) add('good', '🧘', tx('照顾身体', 'Took care of health'), tx(`有 ${healthYears} 年把重心放在健康。每周 150 分钟运动，平均可多活约 3–4 年。`, `${healthYears} years focused on health. 150 minutes of exercise a week adds about 3–4 years.`), +3, false);
    else add('warn', '🏃', tx('运动不足', 'Not enough exercise'), tx(`这一生只有 ${healthYears} 年把重心放在健康。规律运动（每周 150 分钟快走）平均可多活约 3–4 年。`, `Only ${healthYears} years focused on health. Regular exercise (150 min brisk walking a week) adds about 3–4 years.`), 0, true);
    const edu = s.education ?? 0;
    if (edu >= 16) add('good', '🎓', tx('教育程度高', 'Well educated'), tx('受教育越多，越懂得预防、越会找到好的医疗资源。', 'More education means better prevention and better access to care.'), +2, false);
    else if (edu < 9 && age >= 18) add('warn', '📚', tx('教育机会少', 'Little schooling'), tx('教育较少的人平均寿命短几年，主要是健康知识与工作环境的差别。多了解健康资讯一样有用。', 'Less schooling is linked to a few years shorter life, mostly through health knowledge and working conditions.'), -2, false);
    if ((s.incomeQuartile || 4) <= 1) add('warn', '💰', tx('经济压力', 'Financial strain'), tx('收入低的人看病少、营养差、压力大。善用公共医疗、免费体检与疫苗。', 'Low income means less care, worse food and more stress. Use public healthcare, free screenings and vaccines.'), -3, false);
    const ctry = (typeof localize === 'function' && c.id) ? localize(c).name : '';
    if (le >= 82) add('good', '🌏', tx(`生在${ctry}`, `Born in ${ctry}`), tx(`${ctry}预期寿命约 ${le} 岁，医疗与公共卫生条件好。`, `Life expectancy in ${ctry} is about ${le}; healthcare is good.`), 0, false);
    else if (le < 70) add('warn', '🌍', tx(`生在${ctry}`, `Born in ${ctry}`), tx(`${ctry}预期寿命约 ${le} 岁，医疗资源有限。干净饮水、疫苗、蚊帐与安全驾驶影响最大。`, `Life expectancy in ${ctry} is about ${le}. Clean water, vaccines, bed nets and road safety matter most.`), 0, false);

    const gain = Math.min(20, items.filter(x => x.fix && x.yrs < 0).reduce((a, x) => a - x.yrs, 0) + (healthYears < 3 ? 3 : 0));
    const diff = age - le;
    let score = 60 + items.reduce((a, x) => a + (x.g === 'good' ? 6 : x.g === 'bad' ? -12 : -5), 0);
    score = Math.max(5, Math.min(100, Math.round(score)));
    const grade = score >= 80 ? tx('优秀', 'Excellent') : score >= 60 ? tx('良好', 'Good') : score >= 40 ? tx('一般', 'Fair') : tx('需要注意', 'Needs care');
    // 健康曲线
    let spark = '';
    if (traj.length >= 2) {
      const W = 300, Hh = 70, maxA = Math.max(...traj.map(p => p.age), 1);
      const pts = traj.map(p => `${(p.age / maxA * (W - 10) + 5).toFixed(1)},${(Hh - 5 - Math.max(0, Math.min(100, p.health)) / 100 * (Hh - 10)).toFixed(1)}`).join(' ');
      const low = traj.reduce((a, p) => p.health < a.health ? p : a, traj[0]);
      spark = `<div class="fun-hr-chart"><svg viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/></svg>
        <div class="fun-hr-axis"><span>0</span><span>${tx('健康值的一生变化', 'Health over the life')} · ${tx('最低', 'lowest')} ${Math.round(low.health)}（${low.age} ${tx('岁', 'y')}）</span><span>${maxA}</span></div></div>`;
    }
    // 个人化建议：先列出这一生的问题，再补共通的长寿习惯
    const recs = [];
    if (life.smoker) recs.push(tx('戒烟：任何年纪戒都有用，戒烟门诊和尼古丁替代品能让成功率翻倍。', 'Quit smoking: it helps at any age; quit clinics and nicotine replacement double success.'));
    if (life.conditions?.diabetes || life.conditions?.heart) recs.push(tx('慢性病：每 3–6 个月复诊，血压 < 130/80、糖化血色素 < 7%。', 'Chronic illness: check-ups every 3–6 months; blood pressure < 130/80, HbA1c < 7%.'));
    if (soc < 40) recs.push(tx('每周至少和朋友或家人见面一次，加入一个兴趣团体。', 'See friends or family at least once a week; join a group you enjoy.'));
    if (hap < 35) recs.push(tx('每天留 15 分钟给自己：散步、晒太阳、写下三件感恩的事。', 'Give yourself 15 minutes a day: a walk, some sun, three things you\'re grateful for.'));
    if (healthYears < 3) recs.push(tx('每周快走 150 分钟，加上 2 次肌力训练；久坐每小时起来动 5 分钟。', 'Brisk walk 150 min a week plus 2 strength sessions; get up 5 minutes every hour.'));
    const base = [
      tx('吃得像地中海：多蔬果、全谷、豆类、鱼，少加工肉、少糖、少盐。', 'Eat Mediterranean-style: vegetables, whole grains, beans, fish; less processed meat, sugar and salt.'),
      tx('每晚睡 7–9 小时。', 'Sleep 7–9 hours a night.'),
      tx('少喝酒，最好不喝。', 'Drink little alcohol, ideally none.'),
      tx('40 岁起每年量血压、血糖、血脂；按年龄做癌症筛检（大肠、乳房、子宫颈）。', 'From 40, check blood pressure, sugar and cholesterol yearly; do age-appropriate cancer screening.'),
      tx('打疫苗：流感、肺炎链球菌、带状疱疹、HPV。', 'Get vaccinated: flu, pneumococcal, shingles, HPV.'),
      tx('系安全带、骑车戴头盔，不酒驾。', 'Seat belts, helmets, never drink and drive.'),
    ];
    if (c.id === 'SGP') base.push(tx('新加坡居民可以参加 Healthier SG，免费做健康筛检。', 'Singapore residents can join Healthier SG for free health screening.'));
    const allRecs = recs.concat(base).slice(0, 8);
    const verdict = diff >= 5 ? tx(`比${ctry}的预期寿命多活了 ${diff} 年 🎉`, `${diff} years beyond ${ctry}'s life expectancy 🎉`)
      : diff <= -5 ? tx(`比${ctry}的预期寿命少了 ${-diff} 年`, `${-diff} years short of ${ctry}'s life expectancy`)
      : tx(`和${ctry}的预期寿命差不多`, `About ${ctry}'s life expectancy`);
    return `<div class="fun-hr" id="funHealth">
      <h3>🩺 ${tx('健康分析', 'Health report')}</h3>
      <div class="fun-hr-top">
        <div class="fun-hr-score ${score >= 60 ? "" : score >= 40 ? "mid" : "low"}"><b>${score}</b><small>${grade}</small></div>
        <div><div>${tx('活到', 'Lived to')} <b>${age}</b> ${tx('岁', '')} · ${tx('预期', 'expected')} ${le} ${tx('岁', '')}</div><div class="muted">${verdict}</div>
        ${gain > 0 ? `<div class="fun-hr-gain">⏳ ${tx(`改掉可改变的因素，这一生大约还能多活 ${gain} 年`, `Fixing the changeable factors could have added about ${gain} years`)}</div>` : `<div class="fun-hr-gain">🌿 ${tx('这一生的生活习惯已经很好了', 'This life already had healthy habits')}</div>`}</div>
      </div>
      <h4>🌱 ${tx('更长寿的方法（给现实中的你）', 'How to live longer (for the real you)')}</h4>
      <ol class="fun-hr-recs">${allRecs.slice(0, 3).map(r => `<li>${esc(r)}</li>`).join('')}</ol>
      ${window.BornReal ? `<button class="ghost fun-hr-real" type="button" data-hr-real>🔍 ${tx('测测现实中的我能活到几岁', 'How long could the real me live?')}</button>` : ''}
      <details class="fun-hr-more">
        <summary>${tx(`看完整健康分析（${items.length} 项）`, `Full health report (${items.length} items)`)}</summary>
        ${spark}
        <div class="fun-hr-items">${items.map(x => `<div class="fun-hr-it ${x.g}"><span class="fun-hr-ic">${x.icon}</span><div><b>${esc(x.title)}</b>${x.yrs ? ` <span class="fun-hr-y">${x.yrs > 0 ? '+' : '−'}${Math.abs(x.yrs)} ${tx('年', 'y')}</span>` : ''}<div>${esc(x.text)}</div></div></div>`).join('')}</div>
        ${allRecs.length > 3 ? `<ol class="fun-hr-recs" start="4">${allRecs.slice(3).map(r => `<li>${esc(r)}</li>`).join('')}</ol>` : ''}
        <p class="muted fun-cause-note">${tx('年数是依公开研究（WHO、柳叶刀等）的平均值粗估，用来比较轻重，不是医学诊断。', 'Year figures are rough averages from public research (WHO, The Lancet, etc.) for comparison only, not a diagnosis.')}</p>
      </details>
    </div>`;
  }
  const _re5 = window.renderEnd;
  window.renderEnd = function () {
    _re5.apply(this, arguments);
    try {
      const life = STATE.life; if (!life || !life.died) return;
      $('#funCause')?.remove(); $('#funHealth')?.remove();
      const anchor = $('#endCauseAnalysis');
      if (anchor) anchor.insertAdjacentHTML('beforebegin', causeCard(life) + healthReport(life));
    } catch (e) { /* ignore */ }
  };

  window.BornFun = { trackFor, causeCard, healthReport, CAUSE_INFO, rarity, luck, todayChallenge, ACHV, CHALLENGES, sgEvent, toHans, achvModal, wechatModal, ethName, compareModal, track, ETH_LABEL: ethLabel, Audio, TRACKS, storyYear, dailyLine, CHAPTERS, get story() { return STORY; } };
})();
