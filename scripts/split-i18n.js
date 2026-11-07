#!/usr/bin/env node
/* v6.36：把 data/i18n.json（9 种语言、约 420 KB）拆成 data/i18n/<lang>.json，每份约 1/9。
 * 页面只下载当前语言；切换语言时再下载那一份。data/i18n.json 仍是唯一的原始档：
 * 改完翻译后执行  node scripts/split-i18n.js        重新生成
 *               node scripts/split-i18n.js --check  只检查拆分档是否与原始档一致（不一致时 exit 1）
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = JSON.parse(fs.readFileSync(path.join(root, 'data', 'i18n.json'), 'utf8'));
const outDir = path.join(root, 'data', 'i18n');
const check = process.argv.includes('--check');
let stale = [];
if (!check) fs.mkdirSync(outDir, { recursive: true });
for (const [lang, dict] of Object.entries(src)) {
  const file = path.join(outDir, `${lang}.json`);
  const body = JSON.stringify(dict);
  if (check) {
    let cur = null; try { cur = fs.readFileSync(file, 'utf8'); } catch (e) { /* missing */ }
    if (cur !== body) stale.push(lang);
  } else {
    fs.writeFileSync(file, body);
  }
}
if (check) {
  if (stale.length) { console.error(`data/i18n/ is out of date for: ${stale.join(', ')} — run node scripts/split-i18n.js`); process.exit(1); }
  console.log('data/i18n/ matches data/i18n.json');
} else {
  console.log(`wrote ${Object.keys(src).length} files to data/i18n/`);
}
