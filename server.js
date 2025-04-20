const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// コマンドライン引数からポート番号を取得（デフォルトは8000）
const PORT = process.argv[2] ? parseInt(process.argv[2]) : 8000;

const server = http.createServer((req, res) => {
  // URLをパースしてパス部分のみを取得
  const parsedUrl = url.parse(req.url);
  const pathname = parsedUrl.pathname;
  
  // リクエストされたパスからファイルパスを取得
  let filePath;
  if (pathname === '/' || pathname === '') {
    filePath = path.join(__dirname, 'output', 'example.html');
  } else {
    // パス部分からクエリパラメータを除去
    filePath = path.join(__dirname, 'output', pathname);
  }
  
  // ファイルの拡張子を取得
  const extname = path.extname(filePath);
  
  // Content-Typeを設定
  let contentType = 'text/html';
  switch (extname) {
    case '.js':
      contentType = 'text/javascript';
      break;
    case '.css':
      contentType = 'text/css';
      break;
  }
  
  // ファイルを読み込んでレスポンスを返す
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // ファイルが見つからない場合、example.htmlを返す
        fs.readFile(path.join(__dirname, 'output', 'example.html'), (err2, content2) => {
          if (err2) {
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('ファイルが見つかりません');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(content2, 'utf-8');
          }
        });
      } else {
        // サーバーエラー
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`サーバーエラー: ${err.code}`);
      }
    } else {
      // 成功
      res.writeHead(200, { 'Content-Type': `${contentType}; charset=utf-8` });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`サーバーが起動しました: http://localhost:${PORT}`);
});
