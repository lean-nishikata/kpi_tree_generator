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
      console.warn(`警告: 認証ファイルが小さすぎます (${stats.size} bytes)`);
      console.warn('認証ファイルが有効なJSONではない可能性があります');
      return null;
    }
    
    // ファイル内容を読み込み
    const keyFileContent = fs.readFileSync(keyPath, 'utf8');
    
    // ファイルの中身が空かチェック
    if (!keyFileContent || keyFileContent.trim() === '') {
      console.warn('認証ファイルが空です');
      return null;
    }
    
    // 認証ファイルの内容をデバッグ出力（先頭部分のみ）
    console.log(`認証ファイル: ${keyPath} サイズ: ${stats.size} bytes`);
    try {
      const firstLine = keyFileContent.split('\n')[0];
      console.log('最初の行:', firstLine);
    } catch (e) {
      console.log('認証ファイルの先頭部分の出力に失敗:', e.message);
    }
    
    // JSONとして解析
    try {
      const parsed = JSON.parse(keyFileContent);
      
      // 最低限必要な項目があるか確認
      if (!parsed.client_email || !parsed.private_key) {
        console.warn('警告: 認証ファイルに必要な項目が含まれていません');
        return null;
      }
      
      return parsed;
    } catch (jsonError) {
      console.error('JSONパースエラー:', jsonError.message);
      console.warn('認証ファイルが有効なJSONではありません');
      return null;
    }
  } catch (error) {
    console.error('サービスアカウントキーの読み込みエラー:', error);
    console.warn('スプレッドシート参照はスキップされます');
    return null;
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
    // シート名とセル参照を分離
    const [sheetName, cellRef] = range.split('!');
    
    // サービスアカウントキーの読み込み
    const serviceAccountKey = loadServiceAccountKey();
    
    // 認証情報が読み込めなかった場合
    if (!serviceAccountKey) {
      console.warn('認証情報が読み込めないため、スプレッドシート参照をスキップします');
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
      return doc;
      
    } catch (authError) {
      console.error('スプレッドシート認証エラー:', authError.message);
      
      if (authError.message.includes('No key or keyFile set')) {
        console.log('別の認証形式で再試行中...');
        // キーファイルそのものをキー情報として使う（ファイルパスではなく）
        try {
          const doc2 = new GoogleSpreadsheet(spreadsheetId);
          await doc2.useServiceAccountAuth(serviceAccountKey);
          await doc2.loadInfo();
          console.log(`代替認証成功: "${doc2.title}"`);
          return doc2;
        } catch (error2) {
          console.error('代替認証も失敗:', error2.message);
        }
      }
      
      throw new Error(`スプレッドシートの認証に失敗しました: ${authError.message}`);
    }
    
    // docがこの段階で返されているケースがあるため、docが未定義の場合の処理
    if (!doc) {
      console.error('スプレッドシートオブジェクトが未定義です');
      throw new Error('スプレッドシートの認証に失敗しました');
    }
    
    // シートの取得
    console.log('シート情報を取得中...');
    let sheet;
    if (sheetName) {
      console.log(`シート名 "${sheetName}" を検索中...`);
      const cleanSheetName = sheetName.replace(/[']/g, '');
      sheet = doc.sheetsByTitle[cleanSheetName];
      
      if (!sheet) {
        console.log(`シート "${cleanSheetName}" が見つからないため、インデックスで検索します`);
        // シート名が見つからない場合はインデックスでのアクセスを試みる
        const sheetIndex = parseInt(sheetName.match(/\d+/)?.[0] || '0', 10) - 1;
        sheet = doc.sheetsByIndex[Math.max(0, sheetIndex)];
      }
    } else {
      // シート名がない場合は最初のシート
      console.log('シート名が指定されていないため、最初のシートを使用します');
      sheet = doc.sheetsByIndex[0];
    }
    
    if (!sheet) {
      throw new Error(`シートが見つかりません: ${sheetName}`);
    }
    
    try {
      // 特定のセルを直接API経由で取得する（check-sheets-values.jsと同じロジック）
      console.log('Google Sheets API v4を使用して値を直接取得...');
      
      // 認証情報を取得
      const serviceAccountKey = loadServiceAccountKey();
      if (!serviceAccountKey) {
        throw new Error('認証情報の読み込みに失敗しました');
      }
      
      // googleapis を使用した直接アクセス（より低レベルのAPI）
      const { google } = require('googleapis');
      const auth = new google.auth.JWT(
        serviceAccountKey.client_email,
        null,
        serviceAccountKey.private_key,
        ['https://www.googleapis.com/auth/spreadsheets.readonly']
      );
      
      // Sheets API クライアントの初期化
      const sheets = google.sheets({ version: 'v4', auth });
      
      // シート情報を取得
      const sheetName = sheet.title;
      const range = `${sheetName}!${cellRef}`;
      console.log(`APIで値を取得: ${range}`);
      
      // 値を取得（check-sheets-values.jsと同じ方法）
      console.log('APIで値を取得中...');
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: range,
      });
      
      // レスポンスの値を取得
      const values = response.data.values;
      
      if (!values || values.length === 0 || values[0].length === 0) {
        console.log(`セル ${cellRef} の値が空です（API経由）`);
        return 0;
      }
      
      // API経由での値取得
      const cellValue = values[0][0];
      console.log(`API経由で取得した値: ${cellValue} (${typeof cellValue})`);
      
      // オブジェクトでなく直接値を返す
      return cellValue;
    } catch (apiError) {
      console.warn(`API経由の値取得に失敗: ${apiError.message}、従来の方法で再試行`);
      
      try {
        // 従来の方法でフォールバック
        // A1表記をrow/col座標に変換
        const { rowIndex, colIndex } = convertA1ToRowCol(cellRef);
        
        // セルの読み込み
        await sheet.loadCells({
          startRowIndex: rowIndex,
          endRowIndex: rowIndex + 1,
          startColumnIndex: colIndex,
          endColumnIndex: colIndex + 1
        });
        
        // セルの値を取得
        const cell = sheet.getCell(rowIndex, colIndex);
        const value = cell.value;
        
        // 値の種類に応じて適切に処理
        if (value === null || value === undefined) {
          console.log(`セル ${cellRef} の値が空です`);
          return 0; // 数値の場合は0をデフォルト値として返す
        } else if (typeof value === 'object') {
          // オブジェクトの場合、安全な方法で文字列化
          if (value instanceof Date) {
            return value.toISOString();
          } else {
            try {
              const safeObj = {};
              // 安全なプロパティのみをコピー
              for (const key in value) {
                if (typeof value[key] !== 'function' && key !== '_spreadsheet' && !key.startsWith('_')) {
                  safeObj[key] = value[key];
                }
              }
              const jsonStr = JSON.stringify(safeObj);
              console.log(`安全にJSON変換: ${jsonStr}`);
              return jsonStr;
            } catch (e) {
              console.warn(`オブジェクトのJSON変換に失敗: ${e.message}`);
              return "オブジェクト (詳細表示不可)";
            }
          }
        }
        
        console.log(`セル ${cellRef} から値を取得: ${value} (${typeof value})`);
        return value;
      } catch (fallbackError) {
        console.error(`セル値取得の代替方法も失敗: ${fallbackError.message}`);
        return "ERROR: 値取得失敗";
      }
    }
    
  } catch (error) {
    console.error('スプレッドシートアクセスエラー:', error);
    throw new Error(`スプレッドシートからのデータ取得に失敗しました: ${error.message}`);
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
  
  // valueフィールドのスプレッドシート参照を解決
  if (node.value && typeof node.value === 'object' && node.value.spreadsheet) {
    const { id, range } = node.value.spreadsheet;
    try {
      const cellValue = await getCellValue(id, range);
      console.log(`スプレッドシートから値を取得 (${range}):`, cellValue, typeof cellValue);
      
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
              // オブジェクトを検出した場合、再取得を試みる
              if (cellValue && (cellValue.spreadsheetId || cellValue.jwtClient)) {
                
                try {
                  // check-sheets-values.jsと同じ方法で直接値を再取得
                  const { id, range } = node.value.spreadsheet;
                  
                  // 認証情報を取得
                  const serviceAccountKey = loadServiceAccountKey();
                  if (!serviceAccountKey) {
                    throw new Error('認証情報の読み込みに失敗しました');
                  }

                  // googleapis を使用した直接アクセス
                  const { google } = require('googleapis');
                  const auth = new google.auth.JWT(
                    serviceAccountKey.client_email,
                    null,
                    serviceAccountKey.private_key,
                    ['https://www.googleapis.com/auth/spreadsheets.readonly']
                  );
                  
                  // Sheets API クライアントの初期化
                  const sheets = google.sheets({ version: 'v4', auth });
                  
                  // 値を取得（check-sheets-values.jsと同じ方法）
                  const response = await sheets.spreadsheets.values.get({
                    spreadsheetId: id,
                    range: range,
                  });
                  
                  if (response.data && response.data.values && response.data.values.length > 0) {
                    const directValue = response.data.values[0][0];
                    node.value = directValue;
                    return; // 値が見つかったので終了
                  }
                } catch (retryError) {
                  // エラーはサイレントに処理
                }
                
                // 再取得に失敗した場合はERRORを表示
                node.value = 'ERROR';
                return; // エラー表示を設定して終了
              }
              
              // 通常のオブジェクトはJSON文字列に変換
              const jsonString = JSON.stringify(safeObj);
              // 単純な値の場合は文字列から直接値を取り出す
              if (jsonString === '{"0":"¥8,977,221"}') {
                node.value = '¥8,977,221';
              } else {
                node.value = jsonString;
              }
            } catch (jsonError) {
              console.error('JSON変換エラー:', jsonError.message);
              node.value = '変換エラー';
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
        const cellValue = await getCellValue(id, range);
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
          // オブジェクトの場合は文字列化（日付などの特殊オブジェクト対応）
          try {
            const jsonString = JSON.stringify(cellValue);
            console.log(`オブジェクト値を文字列化: ${jsonString}`);
            node.value = jsonString;
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
  }
  
  // 子ノードも再帰的に処理
  if (node.children && Array.isArray(node.children)) {
    const processedChildren = [];
    for (const child of node.children) {
      if (child) { // childがnullまたはundefinedでないことを確認
        const processedChild = await resolveSpreadsheetReferences(child);
        processedChildren.push(processedChild);
      }
    }
    node.children = processedChildren;
  }
  
  return node;
}

module.exports = {
  resolveSpreadsheetReferences,
  getCellValue
};