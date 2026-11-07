/* =====================================================================
   born-somewhere v6.20 —— 珍藏（keepsake.js）
   用走完的人生（或书架上的前世纪录）在本机生成：
   1) 照片组合：9 张 1080×1440 直式图，对应微信朋友圈九宫格；默认流程就是「分享到朋友圈」
   2) 人生相簿：可打印 / 存成 PDF 的书（浏览器列印）
   3) 人生纪录册：单一 HTML 档（逐年表格、图表、家人、抉择、完整纪录）+ 逐年 CSV
   全部在装置上产生，不上传。
   ===================================================================== */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const isZh = () => LANG === 'zh-Hans' || LANG === 'zh-Hant';
  const tx = (zh, en) => (window.BornXL ? BornXL.t(zh, en) : (isZh() ? zh : en));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  // 资料层多为繁体；简体介面时，送进 canvas 以外（HTML 档、列印页）的文字要先转
  const H = (s) => (LANG === 'zh-Hans' && window.BornFun && BornFun.toHans) ? BornFun.toHans(String(s ?? '')) : String(s ?? '');
  // 正式短网址：二维码、朋友圈文案、纪录册一律指向这里（不论玩家是从哪个网址打开的）
  const CANONICAL = 'https://life.zenmatrix.org/';
  const SITE = () => (/^(localhost|127\.)/.test(location.hostname) ? location.origin + '/' : CANONICAL);
  const SHARE_URL = () => SITE() + '?s=wx';   // 短一点，扫码与手打都容易；s=wx 供统计辨识来源
  const isWeChat = () => /MicroMessenger/i.test(navigator.userAgent);
  const track = (n, p) => { try { window.BornFun?.track?.(n, p); } catch (e) { /* ignore */ } };

  /* ---------------- 逐年快照（新人生起每年记一笔；旧纪录退回 5 年取样的 trajectory） ---------------- */
  const _tick = window.tick;
  window.tick = function () {
    const r = _tick.apply(this, arguments);
    try {
      const L = STATE.life;
      if (L && L.stats) {
        L._yearly = L._yearly || [];
        const last = L._yearly[L._yearly.length - 1];
        if (!last || last.age !== L.age) {
          const s = L.stats;
          L._yearly.push({ age: L.age, h: Math.round(s.health || 0), hp: Math.round(s.happiness || 0), k: Math.round(s.knowledge || 0), so: Math.round(s.social || 0), m: Math.round(s.netAssets || 0), emp: s.employment || '', mar: !!s.married, kids: (s.kids || []).length });
        }
      }
    } catch (e) { /* ignore */ }
    return r;
  };
  function yearly(life) {
    if (life._yearly && life._yearly.length) return life._yearly;
    return (life.trajectory || []).map(t => ({ age: t.age, h: t.health, hp: null, k: t.knowledge, so: t.relationship, m: null, emp: '', mar: null, kids: null }));
  }

  /* ---------------- 人生资料整理 ---------------- */
  const STAGES = [
    { id: 'child', min: 0, max: 12, zh: '童年', en: 'Childhood', icon: '🧸', color: ['#f6c177', '#f4a259'], img: 'assets/illus-home-cat.jpg' },
    { id: 'teen', min: 13, max: 22, zh: '少年', en: 'Youth', icon: '🎒', color: ['#8bd3c7', '#4aa3a2'], img: 'assets/illus-time-seed.jpg' },
    { id: 'young', min: 23, max: 39, zh: '青年', en: 'Young adult', icon: '🌱', color: ['#9ab8ff', '#5b7fe0'], img: null },
    { id: 'mid', min: 40, max: 64, zh: '中年', en: 'Midlife', icon: '🏠', color: ['#c7a4ff', '#8a63d2'], img: null },
    { id: 'elder', min: 65, max: 130, zh: '晚年', en: 'Later years', icon: '🍵', color: ['#e9b3a8', '#c2766a'], img: 'assets/illus-elder-hill.jpg' },
  ];
  const BORING = new Set(['focus', 'finance', 'log']);
  function lifeYears(life) {
    const by = life.year || NOW_YEAR;
    return { by, bm: life.birthMonth || null, dy: by + (life.deathAge ?? life.age ?? 0) };
  }
  const fmtBirth = (life) => { const { by, bm } = lifeYears(life); return bm ? `${by}-${String(bm).padStart(2, '0')}` : String(by); };
  function stageEvents(life, st, n) {
    const rows = (life.log || []).filter(e => e && e.text && e.age >= st.min && e.age <= st.max && e.kind !== 'birth' && e.kind !== 'death').map(clean);
    const seen = new Set();
    const uniq = rows.filter(e => { const k = e.text.slice(0, 24); if (seen.has(k)) return false; seen.add(k); return true; });
    const score = (e) => (e.starred ? 100 : 0) + (/story|big|decision|milestone|spouse|heavy|illness/.test(e.kind || '') ? 20 : 0) + (BORING.has(e.kind) ? -30 : 0) + Math.min(10, (e.text || '').length / 8);
    const picked = [...uniq].sort((a, b) => score(b) - score(a)).slice(0, n || 5);
    return picked.sort((a, b) => a.age - b.age);
  }
  const AUTO_MARK = /s*[（(](自動抉擇|自动抉择|自動|自动|auto)[）)]s*/gi;
  const clean = (e) => Object.assign({}, e, { text: String(e.text).replace(AUTO_MARK, ' ').trim() });
  const allStageEvents = (life, st) => (life.log || []).filter(e => e && e.text && e.age >= st.min && e.age <= st.max).map(clean);
  function familyRows(life) {
    const f = life.family || {};
    const out = [];
    const nm = (n) => (typeof n === 'string' ? n : (n && (n.full || n.full_en)) || '');
    const rel = (p, zh, en) => p && nm(p.name) && out.push({ rel: tx(zh, en), name: nm(p.name), note: typeof p.note === 'string' ? p.note : '' });
    (f.parents || []).forEach(p => rel(p, p.sex === 'M' ? '父亲' : '母亲', p.sex === 'M' ? 'Father' : 'Mother'));
    (f.grandparents || []).forEach(p => rel(p, p.sex === 'M' ? '祖父/外祖父' : '祖母/外祖母', 'Grandparent'));
    (f.siblings || []).forEach(p => rel(p, p.sex === 'M' ? '兄弟' : '姊妹', 'Sibling'));
    const partner = life.stats?.partner || f.partner;
    if (partner && partner.name) rel(partner, '伴侣', 'Partner');
    (life.stats?.kids || f.kids || []).forEach(k => rel(typeof k === 'string' ? { name: k } : k, '孩子', 'Child'));
    return out;
  }
  function choiceRows(life) {
    const rows = [];
    (life.decisions || []).filter(d => d.key !== 'skipped').forEach(d => rows.push({ age: d.age, title: (d.icon ? d.icon + ' ' : '') + (d.label || d.id), note: d.note || '' }));
    const story = (life.log || []).filter(e => e.kind === 'story' && /^「/.test(e.text || ''));
    story.forEach(e => rows.push({ age: e.age, title: e.icon + ' ' + e.text.split('」')[0].replace('「', ''), note: e.text.split('」').slice(1).join('」').trim() }));
    return rows.sort((a, b) => a.age - b.age);
  }
  function summary(life) {
    const c = life.countryData || countryById(life.country);
    const loc = localize(c);
    const r = window.BornFun ? BornFun.rarity(c) : null;
    const { by, dy } = lifeYears(life);
    return {
      c, loc, r, by, dy,
      name: life.name?.full || life.name?.full_en || '—',
      age: life.deathAge ?? life.age ?? 0,
      sex: life.sex === 'M' ? tx('男', 'Male') : tx('女', 'Female'),
      cause: life.cause ? (typeof causeLabel === 'function' ? causeLabel(life.cause) : life.cause) : '',
      eth: life.ethnicity ? (BornFun.ETH_LABEL ? BornFun.ETH_LABEL(life.ethnicity) : life.ethnicity) : '',
    };
  }
  function pickLives() {
    const list = [];
    if (STATE.life && STATE.life.died) list.push({ key: 'current', life: STATE.life, label: tx('刚走完的这一生', 'The life you just finished') });
    (loadPastLives() || []).forEach((p, i) => {
      if (!p.full) return;
      if (STATE.life && STATE.life.died && i === 0 && p.full.regNumber === STATE.life.regNumber) return;
      const c = countryById(p.country);
      list.push({ key: 'past' + i, life: p.full, label: `${c ? c.flag : ''} ${p.name || '—'} · ${p.age} ${tx('岁', 'y')}` });
    });
    return list;
  }

  /* ---------------- 画布工具 ---------------- */
  const W = 1080, HGT = 1440;
  const imgCache = {};
  const loadImg = (src) => imgCache[src] || (imgCache[src] = new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }));
  const FONT = '"PingFang SC","Microsoft YaHei","Noto Sans SC","Hiragino Sans GB",system-ui,sans-serif';
  const SERIF = '"Songti SC","Noto Serif SC","Source Han Serif SC","STSong",serif';
  function wrap(ctx, text, maxW) {
    const out = [];
    let line = '';
    for (const ch of Array.from(String(text))) {
      const t = line + ch;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = ch.trim() ? ch : ''; } else line = t;
    }
    if (line) out.push(line);
    return out;
  }
  function drawText(ctx, text, x, y, maxW, lh, maxLines) {
    let lines = wrap(ctx, text, maxW);
    if (maxLines && lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/.$/, '…'); }
    lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
    return y + lines.length * lh;
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function bg(ctx, c1, c2) {
    const g = ctx.createLinearGradient(0, 0, W, HGT);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, HGT);
    // 纸纹
    ctx.globalAlpha = 0.06; ctx.fillStyle = '#fff';
    for (let i = 0; i < 40; i++) ctx.fillRect(0, i * 36, W, 1);
    ctx.globalAlpha = 1;
  }
  function paper(ctx, x, y, w, h) { ctx.fillStyle = 'rgba(255,252,245,0.96)'; rr(ctx, x, y, w, h, 36); ctx.fill(); }
  function qr(ctx, text, x, y, size) {
    if (typeof qrcode !== 'function') return;
    const q = qrcode(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount(), cell = size / (n + 2);
    ctx.fillStyle = '#fff'; ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#111';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) ctx.fillRect(x + (c + 1) * cell, y + (r + 1) * cell, Math.ceil(cell), Math.ceil(cell));
  }
  function header(ctx, s, idx, total) {
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.font = `600 30px ${FONT}`; ctx.textBaseline = 'top';
    ctx.fillText(`${tx('模拟人生', 'Life Simulator')} · ${s.c.flag} ${s.name}`, 64, 56);
    ctx.textAlign = 'right'; ctx.fillText(`${idx} / ${total}`, W - 64, 56); ctx.textAlign = 'left';
  }
  async function footer(ctx, withQr) {
    ctx.textBaseline = 'alphabetic';
    if (withQr) {
      qr(ctx, SHARE_URL(), W - 64 - 180, HGT - 64 - 180, 180);
      ctx.fillStyle = '#3a3a3a'; ctx.font = `700 34px ${FONT}`;
      ctx.fillText(tx('你会出生在哪里？', 'Where would you be born?'), 96, HGT - 214);
      ctx.font = `400 26px ${FONT}`; ctx.fillStyle = '#666';
      ctx.fillText(tx('扫码来一段人生 · 模拟人生', 'Scan to live a life'), 96, HGT - 172);
      const logo = await loadImg('assets/zenmatrix-logo.jpg');
      if (logo) ctx.drawImage(logo, 96, HGT - 150, 130, 130 * logo.height / logo.width);
      ctx.fillStyle = '#888'; ctx.font = `400 22px ${FONT}`; ctx.fillText('www.zenmatrix.org', 240, HGT - 104);
    } else {
      const coin = await loadImg('assets/zenmatrix-coin.png');
      if (coin) ctx.drawImage(coin, 64, HGT - 76, 36, 36);
      ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.font = `400 24px ${FONT}`;
      ctx.fillText(`${tx('模拟人生', 'Life Simulator')} · ZenMatrix`, coin ? 110 : 64, HGT - 48);
    }
  }
  async function drawImageCover(ctx, src, x, y, w, h, r) {
    const im = await loadImg(src);
    if (!im) return;
    ctx.save(); rr(ctx, x, y, w, h, r); ctx.clip();
    const sc = Math.max(w / im.width, h / im.height);
    ctx.drawImage(im, x + (w - im.width * sc) / 2, y + (h - im.height * sc) / 2, im.width * sc, im.height * sc);
    ctx.restore();
  }
  function eventList(ctx, evs, x, y, w, maxY) {
    ctx.textBaseline = 'top';
    for (const e of evs) {
      if (y > maxY - 60) break;
      ctx.fillStyle = '#8C1D3C'; ctx.font = `700 30px ${FONT}`;
      ctx.fillText(`${e.age}${tx('岁', '')}`, x, y);
      ctx.font = `400 34px ${FONT}`; ctx.fillStyle = '#2a2a2a';
      y = drawText(ctx, `${e.icon || '·'} ${e.text}`, x + 96, y - 2, w - 96, 48, 3) + 22;
    }
    return y;
  }
  function miniChart(ctx, life, x, y, w, h) {
    const ys = yearly(life);
    ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(x, y + h * i / 4); ctx.lineTo(x + w, y + h * i / 4); ctx.stroke(); }
    if (ys.length < 2) return;
    const maxA = Math.max(ys[ys.length - 1].age, 1);
    const series = [['h', '#2B9A5E'], ['hp', '#E07A2E'], ['k', '#3B6FD4'], ['so', '#9B4FD1']];
    for (const [key, color] of series) {
      const pts = ys.filter(p => p[key] != null);
      if (pts.length < 2) continue;
      ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.beginPath();
      pts.forEach((p, i) => { const px = x + p.age / maxA * w, py = y + h - Math.max(0, Math.min(100, p[key])) / 100 * h; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
      ctx.stroke();
    }
  }

  /* ---------------- 我的照片（本机处理，不上传） ----------------
     不做 AI 换脸：同一张脸依「拍照年龄」分三种呈现 ——
       拍照之前的阶段 → 泛黄旧相片（拍立得边框、颗粒、褪色）
       拍照时的阶段   → 原照片，彩色清晰（「就是现在的你」）
       之后的阶段     → 铅笔速写（「还没到来的你」）
     脸部裁切为 600×600；勾选「记住」时存在本机 localStorage。 */
  const FACE_KEY = 'born-somewhere-v2:ks-face';
  let FACE = null;   // { url, age, img }
  (function loadFace() {
    try {
      const raw = localStorage.getItem(FACE_KEY);
      if (!raw) return;
      const f = JSON.parse(raw);
      if (f && f.url) { FACE = { url: f.url, age: +f.age || 30, img: null }; }
    } catch (e) { FACE = null; }
  })();
  async function faceImg() {
    if (!FACE) return null;
    if (!FACE.img) FACE.img = await loadImg(FACE.url);
    return FACE.img;
  }
  function faceMode(st) {
    if (!FACE) return null;
    const a = FACE.age;
    if (a >= st.min && a <= st.max) return 'now';
    return a > st.max ? 'past' : 'future';
  }
  // 低成本模糊：缩小再放大（所有浏览器都支援，不依赖 ctx.filter）
  function softBlur(src, k) {
    const s = document.createElement('canvas'); s.width = Math.max(1, Math.round(src.width / k)); s.height = Math.max(1, Math.round(src.height / k));
    const sx = s.getContext('2d'); sx.imageSmoothingQuality = 'high'; sx.drawImage(src, 0, 0, s.width, s.height);
    const o = document.createElement('canvas'); o.width = src.width; o.height = src.height;
    const ox = o.getContext('2d'); ox.imageSmoothingQuality = 'high'; ox.drawImage(s, 0, 0, o.width, o.height);
    return o;
  }
  function faceCanvas(img, mode, seed) {
    const N = 600;
    const c = document.createElement('canvas'); c.width = N; c.height = N;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0, N, N);
    if (mode === 'now') return c;
    const d = x.getImageData(0, 0, N, N), p = d.data;
    if (mode === 'past') {
      // 褪色 + 棕褐 + 颗粒 + 暗角；越早的阶段越旧（seed 0..1）
      const fade = 0.25 + 0.25 * seed;
      let r = 1234567;
      for (let i = 0; i < p.length; i += 4) {
        const R = p[i], G = p[i + 1], B = p[i + 2];
        let sr = R * .393 + G * .769 + B * .189, sg = R * .349 + G * .686 + B * .168, sb = R * .272 + G * .534 + B * .131;
        sr = sr * (1 - fade) + 235 * fade; sg = sg * (1 - fade) + 220 * fade; sb = sb * (1 - fade) + 190 * fade;
        r = (r * 1103515245 + 12345) & 0x7fffffff; const n = ((r % 41) - 20) * (0.6 + seed * 0.6);
        const px = (i / 4) % N, py = Math.floor(i / 4 / N), dx = px / N - .5, dy = py / N - .5;
        const vig = 1 - Math.min(0.45, (dx * dx + dy * dy) * 1.5);
        p[i] = Math.min(255, (sr + n) * vig); p[i + 1] = Math.min(255, (sg + n) * vig); p[i + 2] = Math.min(255, (sb + n) * vig);
      }
      x.putImageData(d, 0, 0);
      return c;
    }
    // future：铅笔速写（灰阶 + 反相模糊 + 颜色减淡），再叠一点纸色
    const gray = document.createElement('canvas'); gray.width = N; gray.height = N;
    const gx = gray.getContext('2d'); const gd = gx.createImageData(N, N);
    for (let i = 0; i < p.length; i += 4) { const v = p[i] * .299 + p[i + 1] * .587 + p[i + 2] * .114; gd.data[i] = gd.data[i + 1] = gd.data[i + 2] = 255 - v; gd.data[i + 3] = 255; }
    gx.putImageData(gd, 0, 0);
    const blurred = softBlur(gray, 7 + Math.round(seed * 5)).getContext('2d').getImageData(0, 0, N, N).data;
    const strength = 1 - seed * 0.25;   // 越后面的阶段线条越淡
    for (let i = 0; i < p.length; i += 4) {
      const base = p[i] * .299 + p[i + 1] * .587 + p[i + 2] * .114;
      const inv = blurred[i];
      let v = inv >= 255 ? 255 : Math.min(255, base * 255 / (255 - inv));
      v = 255 - (255 - v) * strength;
      p[i] = Math.min(255, v * 0.98 + 4); p[i + 1] = Math.min(255, v * 0.96 + 6); p[i + 2] = Math.min(255, v * 0.9 + 10);
    }
    x.putImageData(d, 0, 0);
    return c;
  }
  // 依模式把脸放进相框：旧相片 = 拍立得白框微倾斜；现在 = 圆角彩照；速写 = 素描纸
  function drawFaceFrame(ctx, face, mode, x, y, size, tilt, label) {
    ctx.save();
    ctx.translate(x + size / 2, y + size / 2);
    ctx.rotate(tilt);
    const pad = mode === 'past' ? 22 : 14, bottom = mode === 'past' ? 70 : 14;
    ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
    ctx.fillStyle = mode === 'future' ? '#f7f3ea' : '#fffdf8';
    rr(ctx, -size / 2 - pad, -size / 2 - pad, size + pad * 2, size + pad + bottom, mode === 'now' ? 28 : 6); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.save(); rr(ctx, -size / 2, -size / 2, size, size, mode === 'now' ? 20 : 2); ctx.clip();
    ctx.drawImage(face, -size / 2, -size / 2, size, size); ctx.restore();
    if (label) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (mode === 'past') { ctx.fillStyle = '#6b5a44'; ctx.font = `500 28px ${SERIF}`; ctx.fillText(label, 0, size / 2 + 36); }
      else { ctx.fillStyle = 'rgba(255,255,255,.96)'; ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 6; ctx.font = `${mode === 'future' ? 'italic ' : ''}600 28px ${FONT}`; ctx.fillText(label, 0, size / 2 + pad + 34); ctx.shadowColor = 'transparent'; }
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }
  const MODE_LABEL = { past: () => tx('旧相片', 'Old photo'), now: () => tx('就是现在的你', 'This is you now'), future: () => tx('还没到来的你 · 铅笔速写', 'Not yet — a pencil sketch') };
  // 裁切介面：拖曳移动、滑杆缩放，输出 600×600
  function cropUI(file, onDone) {
    const box = $('#ksFaceEdit');
    if (!box) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const V = 260;
      let zoom = 1, ox = 0, oy = 0;
      const base = Math.max(V / img.width, V / img.height);
      box.innerHTML = `<div class="ks-crop"><canvas id="ksCropCv" width="${V}" height="${V}"></canvas>
        <div class="ks-crop-side">
          <label>${tx('缩放', 'Zoom')} <input type="range" id="ksZoom" min="1" max="4" step="0.01" value="1"></label>
          <label>${tx('拍这张照片时我几岁', 'My age in this photo')} <input type="number" id="ksFaceAge" min="1" max="110" value="${FACE ? FACE.age : 30}" class="fun-eth-select"></label>
          <label class="ks-chk"><input type="checkbox" id="ksFaceOwn"> ${tx('这是我本人的照片（或我有权使用）', 'This is my own photo (or I have the right to use it)')}</label>
          <label class="ks-chk"><input type="checkbox" id="ksFaceKeep" checked> ${tx('记在这个浏览器，下次不用再传', 'Remember in this browser')}</label>
          <div class="ks-actions"><button class="primary" id="ksFaceOk" type="button">${tx('用这张', 'Use this')}</button><button class="ghost" id="ksFaceCancel" type="button">${tx('取消', 'Cancel')}</button></div>
          <p class="muted">${tx('拖曳照片调整位置，让脸在正中间。照片只在你的装置上处理，不会上传。', 'Drag to centre your face. Processed on your device only.')}</p>
        </div></div>`;
      const cv = $('#ksCropCv'), cx = cv.getContext('2d');
      const draw = () => {
        const s = base * zoom, w = img.width * s, h = img.height * s;
        ox = Math.min(0, Math.max(V - w, ox)); oy = Math.min(0, Math.max(V - h, oy));
        cx.clearRect(0, 0, V, V); cx.drawImage(img, ox, oy, w, h);
        cx.strokeStyle = 'rgba(255,255,255,.8)'; cx.lineWidth = 2; cx.setLineDash([6, 6]);
        cx.beginPath(); cx.ellipse(V / 2, V / 2 * 0.95, V * 0.3, V * 0.38, 0, 0, Math.PI * 2); cx.stroke(); cx.setLineDash([]);
      };
      ox = (V - img.width * base) / 2; oy = (V - img.height * base) / 2; draw();
      let drag = null;
      cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, ox, oy }; cv.setPointerCapture(e.pointerId); });
      cv.addEventListener('pointermove', (e) => { if (!drag) return; ox = drag.ox + e.clientX - drag.x; oy = drag.oy + e.clientY - drag.y; draw(); });
      cv.addEventListener('pointerup', () => { drag = null; });
      $('#ksZoom').addEventListener('input', (e) => {
        const nz = +e.target.value, s0 = base * zoom, s1 = base * nz;
        ox = V / 2 - (V / 2 - ox) * s1 / s0; oy = V / 2 - (V / 2 - oy) * s1 / s0; zoom = nz; draw();
      });
      $('#ksFaceCancel').addEventListener('click', () => { URL.revokeObjectURL(url); box.innerHTML = ''; });
      $('#ksFaceOk').addEventListener('click', () => {
        if (!$('#ksFaceOwn').checked) { toast(tx('请先确认这是你本人的照片', 'Please confirm this is your own photo')); return; }
        const out = document.createElement('canvas'); out.width = 600; out.height = 600;
        const k = 600 / V, s = base * zoom;
        out.getContext('2d').drawImage(img, ox * k, oy * k, img.width * s * k, img.height * s * k);
        const age = Math.max(1, Math.min(110, Math.round(+$('#ksFaceAge').value || 30)));
        const dataUrl = out.toDataURL('image/jpeg', 0.88);
        FACE = { url: dataUrl, age, img: null };
        if ($('#ksFaceKeep').checked) { try { localStorage.setItem(FACE_KEY, JSON.stringify({ url: dataUrl, age })); } catch (e) { toast(tx('浏览器空间不足，这次先不记住', 'Not enough storage to remember it')); } }
        else { try { localStorage.removeItem(FACE_KEY); } catch (e) { /* ignore */ } }
        URL.revokeObjectURL(url);
        box.innerHTML = '';
        track('keepsake_face', { set: 1 });
        onDone();
      });
    };
    img.onerror = () => { toast(tx('这张图片打不开，换一张试试', 'Could not open that image')); URL.revokeObjectURL(url); };
    img.src = url;
  }
  function faceBar() {
    return FACE
      ? `<div class="ks-face"><img src="${FACE.url}" alt="" class="ks-face-thumb"><div class="ks-face-t"><b>📷 ${tx('使用我的照片', 'Using my photo')}</b><span class="muted">${tx(`拍照年龄 ${FACE.age} 岁：之前的阶段是旧相片，${FACE.age} 岁那段是原照片，之后是铅笔速写`, `Age ${FACE.age} in photo: earlier stages look like old prints, later ones are pencil sketches`)}</span></div>
         <div class="ks-face-btns"><button class="ghost" id="ksFaceChange" type="button">${tx('更换', 'Change')}</button><button class="ghost" id="ksFaceRemove" type="button">${tx('不用照片', 'Remove')}</button></div></div>`
      : `<div class="ks-face"><div class="ks-face-t"><b>📷 ${tx('用我的照片（可选）', 'Use my photo (optional)')}</b><span class="muted">${tx('放一张自己的正面照：拍照那个年龄段用原照片，更早的变成旧相片，之后的变成铅笔速写。只在本机处理。', 'Add a front-facing photo of yourself. Processed on your device only.')}</span></div>
         <div class="ks-face-btns"><button class="primary" id="ksFaceChange" type="button">${tx('上传照片', 'Add photo')}</button></div></div>`;
  }

  /* ---------------- 9 张图 ---------------- */
  async function makePhotos(life) {
    const s = summary(life);
    const stages = STAGES.filter(st => st.min <= s.age && allStageEvents(life, st).length);
    const plan = ['cover', 'birth', ...stages.map(st => st.id), 'data', 'end'].slice(0, 9);
    const total = plan.length;
    const out = [];
    for (let i = 0; i < plan.length; i++) {
      const cv = document.createElement('canvas'); cv.width = W; cv.height = HGT;
      const ctx = cv.getContext('2d');
      const kind = plan[i];
      const st = STAGES.find(x => x.id === kind);
      if (kind === 'cover') {
        bg(ctx, '#1d2b4a', '#8C1D3C');
        header(ctx, s, i + 1, total);
        await drawImageCover(ctx, 'assets/illus-world-people.jpg', 64, 130, W - 128, 640, 40);
        const cimg = FACE ? await faceImg() : null;
        if (cimg) drawFaceFrame(ctx, cimg, 'now', W - 64 - 330, 360, 280, 0.03, '');
        paper(ctx, 64, 810, W - 128, 566);
        ctx.textBaseline = 'top'; ctx.fillStyle = '#8C1D3C'; ctx.font = `600 32px ${FONT}`;
        ctx.fillText(tx('这一生', 'This life'), 112, 860);
        ctx.fillStyle = '#1a1a1a'; ctx.font = `700 84px ${SERIF}`;
        drawText(ctx, s.name, 112, 910, W - 224, 96, 2);
        ctx.font = `400 40px ${FONT}`; ctx.fillStyle = '#333';
        ctx.fillText(`${s.c.flag} ${s.loc.name} · ${fmtBirth(life)} – ${s.dy} · ${s.age} ${tx('岁', 'years')}`, 112, 1110);
        if (s.r) {
          ctx.fillStyle = s.r.tier.color; rr(ctx, 112, 1180, 150, 64, 14); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.font = `800 40px ${FONT}`; ctx.fillText(s.r.tier.id, 132, 1190);
          ctx.fillStyle = '#444'; ctx.font = `400 30px ${FONT}`;
          ctx.fillText(tx(`全球每 1 万个新生儿只有 ${s.r.per10k >= 10 ? Math.round(s.r.per10k) : s.r.per10k.toFixed(1)} 个出生在这里`, `${s.r.per10k.toFixed(1)} in 10,000 newborns are born here`), 286, 1196);
        }
        await footer(ctx, false);
      } else if (kind === 'birth') {
        bg(ctx, '#f3d9b1', '#e7b07a');
        header(ctx, s, i + 1, total);
        await drawImageCover(ctx, 'assets/illus-baby-book.jpg', 64, 130, W - 128, 520, 40);
        paper(ctx, 64, 690, W - 128, 686);
        ctx.textBaseline = 'top'; ctx.fillStyle = '#8C1D3C'; ctx.font = `700 56px ${SERIF}`;
        ctx.fillText(tx('出生登记', 'Birth record'), 112, 740);
        const fam = life.family || {};
        const father = (fam.parents || []).find(p => p.sex === 'M'), mother = (fam.parents || []).find(p => p.sex === 'F');
        const rows = [
          [tx('出生', 'Born'), `${fmtBirth(life)} · ${s.c.flag} ${s.loc.name}`],
          [tx('性别', 'Sex'), s.sex + (s.eth ? ` · ${s.eth}` : '')],
          [tx('出生地', 'Place'), life.stats?.birthPlaceType === 'rural' ? tx('乡村', 'Rural') : tx('城市', 'Urban')],
          [tx('家境', 'Household'), `Q${life.stats?.incomeQuartile || 2} / 4`],
          [tx('父亲', 'Father'), father ? (typeof father.name === 'string' ? father.name : father.name?.full || '—') : '—'],
          [tx('母亲', 'Mother'), mother ? (typeof mother.name === 'string' ? mother.name : mother.name?.full || '—') : '—'],
          [tx('预期寿命', 'Life expectancy'), `${effectiveLe(s.c, life)} ${tx('岁', 'years')}`],
        ];
        let y = 840;
        for (const [k, v] of rows) {
          ctx.fillStyle = '#888'; ctx.font = `400 30px ${FONT}`; ctx.fillText(k, 112, y);
          ctx.fillStyle = '#222'; ctx.font = `600 34px ${FONT}`; drawText(ctx, v, 330, y - 2, W - 440, 42, 1);
          y += 70;
        }
        await footer(ctx, false);
      } else if (st) {
        bg(ctx, st.color[0], st.color[1]);
        header(ctx, s, i + 1, total);
        let top = 130;
        const fmode = faceMode(st), fimg = fmode ? await faceImg() : null;
        if (fimg) {
          // 我的照片：左边相框，右边阶段名称
          const order = STAGES.indexOf(st), photoStage = STAGES.findIndex(x => FACE.age >= x.min && FACE.age <= x.max);
          const dist = Math.min(1, Math.abs(order - (photoStage < 0 ? STAGES.length : photoStage)) / 3);
          const fc = faceCanvas(fimg, fmode, dist);
          drawFaceFrame(ctx, fc, fmode, 110, 168, 330, fmode === 'past' ? -0.05 : fmode === 'future' ? 0.035 : 0, MODE_LABEL[fmode]());
          ctx.textBaseline = 'top'; ctx.fillStyle = 'rgba(255,255,255,.95)';
          ctx.font = `120px ${FONT}`; ctx.fillText(st.icon, 520, 170);
          ctx.font = `700 110px ${SERIF}`; ctx.fillText(tx(st.zh, st.en), 520, 300);
          ctx.font = `400 40px ${FONT}`; ctx.fillText(`${st.min} – ${Math.min(st.max, s.age)} ${tx('岁', 'years')}`, 526, 440);
          top = 600;
        } else if (st.img) { await drawImageCover(ctx, st.img, 64, 130, W - 128, 420, 40); top = 590; }
        else {
          ctx.font = `200px ${FONT}`; ctx.textBaseline = 'top'; ctx.fillText(st.icon, 64, 150);
          ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = `700 120px ${SERIF}`; ctx.fillText(tx(st.zh, st.en), 330, 180);
          ctx.font = `400 40px ${FONT}`; ctx.fillText(`${st.min} – ${Math.min(st.max, s.age)} ${tx('岁', 'years')}`, 336, 330);
          top = 470;
        }
        paper(ctx, 64, top, W - 128, HGT - top - 110);
        ctx.textBaseline = 'top';
        const paperTitle = !fimg && st.img;
        if (paperTitle) {
          ctx.fillStyle = '#8C1D3C'; ctx.font = `700 60px ${SERIF}`; ctx.fillText(`${st.icon} ${tx(st.zh, st.en)}`, 112, top + 44);
          ctx.fillStyle = '#888'; ctx.font = `400 32px ${FONT}`; ctx.fillText(`${st.min} – ${Math.min(st.max, s.age)} ${tx('岁', 'years')}`, 532, top + 64);
        }
        eventList(ctx, stageEvents(life, st, paperTitle ? 4 : 5), 112, top + (paperTitle ? 150 : 56), W - 224, HGT - 130);
        await footer(ctx, false);
      } else if (kind === 'data') {
        bg(ctx, '#203a43', '#2c5364');
        header(ctx, s, i + 1, total);
        paper(ctx, 64, 130, W - 128, HGT - 240);
        ctx.textBaseline = 'top'; ctx.fillStyle = '#8C1D3C'; ctx.font = `700 60px ${SERIF}`;
        ctx.fillText(tx('一生的轨迹', 'The shape of a life'), 112, 180);
        miniChart(ctx, life, 112, 300, W - 224, 420);
        const legend = [[tx('健康', 'Health'), '#2B9A5E'], [tx('幸福', 'Happiness'), '#E07A2E'], [tx('知识', 'Knowledge'), '#3B6FD4'], [tx('人际', 'Social'), '#9B4FD1']];
        legend.forEach(([n, c], k) => { ctx.fillStyle = c; ctx.fillRect(112 + k * 220, 760, 40, 14); ctx.fillStyle = '#444'; ctx.font = `400 28px ${FONT}`; ctx.fillText(n, 162 + k * 220, 748); });
        const st2 = life.stats || {};
        const nums = [[tx('最终健康', 'Health'), Math.round(st2.health || 0)], [tx('最终幸福', 'Happiness'), Math.round(st2.happiness || 0)], [tx('最终知识', 'Knowledge'), Math.round(st2.knowledge || 0)], [tx('最终人际', 'Social'), Math.round(st2.social || 0)], [tx('净资产 (US$)', 'Net worth (US$)'), Math.round(st2.netAssets || 0).toLocaleString()], [tx('做过的抉择', 'Choices made'), choiceRows(life).length]];
        nums.forEach(([k, v], j) => {
          const cx = 112 + (j % 2) * 440, cy = 840 + Math.floor(j / 2) * 150;
          ctx.fillStyle = '#888'; ctx.font = `400 28px ${FONT}`; ctx.fillText(k, cx, cy);
          ctx.fillStyle = '#1a1a1a'; ctx.font = `700 60px ${FONT}`; ctx.fillText(String(v), cx, cy + 40);
        });
        await footer(ctx, false);
      } else if (kind === 'end') {
        bg(ctx, '#2b2235', '#4b3b5c');
        header(ctx, s, i + 1, total);
        await drawImageCover(ctx, 'assets/illus-memorial-lantern.jpg', 64, 130, W - 128, 460, 40);
        paper(ctx, 64, 630, W - 128, 746);
        ctx.textBaseline = 'top'; ctx.fillStyle = '#8C1D3C'; ctx.font = `700 60px ${SERIF}`;
        ctx.fillText(tx('这一段人生走完了', 'This life has ended'), 112, 680);
        ctx.fillStyle = '#333'; ctx.font = `400 36px ${FONT}`;
        ctx.fillText(`${s.age} ${tx('岁', 'years')}${s.cause ? ' · ' + s.cause : ''}`, 112, 770);
        const quotes = Object.entries(life.quotes || {}).filter(([, q]) => q && !/自動|自动|auto/i.test(q));
        let y = 850;
        if (quotes.length) {
          const [qa, qq] = quotes[quotes.length - 1];
          ctx.fillStyle = '#555'; ctx.font = `italic 400 34px ${SERIF}`;
          y = drawText(ctx, `「${qq}」—— ${qa} ${tx('岁', 'y/o')}`, 112, y, W - 224, 48, 3) + 20;
        } else {
          const last = stageEvents(life, { min: Math.max(0, s.age - 15), max: s.age }, 1)[0];
          if (last) { ctx.fillStyle = '#555'; ctx.font = `400 32px ${FONT}`; y = drawText(ctx, `${tx('最后的时刻', 'Last moment')}：${last.text}`, 112, y, W - 224, 46, 3) + 20; }
        }
        const ach = (life._fun?.fresh || []).map(id => (BornFun.ACHV || []).find(a => a.id === id)).filter(Boolean);
        if (ach.length) { ctx.fillStyle = '#7a5a00'; ctx.font = `600 30px ${FONT}`; drawText(ctx, `🏆 ${ach.map(a => a.icon + ' ' + tx(a.zh, a.en)).join('  ')}`, 112, y, W - 224, 44, 2); }
        await footer(ctx, true);
      }
      cv._kind = kind;
      out.push(cv);
    }
    return out;
  }
  const toBlob = (cv) => new Promise(res => cv.toBlob(b => res(b), 'image/jpeg', 0.9));

  /* 九宫格拼成一张：朋友圈 / 系统分享只要一张图，最稳 */
  async function makeCollage(life, photos) {
    const s = summary(life);
    const n = photos.length, cols = 3, rows = Math.ceil(n / cols);
    const M = 28, G = 12, TOP = 200, BOT = 250;
    const cw = Math.floor((W - M * 2 - G * (cols - 1)) / cols), ch = Math.round(cw * HGT / W);
    const CH = TOP + rows * ch + (rows - 1) * G + BOT;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = CH;
    const ctx = cv.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, W, CH); g.addColorStop(0, '#2B1B3D'); g.addColorStop(1, '#8C1D3C');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, CH);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
    ctx.fillStyle = '#F39C12'; ctx.font = `800 64px ${FONT}`;
    ctx.fillText(tx('我的另一种人生', 'My other life'), W / 2, 96);
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = `400 32px ${FONT}`;
    ctx.fillText(tx(`投胎到 ${s.c.flag} ${s.loc.name} 之后，发生了这些……`, `Born in ${s.c.flag} ${s.loc.name}, and then…`), W / 2, 156);
    ctx.textAlign = 'left';
    photos.forEach((p, i) => {
      const x = M + (i % cols) * (cw + G), y = TOP + Math.floor(i / cols) * (ch + G);
      ctx.save(); rr(ctx, x, y, cw, ch, 14); ctx.clip(); ctx.drawImage(p, x, y, cw, ch); ctx.restore();
    });
    const fy = CH - BOT + 30;
    ctx.fillStyle = 'rgba(255,252,245,0.97)'; rr(ctx, M, fy, W - M * 2, BOT - 58, 24); ctx.fill();
    const qs = BOT - 98;
    qr(ctx, SHARE_URL(), W - M - 20 - qs, fy + 20, qs);
    ctx.fillStyle = '#2B1B3D'; ctx.font = `800 40px ${FONT}`;
    ctx.fillText(tx('下辈子，你会出生在哪里？', 'Where would YOU be born?'), M + 32, fy + 70);
    ctx.fillStyle = '#8C1D3C'; ctx.font = `600 28px ${FONT}`;
    ctx.fillText(tx('扫码抽一次命运 · 抽到哪里都不能重来', 'Scan to roll your fate. No do-overs.'), M + 32, fy + 118);
    ctx.fillStyle = '#888'; ctx.font = `400 24px ${FONT}`;
    ctx.fillText(SITE().replace(/^https?:\/\//, '').replace(/\/$/, ''), M + 32, fy + 160);
    return cv;
  }

  /* 朋友圈文案：不晒数据，留悬念 + 激将 + 低门槛；可「换一条」 */
  const HOOKS = [
    (s, u) => [`如果人生能重来，你敢让命运替你选出生地吗？我抽到了${s.c.flag}${s.loc.name}，结局完全没想到……10 分钟，你也来抽一次 👉 ${u}`, `If you could be born again, would you let fate pick where? I got ${s.c.flag} ${s.loc.name} and never saw the ending coming. 10 minutes. Your turn 👉 ${u}`],
    (s, u) => [`刚在《模拟人生》里过完了一辈子，看到最后一张有点破防 🥲 换个地方出生，人生能差这么多。你会投胎到哪里？👉 ${u}`, `Just lived a whole life in Life Simulator and the last picture got me 🥲 Where would you be born? 👉 ${u}`],
    (s, u) => [`别问我这辈子过得怎么样，图里都有 😏 先猜猜你下辈子会出生在哪？抽到哪里都不许重来 👉 ${u}`, `Don't ask how my life went, it's all in the pictures 😏 Guess where you'd be born next time. No do-overs 👉 ${u}`],
    (s, u) => [`全世界每秒有 4 个婴儿出生，下一个会是你吗？我这一生从${s.c.flag}${s.loc.name}开始……来看看你的剧本 👉 ${u}`, `4 babies are born every second. Mine started in ${s.c.flag} ${s.loc.name}… see what script you get 👉 ${u}`],
    (s, u) => [`测完才发现：同一个人，换个国家出生，命运能差十万八千里。敢不敢来比比谁的人生更精彩？👉 ${u}`, `Same person, different birthplace, totally different fate. Dare to compare lives? 👉 ${u}`],
  ];
  let hookIdx = null;
  function caption(life, next) {
    const s = summary(life);
    if (hookIdx === null) { const k = String(life.regNumber || life.name?.full || ''); let h = 0; for (const c of k) h = (h * 31 + c.charCodeAt(0)) >>> 0; hookIdx = h % HOOKS.length; }
    if (next) hookIdx = (hookIdx + 1) % HOOKS.length;
    const [zh, en] = HOOKS[hookIdx](s, SHARE_URL());
    return tx(zh, en);
  }
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); return true; } catch (e) {
      const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      ta.remove(); return ok;
    }
  }
  function downloadBlob(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const fileBase = (life) => `${(life.name?.full_en || life.name?.full || 'life').replace(/[^\w一-鿿-]+/g, '_')}_${life.country}`;

  /* ---------------- 珍藏视窗 ---------------- */
  let current = null;   // { life, photos: [canvas], blobs: [Blob] }
  function modal() {
    let m = $('#ksModal');
    if (!m) {
      m = document.createElement('div'); m.id = 'ksModal'; m.className = 'modal fun-modal';
      m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-ks-close]')) m.hidden = true; });
      document.body.appendChild(m);
    }
    return m;
  }
  async function openKeepsake(which) {
    const lives = pickLives();
    const m = modal();
    if (!lives.length) {
      m.innerHTML = `<div class="modal-card fun-card ks-card"><div class="fun-card-head"><h3>🎁 ${tx('珍藏这段人生', 'Keepsakes')}</h3><button class="ghost" data-ks-close>✕</button></div><p>${tx('先走完一段人生，才能用它做珍藏。', 'Finish a life first, then turn it into keepsakes.')}</p></div>`;
      m.hidden = false; return;
    }
    const sel = lives.find(l => l.key === which) || lives[0];
    m.innerHTML = `<div class="modal-card fun-card ks-card">
      <div class="fun-card-head"><h3>🎁 ${tx('珍藏这段人生', 'Keepsakes')}</h3><button class="ghost" data-ks-close>✕</button></div>
      <label class="ks-pick">${tx('选择人生', 'Choose a life')}
        <select id="ksLife" class="fun-eth-select">${lives.map(l => `<option value="${l.key}" ${l.key === sel.key ? 'selected' : ''}>${esc(H(l.label))}</option>`).join('')}</select></label>
      <div id="ksFaceWrap">${faceBar()}</div>
      <div id="ksFaceEdit"></div>
      <input type="file" id="ksFaceFile" accept="image/*" hidden>
      <div class="ks-tabs">
        <button class="ks-tab active" data-ks-tab="photos">📸 ${tx('照片组合 · 朋友圈', 'Photo set')}</button>
        <button class="ks-tab" data-ks-tab="video">🎬 ${tx('人生影片', 'Videos')}</button>
        <button class="ks-tab" data-ks-tab="wish">🌙 ${tx('未竟的心愿', 'Unfinished wish')}</button>
        <button class="ks-tab" data-ks-tab="album">📖 ${tx('人生相簿 PDF', 'Album (PDF)')}</button>
        <button class="ks-tab" data-ks-tab="record">📒 ${tx('人生纪录册', 'Record book')}</button>
        <button class="ks-tab" data-ks-tab="memorial">🕯️ ${tx('公开追思', 'Public memorial')}</button>
      </div>
      <div id="ksBody" class="ks-body"></div>
      <p class="muted ks-foot">${tx('除了「公开追思」，全部在你的装置上制作，不会上传。', 'Except for public memorials, everything is made on your device and nothing is uploaded.')}</p>
    </div>`;
    m.hidden = false;
    $('#ksLife', m).addEventListener('change', (e) => openKeepsake(e.target.value));
    m.querySelectorAll('[data-ks-tab]').forEach(b => b.addEventListener('click', () => {
      m.querySelectorAll('[data-ks-tab]').forEach(x => x.classList.toggle('active', x === b));
      renderTab(b.dataset.ksTab);
    }));
    current = { key: sel.key, life: sel.life, photos: null, blobs: null };
    hookIdx = null;
    wireFace();
    renderTab('photos');
  }
  function activeTab() { return document.querySelector('#ksModal .ks-tab.active')?.dataset.ksTab || 'photos'; }
  function faceChanged() {
    if (current) { current.photos = null; current.blobs = null; current.videos = null; current.lastVideo = null; }
    const w = $('#ksFaceWrap'); if (w) w.innerHTML = faceBar();
    wireFace();
    renderTab(activeTab());
  }
  function wireFace() {
    const file = $('#ksFaceFile');
    $('#ksFaceChange')?.addEventListener('click', () => file && file.click());
    $('#ksFaceRemove')?.addEventListener('click', () => {
      FACE = null; try { localStorage.removeItem(FACE_KEY); } catch (e) { /* ignore */ }
      track('keepsake_face', { set: 0 });
      faceChanged();
    });
    if (file && !file._wired) {
      file._wired = true;
      file.addEventListener('change', () => { const f = file.files && file.files[0]; file.value = ''; if (f) cropUI(f, faceChanged); });
    }
  }
  async function ensurePhotos() {
    if (current.photos) return;
    current.photos = await makePhotos(current.life);
    current.blobs = await Promise.all(current.photos.map(toBlob));
    current.collage = await makeCollage(current.life, current.photos);
    current.collageBlob = await toBlob(current.collage);
  }
  async function renderTab(tab) {
    const body = $('#ksBody');
    if (!body || !current) return;
    if (tab === 'photos') {
      body.innerHTML = `<div class="ks-loading">${tx('正在制作照片⋯', 'Making photos…')}</div>`;
      await ensurePhotos();
      if (activeTab() !== 'photos') return;   // 照片还在做时玩家已切到别的分页（例如从「人生影片」入口打开）
      const wx = isWeChat();
      const urls = current.photos.map(cv => cv.toDataURL('image/jpeg', 0.85));
      const collageUrl = current.collage.toDataURL('image/jpeg', 0.88);
      const canShareFiles = (list) => { try { return !!(navigator.canShare && navigator.canShare({ files: list })); } catch (e) { return false; } };
      const asFile = (b, i) => new File([b], `${fileBase(current.life)}_${i === 'all' ? 'moments' : i + 1}.jpg`, { type: 'image/jpeg' });
      let mode = 'one';   // one = 一张拼图（默认，最稳）；nine = 9 张分开
      body.innerHTML = `
        <div class="ks-mode" role="tablist">
          <button class="ks-mode-b active" data-ks-mode="one" type="button">🧩 ${tx('拼成一张（推荐）', 'One collage (recommended)')}</button>
          <button class="ks-mode-b" data-ks-mode="nine" type="button">🔲 ${tx(`${urls.length} 张分开`, `${urls.length} separate`)}</button>
        </div>
        <div class="ks-one" id="ksOne"><img src="${collageUrl}" alt="${tx('朋友圈拼图', 'Collage')}" data-ks-img="all"></div>
        <div class="ks-grid" id="ksNine" hidden>${urls.map((u, i) => `<img src="${u}" alt="${i + 1}" data-ks-img="${i}" loading="lazy">`).join('')}</div>
        <div class="ks-caption"><div class="ks-cap-k">${tx('朋友圈文案', 'Caption')}<button class="ks-cap-next" id="ksCapNext" type="button">🔄 ${tx('换一条', 'Another')}</button></div><div class="ks-cap-v" id="ksCap">${esc(H(caption(current.life)))}</div></div>
        <div class="ks-actions">
          <button class="primary" id="ksShareMoments" type="button">💚 ${tx('分享到微信朋友圈', 'Share to WeChat Moments')}</button>
          <button class="ghost" id="ksCopyCap" type="button">📋 ${tx('复制文案', 'Copy caption')}</button>
          ${wx ? '' : `<button class="ghost" id="ksDownloadAll" type="button">⬇️ ${tx('下载图片', 'Download')}</button>`}
        </div>
        <div class="ks-how" id="ksHow" hidden></div>`;
      const how = (html) => { const h = $('#ksHow'); h.innerHTML = html; h.hidden = false; };
      const capText = () => $('#ksCap').textContent;
      body.querySelectorAll('[data-ks-mode]').forEach(b => b.addEventListener('click', () => {
        mode = b.dataset.ksMode;
        body.querySelectorAll('[data-ks-mode]').forEach(x => x.classList.toggle('active', x === b));
        $('#ksOne').hidden = mode !== 'one'; $('#ksNine').hidden = mode !== 'nine'; $('#ksHow').hidden = true;
      }));
      $('#ksCapNext').addEventListener('click', () => { $('#ksCap').textContent = H(caption(current.life, true)); });
      $('#ksCopyCap').addEventListener('click', async () => { const ok = await copyText(capText()); toast(ok ? tx('文案已复制', 'Caption copied') : tx('复制失败，请手动选取', 'Copy failed')); });
      const downloadNow = () => {
        if (mode === 'one') downloadBlob(current.collageBlob, `${fileBase(current.life)}_moments.jpg`);
        else current.blobs.forEach((b, i) => setTimeout(() => downloadBlob(b, `${fileBase(current.life)}_${i + 1}.jpg`), i * 350));
      };
      $('#ksDownloadAll')?.addEventListener('click', () => { downloadNow(); track('keepsake_photos_download', { n: mode === 'one' ? 1 : current.blobs.length, mode }); });
      $('#ksShareMoments').addEventListener('click', async () => {
        const cap = capText();
        const files = mode === 'one' ? [asFile(current.collageBlob, 'all')] : current.blobs.map(asFile);
        const canFiles = canShareFiles(files);
        // 先叫起分享选单（要在点击的「使用者手势」内），文案同时复制
        const copied = copyText(cap);
        track('keepsake_share_moments', { via: wx ? 'wechat-browser' : canFiles ? 'share-sheet' : 'download', mode });
        if (wx) {
          await copied;
          how(mode === 'one'
            ? `<b>${tx('在微信里发朋友圈（10 秒）：', 'In WeChat:')}</b><ol><li>${tx('长按上面的拼图 →「保存图片」', 'Long-press the collage → Save image')}</li><li>${tx('「发现 → 朋友圈」→ 右上角相机 →「从相册选择」这张图', 'Moments → camera → pick that image')}</li><li>${tx('文案已复制，长按输入框「粘贴」就好', 'The caption is copied: just paste')}</li></ol>`
            : `<b>${tx('在微信里发朋友圈：', 'In WeChat:')}</b><ol><li>${tx('长按每一张图 →「保存图片」', 'Long-press each image → Save')}</li><li>${tx(`「发现 → 朋友圈」→ 相机 →「从相册选择」，按顺序选 ${current.photos.length} 张`, 'Moments → camera → choose the photos in order')}</li><li>${tx('文案已复制，直接粘贴', 'The caption is copied: just paste')}</li></ol>`);
          $('#ksOne img')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        if (canFiles) {
          try {
            await navigator.share({ files, text: cap, title: tx('模拟人生', 'Life Simulator') });
            how(tx('在分享选单选「微信」→「朋友圈」。如果文案没带过去，长按输入框「粘贴」即可（已复制）。', 'Pick WeChat → Moments. If the caption is missing, paste it (it is copied).'));
            return;
          } catch (e) { if (e && e.name === 'AbortError') return; }
        }
        await copied;
        downloadNow();
        how(`<b>${tx('电脑上：', 'On a computer:')}</b> ${tx(mode === 'one' ? '拼图已下载，文案已复制。传到手机（例如「文件传输助手」）后发朋友圈即可。' : '图片已下载，文案已复制。传到手机（例如「文件传输助手」）后按顺序发朋友圈。', 'The image is downloaded and the caption copied. Send it to your phone (e.g. WeChat File Transfer) and post it to Moments.')}`);
      });
      body.querySelectorAll('[data-ks-img]').forEach(im => im.addEventListener('click', () => { if (!wx) window.open(im.src, '_blank'); }));
    } else if (tab === 'album') {
      body.innerHTML = `<p>${tx('一本可以打印、也可以存成 PDF 的小书：封面、出生登记、每个人生阶段的完整纪录、做过的抉择、家人与结尾。', 'A printable book you can also save as PDF: cover, birth record, every stage of the life, choices, family and ending.')}</p>
        <ol class="ks-steps"><li>${tx('按下「制作相簿」，会打开列印视窗', 'Press "Make album" to open the print dialog')}</li><li>${tx('目的地选「另存为 PDF」（建议纸张 A5 或 A4、开启背景图形）', 'Choose "Save as PDF" (A5/A4, background graphics on)')}</li></ol>
        <div class="ks-actions"><button class="primary" id="ksAlbum" type="button">📖 ${tx('制作相簿', 'Make album')}</button><button class="ghost" id="ksAlbumHtml" type="button">⬇️ ${tx('下载相簿网页档', 'Download album HTML')}</button></div>
        ${isWeChat() ? `<p class="ks-warn">${tx('微信内建浏览器不支援列印。请点右上角「⋯」→「在浏览器打开」，或先下载相簿网页档。', 'WeChat\'s browser cannot print. Open in your browser, or download the album HTML.')}</p>` : ''}`;
      $('#ksAlbum').addEventListener('click', async () => { await ensurePhotos(); await ensureWish(); printAlbum(current.life, current.photos); track('keepsake_album', { mode: 'print' }); });
      $('#ksAlbumHtml').addEventListener('click', async () => { await ensurePhotos(); await ensureWish(); downloadBlob(new Blob([albumHtml(current.life, current.photos, false)], { type: 'text/html;charset=utf-8' }), `${fileBase(current.life)}_album.html`); track('keepsake_album', { mode: 'html' }); });
    } else if (tab === 'memorial') {
      memorialTab(body);
    } else if (tab === 'wish') {
      wishTab(body);
    } else if (tab === 'video') {
      videoTab(body);
    } else if (tab === 'record') {
      const ys = yearly(current.life);
      body.innerHTML = `<p>${tx('一个 HTML 档：逐年表格与图表、家人、做过的抉择与整段人生的纪录；另附逐年表格 CSV（可用 Excel / Numbers 打开）。', 'One HTML file with the yearly table and charts, family, choices and the full record, plus a CSV of the yearly table.')}</p>
        <p class="muted">${tx(`逐年资料：${ys.length} 笔`, `Yearly rows: ${ys.length}`)}${current.life._yearly ? '' : tx('（这段人生来自旧版本，只有每 5 年的取样）', ' (older life — sampled every 5 years)')}</p>
        <div class="ks-actions"><button class="primary" id="ksRecord" type="button">📒 ${tx('下载纪录册 HTML', 'Download record book')}</button><button class="ghost" id="ksCsv" type="button">📊 ${tx('下载逐年 CSV', 'Download yearly CSV')}</button></div>`;
      $('#ksRecord').addEventListener('click', () => { downloadBlob(new Blob([recordHtml(current.life)], { type: 'text/html;charset=utf-8' }), `${fileBase(current.life)}_record.html`); track('keepsake_record', { fmt: 'html' }); });
      $('#ksCsv').addEventListener('click', () => { downloadBlob(new Blob(['﻿' + csv(current.life)], { type: 'text/csv;charset=utf-8' }), `${fileBase(current.life)}_yearly.csv`); track('keepsake_record', { fmt: 'csv' }); });
    }
  }

  /* ---------------- v6.24：未竟的心愿（画出那段人生不曾有过的一天；程序绘图，不用 AI） ----------------
     依这一生「缺了什么」挑一个心愿：太早离开 → 上学第一天／二十岁生日；没遇见伴侣 → 海边日落；
     没有孩子 → 放风筝；走得比预期早 → 一起变老；没上大学 → 毕业典礼；华人 → 回家吃团圆饭；
     其余 → 去远方看雪／极光／海。用登记编号当种子，同一段人生永远是同一个心愿。 */
  function seedRng(str) {
    let h = 1779033703 ^ String(str).length;
    for (const ch of String(str)) { h = Math.imul(h ^ ch.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
    return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  }
  const nmOf = (n) => (typeof n === 'string' ? n : (n && (n.full || n.full_en)) || '');
  const TROPICAL = new Set(['eap', 'sa', 'ssa', 'lac', 'mena']);
  const TRIPS = [
    { id: 'NOR', kind: 'aurora', zh: '去看一次极光', en: 'See the northern lights', line: ['夜空忽然亮起绿色的光，像有人在天上慢慢拉开窗帘。TA 站在雪地里，很久都说不出话。', 'The sky lit up green, like a curtain slowly drawn open. TA stood in the snow, speechless for a long time.'] },
    { id: 'JPN', kind: 'snow', zh: '去看一场真正的雪', en: 'See real snow fall', line: ['雪一片一片落在肩上。TA 伸出手，接住了人生的第一片雪花，笑得像个孩子。', 'Snow settled on TA\'s shoulders. TA caught the first snowflake of a lifetime and laughed like a child.'] },
    { id: 'MDV', kind: 'sea', zh: '去看一次蓝得不像真的海', en: 'See a sea too blue to be real', line: ['海水蓝得不像真的。TA 光着脚在沙滩上走了很久，把烦恼一件一件丢进浪里。', 'The water was impossibly blue. TA walked barefoot for hours, dropping every worry into the waves.'] },
  ];
  function wishFor(life) {
    const s = summary(life), st = life.stats || {}, age = s.age;
    const rnd = seedRng(life.regNumber || s.name);
    const fam = life.family || {};
    const mother = nmOf((fam.parents || []).find(p => p.sex === 'F')?.name) || tx('家人', 'family');
    const father = nmOf((fam.parents || []).find(p => p.sex === 'M')?.name) || tx('家人', 'family');
    const partner = nmOf(st.partner?.name || fam.partner?.name);
    const first = (life.name && (life.name.first || life.name.full)) || s.name;
    const le = typeof effectiveLe === 'function' ? effectiveLe(s.c, life) : (s.c.le || 75);
    const chinese = life.ethnicity === 'chinese' || ['CHN', 'TWN', 'HKG', 'MAC'].includes(life.country);
    const kids = (st.kids || fam.kids || []).length;
    const by = s.by;
    const cand = [];
    if (age < 7) cand.push('school');
    if (age < 20) cand.push('grow');
    if (age >= 20 && !partner && !st.married) cand.push('love');
    if (age >= 28 && !kids) cand.push('child');
    if (age >= 30 && age < le - 8) cand.push('old');
    if (age >= 22 && (st.education || 0) < 4) cand.push('study');
    if (chinese && age >= 18) cand.push('reunion');
    cand.push('travel');
    const type = cand.length > 1 && rnd() < 0.3 ? cand[1] : cand[0];
    let trip = TRIPS[Math.floor(rnd() * TRIPS.length)];
    if (type === 'travel' && TROPICAL.has(s.c.region) && trip.kind === 'sea') trip = TRIPS[rnd() < 0.5 ? 0 : 1];
    if (trip.id === life.country) trip = TRIPS.find(t => t.id !== life.country);
    const dest = countryById(trip.id);
    const destName = dest ? `${dest.flag} ${localize(dest).name}` : '';
    const W_ = {
      school: { scene: 'school', y: by + 6, zh: ['上学的第一天', `${by + 6} 年 9 月 1 日早上，${first}背着新书包，紧紧牵着${mother}的手走进校门。回头挥手的时候，一点也不害怕。`], en: ['The first day of school', `On a September morning in ${by + 6}, ${first} walked through the school gate with a brand-new bag, holding ${mother}'s hand, and waved back without a trace of fear.`] },
      grow: { scene: 'party', y: by + 20, zh: ['过一个平凡的二十岁生日', `${by + 20} 年，${first}二十岁。朋友们挤在小小的房间里唱生日歌，蜡烛一口气就吹灭了，许的愿望谁也不肯说。`], en: ['An ordinary twentieth birthday', `In ${by + 20}, ${first} turned twenty. Friends crowded into a tiny room to sing; the candles went out in one breath, and the wish stayed a secret.`] },
      love: { scene: 'sunset', y: by + Math.min(27, Math.max(20, age - 1)), zh: ['遇见一个人，一起看一次日落', `${by + Math.min(27, Math.max(20, age - 1))} 年秋天的傍晚，${first}在海边遇见一个笑起来很好看的人。两个人聊了很久，直到太阳沉进海里。后来的故事，本来会很长很长。`], en: ['To meet someone and watch a sunset together', `One autumn evening in ${by + Math.min(27, Math.max(20, age - 1))}, ${first} met someone with a lovely smile by the sea. They talked until the sun sank into the water. The story after that would have been a long one.`] },
      child: { scene: 'kite', y: by + 36, zh: ['带自己的孩子去放风筝', `${by + 36} 年春天，风刚刚好。${first}牵着孩子跑上山坡，风筝一下子就飞了起来。孩子回头大喊：「再高一点！」`], en: ['To fly a kite with a child of their own', `Spring ${by + 36}, and the wind was just right. ${first} ran up the hill hand in hand with a little one, and the kite leapt into the sky. "Higher!" the child shouted.`] },
      old: { scene: 'bench', y: by + 80, zh: ['和最重要的人一起慢慢变老', `${by + 80} 年，${first} 80 岁。和${partner || tx('老朋友', 'an old friend')}坐在常去的那张长椅上，看落叶一片一片掉下来。谁也没说话，也不需要说话。`], en: ['To grow old slowly with someone dear', `In ${by + 80}, ${first} is 80, sitting with ${partner || 'an old friend'} on the usual bench, watching the leaves fall one by one. No one speaks; no one needs to.`] },
      study: { scene: 'grad', y: by + 22, zh: ['穿上学士服的那一天', `${by + 22} 年 6 月，${first}穿上学士服，把帽子用力抛向天空。台下的${mother}和${father}一直在擦眼泪。`], en: ['The day of a graduation gown', `June ${by + 22}: ${first} threw the cap high into the sky, while ${mother} and ${father} kept wiping their eyes.`] },
      reunion: { scene: 'home', y: by + Math.max(18, age - 1), zh: ['回家吃一顿团圆饭', `${by + Math.max(18, age - 1)} 年除夕，${first}推开家门，饭菜的香味先跑了出来。厨房里有人喊：「洗手吃饭啦！」一家人围着桌子，灯很暖。`], en: ['To come home for a reunion dinner', `New Year's Eve ${by + Math.max(18, age - 1)}. ${first} opened the door and the smell of dinner rushed out. "Wash your hands, food's ready!" The whole family round one table, under a warm light.`] },
      travel: { scene: trip.kind, y: by + Math.min(40, Math.max(18, age - 1)), zh: [trip.zh, `${by + Math.min(40, Math.max(18, age - 1))} 年冬天，${first}第一次离开${s.loc.name}，飞到${destName}。${trip.line[0]}`], en: [trip.en, `Winter ${by + Math.min(40, Math.max(18, age - 1))}: ${first} left ${s.loc.name} for the first time and flew to ${destName}. ${trip.line[1]}`] },
    };
    const w = W_[type];
    const [title, story] = isZh() ? w.zh : w.en;
    return { type, scene: w.scene, year: w.y, title, story: isZh() ? story.replace(/TA\s?/g, life.sex === 'F' ? '她' : '他') : story.replace(/(^|[.!?] )TA/g, (m, p) => p + (life.sex === 'F' ? 'She' : 'He')).replace(/TA/g, life.sex === 'F' ? 'she' : 'he'), rnd: seedRng((life.regNumber || '') + type) };
  }
  /* 场景绘图：粉彩、柔光、颗粒 */
  function skyG(ctx, x, y, w, h, mode) {
    const C = { dawn: ['#ffd9c0', '#bfe0f5'], day: ['#a9d8f5', '#e8f6ff'], sunset: ['#3d2a5c', '#f28c6b', '#ffd59a'], night: ['#0d1430', '#2a2a5e'], autumn: ['#f7d9a8', '#f3eedf'] }[mode];
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    C.forEach((c, i) => g.addColorStop(i / (C.length - 1), c));
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  }
  function glowDot(ctx, x, y, r, color) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
    g.addColorStop(0, color); g.addColorStop(0.33, color); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, Math.PI * 2); ctx.fill();
  }
  function hills(ctx, x, y, w, h, colors, rnd) {
    colors.forEach((c, i) => {
      const base = y + h * (0.45 + i * 0.18), amp = 30 + rnd() * 40, ph = rnd() * 6, fr = 0.004 + rnd() * 0.004;
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, y + h);
      for (let px = 0; px <= w; px += 8) ctx.lineTo(x + px, base - Math.sin(px * fr + ph) * amp - Math.sin(px * fr * 2.3 + ph) * amp * 0.3);
      ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
    });
  }
  function person(ctx, x, base, h, color, o = {}) {
    const hr = h * 0.13;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, base - h + hr, hr, 0, Math.PI * 2); ctx.fill();
    const top = base - h + hr * 2.2, bw = h * 0.3;
    ctx.beginPath(); ctx.moveTo(x - bw * 0.42, top); ctx.lineTo(x + bw * 0.42, top);
    ctx.quadraticCurveTo(x + bw * 0.75, base - h * 0.2, x + bw * (o.dress ? 0.75 : 0.45), base);
    ctx.lineTo(x - bw * (o.dress ? 0.75 : 0.45), base); ctx.quadraticCurveTo(x - bw * 0.75, base - h * 0.2, x - bw * 0.42, top); ctx.fill();
    if (o.hair) { ctx.beginPath(); ctx.arc(x, base - h + hr * 0.9, hr * 1.08, Math.PI, Math.PI * 2); ctx.fill(); }
    if (o.cane) { ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x + bw * 0.6, base - h * 0.45); ctx.lineTo(x + bw * 0.8, base); ctx.stroke(); }
    if (o.cap) { ctx.fillStyle = '#222'; ctx.fillRect(x - hr * 1.3, base - h - hr * 0.15, hr * 2.6, hr * 0.35); ctx.fillRect(x - hr * 0.7, base - h + hr * 0.1, hr * 1.4, hr * 0.5); }
    if (o.bag) { ctx.fillStyle = '#e76f51'; rr(ctx, x - bw * 0.65, top + h * 0.05, bw * 0.5, h * 0.28, 6); ctx.fill(); }
    return { hand: [x + bw * 0.5, base - h * 0.45], handL: [x - bw * 0.5, base - h * 0.45] };
  }
  function holdHands(ctx, a, b, color) { ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo((a[0] + b[0]) / 2, Math.max(a[1], b[1]) + 14, b[0], b[1]); ctx.stroke(); }
  function tree(ctx, x, base, h, leaf, rnd) {
    ctx.fillStyle = '#6b4f3a'; ctx.fillRect(x - h * 0.04, base - h * 0.55, h * 0.08, h * 0.55);
    for (let i = 0; i < 7; i++) { ctx.fillStyle = leaf[i % leaf.length]; ctx.beginPath(); ctx.arc(x + (rnd() - 0.5) * h * 0.5, base - h * 0.65 + (rnd() - 0.5) * h * 0.3, h * (0.16 + rnd() * 0.08), 0, Math.PI * 2); ctx.fill(); }
  }
  function house(ctx, x, base, w, wall, roof, lit) {
    ctx.fillStyle = wall; ctx.fillRect(x, base - w * 0.7, w, w * 0.7);
    ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(x - w * 0.08, base - w * 0.68); ctx.lineTo(x + w / 2, base - w * 1.08); ctx.lineTo(x + w * 1.08, base - w * 0.68); ctx.fill();
    if (lit) { glowDot(ctx, x + w * 0.3, base - w * 0.38, w * 0.12, 'rgba(255,214,120,.55)'); }
    ctx.fillStyle = lit ? '#ffd36b' : '#cfe3f0'; ctx.fillRect(x + w * 0.14, base - w * 0.52, w * 0.32, w * 0.26);
    ctx.fillStyle = '#7a4b3a'; ctx.fillRect(x + w * 0.62, base - w * 0.42, w * 0.22, w * 0.42);
    return [x + w * 0.14, base - w * 0.52, w * 0.32, w * 0.26];
  }
  function stars(ctx, x, y, w, h, n, rnd) { ctx.fillStyle = '#fff'; for (let i = 0; i < n; i++) { ctx.globalAlpha = 0.4 + rnd() * 0.6; ctx.fillRect(x + rnd() * w, y + rnd() * h * 0.6, 2 + rnd() * 2, 2 + rnd() * 2); } ctx.globalAlpha = 1; }
  function drawScene(ctx, wish, x, y, w, h) {
    const r = wish.rnd, gy = y + h * 0.78;
    ctx.save(); rr(ctx, x, y, w, h, 40); ctx.clip();
    const sc = wish.scene;
    if (sc === 'school') {
      skyG(ctx, x, y, w, h, 'dawn'); glowDot(ctx, x + w * 0.8, y + h * 0.2, 46, 'rgba(255,240,200,.95)');
      hills(ctx, x, y, w, h, ['#cfe8c8', '#a9d6a0'], r);
      ctx.fillStyle = '#f4e3c3'; ctx.fillRect(x + w * 0.45, gy - 330, 420, 330); ctx.fillStyle = '#c9584a'; ctx.beginPath(); ctx.moveTo(x + w * 0.43, gy - 326); ctx.lineTo(x + w * 0.45 + 210, gy - 440); ctx.lineTo(x + w * 0.45 + 440, gy - 326); ctx.fill();
      for (let i = 0; i < 3; i++) { ctx.fillStyle = '#bfe0f5'; ctx.fillRect(x + w * 0.45 + 40 + i * 130, gy - 260, 80, 80); }
      ctx.strokeStyle = '#6b4f3a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x + w * 0.45 + 210, gy - 440); ctx.lineTo(x + w * 0.45 + 210, gy - 520); ctx.stroke(); ctx.fillStyle = '#e63946'; ctx.fillRect(x + w * 0.45 + 213, gy - 520, 60, 36);
      ctx.fillStyle = '#8fbf86'; ctx.fillRect(x, gy, w, h);
      const m = person(ctx, x + w * 0.22, gy + 10, 330, '#5b6b8c', { dress: true, hair: true });
      const k = person(ctx, x + w * 0.34, gy + 10, 190, '#e9a23b', { bag: true });
      holdHands(ctx, m.hand, k.handL, '#5b6b8c');
    } else if (sc === 'party' || sc === 'home') {
      skyG(ctx, x, y, w, h, 'night'); stars(ctx, x, y, w, h, 90, r); glowDot(ctx, x + w * 0.82, y + h * 0.16, 34, 'rgba(255,248,220,.95)');
      ctx.fillStyle = '#1b2244'; ctx.fillRect(x, gy, w, h);
      const win = house(ctx, x + w * 0.18, gy + 4, w * 0.62, '#f1e4cf', '#8C1D3C', true);
      const [wx, wy, ww, wh] = win;
      ctx.save(); ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
      const n = sc === 'home' ? 4 : 3;
      for (let i = 0; i < n; i++) person(ctx, wx + ww * (0.18 + i * 0.64 / (n - 1)), wy + wh + 10, wh * (0.85 + (i % 2) * 0.12), 'rgba(90,50,30,.75)', { hair: i % 2 === 0 });
      if (sc === 'party') { ctx.fillStyle = '#fff'; ctx.fillRect(wx + ww * 0.4, wy + wh * 0.72, ww * 0.2, wh * 0.18); ctx.fillStyle = '#ff7b54'; for (let i = 0; i < 3; i++) ctx.fillRect(wx + ww * (0.44 + i * 0.05), wy + wh * 0.62, 3, wh * 0.1); }
      else { ctx.fillStyle = 'rgba(140,29,60,.8)'; ctx.fillRect(wx, wy + wh * 0.8, ww, wh * 0.2); }
      ctx.restore();
      if (sc === 'party') { ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff'].forEach((c, i) => { const bx = x + w * (0.1 + i * 0.07), byy = y + h * (0.3 + (i % 2) * 0.08); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx, byy + 40); ctx.lineTo(bx + 10, byy + 200); ctx.stroke(); ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(bx, byy, 30, 38, 0, 0, Math.PI * 2); ctx.fill(); }); }
      else { for (let i = 0; i < 5; i++) { const lx = x + w * (0.08 + i * 0.2), ly = y + h * 0.12 + (i % 2) * 30; glowDot(ctx, lx, ly, 18, 'rgba(230,57,70,.8)'); ctx.fillStyle = '#e63946'; ctx.beginPath(); ctx.ellipse(lx, ly, 24, 30, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffd36b'; ctx.fillRect(lx - 3, ly + 30, 6, 22); } }
    } else if (sc === 'sunset') {
      skyG(ctx, x, y, w, h, 'sunset'); glowDot(ctx, x + w * 0.5, y + h * 0.58, 70, 'rgba(255,200,120,.95)');
      ctx.fillStyle = '#3e4a7a'; ctx.fillRect(x, y + h * 0.6, w, h);
      for (let i = 0; i < 9; i++) { ctx.fillStyle = `rgba(255,190,130,${0.5 - i * 0.05})`; ctx.fillRect(x + w * 0.5 - 120 + i * 8, y + h * 0.62 + i * 22, 240 - i * 16, 6); }
      ctx.fillStyle = '#e8c39e'; ctx.fillRect(x, gy, w, h);
      const a = person(ctx, x + w * 0.42, gy + 20, 360, '#2b1b3d');
      const b = person(ctx, x + w * 0.56, gy + 20, 330, '#2b1b3d', { dress: true, hair: true });
      holdHands(ctx, a.hand, b.handL, '#2b1b3d');
      ctx.fillStyle = 'rgba(255,120,140,.85)'; ctx.font = `60px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('♥', x + w * 0.49, gy - 420); ctx.textAlign = 'left';
    } else if (sc === 'kite') {
      skyG(ctx, x, y, w, h, 'day'); glowDot(ctx, x + w * 0.15, y + h * 0.15, 50, 'rgba(255,250,210,.95)');
      for (let i = 0; i < 3; i++) { ctx.fillStyle = 'rgba(255,255,255,.85)'; const cx = x + w * (0.3 + i * 0.25), cy = y + h * (0.12 + i * 0.06); [0, 40, 80].forEach(d => { ctx.beginPath(); ctx.arc(cx + d, cy, 34, 0, Math.PI * 2); ctx.fill(); }); }
      hills(ctx, x, y, w, h, ['#b7e0a5', '#8cc97a'], r);
      const kx = x + w * 0.72, ky = y + h * 0.26;
      ctx.fillStyle = '#e63946'; ctx.beginPath(); ctx.moveTo(kx, ky - 60); ctx.lineTo(kx + 46, ky); ctx.lineTo(kx, ky + 70); ctx.lineTo(kx - 46, ky); ctx.fill();
      ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(kx, ky + 70); ctx.quadraticCurveTo(kx + 30, ky + 140, kx - 10, ky + 200); ctx.stroke();
      const p = person(ctx, x + w * 0.3, gy + 30, 340, '#3d5a80');
      const k = person(ctx, x + w * 0.44, gy + 30, 200, '#ee6c4d', { hair: true });
      holdHands(ctx, p.hand, k.handL, '#3d5a80');
      ctx.strokeStyle = 'rgba(60,60,60,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(k.hand[0], k.hand[1]); ctx.lineTo(kx, ky + 70); ctx.stroke();
    } else if (sc === 'bench') {
      skyG(ctx, x, y, w, h, 'autumn');
      hills(ctx, x, y, w, h, ['#e9c99a', '#d9a86c'], r);
      tree(ctx, x + w * 0.78, gy, 560, ['#e76f51', '#f4a261', '#e9c46a'], r);
      for (let i = 0; i < 26; i++) { ctx.fillStyle = ['#e76f51', '#f4a261', '#e9c46a'][i % 3]; ctx.save(); ctx.translate(x + r() * w, y + h * 0.2 + r() * h * 0.6); ctx.rotate(r() * 6); ctx.fillRect(-8, -4, 16, 8); ctx.restore(); }
      ctx.fillStyle = '#7a5236'; ctx.fillRect(x + w * 0.2, gy - 120, 420, 20); ctx.fillRect(x + w * 0.2, gy - 60, 420, 18); ctx.fillRect(x + w * 0.22, gy - 60, 14, 60); ctx.fillRect(x + w * 0.2 + 390, gy - 60, 14, 60);
      person(ctx, x + w * 0.3, gy - 40, 280, '#6d597a', { hair: true, dress: true });
      person(ctx, x + w * 0.44, gy - 40, 300, '#355070', { cane: true });
    } else if (sc === 'grad') {
      skyG(ctx, x, y, w, h, 'day'); glowDot(ctx, x + w * 0.82, y + h * 0.14, 50, 'rgba(255,250,210,.95)');
      ctx.fillStyle = '#efe3cf'; ctx.fillRect(x + w * 0.1, gy - 420, w * 0.8, 420); ctx.fillStyle = '#d8c7a8'; ctx.beginPath(); ctx.moveTo(x + w * 0.06, gy - 416); ctx.lineTo(x + w * 0.5, gy - 560); ctx.lineTo(x + w * 0.94, gy - 416); ctx.fill();
      for (let i = 0; i < 6; i++) { ctx.fillStyle = '#cbb894'; ctx.fillRect(x + w * (0.16 + i * 0.13), gy - 400, 34, 400); }
      ctx.fillStyle = '#9ccf8f'; ctx.fillRect(x, gy, w, h);
      for (let i = 0; i < 6; i++) { ctx.save(); ctx.translate(x + w * (0.15 + r() * 0.7), y + h * (0.08 + r() * 0.25)); ctx.rotate((r() - 0.5) * 1.2); ctx.fillStyle = '#222'; ctx.fillRect(-36, -8, 72, 14); ctx.fillRect(-18, 4, 36, 18); ctx.restore(); }
      person(ctx, x + w * 0.5, gy + 30, 380, '#1d3557', { cap: true });
      person(ctx, x + w * 0.24, gy + 40, 300, '#6d597a', { hair: true, dress: true });
      person(ctx, x + w * 0.76, gy + 40, 310, '#457b9d');
    } else if (sc === 'aurora' || sc === 'snow') {
      skyG(ctx, x, y, w, h, sc === 'aurora' ? 'night' : 'dawn'); if (sc === 'aurora') stars(ctx, x, y, w, h, 80, r);
      if (sc === 'aurora') { for (let i = 0; i < 4; i++) { const g = ctx.createLinearGradient(0, y + h * 0.1, 0, y + h * 0.55); g.addColorStop(0, 'rgba(120,255,190,0)'); g.addColorStop(0.5, `rgba(${i % 2 ? '120,255,190' : '160,120,255'},.45)`); g.addColorStop(1, 'rgba(120,255,190,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, y + h * (0.3 + i * 0.04)); for (let px = 0; px <= w; px += 10) ctx.lineTo(x + px, y + h * (0.22 + i * 0.05) + Math.sin(px * 0.006 + i) * 60); ctx.lineTo(x + w, y + h * 0.55); ctx.lineTo(x, y + h * 0.55); ctx.fill(); } }
      for (let i = 0; i < 3; i++) { const mx = x + w * (0.1 + i * 0.35), mh = 300 + r() * 160; ctx.fillStyle = sc === 'aurora' ? '#3a4a7a' : '#9fb3d1'; ctx.beginPath(); ctx.moveTo(mx - 260, gy); ctx.lineTo(mx, gy - mh); ctx.lineTo(mx + 260, gy); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(mx - 80, gy - mh * 0.7); ctx.lineTo(mx, gy - mh); ctx.lineTo(mx + 80, gy - mh * 0.7); ctx.fill(); }
      ctx.fillStyle = '#f4f7fb'; ctx.fillRect(x, gy - 10, w, h);
      if (sc === 'snow') { ctx.fillStyle = '#fff'; for (let i = 0; i < 120; i++) { ctx.globalAlpha = 0.6 + r() * 0.4; ctx.beginPath(); ctx.arc(x + r() * w, y + r() * h * 0.8, 3 + r() * 5, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1; }
      person(ctx, x + w * 0.5, gy + 40, 330, sc === 'aurora' ? '#1b1f3a' : '#c0392b', { hair: true });
    } else {
      skyG(ctx, x, y, w, h, 'day'); glowDot(ctx, x + w * 0.75, y + h * 0.18, 60, 'rgba(255,250,210,.95)');
      ctx.fillStyle = '#4fb3d9'; ctx.fillRect(x, y + h * 0.5, w, h); ctx.fillStyle = '#7fd1ea'; ctx.fillRect(x, y + h * 0.5, w, 30);
      for (let i = 0; i < 6; i++) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 4; ctx.beginPath(); for (let px = 0; px <= w; px += 12) ctx.lineTo(x + px, y + h * (0.56 + i * 0.035) + Math.sin(px * 0.03 + i) * 5); ctx.stroke(); }
      ctx.fillStyle = '#f3dfb3'; ctx.beginPath(); ctx.moveTo(x, gy - 40); ctx.quadraticCurveTo(x + w * 0.5, gy - 120, x + w, gy - 20); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.fill();
      ctx.fillStyle = '#7a5236'; ctx.fillRect(x + w * 0.12, gy - 420, 18, 380); ['#2a9d8f', '#3fb39f', '#2a9d8f'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x + w * 0.12 + 9 + (i - 1) * 90, gy - 420 + Math.abs(i - 1) * 30, 120, 30, (i - 1) * 0.5, 0, Math.PI * 2); ctx.fill(); });
      person(ctx, x + w * 0.56, gy + 10, 330, '#264653', { hair: true, dress: true });
    }
    // 梦境处理：柔光、暗角、颗粒、日期戳
    const vg = ctx.createRadialGradient(x + w / 2, y + h / 2, h * 0.25, x + w / 2, y + h / 2, h * 0.75);
    vg.addColorStop(0, 'rgba(255,255,255,0)'); vg.addColorStop(1, 'rgba(40,20,60,.35)');
    ctx.fillStyle = vg; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,240,220,.10)'; ctx.fillRect(x, y, w, h);
    for (let i = 0; i < 2600; i++) { ctx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)'; ctx.fillRect(x + r() * w, y + r() * h, 2, 2); }
    ctx.restore();
    ctx.save(); ctx.setLineDash([18, 14]); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,.85)'; rr(ctx, x + 18, y + 18, w - 36, h - 36, 28); ctx.stroke(); ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.font = `600 30px ${FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(`${wish.year} · ${tx('未曾发生', 'never happened')}`, x + w - 46, y + h - 44); ctx.textAlign = 'left';
  }
  async function makeWish(life) {
    const s = summary(life), wish = wishFor(life);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = HGT;
    const ctx = cv.getContext('2d');
    bg(ctx, '#2B1B3D', '#5a3d7a');
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.font = `600 30px ${FONT}`; ctx.textBaseline = 'top';
    ctx.fillText(`${tx('模拟人生', 'Life Simulator')} · ${s.c.flag} ${s.name}`, 64, 56);
    drawScene(ctx, wish, 64, 116, W - 128, 640);
    paper(ctx, 64, 780, W - 128, HGT - 780 - 40);
    ctx.textBaseline = 'top'; ctx.fillStyle = '#8C1D3C'; ctx.font = `600 30px ${FONT}`;
    ctx.fillText(`🌙 ${tx('未竟的心愿', 'An unfinished wish')}`, 112, 816);
    ctx.fillStyle = '#1a1a1a'; ctx.font = `700 56px ${SERIF}`;
    let y = drawText(ctx, wish.title, 112, 862, W - 224, 64, 1);
    ctx.fillStyle = '#444'; ctx.font = `400 30px ${FONT}`;
    y = drawText(ctx, wish.story, 112, y + 14, W - 224, 44, 4);
    ctx.fillStyle = '#8a7a6a'; ctx.font = `italic 400 26px ${SERIF}`;
    ctx.fillText(tx('这一天没有发生。但在另一种可能里，它很美。', 'This day never came. In another version of things, it was beautiful.'), 112, Math.min(1140, y + 12));
    await footer(ctx, true);
    cv._kind = 'wish'; cv._wish = wish;
    return cv;
  }
  async function ensureWish() { if (!current.wish) { current.wish = await makeWish(current.life); current.wishBlob = await toBlob(current.wish); } }
  function wishTab(body) {
    body.innerHTML = `<div class="ks-loading">${tx('正在画那一天⋯', 'Drawing that day…')}</div>`;
    (async () => {
      await ensureWish();
      if (activeTab() !== 'wish') return;
      const w = current.wish._wish, url = current.wish.toDataURL('image/jpeg', 0.88);
      const wx = isWeChat();
      const file = new File([current.wishBlob], `${fileBase(current.life)}_wish.jpg`, { type: 'image/jpeg' });
      const canShare = (() => { try { return !!(navigator.canShare && navigator.canShare({ files: [file] })); } catch (e) { return false; } })();
      const cap = tx(`《模拟人生》里的${current.life.sex === 'F' ? '她' : '他'}，一辈子没能「${w.title}」。我替${current.life.sex === 'F' ? '她' : '他'}画了出来。你的人生，会缺哪一块？👉 ${SHARE_URL()}`, `In Life Simulator, this life never got to "${w.title}". So I drew it. What would yours be missing? 👉 ${SHARE_URL()}`);
      body.innerHTML = `<p>${tx('依这一生缺少的经历，画出它不曾有过的一天。', 'A picture of a day this life never had, based on what it missed.')}</p>
        <div class="ks-one"><img src="${url}" alt="${esc(w.title)}"></div>
        <div class="ks-caption"><div class="ks-cap-k">${tx('分享文案', 'Caption')}</div><div class="ks-cap-v">${esc(H(cap))}</div></div>
        <div class="ks-actions">
          ${canShare && !wx ? `<button class="primary" id="ksWishShare" type="button">💚 ${tx('分享这一天', 'Share')}</button>` : ''}
          ${wx ? '' : `<button class="${canShare ? 'ghost' : 'primary'}" id="ksWishDl" type="button">⬇️ ${tx('下载图片', 'Download')}</button>`}
          <button class="ghost" id="ksWishCap" type="button">📋 ${tx('复制文案', 'Copy caption')}</button>
        </div>
        ${wx ? `<p class="muted">${tx('长按图片 →「保存图片」，再发朋友圈（文案可先复制）。', 'Long-press the image to save it.')}</p>` : ''}`;
      track('keepsake_wish', { type: w.type, step: 'view' });
      $('#ksWishCap').addEventListener('click', async () => { const ok = await copyText(H(cap)); toast(ok ? tx('文案已复制', 'Caption copied') : tx('复制失败', 'Copy failed')); });
      $('#ksWishDl')?.addEventListener('click', () => { downloadBlob(current.wishBlob, file.name); track('keepsake_wish', { type: w.type, step: 'download' }); });
      $('#ksWishShare')?.addEventListener('click', async () => { copyText(H(cap)); try { await navigator.share({ files: [file], text: H(cap), title: tx('未竟的心愿', 'An unfinished wish') }); track('keepsake_wish', { type: w.type, step: 'share' }); } catch (e) { /* cancelled */ } });
    })();
  }

  /* ---------------- v6.23：人生影片（canvas 动画 + MediaRecorder，本机录制，不上传） ----------------
     三种：人生跑马灯（约 100 秒）、20 秒预告、片尾彩蛋短片（9 秒）。
     画面 720×1280 直式 30fps；配乐沿用 fun.js 的原创旋律（依出生国）；
     支援 MP4 的浏览器（Safari、新版 Chrome/Edge）直接出 MP4，其余出 WebM。 */
  const VW = 720, VH = 1280, FPS = 30;
  const VIDEO_MODES = {
    full: { icon: '🎞️', zh: '人生跑马灯影片', en: 'Life reel', intro: 6, slide: 9.5, egg: 9, fade: 0.7 },
    teaser: { icon: '⚡', zh: '20 秒预告', en: '20-second teaser', intro: 2, slide: 1.5, egg: 4.5, fade: 0.2 },
    egg: { icon: '🎁', zh: '片尾彩蛋短片', en: 'Easter-egg clip', intro: 0, slide: 0, egg: 9, fade: 0 },
  };
  function pickMime() {
    if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) return null;
    const list = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    for (const m of list) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) { /* ignore */ } }
    return '';
  }
  const ease = (p) => 1 - Math.pow(1 - Math.max(0, Math.min(1, p)), 3);
  const cut = (s, n) => { const a = Array.from(String(s || '')); return a.length > n ? a.slice(0, n).join('') + '…' : a.join(''); };
  function slideMeta(life, kind) {
    const s = summary(life);
    const st = STAGES.find(x => x.id === kind);
    if (st) {
      const a1 = Math.min(st.max, s.age);
      const evs = stageEvents(life, st, 8);
      return { title: `${st.icon} ${tx(st.zh, st.en)}`, sub: `${st.min} – ${a1} ${tx('岁', 'years')}`, a0: st.min, a1, ticker: evs.length ? evs.map(e => `${e.age}${tx('岁', 'y')} · ${cut(e.text, 46)}`) : [tx(st.zh, st.en)] };
    }
    if (kind === 'cover') return { title: tx('这一生', 'This life'), sub: s.name, a0: 0, a1: 0, ticker: [`${s.c.flag} ${s.loc.name}`, `${fmtBirth(life)} – ${s.dy}`, `${s.sex}${s.eth ? ' · ' + s.eth : ''}`, tx(`享年 ${s.age} 岁`, `Lived to ${s.age}`)] };
    if (kind === 'birth') return { title: `👶 ${tx('出生', 'Birth')}`, sub: `${fmtBirth(life)} · ${s.c.flag} ${s.loc.name}`, a0: 0, a1: 0, ticker: familyRows(life).slice(0, 6).map(r => `${r.rel} · ${r.name}`).concat([tx('欢迎来到这个世界', 'Welcome to the world')]) };
    if (kind === 'data') {
      const st2 = life.stats || {};
      return { title: `📈 ${tx('一生的轨迹', 'The trajectory')}`, sub: tx('健康 · 幸福 · 知识 · 人际', 'Health · happiness · knowledge · people'), a0: 0, a1: 0, ticker: [tx(`净资产 US$ ${Math.round(st2.netAssets || 0).toLocaleString()}`, `Net worth US$ ${Math.round(st2.netAssets || 0).toLocaleString()}`), tx(`做过 ${(life.decisions || []).filter(d => d.key !== 'skipped').length} 个抉择`, `${(life.decisions || []).length} choices made`), tx(`活了 ${s.age} 年`, `${s.age} years lived`)] };
    }
    return { title: `🕯️ ${tx('这一段人生走完了', 'The end of this life')}`, sub: `${s.age} ${tx('岁', 'years')}${s.cause ? ' · ' + s.cause : ''}`, a0: 0, a1: 0, ticker: [tx(`${s.name}，${fmtBirth(life)} – ${s.dy}`, `${s.name}, ${fmtBirth(life)} – ${s.dy}`), tx('谢谢你陪 TA 走完这一生', 'Thank you for living it')] };
  }
  function buildSegs(life, photos, mode) {
    const M = VIDEO_MODES[mode], segs = [];
    if (M.intro) segs.push({ type: 'intro', dur: M.intro });
    if (M.slide) photos.forEach(cv => segs.push({ type: 'slide', dur: M.slide, cv, meta: slideMeta(life, cv._kind || '') }));
    // 彩蛋：抽出「下一世」（依真实出生人数比例，避开这一世的国家）
    let next = null;
    for (let i = 0; i < 12 && (!next || next.id === life.country); i++) next = typeof chooseCountry === 'function' ? chooseCountry('baby') : null;
    const reel = [];
    for (let i = 0; i < 36; i++) reel.push(COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)]);
    segs.push({ type: 'egg', dur: M.egg, next: next || countryById('CHN'), reel });
    return segs;
  }
  function vBackdrop(ctx, im) {
    ctx.fillStyle = '#14101c'; ctx.fillRect(0, 0, VW, VH);
    if (!im) return;
    const hasFilter = 'filter' in ctx;
    ctx.save();
    if (hasFilter) ctx.filter = 'blur(26px) brightness(0.5)';
    const h = VH * 1.12, w = h * im.width / im.height;
    ctx.drawImage(im, (VW - w) / 2, (VH - h) / 2, w, h);
    ctx.restore();
    if (!hasFilter) { ctx.fillStyle = 'rgba(10,8,16,.6)'; ctx.fillRect(0, 0, VW, VH); }
  }
  function vIntro(ctx, life, lt, dur, mode) {
    const s = summary(life);
    const g = ctx.createLinearGradient(0, 0, VW, VH); g.addColorStop(0, '#1d2b4a'); g.addColorStop(1, '#8C1D3C');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    if (mode === 'teaser') {
      ctx.globalAlpha = ease(lt / 0.5);
      ctx.fillStyle = '#F39C12'; ctx.font = `800 64px ${FONT}`; ctx.fillText(tx('如果人生重来一次……', 'If you could be born again…'), VW / 2, 600);
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = `400 34px ${FONT}`; ctx.fillText(tx(`我投胎到了 ${s.c.flag} ${s.loc.name}`, `I was born in ${s.c.flag} ${s.loc.name}`), VW / 2, 680);
      ctx.globalAlpha = 1; ctx.textAlign = 'left'; return;
    }
    const a = (t0) => ease((lt - t0) / 0.9);
    ctx.globalAlpha = a(0.2); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = `500 30px ${FONT}`; ctx.fillText(tx('模拟人生 · 一个人的一生', 'Life Simulator · one whole life'), VW / 2, 420);
    ctx.globalAlpha = a(0.9); ctx.fillStyle = '#fff'; ctx.font = `800 92px ${SERIF}`; ctx.fillText(cut(s.name, 8), VW / 2, 580);
    ctx.globalAlpha = a(1.7); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = `400 36px ${FONT}`; ctx.fillText(`${s.c.flag} ${s.loc.name} · ${fmtBirth(life)} – ${s.dy}`, VW / 2, 660);
    ctx.globalAlpha = a(2.8); ctx.fillStyle = '#F39C12'; ctx.font = `700 40px ${FONT}`; ctx.fillText(tx(`${s.age} 年的一生，从这里开始`, `${s.age} years, starting now`), VW / 2, 800);
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  }
  function vSlide(ctx, sg, lt, mode) {
    const im = sg.cv, m = sg.meta, dur = sg.dur, p = Math.min(1, lt / dur);
    vBackdrop(ctx, im);
    const pw = 640, ph = Math.round(pw * im.height / im.width), px = (VW - pw) / 2, py = 176;
    const z = mode === 'teaser' ? 1.1 - 0.1 * ease(p * 1.6) : 1.0 + 0.06 * p;
    const zw = pw * z, zh = ph * z;
    ctx.save(); rr(ctx, px, py, pw, ph, 22); ctx.clip();
    ctx.drawImage(im, px - (zw - pw) / 2, py - (zh - ph) * (mode === 'full' ? p : 0.5), zw, zh);
    ctx.restore();
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.fillStyle = '#fff'; ctx.font = `800 50px ${FONT}`; ctx.fillText(m.title, 40, 96);
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = `400 28px ${FONT}`; ctx.fillText(cut(m.sub, 24), 40, 142);
    if (m.a1 > 0) {
      const age = Math.round(m.a0 + (m.a1 - m.a0) * Math.min(1, p * 1.15));
      ctx.textAlign = 'right'; ctx.fillStyle = '#F39C12'; ctx.font = `800 72px ${FONT}`; ctx.fillText(String(age), VW - 40, 104);
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = `400 24px ${FONT}`; ctx.fillText(tx('岁', 'yrs'), VW - 40, 142); ctx.textAlign = 'left';
    }
    // 跑马灯字幕
    const ty = py + ph + 34, th = 92;
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, ty, VW, th);
    ctx.fillStyle = '#F39C12'; ctx.fillRect(0, ty, 8, th);
    ctx.save(); ctx.beginPath(); ctx.rect(8, ty, VW - 8, th); ctx.clip();
    ctx.fillStyle = '#fff'; ctx.font = `500 34px ${FONT}`;
    if (mode === 'full') {
      const text = m.ticker.join('　　◆　　');
      const tw = ctx.measureText(text).width;
      const speed = Math.max(110, (tw + VW) / (dur - 0.3));
      ctx.fillText(text, VW - lt * speed, ty + 58);
    } else {
      ctx.fillText(cut(m.ticker[0], 18), 32, ty + 58);
    }
    ctx.restore();
  }
  function vEgg(ctx, life, sg, lt, mode) {
    const dur = sg.dur, spin = dur * 0.5, next = sg.next;
    const g = ctx.createLinearGradient(0, 0, VW, VH); g.addColorStop(0, '#2B1B3D'); g.addColorStop(1, '#8C1D3C');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#F39C12'; ctx.font = `800 40px ${FONT}`; ctx.fillText(tx('🎁 片尾彩蛋', '🎁 Easter egg'), VW / 2, 170);
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = `500 36px ${FONT}`; ctx.fillText(tx('如果再投胎一次，下一世会在……', 'Born again, the next life would be in…'), VW / 2, 236);
    // 转盘框
    const bx = 70, by = 330, bw = VW - 140, bh = 330;
    ctx.fillStyle = 'rgba(255,252,245,.97)'; rr(ctx, bx, by, bw, bh, 28); ctx.fill();
    let c = next, pop = 1;
    if (lt < spin) {
      const idx = Math.min(sg.reel.length - 1, Math.floor(ease(lt / spin) * sg.reel.length));
      c = sg.reel[idx] || next;
    } else pop = 1 + 0.25 * Math.max(0, 1 - (lt - spin) / 0.35);
    const name = c ? localize(c).name : '';
    ctx.save(); ctx.translate(VW / 2, by + bh / 2); ctx.scale(pop, pop);
    ctx.font = `120px ${FONT}`; ctx.fillStyle = '#222'; ctx.fillText(c ? c.flag : '', 0, -10);
    ctx.font = `800 58px ${FONT}`; ctx.fillStyle = '#2B1B3D'; ctx.fillText(cut(name, 9), 0, 100);
    ctx.restore();
    if (lt >= spin) {
      const a = ease((lt - spin) / 0.6);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#fff'; ctx.font = `700 40px ${FONT}`; ctx.fillText(tx(`下一世：${next.flag} ${localize(next).name}`, `Next life: ${next.flag} ${localize(next).name}`), VW / 2, 740);
      ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = `400 30px ${FONT}`; ctx.fillText(tx(`预期寿命约 ${Math.round(effectiveLe(next, {}))} 岁 · 会过得怎样，没人知道`, `Life expectancy ~${Math.round(effectiveLe(next, {}))} · nobody knows how it goes`), VW / 2, 792);
      const qa = ease((lt - spin - 0.6) / 0.6);
      ctx.globalAlpha = qa;
      ctx.fillStyle = 'rgba(255,252,245,.97)'; rr(ctx, 70, 860, VW - 140, 330, 26); ctx.fill();
      qr(ctx, SHARE_URL(), VW - 70 - 30 - 250, 900, 250);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#2B1B3D'; ctx.font = `800 40px ${FONT}`; ctx.fillText(tx('你呢？', 'Your turn?'), 110, 950);
      ctx.fillStyle = '#8C1D3C'; ctx.font = `600 28px ${FONT}`;
      drawText(ctx, tx('扫码抽一次命运，抽到哪里都不能重来', 'Scan to roll your fate. No do-overs.'), 110, 980, 230, 40, 3);
      ctx.fillStyle = '#888'; ctx.font = `400 22px ${FONT}`; ctx.fillText(SITE().replace(/^https?:\/\//, '').replace(/\/$/, ''), 110, 1160);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';
  }
  function vChrome(ctx, t, total) {
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(40, VH - 70, VW - 80, 4);
    ctx.fillStyle = '#F39C12'; ctx.fillRect(40, VH - 70, (VW - 80) * Math.min(1, t / total), 4);
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = `400 22px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(`${tx('模拟人生', 'Life Simulator')} · ${SITE().replace(/^https?:\/\//, '').replace(/\/$/, '')}`, 40, VH - 32);
  }
  function drawSeg(ctx, life, sg, lt, mode) {
    if (sg.type === 'intro') vIntro(ctx, life, lt, sg.dur, mode);
    else if (sg.type === 'slide') vSlide(ctx, sg, lt, mode);
    else vEgg(ctx, life, sg, lt, mode);
  }
  function drawVideoFrame(ctx, life, segs, t, mode) {
    const total = segs.reduce((a, s) => a + s.dur, 0), fade = VIDEO_MODES[mode].fade;
    let acc = 0, i = 0;
    while (i < segs.length - 1 && t >= acc + segs[i].dur) { acc += segs[i].dur; i++; }
    const lt = t - acc;
    ctx.globalAlpha = 1;
    if (i > 0 && fade && lt < fade) {
      drawSeg(ctx, life, segs[i - 1], segs[i - 1].dur, mode);
      ctx.save(); ctx.globalAlpha = lt / fade; drawSeg(ctx, life, segs[i], lt, mode); ctx.restore();
    } else drawSeg(ctx, life, segs[i], lt, mode);
    ctx.globalAlpha = 1;
    vChrome(ctx, t, total);
  }
  function scoreInto(actx, dest, code, dur) {
    const T = window.BornFun && BornFun.TRACKS; if (!T) return;
    const key = (BornFun.trackFor && BornFun.trackFor(code)) || (T[code] ? code : 'SGP');
    const sc = T[key] || T.SGP;
    const master = actx.createGain(); master.connect(dest);
    const t0 = actx.currentTime + 0.05;
    master.gain.setValueAtTime(0, t0); master.gain.linearRampToValueAtTime(1, t0 + 1);
    master.gain.setValueAtTime(1, Math.max(t0 + 1, t0 + dur - 2.5)); master.gain.linearRampToValueAtTime(0, t0 + dur);
    const note = (midi, time, len, gain) => {
      const osc = actx.createOscillator(), env = actx.createGain();
      osc.type = sc.wave; osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
      env.gain.setValueAtTime(0, time); env.gain.linearRampToValueAtTime(gain, time + 0.2);
      env.gain.exponentialRampToValueAtTime(Math.max(0.00001, gain * 0.5), time + len * 0.65); env.gain.linearRampToValueAtTime(0, time + len);
      osc.connect(env).connect(master); osc.start(time); osc.stop(time + len + 0.02);
    };
    const beat = dur < 30 ? sc.beat * 0.75 : sc.beat;
    for (let t = t0, step = 0; t < t0 + dur; t += beat, step = (step + 1) % 16) {
      if (step % 4 === 0) sc.chords[Math.floor(step / 4) % 4].forEach(n => note(sc.root + n, t, beat * 4, 0.07));
      note(sc.notes[step], t, beat * 1.8, 0.16);
    }
  }
  async function recordVideo(life, photos, mode, cv, onProgress, signal) {
    const segs = buildSegs(life, photos, mode);
    const total = segs.reduce((a, s) => a + s.dur, 0);
    const ctx = cv.getContext('2d');
    drawVideoFrame(ctx, life, segs, 0, mode);
    const stream = cv.captureStream(FPS);
    let actx = null;
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      await actx.resume();
      const dest = actx.createMediaStreamDestination();
      scoreInto(actx, dest, life.country, total);
      dest.stream.getAudioTracks().forEach(tr => stream.addTrack(tr));
    } catch (e) { actx = null; }
    const mime = pickMime();
    let rec;
    try { rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 5e6 } : { videoBitsPerSecond: 5e6 }); } catch (e) { rec = new MediaRecorder(stream); }
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise(res => { rec.onstop = res; });
    rec.start(1000);
    const t0 = performance.now();
    await new Promise(res => {
      const step = () => {
        if (signal && signal.aborted) return res();
        const t = (performance.now() - t0) / 1000;
        if (t >= total) { drawVideoFrame(ctx, life, segs, total - 0.001, mode); return setTimeout(res, 120); }
        drawVideoFrame(ctx, life, segs, t, mode);
        onProgress && onProgress(t / total, total);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    rec.stop(); await stopped;
    stream.getTracks().forEach(tr => tr.stop());
    if (actx) actx.close().catch(() => {});
    if (signal && signal.aborted) return null;
    const type = (rec.mimeType || mime || 'video/webm').split(';')[0] || 'video/webm';
    return { blob: new Blob(chunks, { type }), ext: /mp4/.test(type) ? 'mp4' : 'webm', total };
  }
  function videoTab(body) {
    const mime = pickMime();
    const wx = isWeChat();
    const n = current.photos ? current.photos.length : 9;
    const dur = (k) => { const M = VIDEO_MODES[k]; return Math.round(M.intro + M.slide * n + M.egg); };
    const desc = {
      full: tx(`约 ${dur('full')} 秒 · ${n} 个片段 + 跑马灯字幕 + 原创配乐 + 片尾彩蛋`, `~${dur('full')}s · ${n} scenes, ticker captions, original score, easter egg`),
      teaser: tx('20 秒快剪 + 结尾钩子，适合视频号、抖音、朋友圈', '20s quick cuts with a hook ending'),
      egg: tx('9 秒 · 抽出「下一世」出生在哪里，可单独发或当片尾', '9s · rolls your "next life"'),
    };
    body.innerHTML = `<p>${tx('用这一生的照片做成直式影片（9:16），附原创配乐。全部在你的装置上录制，不会上传。', 'Turn this life into a vertical video (9:16) with an original score. Recorded on your device; nothing is uploaded.')}</p>
      ${mime === null ? `<p class="ks-warn">${wx ? tx('微信内建浏览器无法录制影片。请点右上角「⋯」→「在浏览器打开」。', 'WeChat\'s browser cannot record video. Open this page in your browser.') : tx('这个浏览器不支援录制影片，请改用新版 Chrome、Edge 或 Safari。', 'This browser cannot record video. Try a recent Chrome, Edge or Safari.')}</p>` : ''}
      <div class="ks-vids">${Object.keys(VIDEO_MODES).map(k => `<button class="ks-vid-b" data-ks-vid="${k}" type="button" ${mime === null ? 'disabled' : ''}><b>${VIDEO_MODES[k].icon} ${tx(VIDEO_MODES[k].zh, VIDEO_MODES[k].en)}</b><span>${desc[k]}</span></button>`).join('')}</div>
      <div id="ksVidStage" class="ks-vid-stage"></div>`;
    body.querySelectorAll('[data-ks-vid]').forEach(b => b.addEventListener('click', () => runVideo(b.dataset.ksVid)));
    if (current.lastVideo && current.videos && current.videos[current.lastVideo]) showVideo(current.lastVideo);
  }
  let vidAbort = null;
  async function runVideo(mode) {
    const stage = $('#ksVidStage'); if (!stage) return;
    current.videos = current.videos || {};
    if (current.videos[mode]) return showVideo(mode);
    if (vidAbort) return;
    stage.innerHTML = `<div class="ks-loading">${tx('正在准备画面⋯', 'Preparing…')}</div>`;
    await ensurePhotos();
    await loadImg('assets/zenmatrix-logo.jpg');
    const life = current.life;
    const cv = document.createElement('canvas'); cv.width = VW; cv.height = VH; cv.className = 'ks-vid-canvas';
    stage.innerHTML = `<div class="ks-vid-rec"><div class="ks-vid-frame"></div>
      <div class="ks-vid-side"><b>🔴 ${tx('录制中', 'Recording')} · ${tx(VIDEO_MODES[mode].zh, VIDEO_MODES[mode].en)}</b>
      <div class="ks-prog"><i id="ksVidBar"></i></div><span id="ksVidTime" class="muted"></span>
      <p class="muted">${tx('影片是即时录制的，请保持这个画面开启、不要切换 App 或锁屏。', 'Recording in real time. Keep this screen open.')}</p>
      <button class="ghost" id="ksVidCancel" type="button">${tx('取消', 'Cancel')}</button></div></div>`;
    $('.ks-vid-frame', stage).appendChild(cv);
    document.querySelectorAll('[data-ks-vid]').forEach(b => { b.disabled = true; });
    vidAbort = new AbortController();
    $('#ksVidCancel').addEventListener('click', () => vidAbort && vidAbort.abort());
    track('keepsake_video', { mode, step: 'start' });
    let res = null;
    try {
      res = await recordVideo(life, current.photos, mode, cv, (p, total) => {
        const bar = $('#ksVidBar'); if (bar) bar.style.width = (p * 100).toFixed(1) + '%';
        const tm = $('#ksVidTime'); if (tm) tm.textContent = tx(`还剩约 ${Math.max(0, Math.ceil(total * (1 - p)))} 秒`, `${Math.max(0, Math.ceil(total * (1 - p)))}s left`);
      }, vidAbort.signal);
    } catch (e) { res = null; stage.innerHTML = `<p class="ks-warn">${tx('录制失败：', 'Recording failed: ')}${esc(e && e.message || e)}</p>`; }
    vidAbort = null;
    document.querySelectorAll('[data-ks-vid]').forEach(b => { b.disabled = false; });
    if (!res || !current || current.life !== life) { if (!res && stage.isConnected && !stage.querySelector('.ks-warn')) stage.innerHTML = ''; return; }
    current.videos[mode] = { ...res, url: URL.createObjectURL(res.blob) };
    track('keepsake_video', { mode, step: 'done', ext: res.ext, sec: Math.round(res.total) });
    showVideo(mode);
  }
  function showVideo(mode) {
    const v = current.videos && current.videos[mode]; const stage = $('#ksVidStage');
    if (!v || !stage) return;
    current.lastVideo = mode;
    const wx = isWeChat();
    const name = `${fileBase(current.life)}_${mode}.${v.ext}`;
    const file = new File([v.blob], name, { type: v.blob.type });
    const canShare = (() => { try { return !!(navigator.canShare && navigator.canShare({ files: [file] })); } catch (e) { return false; } })();
    stage.innerHTML = `<div class="ks-vid-done">
      <video src="${v.url}" controls playsinline preload="metadata"></video>
      <div class="ks-vid-side"><b>✅ ${tx(VIDEO_MODES[mode].zh, VIDEO_MODES[mode].en)} · ${Math.round(v.total)} ${tx('秒', 's')} · ${v.ext.toUpperCase()}</b>
        <div class="ks-actions">
          ${canShare ? `<button class="primary" id="ksVidShare" type="button">💚 ${tx('分享影片', 'Share video')}</button>` : ''}
          <button class="${canShare ? 'ghost' : 'primary'}" id="ksVidDl" type="button">⬇️ ${tx('下载影片', 'Download')}</button>
          <button class="ghost" id="ksVidCap" type="button">📋 ${tx('复制文案', 'Copy caption')}</button>
        </div>
        <p class="muted">${wx ? tx('微信内无法直接存影片：点右上角「⋯」→「在浏览器打开」再下载。', 'In WeChat, open in your browser to save the video.') : v.ext === 'webm' ? tx('这是 WebM 格式；电脑可直接播放，要发微信视频号可先用剪映等 App 转成 MP4。', 'This is WebM. Convert to MP4 if your app needs it.') : tx('存到相册后，可发朋友圈、视频号、抖音、小红书。', 'Save it, then post to Moments, Channels, TikTok, etc.')}</p>
      </div></div>`;
    $('#ksVidDl').addEventListener('click', () => { downloadBlob(v.blob, name); track('keepsake_video', { mode, step: 'download' }); });
    $('#ksVidCap').addEventListener('click', async () => { const ok = await copyText(H(caption(current.life))); toast(ok ? tx('文案已复制', 'Caption copied') : tx('复制失败', 'Copy failed')); });
    $('#ksVidShare')?.addEventListener('click', async () => {
      const cap = H(caption(current.life)); copyText(cap);
      try { await navigator.share({ files: [file], text: cap, title: tx('模拟人生', 'Life Simulator') }); track('keepsake_video', { mode, step: 'share' }); } catch (e) { /* cancelled */ }
    });
  }

  /* ---------------- 相簿（列印 / PDF） ---------------- */
  function albumHtml(life, photos, forPrint) {
    const s = summary(life);
    const imgs = photos.map(cv => cv.toDataURL('image/jpeg', 0.88));
    const wishImg = (current && current.life === life && current.wish) ? current.wish.toDataURL('image/jpeg', 0.88) : '';
    const stagePages = STAGES.filter(st => st.min <= s.age && allStageEvents(life, st).length).map(st => {
      const evs = allStageEvents(life, st);
      const photoIdx = 2 + STAGES.filter(x => x.min <= s.age && allStageEvents(life, x).length).indexOf(st);
      return `<section class="pg"><div class="plate"><img src="${imgs[photoIdx] || ''}" alt=""></div></section>
      <section class="pg text"><h2>${st.icon} ${esc(tx(st.zh, st.en))} <small>${st.min}–${Math.min(st.max, s.age)} ${tx('岁', 'years')}</small></h2>
      <ul class="ev">${evs.map(e => `<li><b>${e.age}</b><span>${esc(e.icon || '·')} ${esc(H(e.text))}</span></li>`).join('')}</ul></section>`;
    }).join('');
    const choices = choiceRows(life), fam = familyRows(life);
    return `<!doctype html><html lang="${esc(LANG)}"><head><meta charset="utf-8"><title>${esc(H(s.name))} · ${tx('人生相簿', 'Life album')}</title>
<style>
@page { size: A5; margin: 12mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "PingFang SC","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif; color: #222; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.pg { page-break-after: always; break-after: page; min-height: 180mm; padding: 0; }
.plate { display: flex; justify-content: center; } .plate img { max-width: 100%; max-height: 182mm; border-radius: 6mm; }
h1 { font-family: "Songti SC","Noto Serif SC",serif; font-size: 26pt; margin: 6mm 0 2mm; color: #8C1D3C; }
h2 { font-family: "Songti SC","Noto Serif SC",serif; font-size: 18pt; color: #8C1D3C; border-bottom: 1px solid #e5d9c5; padding-bottom: 2mm; }
h2 small { font-size: 10pt; color: #888; font-family: sans-serif; }
.meta { color: #555; font-size: 11pt; line-height: 1.7; }
.ev { list-style: none; padding: 0; margin: 0; font-size: 10.5pt; line-height: 1.55; }
.ev li { display: grid; grid-template-columns: 9mm 1fr; gap: 3mm; padding: 1.2mm 0; border-bottom: 1px dotted #eee; break-inside: avoid; }
.ev b { color: #8C1D3C; }
table { width: 100%; border-collapse: collapse; font-size: 10.5pt; } td { padding: 1.5mm 2mm; border-bottom: 1px solid #eee; vertical-align: top; }
.end { text-align: center; } .end p { color: #555; }
.colophon { font-size: 9pt; color: #999; text-align: center; margin-top: 10mm; }
@media screen { body { max-width: 160mm; margin: 0 auto; padding: 10mm; background: #f4f1eb; } .pg { background: #fff; padding: 10mm; margin-bottom: 8mm; box-shadow: 0 2px 10px rgba(0,0,0,.08); } }
</style></head><body>
<section class="pg"><div class="plate"><img src="${imgs[0]}" alt=""></div></section>
<section class="pg text"><h1>${esc(H(s.name))}</h1><p class="meta">${s.c.flag} ${esc(H(s.loc.name))} · ${fmtBirth(life)} – ${s.dy} · ${s.age} ${tx('岁', 'years')}${s.r ? ` · ${s.r.tier.id}` : ''}<br>${esc(s.sex)}${s.eth ? ' · ' + esc(s.eth) : ''}${s.cause ? ' · ' + esc(H(s.cause)) : ''}</p>
<div class="plate"><img src="${imgs[1]}" alt=""></div></section>
${stagePages}
${choices.length ? `<section class="pg text"><h2>⚖️ ${tx('做过的抉择', 'Choices')}</h2><table>${choices.map(c => `<tr><td><b>${c.age}</b></td><td>${esc(H(c.title))}${c.note ? `<br><small>${esc(H(c.note))}</small>` : ''}</td></tr>`).join('')}</table></section>` : ''}
${fam.length ? `<section class="pg text"><h2>👪 ${tx('家人', 'Family')}</h2><table>${fam.map(f => `<tr><td>${esc(f.rel)}</td><td>${esc(H(f.name))}</td></tr>`).join('')}</table></section>` : ''}
${wishImg ? `<section class="pg"><div class="plate"><img src="${wishImg}" alt=""></div></section>` : ''}
<section class="pg"><div class="plate"><img src="${imgs[imgs.length - 2] || ''}" alt=""></div></section>
<section class="pg end"><div class="plate"><img src="${imgs[imgs.length - 1]}" alt=""></div>
<p class="colophon">${tx('本相簿由《模拟人生》在你的装置上生成 · 人生为虚构模拟 · ZenMatrix · www.zenmatrix.org', 'Made on your device by Life Simulator · A fictional simulation · ZenMatrix · www.zenmatrix.org')}</p></section>
${forPrint ? '<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},300);};<\/script>' : ''}
</body></html>`;
  }
  function printAlbum(life, photos) {
    const html = albumHtml(life, photos, false);
    let fr = $('#ksPrintFrame');
    if (fr) fr.remove();
    fr = document.createElement('iframe');
    fr.id = 'ksPrintFrame';
    fr.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;';
    document.body.appendChild(fr);
    fr.onload = () => { setTimeout(() => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { window.open(URL.createObjectURL(new Blob([albumHtml(life, photos, true)], { type: 'text/html' })), '_blank'); } }, 400); };
    fr.srcdoc = html;
  }

  /* ---------------- 纪录册 HTML + CSV ---------------- */
  const EMP = { none: ['—', '—'], student: ['学生', 'Student'], university: ['大学', 'University'], employed: ['就业', 'Employed'], family_biz: ['家族事业', 'Family business'], retired: ['退休', 'Retired'], unemployed: ['失业', 'Unemployed'] };
  const empLabel = (e) => e ? tx(...(EMP[e] || [e, e])) : '';
  function eventsByAge(life) {
    const m = {};
    (life.log || []).forEach(e => { if (e && e.text) (m[e.age] = m[e.age] || []).push(H(e.text)); });
    return m;
  }
  function csv(life) {
    const ys = yearly(life), ev = eventsByAge(life), { by } = lifeYears(life);
    const q = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const head = isZh() ? ['年龄', '年份', '健康', '幸福', '知识', '人际', '净资产_US$', '状态', '已婚', '孩子数', '这一年的事件'] : ['age', 'year', 'health', 'happiness', 'knowledge', 'social', 'net_assets_usd', 'status', 'married', 'children', 'events'];
    const rows = ys.map(y => [y.age, by + y.age, y.h, y.hp ?? '', y.k, y.so, y.m ?? '', empLabel(y.emp), y.mar == null ? '' : (y.mar ? 1 : 0), y.kids ?? '', (ev[y.age] || []).join(' / ')]);
    return [head, ...rows].map(r => r.map(q).join(',')).join('\r\n');
  }
  function svgChart(life) {
    const ys = yearly(life);
    if (ys.length < 2) return '';
    const w = 760, h = 260, maxA = Math.max(ys[ys.length - 1].age, 1);
    const line = (key, color) => { const pts = ys.filter(p => p[key] != null); if (pts.length < 2) return ''; return `<polyline fill="none" stroke="${color}" stroke-width="2.5" points="${pts.map(p => `${(40 + p.age / maxA * (w - 60)).toFixed(1)},${(h - 30 - Math.max(0, Math.min(100, p[key])) / 100 * (h - 50)).toFixed(1)}`).join(' ')}"/>`; };
    const grid = [0, 25, 50, 75, 100].map(v => `<line x1="40" x2="${w - 20}" y1="${h - 30 - v / 100 * (h - 50)}" y2="${h - 30 - v / 100 * (h - 50)}" stroke="#eee"/><text x="34" y="${h - 26 - v / 100 * (h - 50)}" font-size="10" text-anchor="end" fill="#999">${v}</text>`).join('');
    const ticks = Array.from({ length: 6 }, (_, i) => Math.round(maxA * i / 5)).map(a => `<text x="${40 + a / maxA * (w - 60)}" y="${h - 10}" font-size="10" text-anchor="middle" fill="#999">${a}</text>`).join('');
    const money = ys.filter(p => p.m != null);
    let moneyChart = '';
    if (money.length > 1) {
      const mx = Math.max(...money.map(p => p.m), 1), mn = Math.min(...money.map(p => p.m), 0);
      moneyChart = `<svg viewBox="0 0 ${w} 180" role="img" aria-label="net worth"><polyline fill="none" stroke="#b8860b" stroke-width="2.5" points="${money.map(p => `${(40 + p.age / maxA * (w - 60)).toFixed(1)},${(150 - (p.m - mn) / (mx - mn || 1) * 130).toFixed(1)}`).join(' ')}"/><text x="40" y="14" font-size="11" fill="#999">${tx('净资产（US$）最高', 'Net worth max')} ${Math.round(mx).toLocaleString()}</text></svg>`;
    }
    return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="stats">${grid}${ticks}${line('h', '#2B9A5E')}${line('hp', '#E07A2E')}${line('k', '#3B6FD4')}${line('so', '#9B4FD1')}</svg>
      <p class="legend"><i style="background:#2B9A5E"></i>${tx('健康', 'Health')} <i style="background:#E07A2E"></i>${tx('幸福', 'Happiness')} <i style="background:#3B6FD4"></i>${tx('知识', 'Knowledge')} <i style="background:#9B4FD1"></i>${tx('人际', 'Social')}</p>${moneyChart}`;
  }
  function recordHtml(life) {
    const s = summary(life), ys = yearly(life), ev = eventsByAge(life), { by } = lifeYears(life);
    const choices = choiceRows(life), fam = familyRows(life);
    const quotes = Object.entries(life.quotes || {}).filter(([, q]) => q);
    return `<!doctype html><html lang="${esc(LANG)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(H(s.name))} · ${tx('人生纪录册', 'Life record')}</title>
<style>
:root { --ink:#1f1f1f; --mute:#777; --line:#e6e0d4; --accent:#8C1D3C; --bg:#faf7f0; }
@media (prefers-color-scheme: dark) { :root { --ink:#e8e6e1; --mute:#a5a29a; --line:#333; --accent:#e2678a; --bg:#151515; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.6 "PingFang SC","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif; }
main { max-width: 900px; margin: 0 auto; padding: 24px 16px 60px; }
h1 { color: var(--accent); margin: 0 0 4px; font-family: "Songti SC","Noto Serif SC",serif; font-size: 32px; }
h2 { color: var(--accent); border-bottom: 1px solid var(--line); padding-bottom: 6px; margin-top: 36px; }
.meta { color: var(--mute); }
.cards { display: grid; grid-template-columns: repeat(auto-fill,minmax(150px,1fr)); gap: 10px; margin: 16px 0; }
.card { border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; } .card b { display: block; font-size: 22px; }
.scroll { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
th, td { border-bottom: 1px solid var(--line); padding: 6px 8px; text-align: left; vertical-align: top; }
th { position: sticky; top: 0; background: var(--bg); }
td.n { text-align: right; font-variant-numeric: tabular-nums; }
svg { width: 100%; height: auto; }
.legend i { display: inline-block; width: 14px; height: 4px; margin: 0 4px 2px 10px; vertical-align: middle; }
.log li { margin: 2px 0; } .log b { color: var(--accent); display: inline-block; min-width: 3em; }
footer { color: var(--mute); font-size: 12px; margin-top: 40px; text-align: center; }
a { color: var(--accent); }
.hd { display: flex; gap: 16px; align-items: center; } .avatar { width: 88px; height: 88px; border-radius: 50%; object-fit: cover; border: 3px solid var(--line); flex: none; }
</style></head><body><main>
<div class="hd">${FACE ? `<img class="avatar" src="${FACE.url}" alt="">` : ''}<h1>${esc(H(s.name))}</h1></div>
<p class="meta">${s.c.flag} ${esc(H(s.loc.name))} · ${fmtBirth(life)} – ${s.dy} · ${s.age} ${tx('岁', 'years')} · ${esc(s.sex)}${s.eth ? ' · ' + esc(s.eth) : ''}${s.cause ? ' · ' + esc(H(s.cause)) : ''} · ${tx('登记编号', 'Reg.')} ${esc(life.regNumber || '')}</p>
<div class="cards">
 <div class="card">${tx('稀有度', 'Rarity')}<b>${s.r ? s.r.tier.id : '—'}</b></div>
 <div class="card">${tx('出生运气', 'Birth luck')}<b>${window.BornFun ? BornFun.luck(s.c).score : '—'}</b></div>
 <div class="card">${tx('当地预期寿命', 'Life expectancy')}<b>${effectiveLe(s.c, life)}</b></div>
 <div class="card">${tx('实际寿命', 'Lived')}<b>${s.age}</b></div>
 <div class="card">${tx('净资产 US$', 'Net worth US$')}<b>${Math.round(life.stats?.netAssets || 0).toLocaleString()}</b></div>
 <div class="card">${tx('抉择', 'Choices')}<b>${choices.length}</b></div>
</div>
<h2>📈 ${tx('一生的轨迹', 'Trajectory')}</h2>
${svgChart(life) || `<p class="meta">${tx('资料不足以画图。', 'Not enough data to chart.')}</p>`}
<h2>📅 ${tx('逐年表格', 'Year by year')}</h2>
<div class="scroll"><table><thead><tr><th>${tx('年龄', 'Age')}</th><th>${tx('年份', 'Year')}</th><th>${tx('健康', 'Health')}</th><th>${tx('幸福', 'Happy')}</th><th>${tx('知识', 'Know.')}</th><th>${tx('人际', 'Social')}</th><th>${tx('净资产', 'Net worth')}</th><th>${tx('状态', 'Status')}</th><th>${tx('这一年', 'This year')}</th></tr></thead><tbody>
${ys.map(y => `<tr><td class="n">${y.age}</td><td class="n">${by + y.age}</td><td class="n">${y.h ?? ''}</td><td class="n">${y.hp ?? ''}</td><td class="n">${y.k ?? ''}</td><td class="n">${y.so ?? ''}</td><td class="n">${y.m == null ? '' : Math.round(y.m).toLocaleString()}</td><td>${esc(empLabel(y.emp))}${y.mar ? ' · ' + tx('已婚', 'married') : ''}${y.kids ? ' · ' + y.kids + tx('孩', ' kids') : ''}</td><td>${(ev[y.age] || []).map(esc).join('<br>')}</td></tr>`).join('')}
</tbody></table></div>
${fam.length ? `<h2>👪 ${tx('家人', 'Family')}</h2><table>${fam.map(f => `<tr><td>${esc(f.rel)}</td><td>${esc(H(f.name))}</td><td>${esc(f.note)}</td></tr>`).join('')}</table>` : ''}
${choices.length ? `<h2>⚖️ ${tx('做过的抉择', 'Choices')}</h2><table>${choices.map(c => `<tr><td class="n">${c.age}</td><td><b>${esc(H(c.title))}</b>${c.note ? `<br>${esc(H(c.note))}` : ''}</td></tr>`).join('')}</table>` : ''}
${quotes.length ? `<h2>✎ ${tx('写下的话', 'Words you wrote')}</h2><ul>${quotes.map(([a, q]) => `<li><b>${a}</b> ${esc(H(q))}</li>`).join('')}</ul>` : ''}
<h2>📜 ${tx('整段人生的纪录', 'The full record')}</h2>
<ul class="log">${(life.log || []).filter(e => e && e.text).map(e => `<li><b>${e.age}</b> ${esc(e.icon || '·')} ${esc(H(e.text))}</li>`).join('')}</ul>
<footer>${tx('本纪录册由《模拟人生》在你的装置上生成；人生为依统计资料的虚构模拟，不代表任何真实个人。', 'Made on your device by Life Simulator. A fictional, statistics-based simulation.')}<br><a href="${esc(SITE())}">${esc(SITE())}</a> · ZenMatrix · <a href="https://www.zenmatrix.org/?utm_source=born-somewhere&amp;utm_medium=referral&amp;utm_campaign=record">www.zenmatrix.org</a></footer>
</main></body></html>`;
  }

  /* ---------------- v6.25：公开追思馆 ----------------
     发布：只送出游戏生成的人生纪录（不含「我的照片」、不含玩家写下的反思）；
     公开页 life.zenmatrix.org/?m=xxxx 在访客装置上用同一套程式重画九宫格与未竟的心愿。 */
  const API = '/api/memorial';
  const PUB_KEY = 'born-somewhere-v2:public-memorials';
  const CANDLE_KEY = 'born-somewhere-v2:candles';
  const BAD_TXT = /(https?:|www\.|\.(com|cn|net|org|io|me|top|xyz)\b|@[a-z0-9]|微信号|vx[:：]|qq[:：]|t\.me)/i;
  const memUrl = (id) => SITE() + '?m=' + id;
  const loadPub = () => { try { return JSON.parse(localStorage.getItem(PUB_KEY) || '{}') || {}; } catch (e) { return {}; } };
  const savePub = (o) => { try { localStorage.setItem(PUB_KEY, JSON.stringify(o)); } catch (e) { /* ignore */ } };
  async function withoutFace(fn) { const f = FACE; FACE = null; try { return await fn(); } finally { FACE = f; } }
  function publicLife(life) {
    const L = JSON.parse(JSON.stringify(Object.assign({}, life, { countryData: undefined, quotes: undefined, companions: undefined })));
    delete L.quotes; delete L.countryData; delete L.companions;
    L.log = (L.log || []).filter(e => e && e.text && !BAD_TXT.test(e.text)).map(e => ({ age: e.age, kind: e.kind, icon: e.icon, text: String(e.text).replace(AUTO_MARK, ' ').trim().slice(0, 260), starred: !!e.starred }));
    L.decisions = (L.decisions || []).map(d => ({ age: d.age, id: d.id, key: d.key, label: d.label, icon: d.icon, note: BAD_TXT.test(d.note || '') ? '' : d.note }));
    return L;
  }
  function memorialTab(body) {
    const life = current.life, key = life.regNumber || fileBase(life);
    const pub = loadPub()[key];
    if (pub && pub.id) return showPublished(body, key, pub);
    body.innerHTML = `<p>${tx('把这一生做成一个公开的追思页面，任何人打开连结都能看到，并为 TA 点一根蜡烛。', 'Turn this life into a public memorial page anyone can visit and light a candle for.')}</p>
      <div class="ks-pubbox">
        <div><b>✅ ${tx('会公开', 'Public')}</b><ul><li>${tx('游戏生成的人生纪录：名字、出生地、年份、家人、事件、抉择、死因', 'The game-generated record: name, birthplace, years, family, events, choices, cause')}</li><li>${tx('照片组合（九宫格）与未竟的心愿（用插画）', 'The photo set and the unfinished wish (illustrations)')}</li></ul></div>
        <div><b>🚫 ${tx('不会公开', 'Not public')}</b><ul><li>${tx('「我的照片」：即使你上传过，公开页也一律用插画', 'Your own photo: public pages always use illustrations')}</li><li>${tx('你在暂停时写下的想法', 'Anything you typed during the life')}</li><li>${tx('你的姓名、联络方式或任何个人资料', 'Your name, contact details or any personal data')}</li></ul></div>
      </div>
      <label class="ks-own"><input type="checkbox" id="ksPubOk"> ${tx('我了解这个页面任何拿到连结的人都能看到，之后可以随时删除。', 'I understand anyone with the link can see this page, and I can delete it anytime.')}</label>
      <div class="ks-actions"><button class="primary" id="ksPub" type="button" disabled>🕯️ ${tx('发布到公开追思馆', 'Publish memorial')}</button></div>
      <p class="muted" id="ksPubMsg"></p>
      ${autoToggle()}`;
    wireAutoToggle(body);
    const ok = $('#ksPubOk'), btn = $('#ksPub'), msg = $('#ksPubMsg');
    ok.addEventListener('change', () => { btn.disabled = !ok.checked; });
    btn.addEventListener('click', async () => {
      btn.disabled = true; msg.textContent = tx('发布中⋯', 'Publishing…');
      try {
        const p = await postLife(life, key);
        track('memorial_publish', { country: life.country });
        showPublished(body, key, p);
      } catch (e) { msg.textContent = tx('发布失败：', 'Failed: ') + (e.message || e); btn.disabled = false; }
    });
  }
  async function postLife(life, key) {
    const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ life: publicLife(life) }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.id) throw new Error(r.status === 429 ? tx('今天发布太多次了，明天再试', 'Too many today, try tomorrow') : (j.error || r.status));
    const all = loadPub(); all[key] = { id: j.id, token: j.token, name: summary(life).name, created: Date.now() }; savePub(all);
    pubCache = null;   // 「大家分享的人生」马上看得到
    return all[key];
  }

  /* v6.35：人生结束就自动放进人生星光馆（预设开启，可在这里关掉）。
     送出的内容跟手动发布一样：只有游戏生成的纪录，没有「我的照片」、没有玩家写下的文字。
     玩家自己删掉的那段人生会记成 { off: true }，不会再自动发布。 */
  const AUTO_KEY = 'born-somewhere-v2:auto-publish';
  const autoOn = () => { try { return localStorage.getItem(AUTO_KEY) !== '0'; } catch (e) { return true; } };
  const setAuto = (v) => { try { localStorage.setItem(AUTO_KEY, v ? '1' : '0'); } catch (e) { /* ignore */ } };
  const autoTried = new Set();
  function autoToggle() {
    return `<label class="ks-own ks-auto"><input type="checkbox" data-ks-auto ${autoOn() ? 'checked' : ''}> ${tx('以后每段人生结束时，自动放进人生星光馆', 'Automatically add every finished life to the memorial hall')}</label>`;
  }
  function wireAutoToggle(root) {
    root.querySelector('[data-ks-auto]')?.addEventListener('change', (e) => {
      setAuto(e.target.checked);
      track('memorial_auto_toggle', { on: e.target.checked ? 1 : 0 });
      toast(e.target.checked ? tx('已开启自动发布', 'Auto-publish on') : tx('已关闭自动发布，之后要手动发布', 'Auto-publish off'));
    });
  }
  async function autoPublish(life) {
    if (!life || !life.died || !autoOn() || !navigator.onLine) return;
    if (/[?&]m=/.test(location.search)) return;
    const key = life.regNumber || fileBase(life);
    if (!key || autoTried.has(key) || loadPub()[key]) return;
    autoTried.add(key);
    try {
      await postLife(life, key);
      track('memorial_auto', { country: life.country, age: life.deathAge });
      toast(`🌟 ${tx('这段人生已放进人生星光馆（纪念品 → 星光馆可删除或关闭自动发布）', 'This life is now in the memorial hall (Keepsakes → Public memorial to delete it or turn this off)')}`, 3200);
    } catch (e) { /* 离线、额度用完：安静失败，玩家还能手动发布 */ }
  }
  function showPublished(body, key, pub) {
    const url = memUrl(pub.id);
    body.innerHTML = `<p>🕯️ ${tx('这段人生已经在公开追思馆了：', 'This life is in the public memorial hall:')}</p>
      <div class="ks-publink"><canvas id="ksPubQr" width="180" height="180"></canvas><div>
        <a href="${url}" target="_blank" rel="noopener" class="ks-url">${esc(url.replace(/^https?:\/\//, ''))}</a>
        <div class="ks-actions"><button class="primary" id="ksPubCopy" type="button">📋 ${tx('复制连结', 'Copy link')}</button>
        ${navigator.share ? `<button class="ghost" id="ksPubShare" type="button">💚 ${tx('分享', 'Share')}</button>` : ''}
        <button class="ghost" id="ksPubDel" type="button">🗑️ ${tx('删除公开页', 'Delete page')}</button></div>
      </div></div>
      ${autoToggle()}
      <p class="muted">${tx('删除用的凭证只存在这个浏览器里；清除浏览资料后就无法自己删除，可来信 info@zenmatrix.org 处理。', 'The delete key lives only in this browser. If you clear it, email info@zenmatrix.org.')}</p>`;
    wireAutoToggle(body);
    const qc = $('#ksPubQr'); if (qc) qr(qc.getContext('2d'), url, 0, 0, 180);
    const text = tx(`我在《模拟人生》里走完了一生，为 TA 留了一个追思页。来点一根蜡烛吧 🕯️ ${url}`, `I lived a whole life in Life Simulator. Light a candle for it 🕯️ ${url}`).replace(/TA/, current.life.sex === 'F' ? '她' : '他');
    $('#ksPubCopy').addEventListener('click', async () => { const ok = await copyText(H(text)); toast(ok ? tx('连结已复制', 'Link copied') : tx('复制失败', 'Copy failed')); });
    $('#ksPubShare')?.addEventListener('click', async () => { try { await navigator.share({ url, text: H(text), title: tx('追思', 'In memory') }); } catch (e) { /* cancelled */ } });
    $('#ksPubDel').addEventListener('click', async () => {
      if (!confirm(tx('确定删除这个公开追思页？删除后连结会失效。', 'Delete this public page? The link will stop working.'))) return;
      try {
        const r = await fetch(`${API}/${pub.id}`, { method: 'DELETE', headers: { 'x-owner-token': pub.token } });
        if (!r.ok && r.status !== 404) throw new Error(r.status);
        const all = loadPub(); all[key] = { off: true }; savePub(all); pubCache = null;
        track('memorial_delete', {});
        toast(tx('已删除', 'Deleted')); memorialTab(body);
      } catch (e) { toast(tx('删除失败，请稍后再试', 'Delete failed')); }
    });
  }

  /* ---------- 公开页：?m=xxxx ---------- */
  async function waitReady() { for (let i = 0; i < 100; i++) { if (typeof COUNTRIES !== 'undefined' && COUNTRIES.length && typeof I18N !== 'undefined' && I18N[LANG]) return true; await new Promise(r => setTimeout(r, 100)); } return false; }
  async function openMemorialView(id) {
    if (!(await waitReady())) return;
    let v = $('#memView');
    if (!v) { v = document.createElement('div'); v.id = 'memView'; v.className = 'mem-view'; document.body.appendChild(v); }
    document.body.classList.add('mem-open');
    v.innerHTML = `<div class="mem-wrap"><div class="ks-loading">🕯️ ${tx('正在打开追思页⋯', 'Opening…')}</div></div>`;
    let data;
    try { const r = await fetch(`${API}/${encodeURIComponent(id)}`); if (!r.ok) throw new Error(r.status); data = await r.json(); }
    catch (e) {
      v.innerHTML = `<div class="mem-wrap"><h2>🕯️ ${tx('这个追思页不存在或已删除', 'This memorial is not available')}</h2><div class="ks-actions"><button class="primary" data-mem-go type="button">▶ ${tx('我也来活一次', 'Live a life')}</button></div></div>`;
      wireMemView(v); return;
    }
    const life = data.life; life.countryData = countryById(life.country); life.died = true;
    if (!life.countryData) return;
    const s = summary(life);
    const lit = (() => { try { return (JSON.parse(localStorage.getItem(CANDLE_KEY) || '[]') || []).includes(id); } catch (e) { return false; } })();
    const stages = STAGES.filter(st => st.min <= s.age).map(st => ({ st, evs: stageEvents(life, st, 3) })).filter(x => x.evs.length);
    v.innerHTML = `<div class="mem-wrap">
      <div class="mem-head">
        <div class="mem-kicker">🕯️ ${tx('模拟人生 · 公开追思馆', 'Life Simulator · Memorial hall')}</div>
        <h1>${esc(H(s.name))}</h1>
        <p class="mem-meta">${s.c.flag} ${esc(H(s.loc.name))} · ${fmtBirth(life)} – ${s.dy} · ${tx('享年', 'Aged')} ${s.age}${s.cause ? ' · ' + esc(H(s.cause)) : ''}</p>
        <button class="mem-candle ${lit ? 'lit' : ''}" id="memCandle" type="button"><span class="mem-flame">${tx("🌟", "🕯️")}</span> <b id="memCount">${data.candles || 0}</b> <span>${lit ? tx('你已点过蜡烛', 'You lit a candle') : tx('点一根蜡烛', 'Light a candle')}</span></button>
      </div>
      <div class="ks-grid mem-grid" id="memGrid"><div class="ks-loading">${tx('正在画这一生⋯', 'Drawing this life…')}</div></div>
      <div id="memWish"></div>
      <div class="mem-tl">${stages.map(({ st, evs }) => `<section><h3>${st.icon} ${esc(tx(st.zh, st.en))} <small>${st.min}–${Math.min(st.max, s.age)}</small></h3><ul>${evs.map(e => `<li><b>${e.age}</b> ${esc(H(e.text))}</li>`).join('')}</ul></section>`).join('')}</div>
      <div class="mem-cta"><p>${tx('这只是 80 亿种人生里的一种。你会出生在哪里？', 'One of 8 billion possible lives. Where would you be born?')}</p><button class="primary" data-mem-go type="button">▶ ${tx('我也来活一次', 'Live a life')}</button></div>
      <div class="mem-recent" id="memRecent"></div>
      <p class="muted mem-foot">${tx('人生为《模拟人生》依真实统计生成的虚构故事，由玩家发布。', 'A fictional life generated from real statistics, published by a player.')} <button class="lnk" id="memReport" type="button">${tx('举报', 'Report')}</button></p>
    </div>`;
    wireMemView(v);
    track('memorial_view', { country: life.country });
    $('#memCandle').addEventListener('click', async () => {
      const b = $('#memCandle'); if (b.classList.contains('lit')) return;
      b.classList.add('lit'); b.querySelector('span:last-child').textContent = tx('你已点过蜡烛', 'You lit a candle');
      try { const r = await fetch(`${API}/${id}/candle`, { method: 'POST' }); const j = await r.json(); $('#memCount').textContent = j.candles; } catch (e) { /* ignore */ }
      try { const a = JSON.parse(localStorage.getItem(CANDLE_KEY) || '[]') || []; a.push(id); localStorage.setItem(CANDLE_KEY, JSON.stringify(a.slice(-200))); } catch (e) { /* ignore */ }
      track('memorial_candle', {});
    });
    $('#memReport').addEventListener('click', async () => {
      if (!confirm(tx('这个页面有不当内容吗？举报后我们会检查。', 'Report this page for inappropriate content?'))) return;
      try { await fetch(`${API}/${id}/report`, { method: 'POST' }); } catch (e) { /* ignore */ }
      toast(tx('谢谢，已收到举报', 'Thanks, reported'));
    });
    // 图：在访客装置上重画（不含任何人的真实照片）
    const photos = await withoutFace(() => makePhotos(life));
    const grid = $('#memGrid'); if (grid) grid.innerHTML = photos.map((cv, i) => `<img src="${cv.toDataURL('image/jpeg', 0.82)}" alt="${i + 1}" data-mem-img>`).join('');
    const wish = await makeWish(life);
    const mw = $('#memWish'); if (mw) mw.innerHTML = `<div class="ks-one"><img src="${wish.toDataURL('image/jpeg', 0.85)}" alt=""></div>`;
    v.querySelectorAll('[data-mem-img]').forEach(im => im.addEventListener('click', () => im.classList.toggle('zoom')));
    try {
      const r = await fetch(API); const j = await r.json();
      const items = (j.items || []).filter(x => x.id !== id).slice(0, 8);
      if (items.length) $('#memRecent').innerHTML = `<h3>🕯️ ${tx('最近的追思', 'Recent memorials')}</h3><div class="mem-list">${items.map(x => { const c = countryById(x.country); return `<a href="?m=${encodeURIComponent(x.id)}">${c ? c.flag : ''} ${esc(H(x.name || ''))} <small>${x.age} ${tx('岁', 'y')}</small></a>`; }).join('')}</div>`;
    } catch (e) { /* ignore */ }
  }
  function wireMemView(v) {
    v.querySelectorAll('[data-mem-go]').forEach(b => b.addEventListener('click', () => {
      v.remove(); document.body.classList.remove('mem-open');
      try { history.replaceState(null, '', location.pathname); } catch (e) { /* ignore */ }
      track('memorial_cta', {});
      window.scrollTo(0, 0);
    }));
  }
  (function bootMemorial() {
    let id = null;
    try { id = new URLSearchParams(location.search).get('m'); } catch (e) { id = null; }
    if (id && /^[a-z0-9]{6,12}$/i.test(id)) openMemorialView(id.toLowerCase());
  })();

  /* v6.27：「大家分享的人生」以前只读本机纪录（只看得到自己的）。
   * 现在先放其他玩家公开的追思（/api/memorial 摘要），再放自己的人生。 */
  let pubCache = null, pubAt = 0;
  async function fetchPublic() {
    if (pubCache && Date.now() - pubAt < 60000) return pubCache;
    try { const r = await fetch(API); const j = await r.json(); pubCache = j.items || []; pubAt = Date.now(); } catch (e) { pubCache = pubCache || []; }
    return pubCache;
  }
  function publicCards(items) {
    const mine = loadPub();
    const box = document.createElement('div');
    box.className = 'shared-public';
    box.id = 'sharedPublic';
    if (!items.length) {
      box.innerHTML = `<p class="shared-public-empty">🕯️ ${tx('还没有其他玩家公开人生。人生结束后会自动出现在这里。', 'No one has shared a life publicly yet. Finished lives appear here automatically.')}</p>`;
      return box;
    }
    box.innerHTML = `<div class="shared-sec">🕯️ ${tx('公开追思', 'Public memorials')} · ${items.length}</div>` + items.map(x => {
      const c = countryById(x.country);
      const loc = c && typeof localize === 'function' ? localize(c) : null;
      const cause = x.cause && typeof causeLabel === 'function' ? causeLabel(x.cause) : '';
      const own = Object.prototype.hasOwnProperty.call(mine, x.id) || Object.values(mine).some(v => v && v.id === x.id);
      return `<a class="shared-card shared-pub" href="?m=${encodeURIComponent(x.id)}" data-mem-id="${esc(x.id)}">
        <div class="shared-head"><span class="shared-flag">${c ? c.flag : '🏳️'}</span><div>
          <div class="shared-name">${esc(H(x.name || '—'))}${own ? ` <small class="shared-own">${tx('我发布的', 'mine')}</small>` : ''}</div>
          <div class="shared-meta">${esc(H(loc?.name || x.country || '?'))} · ${x.age ?? '?'} ${tx('岁', 'y')}${cause ? ' · ' + esc(H(cause)) : ''}</div>
        </div></div>
        <div class="shared-quote">${tx('点开看这段人生 →', 'Open this life →')}</div>
      </a>`;
    }).join('') + `<div class="shared-sec">📖 ${tx('我自己的人生', 'My own lives')}</div>`;
    box.querySelectorAll('[data-mem-id]').forEach(a => a.addEventListener('click', (e) => {
      e.preventDefault();
      track('shared_public_open', {});
      openMemorialView(a.dataset.memId);
    }));
    return box;
  }
  const _renderShared = window.renderSharedLives;
  window.renderSharedLives = function (lives) {
    if (_renderShared) _renderShared(lives);
    const wrap = $('#sharedFeed'), list = $('#sharedList');
    if (!wrap || !list) return;
    fetchPublic().then(items => {
      document.getElementById('sharedPublic')?.remove();
      if (!items.length && !(lives && lives.length)) return;
      wrap.hidden = false;
      list.parentNode.insertBefore(publicCards(items), list);
    });
  };

  /* ---------------- 入口：讣闻页 + 书架 ---------------- */
  const _renderEnd = window.renderEnd;
  window.renderEnd = function () {
    _renderEnd.apply(this, arguments);
    try { if (STATE.life && STATE.life.died) autoPublish(STATE.life); } catch (e) { /* ignore */ }
    try {
      const host = $('#funEndPanel') || $('#view-end');
      if (!host || !STATE.life || !STATE.life.died) return;
      $('#ksEndPanel')?.remove();
      host.insertAdjacentHTML('afterend', `<div id="ksEndPanel" class="ks-end">
        <div class="ks-end-t">🎁 ${tx('珍藏这段人生', 'Keep this life')}</div>
        <div class="ks-end-btns">
          <button class="primary" data-ks-open="photos" type="button">💚 ${tx('九宫格 · 发朋友圈', '9 photos · Moments')}</button>
          <button class="ghost" data-ks-open="video" type="button">🎬 ${tx('人生影片', 'Life video')}</button>
          <button class="ghost" data-ks-open="wish" type="button">🌙 ${tx('未竟的心愿', 'Unfinished wish')}</button>
          <button class="ghost" data-ks-open="album" type="button">📖 ${tx('人生相簿 PDF', 'Album PDF')}</button>
          <button class="ghost" data-ks-open="record" type="button">📒 ${tx('人生纪录册', 'Record book')}</button>
          <button class="ghost" data-ks-open="memorial" type="button">🕯️ ${tx('公开追思', 'Public memorial')}</button>
        </div></div>`);
    } catch (e) { /* ignore */ }
  };
  document.addEventListener('click', async (e) => {
    const b = e.target.closest && e.target.closest('[data-ks-open]');
    if (!b) return;
    await openKeepsake('current');
    const tab = b.dataset.ksOpen;
    if (tab !== 'photos') $(`[data-ks-tab="${tab}"]`)?.click();
    track('keepsake_open', { tab });
  });
  // 书架页：加「珍藏」入口（可选任一段前世纪录）
  const _renderShelf = window.renderShelf;
  if (typeof _renderShelf === 'function') {
    window.renderShelf = function () {
      _renderShelf.apply(this, arguments);
      try {
        const sh = $('#view-shelf');
        if (sh && !$('#ksShelfBtn')) sh.insertAdjacentHTML('afterbegin', `<div class="ks-shelf"><button class="ghost" id="ksShelfBtn" data-ks-open="photos" type="button">🎁 ${tx('用前世纪录做珍藏（九宫格 / 影片 / 心愿 / 相簿 / 纪录册）', 'Make keepsakes from past lives')}</button></div>`);
      } catch (err) { /* ignore */ }
    };
  }

  window.BornKeepsake = { openMemorialView, publicLife, makeWish, wishFor, openKeepsake, makePhotos, recordVideo, buildSegs, drawVideoFrame, pickMime, recordHtml, albumHtml, csv, caption };
})();
