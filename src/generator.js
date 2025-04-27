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
  // キャッシュバスティングのためにタイムスタンプを追加
  console.log('スクリプト読み込み開始...');
  
  // ファイル存在確認と最新バージョンのロード
  const fileExists = async (path) => {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  };
  
  // 各ファイルの存在を確認
  const files = [JS_CORE_PATH, JS_TREE_PATH, JS_URL_PATH, JS_SHARE_PATH, JS_ANCHOR_PATH];
  for (const file of files) {
    if (!await fileExists(file)) {
      console.error(`ファイルが見つかりません: ${file}`);
    }
  }
  
  // キャッシュを避けるために強制的に再読み込み
  const coreJs = await fs.readFile(JS_CORE_PATH, 'utf8');
  const treeJs = await fs.readFile(JS_TREE_PATH, 'utf8');
  const urlJs = await fs.readFile(JS_URL_PATH, 'utf8');
  const shareJs = await fs.readFile(JS_SHARE_PATH, 'utf8');
  const anchorJs = await fs.readFile(JS_ANCHOR_PATH, 'utf8');
  
  console.log('スクリプト読み込み完了');
  
  // 各ファイルのサイズを確認してデバッグ情報を出力
  console.log(`core.js: ${coreJs.length} バイト`);
  console.log(`tree.js: ${treeJs.length} バイト`);
  console.log(`url.js: ${urlJs.length} バイト`);
  console.log(`share.js: ${shareJs.length} バイト`);
  console.log(`anchor.js: ${anchorJs.length} バイト`);
  
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
      // 設定ファイルが見つからない場合はexample.yamlを試みる
      
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
        throw new Error('No config file found. Please provide a valid YAML configuration file.');
      }
    }
    
    // 設定ファイルを使用
    
    // Read and parse YAML file
    const configData = await fs.readFile(configFile, 'utf8');
    const config = YAML.parse(configData);
    
    // Docker環境の検出
    const isDocker = fs.existsSync('/.dockerenv') || process.env.RUNNING_IN_DOCKER === 'true';
    console.log('-------------- KPIツリー生成処理スタート --------------');
    console.log(`実行環境: ${isDocker ? 'Dockerコンテナ' : 'ローカル環境'}`);
    console.log(`環境変数GOOGLE_SERVICE_ACCOUNT_KEY_PATH: ${process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || '未設定'}`);
    
    // Google Spreadsheetの参照を解決
    if (config.root) {
      try {
        // キーファイルの存在を確認
        const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
        console.log(`サービスアカウントキーパス: ${keyPath}`);
        console.log(`キーファイル存在確認: ${keyPath && fs.existsSync(keyPath) ? '存在します' : '存在しません'}`);
        
        if (keyPath && fs.existsSync(keyPath)) {
          console.log(`スプレッドシート参照の解決を開始します...`);
          config.root = await resolveSpreadsheetReferences(config.root);
          console.log(`スプレッドシート参照の解決が完了しました`);
        } else {
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
              // null/undefinedのノードをフィルタリングして安全に処理
              node.children = node.children
                .filter(child => child !== null && child !== undefined)
                .map(child => markSpreadsheetRefAsError(child));
            }
            
            return node;
          };
          
          // ツリー全体のスプレッドシート参照をERRORに置き換え
          config.root = markSpreadsheetRefAsError(config.root);
        }
      } catch (error) {
        // エラーは抑制して処理を続行
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
    
    // PUBLIC_URL変数を設定するスクリプトを生成
    // リダイレクト先で決定論的に動作するよう改善
    const publicUrlScript = publicUrl ? `<script>
    // リダイレクト環境で動作するPUBLIC_URL設定 - GCS対応強化版
    (function() {
      // 強制的にYAMLで設定した公開URLを使用
      var FIXED_PUBLIC_URL = "${publicUrl}";
      
      // キャッシュバスティング用タイムスタンプ
      var CACHE_BUSTER = new Date().getTime();
      
      // 常にグローバルに利用可能な形で公開URLを設定
      window.PUBLIC_URL = FIXED_PUBLIC_URL;
      window._publicBaseUrl = FIXED_PUBLIC_URL;
      
      console.log('キャッシュ対策タイムスタンプ:', CACHE_BUSTER);
      console.log('強制的に設定した公開URL:', FIXED_PUBLIC_URL);
      
      // GCSリダイレクトを検出しても上書きしない
      if (window.location.href.includes('googleusercontent.com')) {
        console.log('リダイレクト先を検出しましたが、YAML設定の公開URLを優先します: ' + FIXED_PUBLIC_URL);
      }
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
    
    // 生成完了
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
  // ノードがnullまたはundefinedの場合、安全なデフォルト値を返す
  if (!node) {
    return `node-default-${path}`;
  }
  
  // ノードの内容とパス情報からハッシュを生成
  const nodeText = node.text || '';
  const nodeValue = node.value || '';
  const content = `${nodeText}-${nodeValue}-${path}`;
  return `node-${hashString(content)}`;
}

// Function to generate HTML for the tree
function generateTreeHtml(node, level = 0, path = 'root') {
  // ノードがない場合は空文字列を返す
  if (!node) {
    return '';
  }
  
  // ノードのテキストと位置情報から一意なIDを生成
  const nodeId = generateDeterministicId(node, path);
  const hasChildren = node.children && node.children.length > 0;
  
  // Create node content
  let nodeContent = '';
  let mainText = node.text || '';
  
  // URLがある場合、主テキストのみにリンクを適用
  if (node.url) {
    mainText = `<a href="${node.url}" target="_blank">${mainText}</a>`;
  }
  
  // 主テキストを追加
  nodeContent += mainText;
  
  // text_enが存在する場合は小さなフォントで追加（リンクの外側に追加）
  if (node.text_en) {
    nodeContent += `<div class="text-en">${node.text_en}</div>`;
  }
  // 値表示用の変数初期化
  let displayValue = null;
  let valueAttributes = '';
  
  // 値の優先順位を設定
  if (node.value !== undefined) {
    valueAttributes += ` data-value-default="${node.value}"`;
    displayValue = node.value;
  }
  
  // 日次の値があれば設定（日次がデフォルト表示なのでこちらを初期表示値にする）
  if (node.value_daily !== undefined) {
    valueAttributes += ` data-value-daily="${node.value_daily}"`;
    displayValue = node.value_daily; // 日次をデフォルト表示に設定
  }
  
  // 月次の値は属性として設定するが、初期表示には使わない
  if (node.value_monthly !== undefined) {
    valueAttributes += ` data-value-monthly="${node.value_monthly}"`;
  }
  
  // 表示値がない場合はスキップ
  if (displayValue !== null) {
    // オブジェクトや複雑な値の場合は適切に文字列化
    if (typeof displayValue === 'object' && displayValue !== null) {
      try {
        // スプレッドシートAPIレスポンスを検出
        if (displayValue.context || displayValue.spreadsheetId || 
            displayValue._rawSheets || displayValue.authMode || 
            displayValue.jwtClient || displayValue._options || 
            (displayValue.data && displayValue.data.values)) {
          
          // APIレスポンスから実際のデータを抽出する
          if (displayValue.data && displayValue.data.values && 
              Array.isArray(displayValue.data.values) && 
              displayValue.data.values.length > 0 && 
              displayValue.data.values[0].length > 0) {
            // データ最初の要素を取得
            const rawValue = displayValue.data.values[0][0];
            
            // 取得した値がオブジェクトなら再帰的に処理
            if (typeof rawValue === 'object' && rawValue !== null) {
              // プリミティブ値を探す
              if (rawValue.formattedValue) {
                displayValue = rawValue.formattedValue;
              } else if (rawValue.value !== undefined) {
                displayValue = rawValue.value;
              } else {
                // 最後の手段としてJSON変換
                displayValue = JSON.stringify(rawValue);
              }
            } else {
              // 数値や文字列などのプリミティブ値
              displayValue = rawValue;
            }
          } else if (displayValue.formattedValue) {
            // 別のAPIレスポンス形式
            displayValue = displayValue.formattedValue;
          } else if (displayValue.userEnteredValue) {
            // 入力値から取得
            const userValue = displayValue.userEnteredValue;
            // 各種値タイプをチェック
            if (userValue.stringValue) displayValue = userValue.stringValue;
            else if (userValue.numberValue !== undefined) displayValue = userValue.numberValue;
            else if (userValue.boolValue !== undefined) displayValue = userValue.boolValue ? 'TRUE' : 'FALSE';
            else if (userValue.formulaValue) displayValue = userValue.formulaValue;
            else displayValue = JSON.stringify(userValue);
          } else {
            // データが見つからない場合はエラーメッセージ
            displayValue = "0";
          }
        } else {
          // その他のオブジェクトの場合
          // 重要なフィールドをチェック
          if (displayValue.value !== undefined) {
            displayValue = displayValue.value;
          } else if (displayValue.text !== undefined) {
            displayValue = displayValue.text;
          } else if (displayValue["0"] !== undefined) {
            displayValue = displayValue["0"];
          } else {
            // 最後の手段としてJSON変換
            displayValue = JSON.stringify(displayValue);
          }
        }
      } catch (e) {
        console.error('オブジェクト処理エラー:', e);
        displayValue = "値取得エラー";
      }
      
      // 最終的にオブジェクトが残っている場合は文字列化
      if (typeof displayValue === 'object' && displayValue !== null) {
        try {
          displayValue = JSON.stringify(displayValue);
        } catch (jsonErr) {
          displayValue = 'オブジェクト';  // 最悪の場合は決め打ち
        }
      }
    }
    
    // value要素自体にデータ属性を直接設定
    nodeContent += `<div class="value"${valueAttributes}>${displayValue}</div>`;
  }
  
  // node要素にはデータ属性を設定しないようにする。すべての属性はvalue要素に移動済み
  let dataAttributes = '';
  
  // Start the node HTML
  let html = `
    <li>
      <div class="node" id="${nodeId}"${dataAttributes}>
        ${nodeContent}
      </div>`;
  
  // Add children if any
  if (hasChildren) {
    html += `
      <button class="toggle-btn" data-target="${nodeId}-children"></button>
      <ul id="${nodeId}-children" class="children">`;
    
    // Add each child with operator
    node.children.forEach((child, index) => {
      // nullまたはundefinedの子ノードをスキップ
      if (!child) return;
      
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