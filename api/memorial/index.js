/* born-somewhere v6.25 —— 公开追思馆 API（Azure Static Web Apps 内建 Functions，零依赖）
   资料存在私有 Blob 容器（MEM_SAS_URL = 容器 SAS 网址）：
     m/{id}.json   已清洗的人生纪录（只收游戏生成的内容）
     c/{id}.json   { candles, reports, hidden }
     o/{id}.txt    发布者删除权杖的 SHA-256
     index.json    最近 60 笔的摘要（追思墙）
     r/{日期}/{ip 杂凑}.txt  每日发布次数（限流）
   路由：
     GET    /api/memorial               最近的追思（追思墙）
     POST   /api/memorial               发布 { life } → { id, token }
     GET    /api/memorial/{id}          读取
     POST   /api/memorial/{id}/candle   点一根蜡烛
     POST   /api/memorial/{id}/report   举报（累计 3 次自动隐藏）
     POST   /api/memorial/{id}/hide     管理员隐藏（header x-admin-key）
     DELETE /api/memorial/{id}          发布者删除（header x-owner-token） */
const crypto = require('crypto');

const BASE = process.env.MEM_SAS_URL || '';
const ADMIN = process.env.ADMIN_KEY || '';
const SALT = process.env.IP_SALT || 'salt';
const MAX_PER_DAY = 40;   // v6.35：人生结束会自动发布，额度从 12 提高

