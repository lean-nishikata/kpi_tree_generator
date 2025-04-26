const fs = require('fs-extra');
const YAML = require('yaml');
const path = require('path');

// Constants
const TEMPLATE_PATH = path.join(__dirname, 'template.html');
const STYLE_PATH = path.join(__dirname, '..', 'static', 'style.css');

// 分割されたJSファイルパス
const JS_CORE_PATH = path.join(__dirname, '..', 'static', 'js', 'core.js');
const JS_TREE_PATH = path.join(__dirname, '..', 'static', 'js', 'tree.js');
const JS_URL_PATH = path.join(__dirname, '..', 'static', 'js', 'url.js');
const JS_SHARE_PATH = path.join(__dirname, '..', 'static', 'js', 'share.js');
const JS_ANCHOR_PATH = path.join(__dirname, '..', 'static', 'js', 'anchor.js');

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
    
    // Set default output directory based on config name
    if (!config.output) {
      // Check if running in Docker or local
      const isDocker = await fs.pathExists('/app');
      if (isDocker) {
        config.output = `/app/output/${configName}/index.html`;
      } else {
        // Extract just the filename without path
        const fileName = path.basename(configName);
        config.output = path.join(process.cwd(), 'output', fileName, 'index.html');
      }
    }
    
    // Read template file
    const template = await fs.readFile(TEMPLATE_PATH, 'utf8');
    
    // Generate the tree HTML
    const treeHtml = generateTreeHtml(config.root);
    
    // スタイルファイルのみここで読み込む (JSファイルはコピーする)
    const styleContent = await fs.readFile(STYLE_PATH, 'utf8');
    
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
    const jsDir = path.join(outputDir, 'js');
    const cssDir = path.join(outputDir, 'css');
    
    // 出力ディレクトリ構造を作成
    await fs.ensureDir(outputDir);
    await fs.ensureDir(jsDir);
    await fs.ensureDir(cssDir);
    
    // HTMLファイルを出力
    await fs.writeFile(outputFile, html);
    
    // JSファイルをコピー
    await fs.copyFile(JS_CORE_PATH, path.join(jsDir, 'core.js'));
    await fs.copyFile(JS_TREE_PATH, path.join(jsDir, 'tree.js'));
    await fs.copyFile(JS_URL_PATH, path.join(jsDir, 'url.js'));
    await fs.copyFile(JS_SHARE_PATH, path.join(jsDir, 'share.js'));
    await fs.copyFile(JS_ANCHOR_PATH, path.join(jsDir, 'anchor.js'));
    
    // CSSファイルをコピー
    await fs.copyFile(STYLE_PATH, path.join(cssDir, 'style.css'));
    
    console.log(`KPI tree generated successfully: ${outputFile}`);
    console.log(`All files placed in: ${outputDir}`);
    console.log('Directory structure ready for GCS upload');
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
    nodeContent += `<div class="value">${node.value}</div>`;
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