/* v6.34：家族传承模式
 *
 * 一段人生结束时，如果有还在世的孩子，就可以「成为下一代」：
 *   - 出生为那个孩子：名字、性别、出生年都是上一代人生里真的那个孩子。
 *   - 父母 = 刚走完的那一生 + TA 的伴侣；兄弟姊妹 = 其他孩子；祖父母 = 上一代的父母。
 *   - 家境依上一代留下的财富决定；上一代走完一生的那一年，按在世子女人数平分遗产（扣 15% 税费）。
 *   - 每一代都记进族谱：讣闻页显示「我家 N 代」，可以分享族谱卡或下载 GEDCOM。
 * 全部存在本机 localStorage（born-somewhere-v2:dynasty）。
 */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const isZh = () => typeof LANG === 'undefined' || /^zh/.test(LANG);
  const tx = (zh, en) => (window.BornXL ? BornXL.t(zh, en) : (isZh() ? zh : en));
  const H = (s) => (typeof LANG !== 'undefined' && LANG === 'zh-Hans' && window.BornFun && BornFun.toHans) ? BornFun.toHans(String(s ?? '')) : String(s ?? '');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const track = (n, p) => { try { window.BornFun?.track?.(n, p); } catch (e) { /* ignore */ } };
  const KEY = 'born-somewhere-v2:dynasty';
  const SITE = 'https://life.zenmatrix.org/';
  const money = (n) => (n < 0 ? '−' : '') + 'US$' + Math.abs(Math.round(n || 0)).toLocaleString();
  const causeName = (k) => { try { return k ? causeLabel(k) : ''; } catch (e) { return k || ''; } };
  const fullName = (n) => (n && (n.full || n.full_en)) || String(n || '');

  const loadAll = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
  const saveAll = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* ignore */ } };
  const getDyn = (id) => loadAll()[id] || null;
  function putDyn(d) { const all = loadAll(); all[d.id] = d; saveAll(all); }

  const livingKids = (life) => ((life.family && life.family.kids) || []).filter(k => k && !k.death);
  // 一代人生的族谱纪录
  function record(life, gen) {
    const fam = life.family || {}, s = life.stats || {};
    return {
      gen, rid: life.regNumber, name: fullName(life.name), sex: life.sex, country: life.country,
      year: life.year, age: life.deathAge ?? life.age, cause: life.cause || '',
      w: Math.round(s.netAssets || 0), p: Math.round(s.happiness || 0),
      partner: fam.partner ? { name: fam.partner.name, sex: fam.partner.sex, year: fam.partner.birth?.year } : null,
      kids: (fam.kids || []).map(k => ({ id: k.id, name: k.name, sex: k.sex, year: k.birth?.year, dead: !!k.death })),
      next: null,
    };
  }
  // 讣闻页时把这一代写进族谱（同一段人生只写一次）
  function commit(life) {
    if (!life.dynasty) return null;
    const d = getDyn(life.dynasty.id); if (!d) return null;
    const r = record(life, life.dynasty.gen);
    const i = d.gens.findIndex(g => g.rid === r.rid);
    if (i >= 0) { r.next = d.gens[i].next; d.gens[i] = r; } else d.gens.push(r);
    d.gens.sort((a, b) => a.gen - b.gen);
    putDyn(d);
    return d;
  }

  /* ---------- 成为下一代 ---------- */
  function becomeChild(parent, kidId) {
    const kid = livingKids(parent).find(k => k.id === kidId); if (!kid) return;
    const c = parent.countryData || countryById(parent.country);
    // 族谱：第一次传承时，把这一生当成第 1 代
    let d = parent.dynasty ? getDyn(parent.dynasty.id) : null;
    if (!d) {
      d = { id: 'd' + Date.now().toString(36), started: Date.now(), gens: [] };
      parent.dynasty = { id: d.id, gen: 1 };
      putDyn(d);
    }
    const pg = parent.dynasty.gen;
    d = commit(parent) || d;
    const me = d.gens.find(g => g.gen === pg); if (me) me.next = kid.id;
    putDyn(d);

    // 用孩子的性别、上一代的族群出生（其他随机照常）
    const saved = { sex: STATE.birthSex, eth: STATE.birthEth, era: STATE.era };
    STATE.birthSex = kid.sex === 'M' ? 'M' : 'F';
    STATE.birthEth = parent.ethnicity || 'auto';
    let life;
    try { life = window.newLife(parent.country); } finally { STATE.birthSex = saved.sex; STATE.birthEth = saved.eth; STATE.era = saved.era; }
    if (!life) return;
    const by = kid.birth?.year || (parent.year + 30);
    const bornAt = Math.max(15, by - parent.year);
    const pAge = parent.deathAge ?? parent.age;
    life.year = by; life.yearOffset = 0; life.birthMonth = null;
    life.regNumber = String(life.regNumber || '').replace(/-\d{4}-/, `-${by}-`);
    // 名字：沿用上一代给孩子取的名字
    const last = parent.name && parent.name.last;
    const first = last && kid.name.startsWith(last) ? kid.name.slice(last.length) : String(kid.name).split(/\s+/)[0];
    life.name = Object.assign({}, life.name, { full: kid.name, full_en: kid.nameEn || kid.name, first, last: last || life.name.last });
    // 家人：父母 = 上一代 + 伴侣；兄弟姊妹 = 其他孩子；祖父母 = 上一代的父母
    const pf = parent.family || {};
    const parentNode = { id: 'dyn_' + (parent.regNumber || Date.now()), name: fullName(parent.name), sex: parent.sex, country: parent.country, countryData: c, birth: { year: parent.year }, death: { year: parent.year + pAge } };
    const partnerNode = pf.partner ? Object.assign({}, pf.partner, { death: pf.partner.death || null }) : null;
    life.family = Object.assign({}, life.family, {
      parents: [parentNode, partnerNode].filter(Boolean),
      siblings: (pf.kids || []).filter(k => k.id !== kid.id),
      grandparents: pf.parents || [],
      partner: null, kids: [], fosterCare: null, adoptedFrom: null,
    });
    const pDetail = { age: bornAt, job: (parent.sex === 'M' ? parent.fatherDetail : parent.motherDetail)?.job || null };
    const sDetail = partnerNode ? { age: Math.max(16, by - (partnerNode.birth?.year || by - bornAt)), job: null } : null;
    life.fatherDetail = parent.sex === 'M' ? pDetail : sDetail;
    life.motherDetail = parent.sex === 'F' ? pDetail : sDetail;
    // 家境：看上一代留下多少（相对于当地人均收入）
    const ratio = (parent.stats?.netAssets || 0) / Math.max(1000, c.ppp || 10000);
    life.stats.incomeQuartile = ratio > 30 ? 4 : ratio > 8 ? 3 : ratio > 2 ? 2 : 1;
    if (parent.stats?.birthPlaceType) life.stats.birthPlaceType = ratio > 8 ? 'urban' : parent.stats.birthPlaceType;
    if ((parent.stats?.knowledge || 0) >= 70) life.stats.knowledge = Math.min(100, (life.stats.knowledge || 0) + 6);   // 家里有书香
    // 遗产：上一代走完一生那年，按在世子女平分（扣 15% 税费）
    const heirs = Math.max(1, livingKids(parent).length);
    const amount = Math.max(0, Math.round((parent.stats?.netAssets || 0) * 0.85 / heirs));
    life.dynasty = { id: d.id, gen: pg + 1, inherit: { atAge: Math.max(1, pAge - bornAt), amount, from: fullName(parent.name), fromSex: parent.sex, fromAge: pAge, done: false } };
    delete life.seed;   // 传承人生的起点不是种子生成的，不能做「同一个起点」挑战
    life.ethnicity = parent.ethnicity || life.ethnicity;
    track('dynasty_next', { gen: pg + 1, country: parent.country });
    STATE._certLife = life;
    try { setView('intro'); } catch (e) { /* ignore */ }
    startLife(parent.country);
    const L = STATE.life;
    if (L && L.dynasty) {
      const rel = parent.sex === 'M' ? tx('父亲', 'father') : tx('母亲', 'mother');
      const txt = tx(`👪 你是${rel} ${fullName(parent.name)} 的孩子，家族第 ${L.dynasty.gen} 代`, `👪 You are the child of your ${rel} ${fullName(parent.name)} — generation ${L.dynasty.gen}`);
      L.log.push({ age: 0, kind: 'family', icon: '👪', text: txt });
      try { logLife(txt); } catch (e) { /* ignore */ }
    }
  }

  // 每年检查：上一代走完一生的那一年，收到遗产
  const _tick = window.tick;
  window.tick = function () {
    const r = _tick.apply(this, arguments);
    try {
      const L = STATE.life, inh = L && L.dynasty && L.dynasty.inherit;
      if (inh && !inh.done && !L.died && L.age >= inh.atAge) {
        inh.done = true;
        const rel = inh.fromSex === 'M' ? tx('父亲', 'Your father') : tx('母亲', 'Your mother');
        const txt = inh.amount > 0
          ? tx(`🕊️ ${rel} ${inh.from} 走完了一生（${inh.fromAge} 岁），你继承了 ${money(inh.amount)}`, `🕊️ ${rel} ${inh.from} passed away at ${inh.fromAge}; you inherited ${money(inh.amount)}`)
          : tx(`🕊️ ${rel} ${inh.from} 走完了一生（${inh.fromAge} 岁）`, `🕊️ ${rel} ${inh.from} passed away at ${inh.fromAge}`);
        if (inh.amount > 0) L.stats.netAssets = (L.stats.netAssets || 0) + inh.amount;
        L.log.push({ age: L.age, kind: 'family', icon: '🕊️', text: txt });
        try { logLife(txt); } catch (e) { /* ignore */ }
      }
    } catch (e) { /* ignore */ }
    return r;
  };

  /* ---------- 讣闻页 ---------- */
  function treeHtml(d, curRid) {
    if (!d || d.gens.length < 2) return '';
    return `<div class="dy-tree">${d.gens.map((g, i) => {
      const c = countryById(g.country);
      const end = g.year + (g.age || 0);
      return `${i ? '<div class="dy-link">↓</div>' : ''}<div class="dy-gen ${g.rid === curRid ? 'cur' : ''}">
        <div class="dy-g">${tx(`第 ${g.gen} 代`, `Gen ${g.gen}`)}</div>
        <div class="dy-main"><b>${c ? c.flag + ' ' : ''}${esc(g.name)}</b> <span class="muted">${g.sex === 'M' ? tx('男', 'M') : tx('女', 'F')} · ${g.year}–${end} · ${g.age} ${tx('岁', 'y')}</span>
        <div class="dy-sub">💰 ${money(g.w)} · 😊 ${g.p}${g.cause ? ' · ' + esc(causeName(g.cause)) : ''}${g.partner ? ` · 💑 ${esc(g.partner.name)}` : ''}${g.kids.length ? ` · 👶 ${g.kids.length}` : ''}</div></div>
      </div>`;
    }).join('')}</div>`;
  }
  function endBlock(life) {
    const kids = livingKids(life);
    const d = life.dynasty ? getDyn(life.dynasty.id) : null;
    const gen = life.dynasty ? life.dynasty.gen : 1;
    let html = '';
    if (d && d.gens.length >= 2) {
      html += `<h3>📜 ${tx(`我家 ${d.gens.length} 代`, `${d.gens.length} generations of my family`)}</h3>${treeHtml(d, life.regNumber)}
        <div class="ks-actions"><button class="ghost" data-dy-card type="button">🖼️ ${tx('分享族谱卡', 'Share family card')}</button>
        <button class="ghost" data-dy-ged type="button">⬇️ ${tx('下载族谱（GEDCOM）', 'Download family tree (GEDCOM)')}</button></div>`;
    }
    if (kids.length) {
      const heirs = kids.length;
      const share = Math.max(0, Math.round((life.stats?.netAssets || 0) * 0.85 / heirs));
      html += `<div class="dy-next"><b>👨‍👩‍👧 ${tx('家族传承：成为下一代', 'Family legacy: live the next generation')}</b>
        <p>${tx(`成为你的孩子，继续这个家族的故事（第 ${gen + 1} 代）。`, `Be born as one of your children and continue the family story (generation ${gen + 1}).`)}${share > 0 ? tx(`你走完一生那年，每个孩子会继承约 ${money(share)}。`, ` Each child inherits about ${money(share)} when you pass away.`) : ''}</p>
        <div class="dy-kids">${kids.map(k => `<button class="primary" data-dy-kid="${esc(k.id)}" type="button">${k.sex === 'M' ? '👦' : '👧'} ${tx('成为', 'Be')} ${esc(k.name)} <small>${k.sex === 'M' ? tx('儿子', 'son') : tx('女儿', 'daughter')} · ${k.birth?.year || ''}</small></button>`).join('')}</div></div>`;
    } else if (d && d.gens.length >= 2) {
      html += `<p class="muted dy-end">🌙 ${tx(`这一代没有留下孩子，家族的故事在第 ${gen} 代画下句点。`, `No children this time — the family story ends at generation ${gen}.`)}</p>`;
    }
    return html ? `<div id="dyEnd" class="dy-end-wrap">${html}</div>` : '';
  }

  // 族谱卡
  function makeCard(d) {
    const W = 1080, rowH = 170, Hh = Math.max(1350, 330 + d.gens.length * rowH + 300), cv = document.createElement('canvas'); cv.width = W; cv.height = Hh;
    const ctx = cv.getContext('2d');
    const font = (s, w = 700) => `${w} ${s}px "PingFang SC","Noto Sans SC","Microsoft YaHei",sans-serif`;
    const g = ctx.createLinearGradient(0, 0, 0, Hh); g.addColorStop(0, '#4a2c12'); g.addColorStop(1, '#22140a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hh);
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffd27a'; ctx.font = font(60);
    ctx.fillText(tx(`我家 ${d.gens.length} 代`, `${d.gens.length} generations`), W / 2, 130);
    ctx.fillStyle = '#f5e9d6'; ctx.font = font(32, 400);
    const y0 = d.gens[0].year, yN = d.gens[d.gens.length - 1].year + (d.gens[d.gens.length - 1].age || 0);
    ctx.fillText(tx(`《模拟人生》里的一个家族 · ${y0}–${yN}`, `A family in Life Simulator · ${y0}–${yN}`), W / 2, 190);
    let y = 270;
    d.gens.forEach((gn, i) => {
      if (i) { ctx.strokeStyle = 'rgba(255,210,122,.5)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(W / 2, y - 30); ctx.lineTo(W / 2, y - 6); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(90, y, W - 180, rowH - 40, 22); else ctx.rect(90, y, W - 180, rowH - 40); ctx.fill();
      ctx.textAlign = 'left'; ctx.fillStyle = '#ffd27a'; ctx.font = font(30); ctx.fillText(tx(`第 ${gn.gen} 代`, `Gen ${gn.gen}`), 125, y + 52);
      ctx.fillStyle = '#fff'; ctx.font = font(40); ctx.fillText(gn.name, 270, y + 54);
      ctx.fillStyle = '#e8dcc8'; ctx.font = font(28, 400);
      const c = countryById(gn.country);
      ctx.fillText(`${c ? localize(c).name + ' · ' : ''}${gn.year}–${gn.year + (gn.age || 0)} · ${gn.age} ${tx('岁', 'y')} · ${money(gn.w)}`, 270, y + 100);
      y += rowH;
    });
    ctx.fillStyle = '#f7f3ea'; ctx.fillRect(0, Hh - 280, W, 280);
    ctx.textAlign = 'left'; ctx.fillStyle = '#4a2c12'; ctx.font = font(46);
    ctx.fillText(tx('你的家族能传几代？', 'How many generations can you go?'), 80, Hh - 170);
    ctx.font = font(32, 400); ctx.fillStyle = '#333';
    ctx.fillText('life.zenmatrix.org', 80, Hh - 110);
    try {
      const q = qrcode(0, 'M'); q.addData(SITE + '?utm_source=familycard'); q.make();
      const n = q.getModuleCount(), size = 210, cell = size / n, qx = W - 80 - size, qy = Hh - 245;
      ctx.fillStyle = '#fff'; ctx.fillRect(qx - 10, qy - 10, size + 20, size + 20); ctx.fillStyle = '#000';
      for (let r = 0; r < n; r++) for (let cc = 0; cc < n; cc++) if (q.isDark(r, cc)) ctx.fillRect(qx + cc * cell, qy + r * cell, Math.ceil(cell), Math.ceil(cell));
    } catch (e) { /* ignore */ }
    return cv;
  }
  function showCard(d) {
    const cv = makeCard(d), img = cv.toDataURL('image/jpeg', 0.9);
    const wx = /MicroMessenger/i.test(navigator.userAgent);
    track('dynasty_card', { gens: d.gens.length });
    let m = $('#dyModal');
    if (!m) { m = document.createElement('div'); m.id = 'dyModal'; m.className = 'modal fun-modal'; m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-dy-close]')) m.hidden = true; }); document.body.appendChild(m); }
    m.innerHTML = `<div class="modal-card fun-card ch-card">
      <div class="fun-card-head"><h3>📜 ${tx('族谱卡', 'Family card')}</h3><button class="ghost" data-dy-close type="button">✕</button></div>
      <img class="rl-cardimg" src="${img}" alt="">
      <p class="muted ch-note">${wx ? tx('长按图片发给朋友或保存', 'Long-press to send or save') : ''}</p>
      <div class="ks-actions">${navigator.share ? `<button class="primary" id="dyShare" type="button">💚 ${tx('分享', 'Share')}</button>` : ''}
      ${!wx ? `<a class="ghost ks-btnlink" download="family.jpg" href="${img}">⬇️ ${tx('下载图片', 'Download image')}</a>` : ''}</div>
    </div>`;
    m.hidden = false;
    $('#dyShare')?.addEventListener('click', () => cv.toBlob(async (b) => {
      const file = new File([b], 'family.jpg', { type: 'image/jpeg' });
      const text = H(tx(`我在《模拟人生》里传了 ${d.gens.length} 代。你的家族能传几代？${SITE}`, `My family lasted ${d.gens.length} generations in Life Simulator. How about yours? ${SITE}`));
      try { if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], text }); else await navigator.share({ text, url: SITE }); } catch (e) { /* cancelled */ }
    }, 'image/jpeg', 0.9));
  }
  // GEDCOM：每一代 + 伴侣 + 亲子关系
  function downloadGed(d) {
    if (!window.Gedcom) return;
    const DB = { _meta: { title: tx('族谱', 'Family tree') + ' · born-somewhere' }, people: {} };
    d.gens.forEach((g, i) => {
      const id = 'g' + g.gen, pid = g.partner ? 'p' + g.gen : null;
      const prev = i ? d.gens[i - 1] : null;
      DB.people[id] = { id, name: g.name, nameEn: '', gender: g.sex || 'U', birth: { year: g.year }, death: { year: g.year + (g.age || 0) }, birthPlace: g.country, deathPlace: '', notes: g.cause ? causeName(g.cause) : '', parents: prev ? ['g' + prev.gen].concat(prev.partner ? ['p' + prev.gen] : []) : [], spouses: pid ? [pid] : [] };
      if (pid) DB.people[pid] = { id: pid, name: g.partner.name, nameEn: '', gender: g.partner.sex || 'U', birth: g.partner.year ? { year: g.partner.year } : null, death: null, birthPlace: g.country, deathPlace: '', notes: '', parents: [], spouses: [id] };
    });
    const ged = window.Gedcom.export(DB);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ged], { type: 'text/plain' }));
    a.download = `family-${d.gens.length}gen.ged`;
    document.body.appendChild(a); a.click(); a.remove();
    track('dynasty_ged', { gens: d.gens.length });
  }

  const _renderEnd = window.renderEnd;
  window.renderEnd = function () {
    _renderEnd.apply(this, arguments);
    try {
      const life = STATE.life; if (!life || !life.died) return;
      if (life.dynasty) commit(life);
      $('#dyEnd')?.remove();
      const html = endBlock(life); if (!html) return;
      const anchor = $('#funCause') || $('#endCauseAnalysis'); if (!anchor) return;
      anchor.insertAdjacentHTML('beforebegin', html);
      document.querySelectorAll('#dyEnd [data-dy-kid]').forEach(b => b.addEventListener('click', () => becomeChild(life, b.dataset.dyKid)));
      const d = life.dynasty ? getDyn(life.dynasty.id) : null;
      document.querySelector('#dyEnd [data-dy-card]')?.addEventListener('click', () => d && showCard(d));
      document.querySelector('#dyEnd [data-dy-ged]')?.addEventListener('click', () => d && downloadGed(d));
    } catch (e) { /* ignore */ }
  };
  window.BornDynasty = { becomeChild, loadAll, record, makeCard };
})();