const blobUrl = (p) => BASE.replace('?', '/' + p + '?');
async function getBlob(p) {
  const r = await fetch(blobUrl(p));
  if (r.status === 404) return { data: null, etag: null };
  if (!r.ok) throw new Error('blob get ' + r.status);
  const txt = await r.text();
  let data = txt; try { data = JSON.parse(txt); } catch (e) { /* text */ }
  return { data, etag: r.headers.get('etag') };
}
async function putBlob(p, body, cond) {
  const headers = { 'x-ms-blob-type': 'BlockBlob', 'content-type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8' };
  if (cond && cond.etag) headers['If-Match'] = cond.etag;
  if (cond && cond.create) headers['If-None-Match'] = '*';
  const r = await fetch(blobUrl(p), { method: 'PUT', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
  if (r.status === 412 || r.status === 409) return false;
  if (!r.ok) throw new Error('blob put ' + r.status);
  return true;
}
async function delBlob(p) { const r = await fetch(blobUrl(p), { method: 'DELETE' }); return r.ok || r.status === 404; }
async function update(p, fn, init) {
  for (let i = 0; i < 6; i++) {
    const { data, etag } = await getBlob(p);
    const next = fn(data == null ? init : data);
    if (await putBlob(p, next, etag ? { etag } : { create: true })) return next;
  }
  throw new Error('busy');
}

/* ---------- 清洗：只留游戏生成的栏位；有网址或联络方式就拒收 ---------- */
const BAD = /(https?:|www\.|\.(com|cn|net|org|io|me|top|xyz)\b|@[a-z0-9]|微信号|vx[:：]|qq[:：]|t\.me)/i;
class Reject extends Error {}
const S = (v, n) => {
  if (v == null) return '';
  const s = String(v).replace(/[\u0000-\u001f\u007f<>]/g, ' ').slice(0, n);
  if (BAD.test(s)) throw new Reject('text');
  return s;
};
const N = (v, lo, hi) => { const x = Number(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : 0; };
const nameOf = (n) => (n && typeof n === 'object') ? { full: S(n.full, 40), full_en: S(n.full_en, 60), first: S(n.first, 30), last: S(n.last, 30) } : S(n, 40);
const person = (p) => p && typeof p === 'object' ? { name: nameOf(p.name), sex: p.sex === 'F' ? 'F' : 'M', note: S(typeof p.note === 'string' ? p.note : '', 80) } : null;
const arr = (a, n, f) => (Array.isArray(a) ? a.slice(0, n).map(f).filter(Boolean) : []);
const ETH = ['chinese', 'malay', 'indian', 'eurasian', 'european', 'african', 'latino', 'arab'];
function clean(L) {
  if (!L || typeof L !== 'object') throw new Reject('life');
  if (!/^[A-Z]{3}$/.test(String(L.country || ''))) throw new Reject('country');
  const st = L.stats || {};
  const fam = L.family || {};
  const out = {
    country: L.country, sex: L.sex === 'F' ? 'F' : 'M', year: N(L.year, 1800, 2300), birthMonth: L.birthMonth ? N(L.birthMonth, 1, 12) : null,
    ethnicity: ETH.includes(L.ethnicity) ? L.ethnicity : null,
    name: nameOf(L.name), regNumber: S(L.regNumber, 40),
    age: N(L.deathAge ?? L.age, 0, 130), deathAge: N(L.deathAge ?? L.age, 0, 130), died: true, cause: S(L.cause, 20),
    smoker: !!L.smoker, conditions: { diabetes: !!(L.conditions && L.conditions.diabetes), heart: !!(L.conditions && L.conditions.heart) },
    stats: {
      education: N(st.education, 0, 5), married: !!st.married, partner: st.partner ? { name: nameOf(st.partner.name), sex: st.partner.sex === 'F' ? 'F' : 'M' } : null,
      kids: arr(st.kids, 12, k => (typeof k === 'string' ? { name: S(k, 40) } : person(k))),
      health: N(st.health, 0, 150), happiness: N(st.happiness, 0, 150), knowledge: N(st.knowledge, 0, 150), social: N(st.social, 0, 150),
      netAssets: N(st.netAssets, -1e12, 1e12), annualIncome: N(st.annualIncome, -1e10, 1e10), incomeQuartile: N(st.incomeQuartile, 1, 4),
      religion: S(st.religion, 20), birthPlaceType: st.birthPlaceType === 'rural' ? 'rural' : 'urban', employment: S(st.employment, 20),
    },
    family: {
      parents: arr(fam.parents, 2, person), grandparents: arr(fam.grandparents, 4, person), siblings: arr(fam.siblings, 10, person),
      partner: person(fam.partner), kids: arr(fam.kids, 12, k => (typeof k === 'string' ? { name: S(k, 40) } : person(k))),
    },
    log: arr(L.log, 500, e => e && e.text ? { age: N(e.age, 0, 130), kind: S(e.kind, 20), icon: S(e.icon, 8), text: S(e.text, 260), starred: !!e.starred } : null),
    decisions: arr(L.decisions, 80, d => d ? { age: N(d.age, 0, 130), id: S(d.id, 40), key: S(d.key, 40), label: S(d.label, 80), icon: S(d.icon, 8), note: S(d.note, 160) } : null),
    _yearly: arr(L._yearly, 135, y => y && typeof y === 'object' ? Object.fromEntries(Object.entries(y).slice(0, 16).map(([k, v]) => [S(k, 16), typeof v === 'number' ? v : S(v, 24)])) : null),
    _fun: { fresh: arr(L._fun && L._fun.fresh, 40, x => S(x, 24)) },
  };
  return out;
}

const json = (status, body, extra) => ({ status, headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, extra || {}), body: JSON.stringify(body) });
const newId = () => { const a = '23456789abcdefghjkmnpqrstuvwxyz'; let s = ''; const b = crypto.randomBytes(8); for (const x of b) s += a[x % a.length]; return s; };
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const okId = (id) => /^[a-z0-9]{6,12}$/.test(id || '');
function ipOf(req) { const h = req.headers || {}; return String(h['x-forwarded-for'] || h['x-client-ip'] || '').split(',')[0].replace(/:\d+$/, '').trim() || 'unknown'; }

module.exports = async function (context, req) {
  try {
    if (!BASE) { context.res = json(503, { error: 'not configured' }); return; }
    const id = (context.bindingData.id || '').toLowerCase();
    const action = (context.bindingData.action || '').toLowerCase();
    const m = req.method;

    if (!id && m === 'GET') {
      const { data } = await getBlob('index.json');
      context.res = json(200, { items: (data || []).slice(0, 30) }, { 'cache-control': 'public, max-age=60' });
      return;
    }
    if (!id && m === 'POST') {
      const raw = req.rawBody || '';
      if (raw.length > 400000) { context.res = json(413, { error: 'too large' }); return; }
      let life;
      try { life = clean((req.body || {}).life); } catch (e) { context.res = json(400, { error: e instanceof Reject ? 'rejected:' + e.message : 'bad request' }); return; }
      const day = new Date().toISOString().slice(0, 10), ipk = sha(SALT + ipOf(req)).slice(0, 24);
      const cnt = await update(`r/${day}/${ipk}.json`, d => ({ n: (d.n || 0) + 1 }), { n: 0 });
      if (cnt.n > MAX_PER_DAY) { context.res = json(429, { error: 'too many' }); return; }
      let mid = newId();
      for (let i = 0; i < 4 && !(await putBlob(`m/${mid}.json`, { v: 1, id: mid, created: new Date().toISOString(), life }, { create: true })); i++) mid = newId();
      const token = crypto.randomBytes(18).toString('hex');
      await putBlob(`o/${mid}.txt`, sha(token));
      await putBlob(`c/${mid}.json`, { candles: 0, reports: 0, hidden: false });
      const nm = typeof life.name === 'object' ? (life.name.full || life.name.full_en) : life.name;
      await update('index.json', list => [{ id: mid, name: nm, country: life.country, age: life.deathAge, cause: life.cause, year: life.year, created: new Date().toISOString() }].concat((list || []).filter(x => x.id !== mid)).slice(0, 60), []);
      context.res = json(201, { id: mid, token });
      return;
    }
    if (!okId(id)) { context.res = json(404, { error: 'not found' }); return; }

    if (m === 'GET' && !action) {
      const [{ data: doc }, { data: c }] = await Promise.all([getBlob(`m/${id}.json`), getBlob(`c/${id}.json`)]);
      if (!doc || (c && c.hidden)) { context.res = json(404, { error: 'not found' }); return; }
      context.res = json(200, { id, created: doc.created, life: doc.life, candles: (c && c.candles) || 0 });
      return;
    }
    if (m === 'POST' && (action === 'candle' || action === 'report')) {
      const { data: doc } = await getBlob(`m/${id}.json`);
      if (!doc) { context.res = json(404, { error: 'not found' }); return; }
      const next = await update(`c/${id}.json`, d => {
        const o = Object.assign({ candles: 0, reports: 0, hidden: false }, d);
        if (action === 'candle') o.candles = Math.min(1e9, o.candles + 1);
        else { o.reports += 1; if (o.reports >= 3) o.hidden = true; }
        return o;
      }, {});
      if (next.hidden) await update('index.json', list => (list || []).filter(x => x.id !== id), []);
      context.res = json(200, action === 'candle' ? { candles: next.candles } : { ok: true });
      return;
    }
    if (m === 'POST' && action === 'hide') {
      if (!ADMIN || (req.headers['x-admin-key'] || '') !== ADMIN) { context.res = json(403, { error: 'forbidden' }); return; }
      const unhide = (req.query && req.query.unhide) === '1';
      await update(`c/${id}.json`, d => Object.assign({ candles: 0, reports: 0 }, d, { hidden: !unhide }), {});
      if (!unhide) await update('index.json', list => (list || []).filter(x => x.id !== id), []);
      context.res = json(200, { ok: true, hidden: !unhide });
      return;
    }
    if (m === 'DELETE') {
      const { data: h } = await getBlob(`o/${id}.txt`);
      const tok = req.headers['x-owner-token'] || '';
      const isAdmin = ADMIN && (req.headers['x-admin-key'] || '') === ADMIN;
      if (!isAdmin && (!h || !tok || String(h).trim() !== sha(tok))) { context.res = json(403, { error: 'forbidden' }); return; }
      await Promise.all([delBlob(`m/${id}.json`), delBlob(`c/${id}.json`), delBlob(`o/${id}.txt`)]);
      await update('index.json', list => (list || []).filter(x => x.id !== id), []);
      context.res = json(200, { ok: true });
      return;
    }
    context.res = json(405, { error: 'method' });
  } catch (e) {
    context.log.error(e);
    context.res = json(500, { error: 'server' });
  }
};
