// Keep product copy, guidance and attribution identical across both viewers.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index-drawings.html'), 'utf8');
function replace(from, to) {
  if (!html.includes(from)) throw new Error('Missing shared page anchor: ' + from);
  html = html.replace(from, to);
}
replace('<title>菊池球 · FCC / BCC 交互教学模型</title>', '<title>菊池球 · FCC / BCC 轻量教学模型</title>');
replace('<link rel="stylesheet" href="style.css?v=20260908-shared3">', '<link rel="stylesheet" href="style.css?v=20260908-shared3">\n  <link rel="stylesheet" href="style-lite.css">');
replace('<script src="viewer-drawings.js?v=20260908-shared3" defer></script>', '<script src="texture-loader-lite.js" defer></script>\n  <script src="viewer-lite.js" defer></script>');
replace('<body class="teaching-app">', '<body class="teaching-app lite-app">');
replace('id="retry"', 'id="retry-model"');
replace('<p class="detail" id="face-description">点选模型表面，查看对应的局部图案。</p>', '<p class="detail" id="face-description">点选模型表面，查看对应的局部图案。</p>\n        <p class="detail" id="detail-status" role="status"></p><button id="retry-detail" class="text-button" type="button" hidden>重试高清图</button>');
replace('当前为全清晰视图，所有面保留原分辨率。<a href="index-lite.html" id="render-mode-link">切换轻量视图 ↗</a>', '轻量视图：旋转时使用小图，停下或点选后补充当前面的高清细节。<a href="index-drawings.html" id="render-mode-link">切换全清晰视图 ↗</a>');
html = html.replace('viewer-lite.js"', 'viewer-lite.js?v=20260908-shared3"');
fs.writeFileSync(path.join(root, 'index-lite.html'), html);
console.log('Synced teaching copy and credits to index-lite.html');
