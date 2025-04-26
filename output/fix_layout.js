// HTMLの修正を行うスクリプト
const fs = require('fs');
const path = require('path');

// configHTML読み込み
const htmlPath = path.join(__dirname, 'config.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// 強制的に水平レイアウトに変更
html = html.replace(/data-direction="vertical"/g, 'data-direction="horizontal"');
html = html.replace(/direction-vertical/g, 'direction-horizontal');

// CSSに問題があるかもしれないので、強制的に水平レイアウト表示のスタイルを追加
const cssInsert = `
<style>
/* 強制的な水平レイアウト */
.direction-horizontal {
  display: block !important;
}
.direction-vertical {
  display: none !important;
}
.direction-horizontal .kpi-tree {
  display: flex !important;
  flex-direction: row !important;
}
.direction-horizontal .kpi-tree ul {
  display: flex !important;
  flex-direction: column !important;
  padding-left: 20px !important;
}
.direction-horizontal .kpi-tree li {
  display: flex !important;
  flex-direction: row !important;
  align-items: flex-start !important;
  margin: 3px 0 !important;
}
</style>
`;

// CSSを<head>の最後に挿入
html = html.replace('</head>', cssInsert + '</head>');

// HTMLを書き戻す
fs.writeFileSync(htmlPath, html);
console.log('HTML修正完了: ' + htmlPath);
