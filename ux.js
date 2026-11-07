/* v6.36：手机体验修正（最后载入，包在所有模块外层）
 *
 *  1) 首页「出生」按钮在 390×844 手机上位于 1364px，要往下滑一屏半才看得到。
 *     看不到它的时候，屏幕底部固定一个「出生」按钮（点了就按真正的 #btnStart）。
 *  2) 讣闻页：人生总结 → 下一步（再活一次 / 换个出生地）→ 挑战朋友 / 成为下一代 →
 *     珍藏这段人生 → 成就 → 死因 → 健康报告 → 其他纪录。以前成就与纪念品在总结之前，
 *     「再活一次」在最底下（第 6 屏）。
 *  3) 顶部导航在手机上是横向卷动的，切到「讣闻」时高亮的标签在画面外，只露出一条红边。
 *     切换页面时把高亮标签卷进画面。
 *  4) Windows 不显示国旗 emoji（变成「SG」两个字母）。侦测到时才载入 Twemoji 国旗字体（77 KB）。
 *  5) 健康报告里「测测现实中的我」按钮 → 打开 real.js。
 */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const tx = (zh, en) => (window.BornXL ? BornXL.t(zh, en) : (/^zh/.test(typeof LANG === 'undefined' ? 'zh' : LANG) ? zh : en));

  /* ---------- 4) 国旗字体 ---------- */
  (function flagPolyfill() {
    try {
      const probe = (txt) => {
        const c = document.createElement('canvas'); c.width = c.height = 1;
        const x = c.getContext('2d', { willReadFrequently: true });
        x.textBaseline = 'top'; x.font = '100px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; x.scale(0.01, 0.01);
        const px = (col) => { x.clearRect(0, 0, 100, 100); x.fillStyle = col; x.fillText(txt, 0, 0); return x.getImageData(0, 0, 1, 1).data.join(','); };
        const w = px('#fff'), b = px('#000');
        return w === b && !b.startsWith('0,0,0,');   // 有颜色、且不随 fillStyle 改变 = 彩色 emoji
      };
      if (!probe('\u{1F60A}') || probe('\u{1F1F8}\u{1F1EC}')) return;   // 连普通 emoji 都不彩色，或国旗本来就正常
      const st = document.createElement('style');
      st.textContent = `@font-face { font-family: "Twemoji Country Flags"; unicode-range: U+1F1E6-1F1FF, U+1F3F4, U+E0062-E0063, U+E0065, U+E0067, U+E006C, U+E006E, U+E0073-E0074, U+E0077, U+E007F; src: url('vendor/TwemojiCountryFlags.woff2') format('woff2'); font-display: swap; }`;
      document.head.appendChild(st);
      document.documentElement.classList.add('flag-poly');
    } catch (e) { /* ignore */ }
  })();

  /* ---------- 1) 首页底部的「出生」按钮 ---------- */
  function setupStickyCta() {
    const real = $('#btnStart'); if (!real || $('#uxCta')) return;
    const bar = document.createElement('div');
    bar.id = 'uxCta'; bar.className = 'ux-cta'; bar.hidden = true;
    bar.innerHTML = `<button type="button" class="cta-btn ux-cta-btn"></button>`;
    document.body.appendChild(bar);
    const btn = bar.firstElementChild;
    const label = () => { btn.textContent = (real.textContent || '').trim() || tx('出生', 'Be born'); };
    btn.addEventListener('click', () => { try { window.BornFun?.track?.('sticky_cta', {}); } catch (e) { /* ignore */ } real.click(); });
    let realVisible = true;
    const update = () => {
      const onIntro = $('#view-intro')?.classList.contains('active');
      const modal = [...document.querySelectorAll('.modal, .fun-modal, .ks-modal, [role=dialog]')].some(m => !m.hidden && m.getClientRects().length > 0 && getComputedStyle(m).display !== 'none');
      const show = onIntro && !realVisible && !modal && window.innerWidth <= 760;
      if (show) label();
      bar.hidden = !show;
      document.body.classList.toggle('ux-cta-on', show);
    };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => { realVisible = es.some(e => e.isIntersecting); update(); }, { threshold: 0.6 }).observe(real);
    }
    window.addEventListener('resize', update, { passive: true });
    document.addEventListener('click', () => setTimeout(update, 60), true);
    window.BornUX = Object.assign(window.BornUX || {}, { updateCta: update });
    update();
  }

  /* ---------- 3) 导航高亮标签卷进画面 ---------- */
  function revealActiveTab() {
    const nav = $('.topnav'), b = nav && nav.querySelector('.navbtn.active');
    if (!nav || !b || nav.scrollWidth <= nav.clientWidth) return;
    const l = b.offsetLeft - nav.offsetLeft, r = l + b.offsetWidth;
    if (l < nav.scrollLeft) nav.scrollTo({ left: Math.max(0, l - 12), behavior: 'smooth' });
    else if (r > nav.scrollLeft + nav.clientWidth) nav.scrollTo({ left: r - nav.clientWidth + 12, behavior: 'smooth' });
  }
  function navEdges() {
    const nav = $('.topnav'); if (!nav) return;
    const max = nav.scrollWidth - nav.clientWidth;
    nav.classList.toggle('ux-more-l', max > 2 && nav.scrollLeft > 2);
    nav.classList.toggle('ux-more-r', max > 2 && nav.scrollLeft < max - 2);
  }
  function setupNavEdges() {
    const nav = $('.topnav'); if (!nav) return;
    nav.addEventListener('scroll', navEdges, { passive: true });
    window.addEventListener('resize', navEdges, { passive: true });
    navEdges();
  }
  const _setView = window.setView;
  if (_setView) {
    window.setView = function (v) {
      const out = _setView.apply(this, arguments);
      try { revealActiveTab(); setTimeout(navEdges, 400); window.BornUX?.updateCta?.(); if (v === 'end') scrollTo({ top: 0 }); } catch (e) { /* ignore */ }
      return out;
    };
  }

  /* ---------- 2) 讣闻页顺序 ---------- */
  const END_ORDER = ['.cert-band', '.cert-body', '.cert-actions', '#endLastMoments', '#chEnd', '#dyEnd', '#ksEndPanel', '#funEndPanel', '#funCause', '#funHealth', '#endCauseAnalysis', '#endDecisions', '#endPastRecords', '.cert-note'];
  function reorderEnd() {
    const cert = $('#endCert'); if (!cert) return;
    let prev = null;
    for (const sel of END_ORDER) {
      const el = sel.startsWith('#') ? document.getElementById(sel.slice(1)) : cert.querySelector(':scope > ' + sel);
      if (!el) continue;
      if (el.parentNode !== cert) cert.appendChild(el);           // 成就、纪念品面板原本在卡片外
      if (prev) { if (prev.nextElementSibling !== el) prev.after(el); }
      else if (cert.querySelector(':scope > #certCanvas')) cert.querySelector(':scope > #certCanvas').after(el);
      prev = el;
    }
    cert.classList.add('ux-ordered');
    // 卡片顶端的年份：HTML 占位「2024」从来没被更新过，改成「出生年–落幕年」
    const yrs = document.getElementById('endYears'), L = (typeof STATE !== 'undefined') && STATE.life;
    if (yrs && L && typeof L.year === 'number') {
      const age = typeof L.deathAge === 'number' ? L.deathAge : (L.age || 0);
      yrs.textContent = `${L.year}–${L.year + age}`;
    }
    // 「再显示 -9 段过去的人生」：HTML 里写死的字，改成实际还有几段；没有就藏起来
    const more = document.getElementById('endShowMore9');
    if (more && typeof loadPastLives === 'function') {
      let n = 0; try { n = Math.max(0, Math.min(9, loadPastLives().length - 5)); } catch (e) { n = 0; }
      more.hidden = n <= 0;
      if (n > 0) more.textContent = tx(`再显示 ${n} 段过去的人生`, `Show ${n} more past lives`);
    }
  }
  const _renderEnd = window.renderEnd;
  if (_renderEnd) {
    window.renderEnd = function () {
      const out = _renderEnd.apply(this, arguments);
      try { reorderEnd(); setTimeout(reorderEnd, 300); setTimeout(reorderEnd, 1200); } catch (e) { /* ignore */ }
      return out;
    };
  }

  /* ---------- 5) 健康报告 → 我的真实人生 ---------- */
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-hr-real]');
    if (!b || !window.BornReal) return;
    try { window.BornFun?.track?.('health_to_real', {}); } catch (err) { /* ignore */ }
    BornReal.open();
  });

  const boot = () => { setupStickyCta(); setupNavEdges(); setTimeout(navEdges, 800); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.BornUX = Object.assign(window.BornUX || {}, { reorderEnd, revealActiveTab });
})();
