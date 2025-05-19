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
const JS_CALENDAR_PATH = path.join(__dirname, '..', 'static', 'js', 'calendar.js');

// 全てのスクリプトを読み込んで結合する関数
async function loadAllScripts() {
  // キャッシュバスティングのためにタイムスタンプを追加
  console.log('スクリプト読み込み開始...');
  
  // デバッグ: 読み込むファイルのリストを表示
  console.log('読み込み予定JSファイル:');
  console.log('- ' + JS_CORE_PATH);
  console.log('- ' + JS_TREE_PATH);
  console.log('- ' + JS_URL_PATH);
  console.log('- ' + JS_SHARE_PATH);
  console.log('- ' + JS_ANCHOR_PATH);
  console.log('- ' + JS_CALENDAR_PATH);
  
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
  const files = [JS_CORE_PATH, JS_TREE_PATH, JS_URL_PATH, JS_SHARE_PATH, JS_ANCHOR_PATH, JS_CALENDAR_PATH];
  for (const file of files) {
    if (!await fileExists(file)) {
      console.error(`ファイルが見つかりません: ${file}`);
    }
  }
  
  // キャッシュを避けるために強制的に再読み込み
  // 安全にファイルを読み込むヘルパー関数
  const safeReadFile = async (path) => {
    try {
      return await fs.readFile(path, 'utf8');
    } catch (e) {
      console.error(`ファイルの読み込みに失敗しました: ${path}`);
      return ''; // 空文字列を返す
    }
  };
  
  const coreJs = await safeReadFile(JS_CORE_PATH);
  const treeJs = await safeReadFile(JS_TREE_PATH);
  const urlJs = await safeReadFile(JS_URL_PATH);
  const shareJs = await safeReadFile(JS_SHARE_PATH);
  const anchorJs = await safeReadFile(JS_ANCHOR_PATH);
  const calendarJs = await safeReadFile(JS_CALENDAR_PATH);
  
  console.log('スクリプト読み込み完了');
  
  // 各ファイルのサイズを確認してデバッグ情報を出力
  console.log(`core.js: ${coreJs.length} バイト`);
  console.log(`tree.js: ${treeJs.length} バイト`);
  console.log(`url.js: ${urlJs.length} バイト`);
  console.log(`share.js: ${shareJs.length} バイト`);
  console.log(`anchor.js: ${anchorJs.length} バイト`);
  console.log(`calendar.js: ${calendarJs.length} バイト`);
  
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

// calendar.js
${calendarJs}
`;
}

// Main function
async function generateKPITree() {
  // 現在の日付をデフォルトとして使用
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const defaultDate = `${year}年${month}月${day}日`;
  
  // コマンドライン引数から日付パラメータを取得
  const args = process.argv.slice(2);
  let dataDate = defaultDate;
  
  // --date オプションがある場合、その値を使用
  const dateIndex = args.indexOf('--date');
  if (dateIndex > -1 && args.length > dateIndex + 1) {
    // コマンドラインからの入力は「YYYY-MM-DD」形式で受け付ける
    const isoDate = args[dateIndex + 1];
    if (isoDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [inputYear, inputMonth, inputDay] = isoDate.split('-');
      dataDate = `${inputYear}年${inputMonth}月${inputDay}日`;
    } else {
      dataDate = isoDate; // フォーマットが異なる場合はそのまま使用
    }
  }
  try {
    // Get YAML file from command line or use default
    let configName = process.argv[2] || 'config';
    
    // Remove .yaml extension if provided
    if (configName.endsWith('.yaml')) {
      configName = configName.slice(0, -5);
    }
    
    // Remove directory part from configName if it includes path separators
    configName = path.basename(configName);
    
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
          
          // グローバルスプレッドシート設定を初期化
          if (!global.kpiTreeConfig) {
            global.kpiTreeConfig = {};
          }
          
          // YAMLファイルのルートレベルのスプレッドシート設定をグローバル変数に保存
          if (config.spreadsheet && config.spreadsheet.id) {
            console.log(`YAMLファイルからスプレッドシートIDを読み込みました: ${config.spreadsheet.id}`);
            global.kpiTreeConfig.spreadsheet = config.spreadsheet;
            
            // rootノードにも設定を反映
            if (!config.root.spreadsheet) {
              config.root.spreadsheet = {};
            }
            config.root.spreadsheet.id = config.spreadsheet.id;
          } else {
            console.warn('警告: YAMLファイルのルートレベルにスプレッドシートIDが設定されていません');
          }
          
          // 環境変数からIDを設定する場合（YAMLに指定がない場合のみ）
          if (process.env.KPI_TREE_SPREADSHEET_ID && 
              (!global.kpiTreeConfig.spreadsheet || !global.kpiTreeConfig.spreadsheet.id)) {
            console.log(`YAMLに指定がないため、環境変数からスプレッドシートIDを設定します: ${process.env.KPI_TREE_SPREADSHEET_ID}`);
            if (!global.kpiTreeConfig.spreadsheet) {
              global.kpiTreeConfig.spreadsheet = {};
            }
            global.kpiTreeConfig.spreadsheet.id = process.env.KPI_TREE_SPREADSHEET_ID;
          } else if (global.kpiTreeConfig.spreadsheet && global.kpiTreeConfig.spreadsheet.id) {
            console.log(`YAMLの設定を優先し、スプレッドシートID: ${global.kpiTreeConfig.spreadsheet.id} を使用します`);
          }
          
          // スプレッドシート参照を解決
          config.root = await resolveSpreadsheetReferences(config.root);
          console.log(`スプレッドシート参照の解決が完了しました`);
          
          // 前日比・前月比の参照が解決されているか確認し、必要なら再度解決する追加処理
          const manuallyResolveDiffValues = async (node) => {
            if (!node) return node;
            
            // スプレッドシートIDを取得
            const spreadsheetId = global.kpiTreeConfig.spreadsheet.id;
            
            // デモモードの判定
            const shouldUseDemo = !spreadsheetId || !fs.existsSync(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH);
            
            // 前日比の解決
            if (node.diff_daily && typeof node.diff_daily === 'string' && node.diff_daily.startsWith('=')) {
              try {
                if (shouldUseDemo) {
                  // デモモードの場合はランダム値を設定
                  const demoValues = ['+5%', '+10%', '-3%', '+0%', '+7%', '-2%'];
                  node.diff_daily = demoValues[Math.floor(Math.random() * demoValues.length)];
                } else {
                  // スプレッドシートから値を取得
                  const rangeNotation = node.diff_daily.substring(1); // = を除去
                  const spreadsheetHelper = require('./spreadsheet-helper');
                  node.diff_daily = await spreadsheetHelper.getCellValue(spreadsheetId, rangeNotation);
                }
              } catch (e) {
                console.error(`前日比値の解決エラー:`, e);
                // エラーが発生した場合はデフォルト値を設定
                node.diff_daily = '+0%';
              }
            }
            
            // 前月比の解決
            if (node.diff_monthly && typeof node.diff_monthly === 'string' && node.diff_monthly.startsWith('=')) {
              try {
                if (shouldUseDemo) {
                  // デモモードの場合はランダム値を設定
                  const demoValues = ['95%', '110%', '103%', '90%', '120%', '98%'];
                  node.diff_monthly = demoValues[Math.floor(Math.random() * demoValues.length)];
                } else {
                  // スプレッドシートから値を取得
                  const rangeNotation = node.diff_monthly.substring(1); // = を除去
                  const spreadsheetHelper = require('./spreadsheet-helper');
                  node.diff_monthly = await spreadsheetHelper.getCellValue(spreadsheetId, rangeNotation);
                }
              } catch (e) {
                console.error(`前月比値の解決エラー:`, e);
                // エラーが発生した場合はデフォルト値を設定
                node.diff_monthly = '100%';
              }
            }
            
            // 子ノードも再帰的に処理
            if (node.children && Array.isArray(node.children)) {
              for (let i = 0; i < node.children.length; i++) {
                node.children[i] = await manuallyResolveDiffValues(node.children[i]);
              }
            }
            
            return node;
          };
          
          // 前日比・前月比の参照を手動で解決
          config.root = await manuallyResolveDiffValues(config.root);
          console.log(`前日比・前月比の参照解決が完了しました`);
          
        } else {
          // スプレッドシート参照を持つノードについて、元の参照値をそのまま表示する関数
          const markSpreadsheetRefAsOriginal = (node) => {
            if (!node) return node;
            
            // valueがスプレッドシート参照の場合は、元の参照値をそのまま使用
            // 何も変更しない
            
            // 子ノードも再帰的に処理
            if (node.children && Array.isArray(node.children)) {
              // null/undefinedのノードをフィルタリングして安全に処理
              node.children = node.children
                .filter(child => child !== null && child !== undefined)
                .map(child => markSpreadsheetRefAsOriginal(child));
            }
            
            return node;
          };
          
          // ツリー全体のスプレッドシート参照をそのまま使用
          config.root = markSpreadsheetRefAsOriginal(config.root);
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
        // configNameはすでにpath.basenameで処理済み
        config.output = path.join(process.cwd(), 'output', `${configName}.html`);
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
    
    // faviconのURLを取得
    const faviconUrl = config.favicon || '';
    
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
    
    // faviconリンクタグを生成
    const faviconLink = faviconUrl ? `<link rel="icon" href="${faviconUrl}" type="image/x-icon">` : '';
    
    // カスタムヘッダー情報の処理
    // （ノードのスプレッドシート解決後に実行される）
    let headerInfoText = '';
    if (config.header_info) {
      try {
        // ラベルがあれば取得
        const headerLabel = config.header_info.label || 'カスタム情報';
        
        // 値の処理
        let headerValue = '';
        
        // パターン1: スプレッドシート参照オブジェクトの場合
        if (config.header_info.value && typeof config.header_info.value === 'object' && config.header_info.value.spreadsheet) {
          const spreadsheetId = global.kpiTreeConfig?.spreadsheet?.id || 
                               config.header_info.value.spreadsheet.id || 
                               process.env.KPI_TREE_SPREADSHEET_ID;
          
          // サービスアカウントキーの存在を確認
          const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
          const keyExists = keyPath && fs.existsSync(keyPath);
          
          if (spreadsheetId && config.header_info.value.spreadsheet.range && keyExists) {
            try {
              console.log(`ヘッダー情報をスプレッドシートから取得します: ${spreadsheetId}, ${config.header_info.value.spreadsheet.range}`);
              // すでにシートが読み込まれているならそのキャッシュを使用
              const spreadsheetHelper = require('./spreadsheet-helper');
              
              // 参照文字列を整形して取得を試みる
              const rangeString = config.header_info.value.spreadsheet.range;
              // "="で始まる場合は除去する
              const cleanRange = rangeString.startsWith('=') ? rangeString.substring(1) : rangeString;
              
              try {
                headerValue = await spreadsheetHelper.getCellValue(spreadsheetId, cleanRange);
                console.log(`ヘッダー情報の値を取得しました: ${headerValue}`);
              } catch (fetchErr) {
                console.log(`ヘッダー情報取得失敗、参照文字列をそのまま使用: ${rangeString}`);  
                headerValue = rangeString;
              }
            } catch (err) {
              console.error(`ヘッダー情報のスプレッドシート取得エラー:`, err);
              // エラー時はスプレッドシートの参照文字列をそのまま表示
              headerValue = config.header_info.value.spreadsheet.range;
            }
          } else if (spreadsheetId && config.header_info.value.spreadsheet.range) {
            // キーファイルが存在しない場合は参照文字列をそのまま表示
            console.log(`キーファイルが存在しないため、参照文字列をそのまま使用: ${config.header_info.value.spreadsheet.range}`);
            headerValue = config.header_info.value.spreadsheet.range;
          } else {
            headerValue = '未設定';
          }
        }
        // パターン2: 参照文字列の場合（"="で始まる文字列）
        else if (config.header_info.value && typeof config.header_info.value === 'string' && config.header_info.value.startsWith('=')) {
          try {
            const spreadsheetId = global.kpiTreeConfig?.spreadsheet?.id || process.env.KPI_TREE_SPREADSHEET_ID;
            // サービスアカウントキーの存在を確認
            const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
            const keyExists = keyPath && fs.existsSync(keyPath);
            
            if (spreadsheetId && keyExists) {
              // "="を除去した位置指定データを取得
              const cleanRange = config.header_info.value.substring(1);
              console.log(`ヘッダー情報をスプレッドシートから取得します (文字列形式): ${spreadsheetId}, ${cleanRange}`);
              
              try {
                const spreadsheetHelper = require('./spreadsheet-helper');
                headerValue = await spreadsheetHelper.getCellValue(spreadsheetId, cleanRange);
                console.log(`ヘッダー情報の値を取得しました: ${headerValue}`);
              } catch (fetchErr) {
                console.log(`ヘッダー情報取得失敗、参照文字列をそのまま使用: ${config.header_info.value}`);  
                headerValue = config.header_info.value;
              }
            } else {
              // キーファイルが存在しない場合は参照文字列をそのまま表示
              console.log(`キーファイルが存在しないため、参照文字列をそのまま使用: ${config.header_info.value}`);
              headerValue = config.header_info.value;
            }
          } catch (err) {
            console.error(`ヘッダー情報のスプレッドシート取得エラー:`, err);
            headerValue = config.header_info.value;
          }
        } else {
          // 固定値の場合
          headerValue = config.header_info.value || '未設定';
        }
        
        headerInfoText = ` / ${headerLabel}:${headerValue}`;
      } catch (error) {
        console.error('ヘッダー情報処理エラー:', error);
        headerInfoText = '';
      }
    }
    
    // テンプレート変数を確実に置換するための関数
    function replacePlaceholder(text, placeholder, value) {
      const pattern = new RegExp('\\{\\{' + placeholder + '\\}\\}', 'g');
      return text.replace(pattern, value || '');
    }
    
    // 全テンプレート変数を置換
    let html = template;
    html = replacePlaceholder(html, 'TITLE', title);
    html = replacePlaceholder(html, 'TREE_HTML', treeHtml);
    html = replacePlaceholder(html, 'STYLE', styleContent);
    html = replacePlaceholder(html, 'THEME', theme);
    html = replacePlaceholder(html, 'PUBLIC_URL_SCRIPT', publicUrlScript);
    html = replacePlaceholder(html, 'FAVICON_LINK', faviconLink);
    html = replacePlaceholder(html, 'DATA_DATE', dataDate + headerInfoText);
    
    // デバッグ情報
    console.log('テンプレート変数置換完了');
    console.log(`スタイルシートサイズ: ${styleContent ? styleContent.length : 0} バイト`);
      
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
  
  // テキスト属性の設定
  let textAttributes = '';
  
  // デフォルトのテキストを設定
  if (node.text) {
    textAttributes += ` data-text-default="${node.text}"`;
  }
  
  // 日次テキストがあれば設定
  if (node.text_daily !== undefined) {
    textAttributes += ` data-text-daily="${node.text_daily}"`;
    mainText = node.text_daily; // 日次をデフォルト表示に設定
  }
  
  // 月次テキストがあれば属性として追加
  if (node.text_monthly !== undefined) {
    textAttributes += ` data-text-monthly="${node.text_monthly}"`;
  }
  
  // URLがある場合、主テキストのみにリンクを適用
  // テキストが省略される可能性があるため、title属性を追加してマウスホバー時に全文を表示
  let textContent = '';
  if (node.url) {
    textContent = `<a href="${node.url}" target="_blank" class="node-text" title="${mainText}"${textAttributes}>${mainText}</a>`;
  } else {
    textContent = `<span class="node-text" title="${mainText}"${textAttributes}>${mainText}</span>`;
  }

  // 主テキストを追加
  nodeContent += textContent;
  
  // text_enが存在する場合は小さなフォントで追加（リンクの外側に追加）
  // 英語表記にもtitle属性を追加
  if (node.text_en) {
    nodeContent += `<div class="text-en" title="${node.text_en}">${node.text_en}</div>`;
  }
  
  // 値表示用の変数初期化
  let displayValue = null;
  let valueAttributes = '';
  
  // サービスアカウントキーがない場合はエラー表示
  const shouldUseDemo = false; // デモ値を表示しない
  
  // 値の優先順位を設定
  if (node.value !== undefined) {
    valueAttributes += ` data-value-default="${node.value}"`;
    displayValue = node.value;
  }
  
  // 日次の値があれば設定（日次がデフォルト表示なのでこちらを初期表示値にする）
  if (node.value_daily !== undefined) {
    valueAttributes += ` data-value-daily="${node.value_daily}"`;
    displayValue = node.value_daily; // 日次をデフォルト表示に設定
    
    // 文字列参照（=で始まる）の場合はそのまま表示（エラー処理はspreadsheet-helperで行われる）
    if (typeof displayValue === 'string' && displayValue.startsWith('=')) {
      // spreadsheet-helperで処理される
    }
  }
  
  // 月次の値は属性として設定するが、初期表示には使わない
  if (node.value_monthly !== undefined) {
    valueAttributes += ` data-value-monthly="${node.value_monthly}"`;
    
    // 月次データもスプレッドシート参照の場合はそのまま
    if (typeof node.value_monthly === 'string' && node.value_monthly.startsWith('=')) {
      // そのまま表示（エラー処理はspreadsheet-helperで行われる）
    }
  }
  
  // 前日比の値を属性として設定
  let diffDailyValue = node.diff_daily;
  if (node.diff_daily !== undefined) {
    // スプレッドシート参照の場合は解決して表示
    if (typeof node.diff_daily === 'string' && node.diff_daily.startsWith('=')) {
      // スプレッドシートAPIの結果が返ってきた場合
      if (typeof diffDailyValue === 'object' && diffDailyValue !== null) {
        try {
          if (diffDailyValue.data && diffDailyValue.data.values && 
              Array.isArray(diffDailyValue.data.values) && 
              diffDailyValue.data.values.length > 0 && 
              diffDailyValue.data.values[0].length > 0) {
            // 値を取得
            diffDailyValue = diffDailyValue.data.values[0][0];
          }
        } catch (e) {
          console.error('差分値処理エラー:', e);
        }
      }
    }
    
    // 前日比の値を設定
    valueAttributes += ` data-diff-daily="${diffDailyValue}"`;
  }
  
  // 前月比の値を属性として設定
  let diffMonthlyValue = node.diff_monthly;
  if (node.diff_monthly !== undefined) {
    // スプレッドシート参照の場合は解決して表示
    if (typeof node.diff_monthly === 'string' && node.diff_monthly.startsWith('=')) {
      // スプレッドシートAPIの結果が返ってきた場合
      if (typeof diffMonthlyValue === 'object' && diffMonthlyValue !== null) {
        try {
          if (diffMonthlyValue.data && diffMonthlyValue.data.values && 
              Array.isArray(diffMonthlyValue.data.values) && 
              diffMonthlyValue.data.values.length > 0 && 
              diffMonthlyValue.data.values[0].length > 0) {
            // 値を取得
            diffMonthlyValue = diffMonthlyValue.data.values[0][0];
          }
        } catch (e) {
          console.error('差分値処理エラー:', e);
        }
      }
    }
    
    // 前月比の値を設定
    valueAttributes += ` data-diff-monthly="${diffMonthlyValue}"`;
  }
  
  // 表示値がない場合はスキップ
  if (displayValue !== null) {
    // HTML生成前に値の詳細をログ出力
    console.log(`★★★ HTMLノード生成中 - ノード: ${node.text || '無名'} ★★★`);
    console.log(`→ 元の値:`, displayValue);
    console.log(`→ 型:`, typeof displayValue);
    
    // スプレッドシート参照文字列をデモ値に変換
    if (typeof displayValue === 'string' && displayValue.startsWith('=') && shouldUseDemo) {
      // すでに上で処理済み
    }
    // オブジェクトや複雑な値の場合は適切に文字列化
    else if (typeof displayValue === 'object' && displayValue !== null) {
      console.log(`→ オブジェクト内容:`, JSON.stringify(displayValue, null, 2));
      try {
        // スプレッドシートAPIレスポンスを検出
        if (displayValue.context || displayValue.spreadsheetId || 
            displayValue._rawSheets || displayValue.authMode || 
            displayValue.jwtClient || displayValue._options || 
            (displayValue.data && displayValue.data.values)) {
          
          console.log(`→ スプレッドシートAPI形式を検出`);
          
          // APIレスポンスから実際のデータを抽出する
          if (displayValue.data && displayValue.data.values && 
              Array.isArray(displayValue.data.values) && 
              displayValue.data.values.length > 0 && 
              displayValue.data.values[0].length > 0) {
            console.log(`→ values配列からデータ抽出`);
            
            // データ最初の要素を取得
            const rawValue = displayValue.data.values[0][0];
            console.log(`→ 抽出した値:`, rawValue, `型:`, typeof rawValue);
            
            // 取得した値がオブジェクトなら再帰的に処理
            if (typeof rawValue === 'object' && rawValue !== null) {
              console.log(`→ 抽出値がオブジェクト、深層解析開始`);
              console.log(`→ キー一覧:`, Object.keys(rawValue));
              
              // 各プロパティを確認
              for (const key in rawValue) {
                console.log(`→ プロパティ ${key}:`, rawValue[key]);
              }
              
              // プリミティブ値を探す
              if (rawValue.formattedValue) {
                displayValue = rawValue.formattedValue;
                console.log(`→ formattedValueを使用:`, displayValue);
              } else if (rawValue.value !== undefined) {
                displayValue = rawValue.value;
                console.log(`→ valueを使用:`, displayValue);
              } else {
                // 最後の手段としてJSON変換
                displayValue = JSON.stringify(rawValue);
                console.log(`→ JSON変換結果:`, displayValue);
              }
            } else {
              // 数値や文字列などのプリミティブ値
              displayValue = rawValue;
              console.log(`→ プリミティブ値をそのまま使用:`, displayValue);
            }
          } else if (displayValue.formattedValue) {
            // 別のAPIレスポンス形式
            displayValue = displayValue.formattedValue;
            console.log(`→ トップレベルformattedValueを使用:`, displayValue);
          } else if (displayValue.userEnteredValue) {
            // 入力値から取得
            const userValue = displayValue.userEnteredValue;
            console.log(`→ userEnteredValueを発見:`, userValue);
            
            // 各種値タイプをチェック
            if (userValue.stringValue) {
              displayValue = userValue.stringValue;
              console.log(`→ stringValueを使用:`, displayValue);
            } else if (userValue.numberValue !== undefined) {
              displayValue = userValue.numberValue;
              console.log(`→ numberValueを使用:`, displayValue);
            } else if (userValue.boolValue !== undefined) {
              displayValue = userValue.boolValue ? 'TRUE' : 'FALSE';
              console.log(`→ boolValueを使用:`, displayValue);
            } else if (userValue.formulaValue) {
              displayValue = userValue.formulaValue;
              console.log(`→ formulaValueを使用:`, displayValue);
            } else {
              displayValue = JSON.stringify(userValue);
              console.log(`→ userValueをJSON変換:`, displayValue);
            }
          } else {
            // データが見つからない場合はエラーメッセージ
            console.log(`→ 探している値が見つからないためデフォルトに設定`);
            displayValue = "0";
          }
        } else {
          // その他のオブジェクトの場合
          console.log(`→ 一般オブジェクトの処理`);
          
          // 重要なフィールドをチェック
          if (displayValue.value !== undefined) {
            displayValue = displayValue.value;
            console.log(`→ valueプロパティを使用:`, displayValue);
          } else if (displayValue.text !== undefined) {
            displayValue = displayValue.text;
            console.log(`→ textプロパティを使用:`, displayValue);
          } else if (displayValue["0"] !== undefined) {
            displayValue = displayValue["0"];
            console.log(`→ "0"プロパティを使用:`, displayValue);
          } else if (displayValue.spreadsheet) {
            // スプレッドシート参照オブジェクトがそのまま残っている場合
            console.log(`→ スプレッドシート参照オブジェクトがそのまま残っています:`, displayValue.spreadsheet);
            // 共通設定からスプレッドシートIDを取得するヘルパー関数
            const getGlobalSpreadsheetId = () => {
              try {
                // YAML設定から取得する試み
                if (global.kpiTreeConfig && global.kpiTreeConfig.spreadsheet && global.kpiTreeConfig.spreadsheet.id) {
                  return global.kpiTreeConfig.spreadsheet.id;
                }
                // 環境変数から取得する試み
                if (process.env.KPI_TREE_SPREADSHEET_ID) {
                  return process.env.KPI_TREE_SPREADSHEET_ID;
                }
                return null;
              } catch (error) {
                console.error('グローバルスプレッドシートID取得エラー:', error.message);
                return null;
              }
            };
            
            // 実際のデータを使用
            {
              try {
                // グローバルIDを取得
                const globalId = getGlobalSpreadsheetId();
                if (globalId && displayValue.spreadsheet.range) {
                  console.log(`スプレッドシートから値を取得します (ID: ${globalId}, 範囲: ${displayValue.spreadsheet.range})`);
                  
                  // 非同期処理をプロミスとして実行
                  try {
                    // 必要なモジュールをインポート
                    const { getCellValue } = require('./spreadsheet-helper');
                    
                    // 非同期処理を簡略化して同期的に扱う
                    displayValue = '取得中...'; // 一時的な表示値
                    
                    // 非同期の値取得を後で行う
                    setTimeout(async () => {
                      try {
                        // 実際にセルの値取得を試みる
                        const result = await getCellValue(globalId, displayValue.spreadsheet.range);
                        console.log(`→ APIから値を取得しました:`, result);
                        
                        // 結果の型に応じた処理
                        if (result === null || result === undefined) {
                          displayValue = '0';
                        } else if (typeof result === 'number') {
                          displayValue = result;
                        } else if (typeof result === 'string') {
                          displayValue = !isNaN(Number(result)) ? Number(result) : result;
                        } else if (typeof result === 'object') {
                          if (result.value !== undefined) {
                            displayValue = result.value;
                          } else if (result.formattedValue !== undefined) {
                            displayValue = result.formattedValue;
                          } else {
                            try {
                              displayValue = JSON.stringify(result);
                            } catch (e) {
                              displayValue = String(result);
                            }
                          }
                        } else {
                          displayValue = String(result);
                        }
                      } catch (apiError) {
                        console.error(`→ API値取得エラー:`, apiError.message);
                        displayValue = '0'; // エラー時はデフォルト値を0に設定
                      }
                    }, 100);
                  } catch (error) {
                    console.error('スプレッドシート参照処理エラー:', error);
                    displayValue = '0';
                  }
                } else {
                  displayValue = "API参照値";
                }
              } catch (err) {
                console.error('スプレッドシート参照値の処理エラー:', err);
                displayValue = "API参照値";
              }
            }
          } else {
            // 最後の手段としてJSON変換
            const origValue = displayValue;
            try {
              displayValue = JSON.stringify(displayValue);
              console.log(`→ JSON変換結果:`, displayValue);
            } catch (jsonStringifyErr) {
              console.error(`JSON変換エラー:`, jsonStringifyErr);
              displayValue = '変換不能値';
            }
          }
        }
      } catch (e) {
        console.error('オブジェクト処理エラー:', e);
        displayValue = "値取得エラー";
      }
      
      // 最終的にオブジェクトが残っている場合は強制的に文字列化
      if (typeof displayValue === 'object' && displayValue !== null) {
        console.log(`→ 最終チェック: オブジェクトが残っています:`, displayValue);
        console.log(`→ 構造:`, JSON.stringify(displayValue, Object.getOwnPropertyNames(displayValue), 2));
        
        try {
          if (displayValue.spreadsheet) {
            // スプレッドシート参照がそのまま残っている場合は特別処理
            displayValue = "参照値";
          } else {
            displayValue = JSON.stringify(displayValue);
          }
          console.log(`→ 最終変換結果:`, displayValue);
        } catch (jsonErr) {
          console.error('最終JSON変換エラー:', jsonErr);
          displayValue = 'オブジェクト';  // 最悪の場合は決め打ち
        }
      }
      
      // 結果の確認
      console.log(`→ 最終値:`, displayValue, `型:`, typeof displayValue);
    }
    
    // value要素自体にデータ属性を直接設定
    nodeContent += `<div class="value" title="${displayValue}"${valueAttributes}>${displayValue}</div>`;
    
    // 前日比・前月比の表示を追加
    // 日次モードの場合は前日比を表示し、月次モードの場合は前月比を表示
    if (node.diff_daily !== undefined || node.diff_monthly !== undefined) {
      // 日次データをデフォルトとして表示
      let diffDailyDisplay = diffDailyValue;
      let diffMonthlyDisplay = diffMonthlyValue;
      let diffAttributes = '';
      
      // スプレッドシート参照の消去 - 前日比
      if (diffDailyDisplay && typeof diffDailyDisplay === 'string' && diffDailyDisplay.startsWith('=')) {
        // 参照が自動解決されていない場合はデモ値を設定
        if (shouldUseDemo) {
          // デモモードの場合はデモ値を設定
          const demoValues = ['+5%', '+10%', '-3%', '+0%', '+7%', '-2%'];
          diffDailyDisplay = demoValues[Math.floor(Math.random() * demoValues.length)];
        }
      }
      
      // スプレッドシート参照の消去 - 前月比
      if (diffMonthlyDisplay && typeof diffMonthlyDisplay === 'string' && diffMonthlyDisplay.startsWith('=')) {
        // 参照が自動解決されていない場合はデモ値を設定
        if (shouldUseDemo) {
          // デモモードの場合はデモ値を設定
          const demoValues = ['95%', '110%', '103%', '90%', '120%', '98%'];
          diffMonthlyDisplay = demoValues[Math.floor(Math.random() * demoValues.length)];
        }
      }
      
      // オブジェクトの場合の特別処理
      if (typeof diffDailyDisplay === 'object' && diffDailyDisplay !== null) {
        try {
          if (diffDailyDisplay.data && diffDailyDisplay.data.values && 
              Array.isArray(diffDailyDisplay.data.values) && 
              diffDailyDisplay.data.values.length > 0) {
            diffDailyDisplay = diffDailyDisplay.data.values[0][0];
          } else {
            diffDailyDisplay = JSON.stringify(diffDailyDisplay);
          }
        } catch (e) {
          console.error('前日比処理エラー:', e);
          diffDailyDisplay = '0%';
        }
      }
      
      if (typeof diffMonthlyDisplay === 'object' && diffMonthlyDisplay !== null) {
        try {
          if (diffMonthlyDisplay.data && diffMonthlyDisplay.data.values && 
              Array.isArray(diffMonthlyDisplay.data.values) && 
              diffMonthlyDisplay.data.values.length > 0) {
            diffMonthlyDisplay = diffMonthlyDisplay.data.values[0][0];
          } else {
            diffMonthlyDisplay = JSON.stringify(diffMonthlyDisplay);
          }
        } catch (e) {
          console.error('前月比処理エラー:', e);
          diffMonthlyDisplay = '100%';
        }
      }
      
      // 属性を設定
      if (node.diff_daily !== undefined) {
        diffAttributes += ` data-diff-daily="${diffDailyDisplay}"`;
      }
      
      if (node.diff_monthly !== undefined) {
        diffAttributes += ` data-diff-monthly="${diffMonthlyDisplay}"`;
      }
      
      // 差分表示を追加
      if (diffDailyDisplay !== undefined) {
        // 日次データの場合は前日比を表示
        nodeContent += `<div class="diff-value" title="前日比: ${diffDailyDisplay}"${diffAttributes}>
          <span class="diff-label">前日比: </span>
          <span class="diff-number">${diffDailyDisplay}</span>
        </div>`;
      }
    }
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