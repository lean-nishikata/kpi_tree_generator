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
          
          // 環境変数からIDを設定する場合
          if (process.env.KPI_TREE_SPREADSHEET_ID) {
            console.log(`環境変数からスプレッドシートIDを設定します: ${process.env.KPI_TREE_SPREADSHEET_ID}`);
            if (!global.kpiTreeConfig.spreadsheet) {
              global.kpiTreeConfig.spreadsheet = {};
            }
            global.kpiTreeConfig.spreadsheet.id = process.env.KPI_TREE_SPREADSHEET_ID;
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
    
    let html = template
      .replace(/\{\{TITLE\}\}/g, title)
      .replace(/\{\{TREE_HTML\}\}/g, treeHtml)
      .replace(/\{\{STYLE\}\}/g, styleContent)
      .replace(/\{\{THEME\}\}/g, theme)
      .replace(/\{\{PUBLIC_URL_SCRIPT\}\}/g, publicUrlScript)
      .replace(/\{\{FAVICON_LINK\}\}/g, faviconLink);
      
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