#!/usr/bin/env node
/* born-somewhere 冒烟测试（v6.37）—— 用本机的 Microsoft Edge（无头），不下载浏览器。
 *   cd tests && npm i && npm run smoke            全部
 *   node smoke.js lang ko,th                       只跑某几项（lang / layout / publish / challenge / dynasty）
 * 起一个本地伺服器服务仓库根目录；/api/memorial 用假的回应（不会发布到正式站）。
 * 有错误时 exit 1。
 */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright-core');
const ROOT = path.join(__dirname, '..');
const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 8840;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain' };
let hits = [], posts = 0;
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x'); hits.push(u.pathname);
  if (u.pathname.startsWith('/api/memorial')) {
    if (q.method === 'POST') { posts++; r.writeHead(201, { 'content-type': 'application/json' }); r.end(JSON.stringify({ id: 'test' + posts + 'aa', token: 't' })); return; }
    r.writeHead(200, { 'content-type': 'application/json' }); r.end(q.method === 'DELETE' ? '{"ok":true}' : '{"items":[]}'); return;
  }
  let p = decodeURIComponent(u.pathname); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); });
}).listen(PORT);
const BASE = `http://localhost:${PORT}/`;

const only = process.argv[2] ? process.argv[2].split(',') : null;
const want = (n) => !only || only.includes(n);
const LANGS = (process.argv[3] || 'ko,ja,vi,fr,th,es,zh-Hant').split(',');
const fails = [];
const check = (ok, msg) => { console.log(`  ${ok ? '✓' : '✗'} ${msg}`); if (!ok) fails.push(msg); };

const hideModals = () => { for (const id of ['financeModal', 'decisionModal', 'pauseModal', 'focusModal', 'spendModal', 'funStoryModal']) document.getElementById(id)?.setAttribute('hidden', ''); document.querySelectorAll('.fun-modal').forEach(m => { m.hidden = true; }); };
const liveLife = () => { STATE._certLife = null; startLife('SGP'); stopTicker(); STATE.autoDecide = true; const L = STATE.life; let g = 0; while (!L.died && g++ < 130) { STATE.pendingDecision = null; tick(); } };

async function page(b, { lang, mobile = true } = {}) {
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, hasTouch: mobile });
  if (lang) await ctx.addInitScript((l) => { try { if (!sessionStorage.getItem('_l')) { localStorage.setItem('born-somewhere-v2:lang', l); sessionStorage.setItem('_l', '1'); } } catch (e) { /* ignore */ } }, lang);
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
  pg.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  await pg.goto(BASE); await pg.waitForFunction(() => typeof COUNTRIES !== 'undefined' && COUNTRIES.length && typeof I18N !== 'undefined' && I18N[LANG], null, { timeout: 20000 });
  await pg.waitForTimeout(800);
  return { ctx, pg, errs };
}

