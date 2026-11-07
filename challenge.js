/* v6.33：「同一个起点」挑战朋友
 *
 * 每一段人生出生时都有一个种子（seed）：newLife() 执行期间，Math.random 换成用种子产生的随机数，
 * 所以「同样的种子 + 同样的出生设定（国家、年代、性别设定、族群设定）」一定生出同一个人——
 * 同名字、同父母、同家境、同登记号码。出生之后照常随机，所以每个人走出不同的人生。
 *
 * 人生结束后可以把「起点 + 我的结果」做成连结与分享卡；朋友打开连结（?ch=…）就从同一个起点出生，
 * 结束时并排比较寿命、财富、幸福、人际、知识，看谁活得更好，还能「回敬」一个挑战。
 * 资料全部放在连结里，没有伺服器。
 */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const isZh = () => typeof LANG === 'undefined' || /^zh/.test(LANG);
  const tx = (zh, en) => (window.BornXL ? BornXL.t(zh, en) : (isZh() ? zh : en));
  const H = (s) => (typeof LANG !== 'undefined' && LANG === 'zh-Hans' && window.BornFun && BornFun.toHans) ? BornFun.toHans(String(s ?? '')) : String(s ?? '');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const track = (n, p) => { try { window.BornFun?.track?.(n, p); } catch (e) { /* ignore */ } };
  const SITE = 'https://life.zenmatrix.org/';

  // mulberry32：小而快、分布够好的 32 位元种子随机数
  const mulberry = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

  /* ---------- 有种子的出生 ---------- */
  let pending = null;   // 接受挑战后、真正出生前：{ s, c, e, x, h, y, from }
  const _newLife = window.newLife;
  window.newLife = function (code) {
    const P = pending && pending.c === code ? pending : null;
    const seed = P ? P.s : (Math.floor(Math.random() * 4294967296) >>> 0);
    const saved = { era: STATE.era, sex: STATE.birthSex, eth: STATE.birthEth };
    const cfg = P ? { e: P.e, x: P.x, h: P.h } : { e: STATE.era || 'now', x: STATE.birthSex || 'auto', h: STATE.birthEth || 'auto' };
    if (P) { STATE.era = P.e; STATE.birthSex = P.x; STATE.birthEth = P.h; }
    const rnd = Math.random;
    Math.random = mulberry(seed);
    let life;
    try { life = _newLife.apply(this, arguments); }
    finally { Math.random = rnd; if (P) { STATE.era = saved.era; STATE.birthSex = saved.sex; STATE.birthEth = saved.eth; } }
    if (life) {
      life.seed = seed;
      life.seedCfg = cfg;
      if (P) {
        if (P.y && P.e !== 'past' && P.e !== 'future') life.year = P.y;   // 「现在」出生：跟挑战者同一年
        life.challenge = P.from;
      }
    }
    return life;
  };
  const _startLife = window.startLife;
  window.startLife = function () {
    const r = _startLife.apply(this, arguments);
    pending = null;
    return r;
  };

  /* ---------- 连结编码 ---------- */
  const b64u = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64u = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
  const num = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : null; };
  function resultOf(life) {
    const s = life.stats || {};
    return {
      n: String((life.name && (life.name.full || life.name.full_en)) || '').slice(0, 24),
      a: Math.round(life.deathAge ?? life.age ?? 0),
      w: Math.round(s.netAssets || 0),
      p: Math.round(s.happiness || 0),
      o: Math.round(s.social || 0),
      k: Math.round(s.knowledge || 0),
      d: String(life.cause || '').slice(0, 12),
    };
  }
  function encode(life) {
    const cfg = life.seedCfg || {};
    return b64u(JSON.stringify(Object.assign({ v: 1, s: life.seed, c: life.country, e: cfg.e || 'now', x: cfg.x || 'auto', h: cfg.h || 'auto', y: life.year }, resultOf(life))));
  }
  function decode(str) {
    try {
      const o = JSON.parse(unb64u(String(str).slice(0, 600)));
      if (!o || o.v !== 1) return null;
      const c = countryById(String(o.c || '').toUpperCase());
      const s = num(o.s, 0, 4294967295);
      if (!c || s == null) return null;
      const e = ['now', 'past', 'future', 'any'].includes(o.e) ? o.e : 'now';
      const x = ['M', 'F', 'auto'].includes(o.x) ? o.x : 'auto';
      const h = /^[a-z]{2,12}$/.test(o.h || '') ? o.h : 'auto';
      return {
        s: Math.floor(s), c: c.id, e, x, h, y: num(o.y, 1900, 2200),
        from: { n: String(o.n || '').slice(0, 24), a: num(o.a, 0, 125) ?? 0, w: num(o.w, -1e12, 1e12) ?? 0, p: num(o.p, 0, 100) ?? 0, o: num(o.o, 0, 100) ?? 0, k: num(o.k, 0, 100) ?? 0, d: String(o.d || '').slice(0, 12) },
      };
    } catch (e) { return null; }
  }
  const linkFor = (life) => `${SITE}?ch=${encode(life)}`;

  /* ---------- 比较 ---------- */
  const money = (n) => (n < 0 ? '−' : '') + 'US$' + Math.abs(Math.round(n)).toLocaleString();
  const METRICS = [
    { k: 'a', icon: '🎂', zh: '寿命', en: 'Lifespan', fmt: (v) => `${v} ${tx('岁', 'y')}` },
    { k: 'w', icon: '💰', zh: '财富', en: 'Wealth', fmt: money },
    { k: 'p', icon: '😊', zh: '幸福', en: 'Happiness', fmt: (v) => String(v) },
    { k: 'o', icon: '🤝', zh: '人际', en: 'Relationships', fmt: (v) => String(v) },
    { k: 'k', icon: '📚', zh: '知识', en: 'Knowledge', fmt: (v) => String(v) },
  ];
  function compare(me, them) {
    let mine = 0, theirs = 0;
    const rows = METRICS.map(m => {
      const a = me[m.k], b = them[m.k];
      const w = a > b ? 'me' : a < b ? 'them' : 'tie';
      if (w === 'me') mine++; else if (w === 'them') theirs++;
      return { m, a, b, w };
    });
    // 平手时看寿命
    let verdict = mine > theirs ? 'win' : mine < theirs ? 'lose' : (me.a > them.a ? 'win' : me.a < them.a ? 'lose' : 'tie');
    return { rows, mine, theirs, verdict };
  }
  const causeName = (k) => { try { return k ? causeLabel(k) : ''; } catch (e) { return k; } };

  /* ---------- 落地页：朋友打开挑战连结 ---------- */
  function modal(id) {
    let m = document.getElementById(id);
    if (!m) {
      m = document.createElement('div'); m.id = id; m.className = 'modal fun-modal ch-modal';
      m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-ch-close]')) m.hidden = true; });
      document.body.appendChild(m);
    }
    m.hidden = false; return m;
  }
  function openInvite(P) {
    const c = countryById(P.c), nm = localize(c).name;
    pending = P;
    let preview = null;
    try { preview = window.newLife(P.c); } catch (e) { preview = null; }
    const who = preview ? `${esc(preview.name.full || preview.name.full_en || '')}（${preview.sex === 'M' ? tx('男', 'male') : tx('女', 'female')}）` : '';
    const year = preview ? preview.year : (P.y || '');
    const f = P.from;
    track('challenge_open', { country: P.c });
    const m = modal('chInvite');
    m.innerHTML = `<div class="modal-card fun-card ch-card">
      <div class="fun-card-head"><h3>⚔️ ${tx('有人向你挑战！', 'You\'ve been challenged!')}</h3><button class="ghost" data-ch-close type="button">✕</button></div>
      <p class="ch-lead">${tx(`你的朋友把「<b>${esc(f.n || '这个人')}</b>」的一生活到了 <b>${f.a} 岁</b>。现在换你来过这一生：<b>同一个起点</b>——同样的名字、国家、家庭、父母，你能活得更好吗？`, `Your friend lived <b>${esc(f.n || 'this life')}</b>'s life to <b>${f.a}</b>. Now it's your turn: <b>the same start</b> — same name, country, family and parents. Can you do better?`)}</p>
      <div class="ch-start">
        <div class="ch-flag">${c.flag || ''}</div>
        <div><div class="ch-start-k">${tx('你的起点', 'Your start')}</div><b>${esc(nm)} · ${year}</b>${who ? `<div>${who}</div>` : ''}</div>
      </div>
      <div class="ch-target">
        ${METRICS.map(mm => `<div><span>${mm.icon} ${tx(mm.zh, mm.en)}</span><b>${esc(mm.fmt(f[mm.k]))}</b></div>`).join('')}
      </div>
      <div class="ks-actions"><button class="primary" id="chAccept" type="button">👶 ${tx('接受挑战，出生！', 'Accept and be born!')}</button>
        <button class="ghost" data-ch-close type="button">${tx('先看看', 'Maybe later')}</button></div>
      <p class="muted ch-note">${tx('出生之后的每一个选择、每一次运气都不一样。', 'After birth, every choice and every bit of luck is yours.')}</p>
    </div>`;
    $('#chAccept').addEventListener('click', () => {
      m.hidden = true;
      track('challenge_accept', { country: P.c });
      try { history.replaceState(null, '', location.pathname); } catch (e) { /* ignore */ }
      pending = P;
      showBirthCertModal(c);
    });
  }

  /* ---------- 讣闻页：比较 + 发出挑战 ---------- */
  function endBlock(life) {
    const me = resultOf(life);
    const ch = life.challenge;
    let html = '';
    if (ch) {
      const r = compare(me, ch);
      const head = r.verdict === 'win' ? tx(`🏆 你赢了！${r.mine} : ${r.theirs}`, `🏆 You win! ${r.mine} : ${r.theirs}`)
        : r.verdict === 'lose' ? tx(`😤 差一点！${r.mine} : ${r.theirs}`, `😤 So close! ${r.mine} : ${r.theirs}`)
          : tx('🤝 平手！', '🤝 A tie!');
      const diff = me.a - ch.a;
      const sub = diff > 0 ? tx(`同一个起点，你比朋友多活了 ${diff} 年`, `Same start — you lived ${diff} years longer than your friend`)
        : diff < 0 ? tx(`同一个起点，朋友比你多活了 ${-diff} 年`, `Same start — your friend lived ${-diff} years longer`)
          : tx('同一个起点，你们活得一样久', 'Same start, same lifespan');
      html += `<div class="ch-vs ${r.verdict}">
        <h3>${head}</h3><p>${sub}</p>
        <table class="ch-table"><thead><tr><th></th><th>${tx('你', 'You')}</th><th>${tx('朋友', 'Friend')}</th></tr></thead><tbody>
        ${r.rows.map(x => `<tr><td>${x.m.icon} ${tx(x.m.zh, x.m.en)}</td><td class="${x.w === 'me' ? 'w' : ''}">${esc(x.m.fmt(x.a))}</td><td class="${x.w === 'them' ? 'w' : ''}">${esc(x.m.fmt(x.b))}</td></tr>`).join('')}
        <tr><td>🌙 ${tx('落幕原因', 'Cause')}</td><td>${esc(causeName(me.d))}</td><td>${esc(causeName(ch.d))}</td></tr>
        </tbody></table>
        <div class="ks-actions"><button class="primary" data-ch-send type="button">⚔️ ${tx('回敬一个挑战', 'Challenge them back')}</button>
          <button class="ghost" data-ch-again type="button">↺ ${tx('同一个起点再来一次', 'Retry the same start')}</button></div>
      </div>`;
    } else {
      html += `<div class="ch-invite">
        <div><b>⚔️ ${tx('同一个起点，谁活得更好？', 'Same start — who lives better?')}</b>
        <p>${tx('把这一生的起点发给朋友：同样的国家、家庭、父母，看看 TA 能不能比你活得更久、更幸福。', 'Send this life\'s starting point to a friend: same country, family and parents. Can they live longer or happier?')}</p></div>
        <button class="primary" data-ch-send type="button">⚔️ ${tx('挑战朋友', 'Challenge a friend')}</button>
      </div>`;
    }
    return `<div id="chEnd" class="ch-end">${html}</div>`;
  }
  function wireEnd(life) {
    document.querySelectorAll('#chEnd [data-ch-send]').forEach(b => b.addEventListener('click', () => openSend(life)));
    document.querySelector('#chEnd [data-ch-again]')?.addEventListener('click', () => {
      const P = { s: life.seed, c: life.country, e: life.seedCfg?.e || 'now', x: life.seedCfg?.x || 'auto', h: life.seedCfg?.h || 'auto', y: life.year, from: life.challenge };
      track('challenge_retry', {});
      pending = P;
      try { setView('intro'); } catch (e) { /* ignore */ }
      showBirthCertModal(countryById(P.c));
    });
  }

  /* ---------- 发出挑战：分享卡 + 连结 ---------- */
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
  function makeCard(life, url) {
    const W = 1080, Hh = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = Hh;
    const ctx = cv.getContext('2d'), me = resultOf(life), c = life.countryData || countryById(life.country);
    const font = (s, w = 700) => `${w} ${s}px "PingFang SC","Noto Sans SC","Microsoft YaHei",sans-serif`;
    const g = ctx.createLinearGradient(0, 0, W, Hh); g.addColorStop(0, '#173f5f'); g.addColorStop(1, '#0b2236');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hh);
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffd27a'; ctx.font = font(40);
    ctx.fillText(tx('⚔️ 同一个起点挑战', '⚔️ Same-start challenge'), W / 2, 110);
    ctx.fillStyle = '#fff'; ctx.font = font(isZh() ? 58 : 56);
    wrapText(ctx, tx('同一个起点，你能活得比我好吗？', 'Same start. Can you live better than me?'), W / 2, 220, W - 120, 80);
    ctx.font = font(34, 400); ctx.globalAlpha = .85;
    ctx.fillText(`${localize(c).name} · ${life.year} · ${me.n}`, W / 2, 420); ctx.globalAlpha = 1;
    // 五项成绩
    const rows = METRICS;
    let y = 500;
    rows.forEach((m) => {
      ctx.fillStyle = 'rgba(255,255,255,.09)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(110, y, W - 220, 84, 18); else ctx.rect(110, y, W - 220, 84); ctx.fill();
      ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = font(36, 400); ctx.fillText(`${m.icon}  ${tx(m.zh, m.en)}`, 150, y + 56);
      ctx.textAlign = 'right'; ctx.fillStyle = '#ffd27a'; ctx.font = font(42); ctx.fillText(m.fmt(me[m.k]), W - 150, y + 58);
      y += 100;
    });
    ctx.fillStyle = '#f7f3ea'; ctx.fillRect(0, Hh - 300, W, 300);
    ctx.textAlign = 'left'; ctx.fillStyle = '#173f5f'; ctx.font = font(46);
    ctx.fillText(tx('扫码接受挑战', 'Scan to accept'), 80, Hh - 190);
    ctx.font = font(32, 400); ctx.fillStyle = '#333';
    ctx.fillText(tx('同样的国家、家庭、父母，看谁活得更好', 'Same country, family and parents'), 80, Hh - 130);
    ctx.fillText('life.zenmatrix.org', 80, Hh - 80);
    try {
      const q = qrcode(0, 'L'); q.addData(url + '&utm_source=challengecard'); q.make();
      const n = q.getModuleCount(), size = 240, cell = size / n, qx = W - 80 - size, qy = Hh - 270;
      ctx.fillStyle = '#fff'; ctx.fillRect(qx - 10, qy - 10, size + 20, size + 20); ctx.fillStyle = '#000';
      for (let r = 0; r < n; r++) for (let cc = 0; cc < n; cc++) if (q.isDark(r, cc)) ctx.fillRect(qx + cc * cell, qy + r * cell, Math.ceil(cell), Math.ceil(cell));
    } catch (e) { /* ignore */ }
    return cv;
  }
  function openSend(life) {
    const url = linkFor(life), me = resultOf(life);
    const text = H(tx(`我在《模拟人生》出生在${localize(life.countryData || countryById(life.country)).name}，活到了 ${me.a} 岁。同一个起点，你能活得比我好吗？⚔️ ${url}`, `I was born in ${localize(life.countryData || countryById(life.country)).name} and lived to ${me.a} in Life Simulator. Same start — can you do better? ⚔️ ${url}`));
    track('challenge_send', { country: life.country, rematch: !!life.challenge });
    const cv = makeCard(life, url), img = cv.toDataURL('image/jpeg', 0.9);
    const wx = /MicroMessenger/i.test(navigator.userAgent);
    const m = modal('chSend');
    m.innerHTML = `<div class="modal-card fun-card ch-card">
      <div class="fun-card-head"><h3>⚔️ ${tx('挑战朋友', 'Challenge a friend')}</h3><button class="ghost" data-ch-close type="button">✕</button></div>
      <img class="rl-cardimg" src="${img}" alt="">
      <p class="muted ch-note">${wx ? tx('长按图片发给朋友；或复制连结贴到聊天里。', 'Long-press the image to send it, or copy the link.') : tx('把图片或连结发给朋友，朋友打开就从同一个起点出生。', 'Send the image or link; your friend will be born from the same start.')}</p>
      <div class="ks-publink"><input id="chUrl" readonly value="${esc(url)}"></div>
      <div class="ks-actions">
        ${navigator.share ? `<button class="primary" id="chShare" type="button">💚 ${tx('分享', 'Share')}</button>` : ''}
        <button class="${navigator.share ? 'ghost' : 'primary'}" id="chCopy" type="button">🔗 ${tx('复制连结', 'Copy link')}</button>
        ${!wx ? `<a class="ghost ks-btnlink" id="chDl" download="challenge.jpg" href="${img}">⬇️ ${tx('下载图片', 'Download image')}</a>` : ''}
      </div>
    </div>`;
    $('#chCopy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(text); } catch (e) { const i = $('#chUrl'); i.select(); document.execCommand('copy'); }
      $('#chCopy').textContent = '✓ ' + tx('已复制', 'Copied');
    });
    $('#chShare')?.addEventListener('click', () => {
      cv.toBlob(async (b) => {
        const file = new File([b], 'challenge.jpg', { type: 'image/jpeg' });
        try {
          if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], text, title: tx('同一个起点挑战', 'Same-start challenge') });
          else await navigator.share({ text, url, title: tx('同一个起点挑战', 'Same-start challenge') });
        } catch (e) { /* cancelled */ }
      }, 'image/jpeg', 0.9);
    });
  }

  const _renderEnd = window.renderEnd;
  window.renderEnd = function () {
    _renderEnd.apply(this, arguments);
    try {
      const life = STATE.life; if (!life || !life.died || life.seed == null) return;
      $('#chEnd')?.remove();
      const anchor = $('#funCause') || $('#endCauseAnalysis');
      if (!anchor) return;
      anchor.insertAdjacentHTML('beforebegin', endBlock(life));
      wireEnd(life);
      if (life.challenge && !life._chTracked) { life._chTracked = true; track('challenge_done', { verdict: compare(resultOf(life), life.challenge).verdict }); }
    } catch (e) { /* ignore */ }
  };

  function boot() {
    let q = null; try { q = new URLSearchParams(location.search).get('ch'); } catch (e) { /* ignore */ }
    if (!q) return;
    const go = () => { if (!COUNTRIES.length) { setTimeout(go, 300); return; } const P = decode(q); if (P) openInvite(P); };
    go();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.BornChallenge = { encode, decode, linkFor, compare, resultOf, mulberry };
})();
