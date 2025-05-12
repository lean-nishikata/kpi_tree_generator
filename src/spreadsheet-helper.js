/**
 * KPIツリージェネレーター: Googleスプレッドシートヘルパー
 * 
 * Googleスプレッドシートからデータを取得するヘルパー関数群
 */
const fs = require('fs');
const path = require('path');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
require('dotenv').config();

/**
 * 遅延関数 - 指定したミリ秒だけ待機する
 * @param {number} ms - 待機ミリ秒
 * @returns {Promise<void>} 待機後に解決するPromise
 */
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * API呼び出しの状態を追跡するためのシンプルなカウンター
 */
const apiStats = {
  totalRequests: 0,
  successRequests: 0,
  failedRequests: 0,
  lastRequestTime: 0,
  // 同時実行数を制限するためのセマフォ
  activeCalls: 0,
  // ノードの深さを追跡
  currentDepth: 0,
  // 処理キュー
  pendingRequests: [],
  // 深いノードのエラー数
  deepNodeErrors: 0
};

/**
 * 環境変数からサービスアカウントのキーパスを取得
 * @returns {string} キーファイルのパス
 */
function getServiceAccountKeyPath() {
  // 環境変数からキーパスを取得
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  
  if (!keyPath) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY_PATH 環境変数が設定されていません。');
  }
  
  // パスが存在するか確認
  if (!fs.existsSync(keyPath)) {
    console.warn(`警告: サービスアカウントキーファイルが見つかりません: ${keyPath}`);
    console.warn('スプレッドシート参照はスキップされます');
    return null; // nullを返すことで、呼び出し元でエラー処理をスキップできる
  }
  
  return keyPath;
}

/**
 * サービスアカウントキーの読み込み
 * @returns {Object} サービスアカウントキーのJSONオブジェクト
 */
function loadServiceAccountKey() {
  const keyPath = getServiceAccountKeyPath();
  
  // キーパスがnullの場合（ファイルが見つからない場合）
  if (!keyPath) {
    return null;
  }
  
  try {
    // ファイルサイズを確認（空ファイルやダミーファイルでないことを確認）
    const stats = fs.statSync(keyPath);
    if (stats.size < 100) {
      return null;
    }
    
    // ファイル内容を読み込み
    const keyFileContent = fs.readFileSync(keyPath, 'utf8');
    
    // ファイルの中身が空かチェック
    if (!keyFileContent || keyFileContent.trim() === '') {
      return null;
    }
    
    // JSONとして解析
    try {
      const parsed = JSON.parse(keyFileContent);
      
      // 最低限必要な項目があるか確認
      if (!parsed.client_email || !parsed.private_key) {
        return null;
      }
      
      return parsed;
    } catch (jsonError) {
      return null;
    }
  } catch (error) {
    return null;
  }
}

/**
 * GoogleスプレッドシートのセルからA1表記の値を取得（リトライ機能付き）
 * @param {string} spreadsheetId - スプレッドシートID
 * @param {string} range - A1表記の範囲（例: 'Sheet1!A1'）
 * @param {number} retries - 最大再試行回数
 * @param {number} initialDelay - 初回再試行までの待機時間(ms)
 * @returns {Promise<any>} セルの値
 */
async function getCellValueWithRetry(spreadsheetId, range, retries = 4, initialDelay = 500) {
  // リトライ回数を3から4に増加、初期遅延を200msから500msに増加
  let currentDelay = initialDelay;
  
  // ノードの深さに応じて初期遅延を調整
  currentDelay = Math.floor(initialDelay * (1 + (apiStats.currentDepth * 0.3)));
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`${range}の取得リトライ (#${attempt}), ${currentDelay}ms待機後 (深さ: ${apiStats.currentDepth})`);
        await delay(currentDelay);
        currentDelay *= 2; // 指数バックオフ
        
        // 深いノードで失敗が続く場合は追加のクールダウン
        if (attempt > 1 && apiStats.currentDepth > 2) {
          const cooldown = 300 * apiStats.currentDepth;
          console.log(`深いノードでの連続失敗のため追加クールダウン: ${cooldown}ms`);
          await delay(cooldown);
        }
      }
      
      return await getCellValue(spreadsheetId, range);
    } catch (error) {
      apiStats.failedRequests++;
      // 深いノードのエラーを記録
      if (apiStats.currentDepth > 2) {
        apiStats.deepNodeErrors++;
      }
      
      if (attempt === retries) {
        console.error(`${range}の最終リトライも失敗: ${error.message}`);
        throw error;
      }
      console.warn(`${range}の取得に失敗、リトライします: ${error.message}`);
    }
  }
}

