# Attributions

## 本作品的授权

程序代码以 MIT License 释出，全文见 [LICENSE](LICENSE)：

- Copyright (c) 2026 Royce（[rollroyces/born-somewhere](https://github.com/rollroyces/born-somewhere)，本 fork 的上游）
- Copyright (c) 2026 ZenMatrix（[mngappdev/born-somewhere](https://github.com/mngappdev/born-somewhere)，本 fork 的修改）

`assets/` 里的插画（`illus-*.jpg`）由上游作者在 v5.53 加入，随上游仓库以 MIT 释出。`assets/zenmatrix-*` 与 `assets/wechat-qr.png` 是 ZenMatrix 的标志与联络方式，不在 MIT 授权范围内，请勿在衍生作品中使用。

## 1in8b.life（灵感来源，非授权使用）

玩法概念（选一个出生地、按真实统计活完一生）来自 [1in8b.life](https://1in8b.life/)。该站没有为自己的程序或内容声明开放授权，所以不能复制其程序代码、文字或图像。上游说明本作品是「以原作精神重新实现」；本 fork 的修改也没有从 1in8b.life 复制任何内容。若发现仓库里有取自 1in8b.life 的内容，应删除或取得授权。本作品与 1in8b.life 没有隶属或合作关系。

## 统计数据

人生模拟使用的统计数据经过改编（换算、插补、合并成生命表与事件概率），来源如下。各数据的授权以来源机构的官方条款为准：

- 联合国《世界人口展望 2024》（UN DESA）——CC BY 3.0 IGO
- 世界银行 World Development Indicators——CC BY 4.0
- WHO、UNESCO UIS、UNDP《人类发展报告》、ILO、UNAIDS、UNODC、UNICEF、《世界幸福报告 2024》——按各机构的数据使用条款署名使用


## 1in8billion.live (MIT)

v6.15 起，下列内容取自 [juren056/1in8billion.live](https://github.com/juren056/1in8billion.live)，依 MIT License 使用：

- `data/story.json`：人生篇章与日常叙事文本（原版 `content/story-v6/locales` 的 `zh-CN` 与 `en`）。篇章引擎为本仓库重写。
- `fun.js` 的配乐：原版 `life-audio.js` 的排程方式与 `country-music.js` 的 8 首原创旋律（另加本仓库为新加坡写的一首）。

```
MIT License

Copyright (c) 2026 Royce (rollroyces)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## qrcode-generator (MIT)

`vendor/qrcode-generator.js`，Copyright (c) 2009 Kazuhiko Arase，授权见 `vendor/qrcode-generator-LICENSE.txt`。

## opencc-js (MIT)

`vendor/opencc-t2cn.js`，授权见 `vendor/opencc-LICENSE.txt`。

## Twemoji Country Flags（字体：CC BY 4.0；打包程序：MIT）

`vendor/TwemojiCountryFlags.woff2`，来自 country-flag-emoji-polyfill 0.1.10（Copyright (c) 2022 TalkJS，MIT）。字体里的国旗图案来自 Twemoji（Copyright Twitter, Inc. and other contributors），以 CC BY 4.0 授权使用（https://creativecommons.org/licenses/by/4.0/）。只在不显示国旗 emoji 的浏览器（主要是 Windows）载入。授权见 `vendor/TwemojiCountryFlags-LICENSE.txt`。
