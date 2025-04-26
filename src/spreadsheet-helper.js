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
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: fullRange,
      });
      
      // レスポンスの値を取得
      const values = response.data.values;
      
      if (!values || values.length === 0 || values[0].length === 0) {
        console.log(`セル ${cellRef} の値が空です（API経由）`);
        return 0;
      }
      
      // API経由での値取得
      const cellValue = values[0][0];
      return cellValue;
      
    } catch (authError) {
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
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: spreadsheetId,
          range: fullRange,
        });
        
        // レスポンスの値を取得
        const values = response.data.values;
        
        if (!values || values.length === 0 || values[0].length === 0) {
          console.log(`セル ${cellRef} の値が空です（API経由）`);
          return 0;
        }
        
        // API経由での値取得
        const cellValue = values[0][0];
        return cellValue;
      } catch (error2) {
        throw new Error('Failed to access spreadsheet');
      }
    }
    
    // 認証情報が返されたので直接APIにアクセス
    const sheets = authClient; // 認証オブジェクトはもうsheetsクライアント
    
    // シート名とセル参照は既に取得済み（関数の先頭で分離している）
    
    try {
      // 値を直接取得
      
      // 値を取得（check-sheets-values.jsと同じ方法）
      const fullRange = `${sheetName}!${cellRef}`;
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: fullRange,
      });
      
      // レスポンスの値を取得
      const values = response.data.values;
      
      if (!values || values.length === 0 || values[0].length === 0) {
        console.log(`セル ${cellRef} の値が空です（API経由）`);
        return 0;
      }
      
      // API経由での値取得 - check-sheets-values.jsと同じロジック
      const cellValue = values[0][0];
      
      // データの形式を検証
      if (typeof cellValue === 'object') {
        try {
          // オブジェクトがnullの場合
          if (cellValue === null) {
            return "";
          }
          
          // 日付オブジェクトの場合
          if (cellValue instanceof Date) {
            return cellValue.toISOString();
          }
          
          // オブジェクトから安全に値を取り出す試み
          if (cellValue.data && cellValue.data.values && 
              Array.isArray(cellValue.data.values) && 
              cellValue.data.values.length > 0) {
            return cellValue.data.values[0][0];
          }
          
          // APIレスポンスオブジェクトから値を抽出する試み
          if (cellValue.formattedValue) {
            return cellValue.formattedValue;
          }
          
          // 単純なキー値ペアから値を抽出する試み
          if (cellValue["0"] !== undefined) {
            return cellValue["0"];
          }
          
          // valueプロパティがある場合
          if (cellValue.value !== undefined) {
            return cellValue.value;
          }
          
          // 最後の手段として文字列化
          return JSON.stringify(cellValue);
        } catch (objError) {
          console.error('オブジェクト解析エラー:', objError);
          return "ERROR: Object parsing";
        }
      }
      
      // プリミティブ値はそのまま返す
      return cellValue;
    } catch (apiError) {
      // API呼び出しエラー
      return "ERROR: 値取得失敗";
    }
    
  } catch (error) {
    return "ERROR: Access Failed";
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
              // 最も直接的な方法でAPI再取得を試みる
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
              
              // 値を取得
              const response = await sheets.spreadsheets.values.get({
                spreadsheetId: id,
                range: range,
              });
              
              if (response.data && response.data.values && response.data.values.length > 0) {
                let directValue = response.data.values[0][0];
                
                // 取得した値を適切な型に変換
                if (directValue === null || directValue === undefined) {
                  // 空の値は0として扱う
                  node.value = 0;
                } else if (typeof directValue === 'object') {
                  // オブジェクトの場合は文字列化
                  if (directValue instanceof Date) {
                    node.value = directValue.toISOString();
                  } else {
                    // その他のオブジェクトは値プロパティを試みる、なければ文字列化
                    node.value = directValue.value !== undefined ? directValue.value : String(directValue);
                  }
                } else {
                  // 文字列を数値に変換（可能な場合）
                  node.value = typeof directValue === 'string' && !isNaN(Number(directValue)) 
                    ? Number(directValue) 
                    : directValue;
                }
                return; // 値が設定できたので終了
              }
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