/**
 * GoogleスプレッドシートのセルからA1表記の値を取得
 * @param {string} spreadsheetId - スプレッドシートID
 * @param {string} range - A1表記の範囲（例: 'Sheet1!A1'）
 * @returns {Promise<any>} セルの値
 */
async function getCellValue(spreadsheetId, range) {
  try {
    // 前回のリクエストから最低空ける時間（ノードの深さに応じて増加）
    const now = Date.now();
    const timeSinceLastRequest = now - apiStats.lastRequestTime;
    const baseDelay = 200; // 基本待機時間を100msから200msに増加
    const depthFactor = Math.max(1, apiStats.currentDepth / 3); // 深さによる倍率
    const requiredWait = Math.floor(baseDelay * depthFactor);

    if (timeSinceLastRequest < requiredWait) {
      const waitTime = requiredWait - timeSinceLastRequest;
      console.log(`APIレート制限回避のため${waitTime}ms待機 (深さ倍率: ${depthFactor.toFixed(1)})`);
      await delay(waitTime);
    }

    // 同時実行数を制限（最大2つまで）- 3から2に削減
    while (apiStats.activeCalls >= 2) {
      const waitTime = 100 + (50 * apiStats.currentDepth); // 深さに応じた待機時間
      console.log(`同時API呼び出し数が多いため${waitTime}ms待機 (現在: ${apiStats.activeCalls})`);
      await delay(waitTime);
    }

    // 深いノードでエラーが多い場合は追加の待機
    if (apiStats.deepNodeErrors > 3 && apiStats.currentDepth > 2) {
      const cooldownTime = 500 * apiStats.currentDepth;
      console.log(`深いノードでエラーが多発しているため${cooldownTime}ms追加待機`);
      await delay(cooldownTime);
      apiStats.deepNodeErrors = Math.max(0, apiStats.deepNodeErrors - 1); // エラーカウントを減らす
    }

    apiStats.activeCalls++;
    apiStats.lastRequestTime = Date.now();
    apiStats.totalRequests++;
    
    // シート名とセル参照を分離
    const [sheetName, cellRef] = range.split('!');
    
    console.log(`スプレッドシート値を取得: ID=${spreadsheetId}, シート=${sheetName}, セル=${cellRef}`);
    
    // サービスアカウントキーの読み込み
    const serviceAccountKey = loadServiceAccountKey();
    
    // 認証情報が読み込めなかった場合
    if (!serviceAccountKey) {
      console.error('認証情報の読み込みに失敗しました');
      return "ERROR: Auth Failed";
    }
    
    // キー内容の確認（先頭と末尾の不要な空白を削除）
    const cleanedPrivateKey = serviceAccountKey.private_key.trim();
    
    // JWTクライアントの作成（直接キーファイルパスを指定）
    const authClient = new JWT({
      email: serviceAccountKey.client_email,
      key: cleanedPrivateKey, // 余分な空白を削除したキー
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });
    
    try {
      // スプレッドシートへのアクセス
      const doc = new GoogleSpreadsheet(spreadsheetId);
      
      // プライベートキーの検証
      if (!serviceAccountKey.private_key.includes('BEGIN PRIVATE KEY') || 
          !serviceAccountKey.private_key.includes('END PRIVATE KEY')) {
        throw new Error('Invalid private key format');
      }
      
      // 直接サービスアカウント認証を使用
      await doc.useServiceAccountAuth({
        client_email: serviceAccountKey.client_email,
        private_key: serviceAccountKey.private_key
      });
      
      await doc.loadInfo();
      
      // 直接アクセスのためGoogleSheetsAPIを使用
      const { google } = require('googleapis');
      const auth = new google.auth.JWT(
        serviceAccountKey.client_email,
        null,
        serviceAccountKey.private_key,
        ['https://www.googleapis.com/auth/spreadsheets.readonly']
      );
      
      // Sheets API クライアントの初期化
      const sheets = google.sheets({ version: 'v4', auth });
      
      // 値を取得（実際のセルの値を返すように修正）
      const fullRange = `${sheetName}!${cellRef}`;
      console.log(`APIにリクエスト: スプレッドシートID=${spreadsheetId}, 範囲=${fullRange}`);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: fullRange,
      });
      
      // レスポンスの値を取得
      const values = response.data.values;
      console.log(`APIレスポンス受信: `, response.data);
      
      if (!values || values.length === 0 || values[0].length === 0) {
        console.log(`セル ${cellRef} の値が空です（API経由）`);
        apiStats.successRequests++;
        return 0;
      }
      
      // API経由での値取得
      const cellValue = values[0][0];
      console.log(`セル値取得成功: ${cellRef} = `, cellValue, ` (データ型: ${typeof cellValue})`);
      apiStats.successRequests++;
      return cellValue;
      
    } catch (authError) {
      console.warn(`1次APIアクセスに失敗、フォールバック試行: ${authError.message}`);
      await delay(300); // フォールバック前に少し待機
      
      try {
        // 別の方法で直接アクセス
        const { google } = require('googleapis');
        const auth = new google.auth.JWT(
          serviceAccountKey.client_email,
          null,
          serviceAccountKey.private_key,
          ['https://www.googleapis.com/auth/spreadsheets.readonly']
        );
        
        // Sheets API クライアントの初期化
        const sheets = google.sheets({ version: 'v4', auth });
        
        // 値を取得（実際のセルの値を返すように修正）
        const fullRange = `${sheetName}!${cellRef}`;
        console.log(`フォールバックAPI呼び出し: スプレッドシートID=${spreadsheetId}, 範囲=${fullRange}`);
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: spreadsheetId,
          range: fullRange,
        });
        
        // レスポンスの値を取得
        const values = response.data.values;
        console.log(`フォールバックAPIレスポンス受信: `, response.data);
        
        if (!values || values.length === 0 || values[0].length === 0) {
          console.log(`セル ${cellRef} の値が空です（API経由）`);
          apiStats.successRequests++;
          return 0;
        }
        
        // API経由での値取得
        const cellValue = values[0][0];
        console.log(`フォールバックセル値取得成功: ${cellRef} = `, cellValue, ` (データ型: ${typeof cellValue})`);
        apiStats.successRequests++;
        return cellValue;
      } catch (error2) {
        console.error(`フォールバックAPIもエラー: ${error2.message}`);
        throw new Error('Failed to access spreadsheet');
      }
    }
  } catch (error) {
    console.error(`スプレッドシートアクセスエラー: ${error.message}`);
    console.error(error.stack);
    throw error;
  } finally {
    apiStats.activeCalls--;
  }
}