(async () => {
  const b = await chromium.launch({ executablePath: EDGE });

  /* ---------- 1) 各语言：载入的脚本、人生纪录与讣闻页没有漏翻 ---------- */
  if (want('lang')) {
    console.log('\n[lang] default Simplified Chinese');
    hits = [];
    { const { ctx, pg, errs } = await page(b);
      const st = await pg.evaluate(() => ({ LANG, opencc: !!window.OpenCC, xl: !!window.BornXL }));
      check(st.LANG === 'zh-Hans' && st.opencc && !st.xl, `fresh visitor: zh-Hans, opencc loaded, xl dictionaries not loaded (${JSON.stringify(st)})`);
      await pg.evaluate(liveLife); await pg.evaluate(hideModals); await pg.evaluate(() => setView('end')); await pg.waitForTimeout(1200);
      const trad = await pg.evaluate(() => { const T = /[們這說時個來對會後裡為學過還沒讓給經愛]/; const w = document.createTreeWalker(document.getElementById('view-end'), NodeFilter.SHOW_TEXT); const out = []; let n; while ((n = w.nextNode())) if (n.parentElement.offsetParent && T.test(n.textContent)) out.push(n.textContent.trim().slice(0, 40)); return out; });
      check(trad.length === 0, `zh-Hans end page has no Traditional-only characters ${trad.length ? JSON.stringify(trad.slice(0, 3)) : ''}`);
      check(errs.length === 0, `no page errors ${errs.join(' | ')}`);
      await ctx.close(); }

    for (const L of LANGS) {
      console.log(`\n[lang] ${L}`);
      hits = [];
      const { ctx, pg, errs } = await page(b, { lang: L });
      const st = await pg.evaluate(() => ({ LANG, opencc: !!window.OpenCC, xl: !!(window.BornXL && BornXL.events) }));
      check(st.LANG === L && st.xl && !st.opencc, `stored ${L}: dictionaries loaded, opencc not loaded`);
      await pg.waitForTimeout(1500);   // story file
      check(hits.includes(`/data/story/${L}.json`), `story file data/story/${L}.json requested`);
      const r = await pg.evaluate((L) => {
        STATE._certLife = null; startLife('SGP'); stopTicker(); STATE.autoDecide = true; const Lf = STATE.life; let g = 0; while (!Lf.died && g++ < 130) { STATE.pendingDecision = null; tick(); }
        const log = Lf.log.map(e => e.text || '');
        const latinLang = ['fr', 'es', 'vi'].includes(L);
        const en = latinLang ? [] : log.filter(t => /[A-Za-z]{3,}(\s+[A-Za-z']{2,}){3,}/.test(t));
        const stripNames = (t) => t.replace(/[\u4e00-\u9fff]{2,3}(?=[\s·,，、()（）\-—:：.。!！?？'’"」]|[\uac00-\ud7af\u0e00-\u0e7f]|$)/g, '').replace(/^[\u4e00-\u9fff]{2,3}/, '');
        const han = (L === 'ja' || /^zh/.test(L)) ? [] : log.filter(t => /[\u4e00-\u9fff]/.test(stripNames(t)));
        const simp = L === 'zh-Hant' ? log.filter(t => /[们这说时个来对会后里为学过还没让给经爱]/.test(t)) : [];
        return { n: log.length, en, han, simp };
      }, L);
      check(r.en.length === 0, `${r.n} log lines, no English sentences ${r.en.length ? JSON.stringify(r.en.slice(0, 2)) : ''}`);
      check(r.han.length === 0, `no Chinese fragments (names ignored) ${r.han.length ? JSON.stringify(r.han.slice(0, 2)) : ''}`);
      if (L === 'zh-Hant') check(r.simp.length === 0, `no Simplified characters in the log ${r.simp.length ? JSON.stringify(r.simp.slice(0, 2)) : ''}`);
      await pg.evaluate(hideModals); await pg.evaluate(() => setView('end')); await pg.waitForTimeout(1200); await pg.evaluate(hideModals);
      await pg.evaluate(() => { const d = document.querySelector('.fun-hr-more'); if (d) d.open = true; });
      const end = await pg.evaluate((L) => { const latin = ['fr', 'es', 'vi'].includes(L); const w = document.createTreeWalker(document.getElementById('view-end'), NodeFilter.SHOW_TEXT); const out = []; let n; while ((n = w.nextNode())) { const t = n.textContent.trim(); if (!n.parentElement.offsetParent || t.length < 12) continue; if (!latin && /[A-Za-z]{3,}(\s+[A-Za-z']{2,}){3,}/.test(t)) out.push(t.slice(0, 70)); if (L === 'zh-Hant' && /[们这说时个来对会后里为学过还没让给经爱]/.test(t)) out.push(t.slice(0, 70)); } return out; }, L);
      check(end.length === 0, `end page clean ${end.length ? JSON.stringify(end.slice(0, 3)) : ''}`);
      check(errs.length === 0, `no page errors ${errs.join(' | ')}`);
      await ctx.close();
    }
  }

  /* ---------- 2) 手机版面 ---------- */
  if (want('layout')) {
    console.log('\n[layout] 390×844');
    const { ctx, pg, errs } = await page(b);
    const intro = await pg.evaluate(() => ({ sticky: !document.getElementById('uxCta').hidden }));
    check(intro.sticky, 'sticky "be born" button shown while the real one is off-screen');
    await pg.evaluate(liveLife); await pg.evaluate(hideModals); await pg.evaluate(() => setView('end')); await pg.waitForTimeout(1500);
    const e = await pg.evaluate(() => { const y = (id) => { const el = document.getElementById(id) || document.querySelector(id); return el ? Math.round(el.getBoundingClientRect().top + scrollY) : null; };
      const nav = document.querySelector('.topnav'), a = nav.querySelector('.navbtn.active'), ar = a.getBoundingClientRect(), nr = nav.getBoundingClientRect();
      return { newLife: y('btnNewLife'), health: document.getElementById('funHealth')?.offsetHeight, collapsed: !document.querySelector('.fun-hr-more')?.open, tab: ar.left >= nr.left - 1 && ar.right <= nr.right + 1, years: document.getElementById('endYears').textContent }; });
    check(e.newLife < 1000, `"change birthplace" near the top of the obituary (${e.newLife}px)`);
    check(e.health < 700 && e.collapsed, `health report collapsed (${e.health}px)`);
    check(e.tab, 'active nav tab visible');
    check(/^\d{4}–\d{4}$/.test(e.years) && e.years !== '2024', `card shows birth–death years (${e.years})`);
    check(errs.length === 0, `no page errors ${errs.join(' | ')}`);
    await ctx.close();
  }

  /* ---------- 3) 人生星光馆自动发布（假 API） ---------- */
  if (want('publish')) {
    console.log('\n[publish] auto-publish');
    posts = 0;
    const { ctx, pg, errs } = await page(b);
    await pg.evaluate(liveLife); await pg.evaluate(hideModals); await pg.evaluate(() => setView('end')); await pg.waitForTimeout(1200);
    await pg.evaluate(() => { renderEnd(); renderEnd(); }); await pg.waitForTimeout(800);
    check(posts === 1, `one POST per finished life (${posts})`);
    await pg.evaluate(() => localStorage.setItem('born-somewhere-v2:auto-publish', '0'));
    await pg.evaluate(liveLife); await pg.evaluate(hideModals); await pg.evaluate(() => setView('end')); await pg.waitForTimeout(1200);
    check(posts === 1, `nothing posted with auto-publish off (${posts})`);
    check(errs.length === 0, `no page errors ${errs.join(' | ')}`);
    await ctx.close();
  }

  /* ---------- 4) 同一个起点挑战 ---------- */
  if (want('challenge')) {
    console.log('\n[challenge] same start');
    const A = await page(b);
    await A.pg.evaluate(liveLife);
    const a = await A.pg.evaluate(() => ({ link: BornChallenge.linkFor(STATE.life), name: STATE.life.name.full || STATE.life.name.full_en, reg: STATE.life.regNumber }));
    await A.ctx.close();
    const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(a.link.replace(/^https?:\/\/[^/]+\//, BASE)); await pg.waitForSelector('#chAccept', { timeout: 20000 });
    await pg.evaluate(() => document.getElementById('chAccept').click()); await pg.waitForTimeout(800);
    await pg.evaluate(() => document.getElementById('birthCertConfirm')?.click()); await pg.waitForTimeout(800);
    const bLife = await pg.evaluate(() => ({ name: STATE.life.name.full || STATE.life.name.full_en, reg: STATE.life.regNumber }));
    check(bLife.name === a.name && bLife.reg === a.reg, `friend is born identical (${a.name} / ${bLife.name})`);
    check(errs.length === 0, `no page errors ${errs.join(' | ')}`);
    await ctx.close();
  }

  /* ---------- 5) 家族传承 ---------- */
  if (want('dynasty')) {
    console.log('\n[dynasty] next generation');
    const { ctx, pg, errs } = await page(b);
    let ok = false;
    for (let i = 0; i < 25 && !ok; i++) { await pg.evaluate(liveLife); ok = await pg.evaluate(() => (STATE.life.family?.kids || []).some(k => !k.death)); }
    check(ok, 'a life with a living child');
    if (ok) {
      await pg.evaluate(hideModals); await pg.evaluate(() => setView('end')); await pg.waitForTimeout(1000);
      const parent = await pg.evaluate(() => STATE.life.regNumber);
      await pg.evaluate(() => document.querySelector('#dyEnd [data-dy-kid]').click()); await pg.waitForTimeout(600);
      const c = await pg.evaluate(() => ({ gen: STATE.life.dynasty?.gen, parentIn: (STATE.life.family?.parents || []).length }));
      check(c.gen === 2 && c.parentIn >= 1, `reborn as the child (generation ${c.gen})`);
      check(parent !== await pg.evaluate(() => STATE.life.regNumber), 'new life has its own registration number');
    }
    check(errs.length === 0, `no page errors ${errs.join(' | ')}`);
    await ctx.close();
  }

  await b.close(); srv.close();
  console.log(fails.length ? `\n✗ ${fails.length} failed` : '\n✓ all passed');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); srv.close(); process.exit(1); });
