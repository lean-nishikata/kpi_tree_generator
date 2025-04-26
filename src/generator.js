const fs = require('fs-extra');
const YAML = require('yaml');
const path = require('path');
const { resolveSpreadsheetReferences } = require('./spreadsheet-helper');
require('dotenv').config();

// Constants
const TEMPLATE_PATH = path.join(__dirname, 'template.html');
const STYLE_PATH = path.join(__dirname, '..', 'static', 'style.css');

// 分割されたJSファイルパス
const JS_CORE_PATH = path.join(__dirname, '..', 'static', 'js', 'core.js');
const JS_TREE_PATH = path.join(__dirname, '..', 'static', 'js', 'tree.js');
const JS_URL_PATH = path.join(__dirname, '..', 'static', 'js', 'url.js');
const JS_SHARE_PATH = path.join(__dirname, '..', 'static', 'js', 'share.js');
const JS_ANCHOR_PATH = path.join(__dirname, '..', 'static', 'js', 'anchor.js');

// 全てのスクリプトを読み込んで結合する関数
async function loadAllScripts() {
  const coreJs = await fs.readFile(JS_CORE_PATH, 'utf8');
  const treeJs = await fs.readFile(JS_TREE_PATH, 'utf8');
  const urlJs = await fs.readFile(JS_URL_PATH, 'utf8');
  const shareJs = await fs.readFile(JS_SHARE_PATH, 'utf8');
  const anchorJs = await fs.readFile(JS_ANCHOR_PATH, 'utf8');
  
  return `
// KPIツリージェネレーター JavaScript 結合ファイル
// core.js
${coreJs}

// tree.js
${treeJs}

// url.js
${urlJs}

// share.js
${shareJs}

// anchor.js
${anchorJs}
`;
}

// Main function
async function generateKPITree() {
  try {
    // Get YAML file from command line or use default
    let configName = process.argv[2] || 'config';
    
    // Remove .yaml extension if provided
    if (configName.endsWith('.yaml')) {
      configName = configName.slice(0, -5);
    }
    
    // Check several possible file paths
    const possiblePaths = [
      `/app/config/${configName}.yaml`,
      path.join(process.cwd(), 'config', `${configName}.yaml`),
      path.join(process.cwd(), `${configName}.yaml`)
    ];
    
    let configFile = null;
    
    // Try to find the config file in possible locations
    for (const filePath of possiblePaths) {
      if (await fs.pathExists(filePath)) {
        configFile = filePath;
        break;
      }
    }
    
    // If not found, try to use example.yaml
    if (!configFile) {
      console.log(`Config file '${configName}.yaml' not found, trying example.yaml...`);
      
      const examplePaths = [
        '/app/config/example.yaml',
        path.join(process.cwd(), 'config', 'example.yaml'),
        path.join(process.cwd(), 'example.yaml')
      ];
      
      for (const exPath of examplePaths) {
        if (await fs.pathExists(exPath)) {
          configFile = exPath;
          break;
        }
      }
      
      if (!configFile) {
        console.error('No config file found. Please provide a valid YAML configuration file.');
        process.exit(1);
      }
    }
    
    console.log(`Using configuration file: ${configFile}`);
    
    // Read and parse YAML file
    const configData = await fs.readFile(configFile, 'utf8');
    const config = YAML.parse(configData);
    
    // Google Spreadsheetの参照を解決
    if (config.root) {
      console.log('スプレッドシート参照の解決を開始...');
      try {
        // キーファイルの存在を確認
        const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
        if (keyPath && fs.existsSync(keyPath)) {
          console.log(`認証キーファイルを確認: ${keyPath}`);
          config.root = await resolveSpreadsheetReferences(config.root);
          console.log('スプレッドシート参照の解決が完了しました');
        } else {
          console.warn(`警告: スプレッドシート認証キーファイルが見つかりません: ${keyPath || '未設定'}`);
          console.warn('スプレッドシート参照をERRORとして表示します');
          // スプレッドシート参照を持つノードのvalueを"ERROR"に置き換える関数
          const markSpreadsheetRefAsError = (node) => {
            if (!node) return node;
            
            // valueがスプレッドシート参照の場合
            if (node.value && typeof node.value === 'object' && node.value.spreadsheet) {
              node.value = 'ERROR';
            }
            
            // 文字列形式のスプレッドシート参照
            if (node.value && typeof node.value === 'string' && node.value.startsWith('=spreadsheet:')) {
              node.value = 'ERROR';
            }
            
            // 子ノードも再帰的に処理
            if (node.children && Array.isArray(node.children)) {
              node.children = node.children.map(child => markSpreadsheetRefAsError(child));
            }
            
            return node;
          };
          
          // ツリー全体のスプレッドシート参照をERRORに置き換え
          config.root = markSpreadsheetRefAsError(config.root);
        }
      } catch (error) {
        console.error('スプレッドシート参照の解決中にエラーが発生しました:', error.message);
        console.warn('エラーが発生しましたが、処理を続行します');
      }
    }
    
    // 出力先を単一のindex.htmlに変更
    if (!config.output) {
      // Check if running in Docker or local
      const isDocker = await fs.pathExists('/app');
      if (isDocker) {
        config.output = `/app/output/${configName}.html`;
      } else {
        // Extract just the filename without path
        const fileName = path.basename(configName);
        config.output = path.join(process.cwd(), 'output', `${fileName}.html`);
      }
    }
    
    // Read template file
    const template = await fs.readFile(TEMPLATE_PATH, 'utf8');
    
    // Generate the tree HTML
    const treeHtml = generateTreeHtml(config.root);
    
    // スタイルと全てのJSを読み込む
    const styleContent = await fs.readFile(STYLE_PATH, 'utf8');
    // 全てのJSファイルを結合
    const combinedScripts = await loadAllScripts();
    
    // Replace placeholders in template
    const title = config.title || 'KPI Tree';
    const theme = config.theme || 'default';
    // 方向指定は削除（水平レイアウトのみに最適化）
    
    // Get public URL if defined in YAML
    const publicUrl = config.public_url || '';
    console.log(`Public URL from config: ${publicUrl}`);
    
    // PUBLIC_URL変数を設定するスクリプトを生成
    // リダイレクト先で決定論的に動作するよう改善
    const publicUrlScript = publicUrl ? `<script>
    // リダイレクト環境で動作するPUBLIC_URL設定
    (function() {
      window.PUBLIC_URL = "${publicUrl}";
      // 現在のURLがGCSの場合、それを使用
      if (window.location.href.includes('googleusercontent.com')) {
        console.log('リダイレクト先を検出: ' + window.location.href);
        // ファイル名部分を取得
        var pathParts = window.location.pathname.split('/');
        var fileName = pathParts[pathParts.length - 1] || 'index.html';
        // 現在のURLをベースとして使用
        window.PUBLIC_URL = window.location.href;
      }
      console.log('PUBLIC_URL設定: ' + window.PUBLIC_URL);
    })();
    </script>` : '';
    
    let html = template
      .replace(/\{\{TITLE\}\}/g, title)
      .replace(/\{\{TREE_HTML\}\}/g, treeHtml)
      .replace(/\{\{STYLE\}\}/g, styleContent)
      .replace(/\{\{THEME\}\}/g, theme)
      .replace(/\{\{PUBLIC_URL_SCRIPT\}\}/g, publicUrlScript);
      
    // 方向変換ロジックを削除（対応するプレースホルダーもテンプレートから削除済み）
    
    // 出力ファイルパスを決定
    const outputFile = config.output;
    const outputDir = path.dirname(outputFile);
    
    // 出力ディレクトリを作成
    await fs.ensureDir(outputDir);
    
    // 結合したJSを埋め込むため、テンプレート内のプレースホルダーを置き換え
    let finalHtml = html.replace('<!-- COMBINED_SCRIPTS_PLACEHOLDER -->', `<script>
${combinedScripts}
</script>`);
    // HTMLファイルを出力
    await fs.writeFile(outputFile, finalHtml);
    
    console.log(`KPI tree generated successfully: ${outputFile}`);
    console.log('All scripts and styles embedded in a single HTML file');
    console.log('File is ready for direct GCS upload');
  } catch (error) {
    console.error('Error generating KPI tree:', error);
    process.exit(1);
  }
}