/**
 * A1表記(例: A1, B2)をrow, column indexに変換
 * @param {string} a1Notation - A1表記（例: 'A1', 'B2'）
 * @returns {Object} {rowIndex, colIndex}
 */
function convertA1ToRowCol(a1Notation) {
  const match = a1Notation.match(/([A-Z]+)([0-9]+)/);
  if (!match) {
    throw new Error(`無効なA1表記です: ${a1Notation}`);
  }
  
  const colA1 = match[1];
  const rowA1 = match[2];
  
  // 1-indexedの行番号を0-indexedに変換
  const rowIndex = parseInt(rowA1, 10) - 1;
  
  // A-Z列名を0-indexedの列番号に変換
  let colIndex = 0;
  for (let i = 0; i < colA1.length; i++) {
    colIndex = colIndex * 26 + colA1.charCodeAt(i) - 'A'.charCodeAt(0) + 1;
  }
  colIndex -= 1; // 0-indexedに調整
  
  return { rowIndex, colIndex };
}

/**
 * YAMLデータ内のスプレッドシート参照を解決する
 * @param {Object} node - KPIツリーノード
 * @returns {Promise<Object>} 解決されたノード
 */
async function resolveSpreadsheetReferences(node) {
  if (!node) return node;
  
  console.log('----------- スプレッドシート参照解決開始 -----------');
  console.log('NODE:', JSON.stringify({
    title: node.title || '名称なし', 
    text: node.text,
    value: node.value,
    value_daily: node.value_daily,
    value_monthly: node.value_monthly
  }, null, 2));
  
  // process.stdoutに直接書き込み（Docker環境でのログ出力を確実に）
  process.stdout.write('\nノードのスプレッドシート参照確認中...\n');
  
  // valueフィールドのスプレッドシート参照を解決
  if (node.value && typeof node.value === 'object' && node.value.spreadsheet) {
    process.stdout.write('スプレッドシート参照(value)が見つかりました\n');
    process.stdout.write(`スプレッドシート参照詳細: ${JSON.stringify(node.value.spreadsheet, null, 2)}\n`);
    const { id, range } = node.value.spreadsheet;
    console.log(`-----------------------------------`);
    console.log(`スプレッドシートから値を取得開始: (ID: ${id}, 範囲: ${range})`);
    try {
      console.log(`スプレッドシートから値を取得開始: ID=${id}, 範囲=${range}`);
      
      // リトライ機能付きの関数を使用
      const cellValue = await getCellValueWithRetry(id, range);
      
      console.log(`スプレッドシートから値を取得成功: (${range})`);
      console.log(`→ 値:`, cellValue);
      console.log(`→ 型:`, typeof cellValue);
      console.log(`→ オブジェクトか: ${typeof cellValue === 'object' && cellValue !== null}`);
      console.log(`→ 配列か: ${Array.isArray(cellValue)}`);
      console.log(`→ トータルルートは: `, JSON.stringify(cellValue));
      
      if (typeof cellValue === 'object' && cellValue !== null) {
        console.log(`→ オブジェクト詳細:`, JSON.stringify(cellValue, null, 2));
        console.log(`→ オブジェクトキー一覧:`, Object.keys(cellValue));
        
        // オブジェクトの各プロパティを比較的安全に一層深く調査
        for (const key of Object.keys(cellValue)) {
          const value = cellValue[key];
          console.log(`→ プロパティ ${key}: 型=${typeof value}, 値=${
            typeof value === 'object' ? JSON.stringify(value) : value
          }`);
        }
      }
      
      // 値のタイプに応じた処理
      if (cellValue === null || cellValue === undefined) {
        console.log(`スプレッドシートセル ${range} の値が空のため0を使用`);
        node.value = 0;
      } else if (typeof cellValue === 'number') {
        // 数値はそのまま使用
        node.value = cellValue;
      } else if (typeof cellValue === 'string') {
        // 文字列が数値に変換可能か試みる
        node.value = isNaN(Number(cellValue)) ? cellValue : Number(cellValue);
      } else if (typeof cellValue === 'object') {
        // オブジェクトの場合は文字列化（日付などの特殊オブジェクト対応）
        console.log('オブジェクト型の値を処理:', cellValue);
        try {
          if (cellValue instanceof Date) {
            console.log('日付型を検出:', cellValue);
            node.value = cellValue.toISOString();
          } else {
            // オブジェクトからcircular referenceなどの問題となるプロパティを除去
            const safeObj = {};
            try {
              for (const key in cellValue) {
                // 関数やプライベートプロパティを除外
                if (typeof cellValue[key] !== 'function' && 
                    key !== '_spreadsheet' && 
                    !key.startsWith('_')) {
                  safeObj[key] = cellValue[key];
                }
              }
            } catch (loopError) {
              console.error('オブジェクトのプロパティループ中にエラー:', loopError.message);
            }
            
            try {
              // 最も直接的な方法でAPI再取得を試みる
              const { id, range } = node.value.spreadsheet;
              
              // リトライ機能付きの関数を使用
              const directValue = await getCellValueWithRetry(id, range, 2, 300);
              
              if (directValue === null || directValue === undefined) {
                node.value = 0;
              } else if (typeof directValue === 'object') {
                if (directValue instanceof Date) {
                  node.value = directValue.toISOString();
                } else {
                  node.value = directValue.value !== undefined ? directValue.value : String(directValue);
                }
              } else {
                node.value = typeof directValue === 'string' && !isNaN(Number(directValue)) 
                  ? Number(directValue) 
                  : directValue;
              }
              return;
            } catch (retryError) {
              console.error('API再取得エラー:', retryError.message);
            }
            
            // オブジェクトから意味のある値を抽出する
            if (cellValue === null) {
              node.value = 0;
              return;
            }
            
            // valueプロパティを持つ場合はそれを使用
            if (cellValue.value !== undefined) {
              node.value = cellValue.value;
              return;
            }
            
            // formattedValueプロパティを持つ場合はそれを使用
            if (cellValue.formattedValue !== undefined) {
              node.value = cellValue.formattedValue;
              return;
            }
            
            // 単純なキー値オブジェクトから値を抽出
            if (cellValue["0"] !== undefined) {
              node.value = cellValue["0"];
              return;
            }
            
            // どれも該当しない場合は文字列化して表示
            try {
              const jsonString = JSON.stringify(safeObj);
              // 数値文字列の場合は数値に変換
              if (!isNaN(Number(jsonString))) {
                node.value = Number(jsonString);
              } else {
                // その他はそのまま文字列として使用
                node.value = jsonString;
              }
            } catch (jsonError) {
              // JSON変換エラー時は単純な文字列化
              node.value = String(cellValue);
            }
          }
        } catch (e) {
          console.warn(`オブジェクトの文字列化に失敗: ${e.message}`);
          node.value = String(cellValue);
        }
      } else {
        // その他の型は文字列化
        node.value = String(cellValue);
      }
      
    } catch (error) {
      console.error(`スプレッドシート参照の解決に失敗: ${error.message}`);
      node.value = 'ERROR';
    }
  }
  
  // 文字列表記のスプレッドシート参照も解決 (例: =spreadsheet:id:Sheet1!A1)
  if (node.value && typeof node.value === 'string' && node.value.startsWith('=spreadsheet:')) {
    const parts = node.value.substring(12).split(':');
    if (parts.length >= 2) {
      const id = parts[0];
      const range = parts[1];
      try {
        // リトライ機能付きの関数を使用
        const cellValue = await getCellValueWithRetry(id, range);
        
        console.log(`文字列形式の参照から値を取得 (${range}):`, cellValue, typeof cellValue);
        
        // 値のタイプに応じた処理
        if (cellValue === null || cellValue === undefined) {
          console.log(`スプレッドシートセル ${range} の値が空のため0を使用`);
          node.value = 0;
        } else if (typeof cellValue === 'number') {
          // 数値はそのまま使用
          node.value = cellValue;
        } else if (typeof cellValue === 'string') {
          // 文字列が数値に変換可能か試みる
          node.value = isNaN(Number(cellValue)) ? cellValue : Number(cellValue);
        } else if (typeof cellValue === 'object') {
          // オブジェクトの場合の処理改善
          if (cellValue === null) {
            // null値は0として扱う
            node.value = 0;
          } else if (cellValue instanceof Date) {
            // 日付オブジェクト
            node.value = cellValue.toISOString();
          } else if (cellValue.value !== undefined) {
            // 値プロパティがある場合
            node.value = cellValue.value;
          } else if (cellValue.formattedValue !== undefined) {
            // 整形済み値がある場合
            node.value = cellValue.formattedValue;
          } else if (cellValue["0"] !== undefined) {
            // キー "0" の値がある場合
            node.value = cellValue["0"];
          } else {
            // その他のオブジェクトは文字列化
            try {
              const jsonString = JSON.stringify(cellValue);
              console.log(`オブジェクト値を文字列化: ${jsonString}`);
              // 数値文字列の場合は数値に変換
              node.value = !isNaN(Number(jsonString)) ? Number(jsonString) : jsonString;
            } catch (e) {
              console.warn(`オブジェクトの文字列化に失敗: ${e.message}`);
              node.value = String(cellValue);
            }
          }
        } else {
          // その他の型は文字列化
          node.value = String(cellValue);
        }
      } catch (error) {
        console.error(`スプレッドシート参照の解決に失敗: ${error.message}`);
        node.value = 'ERROR';
      }
    }
  }
  
  // 日次データ取得前に小休止
  if (node.value_daily && typeof node.value_daily === 'object' && node.value_daily.spreadsheet) {
    // 日次データ取得前に少し待機（特に深いノードの場合）
    if (apiStats.currentDepth > 1) {
      const dailyPauseTime = 100 * apiStats.currentDepth;
      console.log(`日次データ取得前の小休止: ${dailyPauseTime}ms (深さ: ${apiStats.currentDepth})`);
      await delay(dailyPauseTime);
    }
    process.stdout.write('スプレッドシート参照(value_daily)が見つかりました\n');
    process.stdout.write(`スプレッドシート参照詳細: ${JSON.stringify(node.value_daily.spreadsheet, null, 2)}\n`);
    const { id, range } = node.value_daily.spreadsheet;
    console.log(`-----------------------------------`);
    console.log(`value_daily: スプレッドシートから値を取得開始: (ID: ${id}, 範囲: ${range})`);
    try {
      console.log(`value_daily: スプレッドシートから値を取得開始: ID=${id}, 範囲=${range}`);
      
      // リトライ機能付きの関数を使用
      const cellValue = await getCellValueWithRetry(id, range);
      
      console.log(`value_daily: スプレッドシートから値を取得成功: (${range})`);
      console.log(`→ 値:`, cellValue);
      console.log(`→ 型:`, typeof cellValue);
      
      if (typeof cellValue === 'object' && cellValue !== null) {
        console.log(`→ オブジェクト詳細:`, JSON.stringify(cellValue, null, 2));
      }
      
      // 値のタイプに応じた処理
      if (cellValue === null || cellValue === undefined) {
        console.log(`スプレッドシートセル ${range} の値が空のため0を使用`);
        node.value_daily = 0;
      } else if (typeof cellValue === 'number') {
        // 数値はそのまま使用
        node.value_daily = cellValue;
      } else if (typeof cellValue === 'string') {
        // 文字列が数値に変換可能か試みる
        node.value_daily = isNaN(Number(cellValue)) ? cellValue : Number(cellValue);
      } else if (typeof cellValue === 'object') {
        // オブジェクトの場合は文字列化して試みる
        try {
          if (cellValue.data && cellValue.data.values && 
              Array.isArray(cellValue.data.values) && 
              cellValue.data.values.length > 0 && 
              cellValue.data.values[0].length > 0) {
            const rawValue = cellValue.data.values[0][0];
            node.value_daily = rawValue;
          } else {
            node.value_daily = JSON.stringify(cellValue);
          }
        } catch (objErr) {
          console.error('value_daily: オブジェクトの変換エラー', objErr);
          node.value_daily = 'ERROR';
        }
      } else {
        // その他の型は文字列化
        node.value_daily = String(cellValue);
      }
    } catch (error) {
      console.error(`value_daily: スプレッドシート参照の解決に失敗: ${error.message}`);
      node.value_daily = 'ERROR';
    }
  }
  
  // 月次データ取得前に長めの待機
  if (node.value_monthly && typeof node.value_monthly === 'object' && node.value_monthly.spreadsheet) {
    // 月次データは特にエラーが出やすいため、長めの待機を入れる
    const monthlyPauseTime = 300 + (200 * apiStats.currentDepth);
    console.log(`月次データ取得前の待機: ${monthlyPauseTime}ms (深さ: ${apiStats.currentDepth})`);
    await delay(monthlyPauseTime);
    process.stdout.write('スプレッドシート参照(value_monthly)が見つかりました\n');
    process.stdout.write(`スプレッドシート参照詳細: ${JSON.stringify(node.value_monthly.spreadsheet, null, 2)}\n`);
    const { id, range } = node.value_monthly.spreadsheet;
    console.log(`-----------------------------------`);
    console.log(`value_monthly: スプレッドシートから値を取得開始: (ID: ${id}, 範囲: ${range})`);
    try {
      console.log(`value_monthly: スプレッドシートから値を取得開始: ID=${id}, 範囲=${range}`);
      
      // リトライ機能付きの関数を使用
      const cellValue = await getCellValueWithRetry(id, range);
      
      console.log(`value_monthly: スプレッドシートから値を取得成功: (${range})`);
      console.log(`→ 値:`, cellValue);
      console.log(`→ 型:`, typeof cellValue);
      
      if (typeof cellValue === 'object' && cellValue !== null) {
        console.log(`→ オブジェクト詳細:`, JSON.stringify(cellValue, null, 2));
      }
      
      // 値のタイプに応じた処理
      if (cellValue === null || cellValue === undefined) {
        console.log(`スプレッドシートセル ${range} の値が空のため0を使用`);
        node.value_monthly = 0;
      } else if (typeof cellValue === 'number') {
        // 数値はそのまま使用
        node.value_monthly = cellValue;
      } else if (typeof cellValue === 'string') {
        // 文字列が数値に変換可能か試みる
        node.value_monthly = isNaN(Number(cellValue)) ? cellValue : Number(cellValue);
      } else if (typeof cellValue === 'object') {
        // オブジェクトの場合は文字列化して試みる
        try {
          if (cellValue.data && cellValue.data.values && 
              Array.isArray(cellValue.data.values) && 
              cellValue.data.values.length > 0 && 
              cellValue.data.values[0].length > 0) {
            const rawValue = cellValue.data.values[0][0];
            node.value_monthly = rawValue;
          } else {
            node.value_monthly = JSON.stringify(cellValue);
          }
        } catch (objErr) {
          console.error('value_monthly: オブジェクトの変換エラー', objErr);
          node.value_monthly = 'ERROR';
        }
      } else {
        // その他の型は文字列化
        node.value_monthly = String(cellValue);
      }
    } catch (error) {
      console.error(`value_monthly: スプレッドシート参照の解決に失敗: ${error.message}`);
      node.value_monthly = 'ERROR';
    }
  }
  
  // APIリクエスト状況を出力
  console.log('API呼び出し統計:', {
    総リクエスト数: apiStats.totalRequests,
    成功: apiStats.successRequests,
    失敗: apiStats.failedRequests,
    現在実行中: apiStats.activeCalls
  });
  
  // ノードの子ノードも同様に処理（深度を考慮）
  if (node.children && Array.isArray(node.children)) {
    // 子ノード処理前に現在の深さレベルを記録
    const previousDepth = apiStats.currentDepth;
    // 深さを1増やす
    apiStats.currentDepth++;
    
    // 子ノードの数が多い場合はバッチ処理
    const batchSize = Math.max(1, Math.ceil(10 / apiStats.currentDepth)); // 深さに応じてバッチサイズを調整
    const batches = [];
    
    // 子ノードを複数のバッチに分割
    for (let i = 0; i < node.children.length; i += batchSize) {
      batches.push(node.children.slice(i, i + batchSize));
    }
    
    console.log(`子ノード ${node.children.length}個を${batches.length}バッチに分割 (深さ: ${apiStats.currentDepth})`);
    
    // 結果を格納する配列
    const processedChildren = [];
    
    // 各バッチを順次処理
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`バッチ ${batchIndex + 1}/${batches.length} 処理開始 (${batch.length}ノード)`);
      
      // バッチ間の待機時間（特に深いノードの場合）
      if (batchIndex > 0) {
        const batchWaitTime = 200 * apiStats.currentDepth;
        console.log(`バッチ間の待機: ${batchWaitTime}ms`);
        await delay(batchWaitTime);
      }
      
      // バッチ内の各ノードを並列処理
      const batchPromises = [];
      for (const child of batch) {
        if (child) {
          // 親ノードの処理完了後、深さに応じた間隔を空けてから子ノードを処理
          const childWaitTime = 100 + (50 * apiStats.currentDepth);
          await delay(childWaitTime);
          batchPromises.push(resolveSpreadsheetReferences(child));
        }
      }
      
      // バッチの処理を待機し、結果を結合
      const batchResults = await Promise.all(batchPromises);
      processedChildren.push(...batchResults);
      
      console.log(`バッチ ${batchIndex + 1}/${batches.length} 処理完了`);
    }
    
    // 結果を設定
    node.children = processedChildren;
    
    // 深さレベルを元に戻す
    apiStats.currentDepth = previousDepth;
  }
  
  return node;
}

module.exports = {
  resolveSpreadsheetReferences,
  getCellValue,
  getCellValueWithRetry,
  delay // 外部からも利用できるように公開
};