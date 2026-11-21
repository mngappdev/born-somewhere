#!/usr/bin/env node
/* v6.37：检查 data/story/<lang>.json 是否跟 data/story.json 的英文版对得上。
 *   node scripts/check-story.js ko        检查一种语言
 *   node scripts/check-story.js           检查 data/story/ 里所有语言
 * 检查：键完全一致、每段的 {person} {interest} {lastAge} 数量一致、没有空值、没有照抄英文、
 *       没有残留中文（ja 允许汉字、zh-Hant 本来就是中文）。有问题时 exit 1。
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = JSON.parse(fs.readFileSync(path.join(root, 'data', 'story.json'), 'utf8'));
const en = src.en;
const dir = path.join(root, 'data', 'story');
const langs = process.argv[2] ? [process.argv[2]] : (fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, '')) : []);
const PH = /\{(person|interest|lastAge)\}/g;
const count = (s) => { const m = {}; (String(s).match(PH) || []).forEach(p => { m[p] = (m[p] || 0) + 1; }); return JSON.stringify(Object.keys(m).sort().map(k => k + m[k])); };
let bad = 0;
for (const lang of langs) {
  const file = path.join(dir, `${lang}.json`);
  let d; try { d = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.log(`${lang}: cannot parse ${file}: ${e.message}`); bad++; continue; }
  const probs = [];
  const missing = Object.keys(en).filter(k => !(k in d)); if (missing.length) probs.push(`missing ${missing.length} keys, e.g. ${missing.slice(0, 5).join(', ')}`);
  const extra = Object.keys(d).filter(k => !(k in en)); if (extra.length) probs.push(`extra ${extra.length} keys, e.g. ${extra.slice(0, 5).join(', ')}`);
  let ph = [], empty = [], same = [], han = [];
  for (const k of Object.keys(en)) {
    if (!(k in d)) continue;
    const v = d[k];
    if (typeof v !== 'string' || !v.trim()) { empty.push(k); continue; }
    if (count(v) !== count(en[k])) ph.push(k);
    if (v.trim() === en[k].trim() && /[a-z]{4,}/i.test(en[k]) && !/^ui\./.test(k)) same.push(k);
    if (lang !== 'ja' && !/^zh/.test(lang) && /[一-鿿]/.test(v)) han.push(k);
  }
  if (ph.length) probs.push(`placeholder mismatch in ${ph.length}: ${ph.slice(0, 8).join(', ')}`);
  if (empty.length) probs.push(`empty ${empty.length}: ${empty.slice(0, 8).join(', ')}`);
  if (same.length) probs.push(`identical to English ${same.length}: ${same.slice(0, 8).join(', ')}`);
  if (han.length) probs.push(`Chinese characters in ${han.length}: ${han.slice(0, 8).join(', ')}`);
  if (probs.length) { bad++; console.log(`${lang}: ✗\n  - ${probs.join('\n  - ')}`); }
  else console.log(`${lang}: ✓ ${Object.keys(d).length} passages`);
}
if (!langs.length) console.log('no files in data/story/');
process.exit(bad ? 1 : 0);