// シンプルなハッシュ関数
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0; // 32bit整数に変換
  }
  return Math.abs(hash).toString(36).substr(0, 9);
}

// 決定論的なノードIDを生成する関数
function generateDeterministicId(node, path) {
  // ノードの内容とパス情報からハッシュを生成
  const nodeText = node.text || '';
  const nodeValue = node.value || '';
  const content = `${nodeText}-${nodeValue}-${path}`;
  return `node-${hashString(content)}`;
}

// Function to generate HTML for the tree
function generateTreeHtml(node, level = 0, path = 'root') {
  // ノードのテキストと位置情報から一意なIDを生成
  const nodeId = generateDeterministicId(node, path);
  const hasChildren = node.children && node.children.length > 0;
  
  // Create node content
  let nodeContent = node.text || '';
  if (node.url) {
    nodeContent = `<a href="${node.url}" target="_blank">${nodeContent}</a>`;
  }
  if (node.value !== undefined) {
    // オブジェクトや複雑な値の場合は適切に文字列化
    let displayValue = node.value;
    
    // オブジェクトの場合は文字列に変換
    if (typeof displayValue === 'object' && displayValue !== null) {
      try {
        // 直接文字列として扱う前にJSON文字列かどうかをチェック
        if (typeof displayValue === 'string' && (displayValue.startsWith('{') || displayValue.startsWith('['))) {
          // すでにJSON文字列の場合はそのまま使用
          displayValue = displayValue;
        } else {
          // オブジェクトをJSON文字列に変換
          displayValue = JSON.stringify(displayValue);
        }
      } catch (e) {
        console.error('値の変換エラー:', e);
        displayValue = String(displayValue);
      }
    }
    
    nodeContent += `<div class="value">${displayValue}</div>`;
  }
  
  // Start the node HTML
  let html = `
    <li>
      <div class="node" id="${nodeId}">
        ${nodeContent}
      </div>`;
  
  // Add children if any
  if (hasChildren) {
    html += `
      <button class="toggle-btn" data-target="${nodeId}-children"></button>
      <ul id="${nodeId}-children" class="children">`;
    
    // Add each child with operator
    node.children.forEach((child, index) => {
      // 子ノードにはインデックスを含むパスを渡す
      html += generateTreeHtml(child, level + 1, `${path}-${index}`);
      
      
      // Add operator between nodes if specified (except for the last child)
      if (child.operator && index < node.children.length - 1) {
        // 演算子の表示を変換（*を×、/を÷に）
        let displayOperator = child.operator;
        if (displayOperator === "*") displayOperator = "×";
        if (displayOperator === "/") displayOperator = "÷";
        
        html += `<li class="operator">${displayOperator}</li>`;
      }
    });
    
    html += `
      </ul>`;
  }
  
  html += `
    </li>`;
  
  return html;
}

// Run the generator
generateKPITree();