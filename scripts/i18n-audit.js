#!/usr/bin/env node
/* Node 版的 i18n_audit.py（v6.37）。检查项目完全相同，给没有装 Python 的机器用：
 *   node scripts/i18n-audit.js        有问题时 exit 1
 * 1. U+FFFD 替换字元   2. 韩文值里混入汉字   3. data-t / t() 引用了 i18n.json 里没有的键
 * 4. 各语言键集合一致  5. 空值 / 占位字      6. index.html / app.js / sw.js / README.md 版本号一致，
 *    且汇出图页尾没有写死版本号
 * 额外：7. data/i18n/<lang>.json 与 data/i18n.json 一致（拆分档没忘了重新生成）
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const d = JSON.parse(read('data/i18n.json'));
const html = read('index.html'), js = read('app.js'), sw = read('sw.js'), readme = read('README.md');
const issues = [];
const add = (t, lang, k, detail = '', snip = '') => issues.push([t, lang, k, detail, snip]);

// 1. U+FFFD
for (const [lang, kv] of Object.entries(d)) for (const [k, v] of Object.entries(kv)) { const n = (String(v).match(/�/g) || []).length; if (n) add('U+FFFD', lang, k, 'x' + n, String(v).slice(0, 60)); }
// 2. Han inside Korean
for (const [k, v] of Object.entries(d.ko || {})) { const han = [...new Set([...String(v)].filter(ch => ch >= '一' && ch <= '鿿'))].sort(); if (han.length) add('HAN-in-KO', 'ko', k, han.join(''), String(v).slice(0, 60)); }
// 3. referenced-but-missing keys (a trailing dot is a concatenation prefix, not a key)
const refs = new Set();
for (const src of [html, js]) for (const m of src.matchAll(/data-t(?:-html|-title|-aria)?="([^"]+)"/g)) refs.add(m[1]);
for (const m of js.matchAll(/\bt\(\s*'([A-Za-z0-9_.]+)'/g)) refs.add(m[1]);
for (const [lang, kv] of Object.entries(d)) for (const r of [...refs].sort()) { if (r.endsWith('.')) continue; if (!(r in kv) || !String(kv[r]).trim()) add('MISSING-KEY', lang, r); }
// 4. key-set parity against zh-Hant
const base = new Set(Object.keys(d['zh-Hant']));
for (const [lang, kv] of Object.entries(d)) {
  if (lang === 'zh-Hant') continue;
  const ks = new Set(Object.keys(kv));
  for (const k of [...base].filter(k => !ks.has(k)).sort()) add('MISSING-VS-BASE', lang, k);
  for (const k of [...ks].filter(k => !base.has(k)).sort()) add('ORPHAN-KEY', lang, k);
}
// 5. empty / placeholder values
const ph = /^(TODO|FIXME|xxx|test|lorem|\.\.\.)$/i;
for (const [lang, kv] of Object.entries(d)) for (const [k, v] of Object.entries(kv)) { const s = String(v).trim(); if (!s) add('EMPTY', lang, k); else if (ph.test(s)) add('PLACEHOLDER', lang, k, '', s); }
// 6. version strings
const grab = (re, s) => { const m = re.exec(s); return m ? m[1] : null; };
const htmlV = grab(/class="footer-ver">v(\d+\.\d+)/, html);
const appV = grab(/const APP_VERSION = '(\d+\.\d+\.\d+)'/, js);
const swV = grab(/CACHE_NAME = 'born-somewhere-v(\d+\.\d+)'/, sw);
const readmeV = grab(/# born-somewhere v(5\.\d+|6\.\d+)/, readme);
for (const [where, val] of Object.entries({ 'index.html footer': htmlV, 'app.js APP_VERSION': appV, 'sw.js CACHE_NAME': swV, 'README.md title': readmeV })) if (val == null) add('VERSION', where, '', 'not found');
if (appV && htmlV && appV.split('.').slice(0, 2).join('.') !== htmlV) add('VERSION', 'app.js APP_VERSION', '', `!= index.html v${htmlV}`, appV);
if (htmlV && swV && htmlV !== swV) add('VERSION', 'sw.js CACHE_NAME', '', `!= index.html v${htmlV}`, swV);
if (readmeV && htmlV && readmeV !== htmlV) add('VERSION', 'README.md', '', `!= index.html v${htmlV}`, readmeV);
for (const line of js.split('\n')) if ((line.includes('真實統計') || line.includes('Real statistics')) && line.includes('born-somewhere v')) { const hit = /born-somewhere v(?!\$\{)[0-9.]+/.exec(line); if (hit) add('VERSION', 'app.js', '', 'hardcoded version in export footer', hit[0]); }
// 7. split files up to date
for (const [lang, kv] of Object.entries(d)) {
  let cur = null; try { cur = read(`data/i18n/${lang}.json`); } catch (e) { /* missing */ }
  if (cur !== JSON.stringify(kv)) add('SPLIT-STALE', lang, `data/i18n/${lang}.json`, 'run node scripts/split-i18n.js');
}

if (issues.length) {
  for (const [t, lang, k, detail, snip] of issues) console.log(`${t.padEnd(15)} ${lang}.${k}  [${detail}]  ${JSON.stringify(snip)}`);
  console.log('\nTOTAL:', issues.length);
  process.exit(1);
}
const total = Object.values(d).reduce((n, v) => n + Object.keys(v).length, 0);
console.log(`clean — ${Object.keys(d).length} languages, ${total} values, ${[...refs].filter(r => !r.endsWith('.')).length} referenced keys all resolve, key sets identical, 0 U+FFFD, 0 Han-in-Korean, 0 empty/placeholder, version ${htmlV} consistent across index.html / app.js / sw.js / README.md, split files up to date`);
