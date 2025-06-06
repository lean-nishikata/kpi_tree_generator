/**
 * KPIツリージェネレーター: Googleスプレッドシートヘルパー (簡易版)
 * 
 * Googleスプレッドシートからデータを取得するヘルパー関数群
 * シンプルなキャッシュ機構によるAPI呼び出し最適化機能を含む
 */
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { JWT } = require('google-auth-library');
require('dotenv').config();

// シート単位でキャッシュするためのマップ
const sheetCache = new Map();

/**
 * スプレッドシートの1シートをすべて取得してキャッシュ
 * @param {string} spreadsheetId - スプレッドシートID
 * @param {string} sheetName - シート名
 * @returns {Promise<Object>} シートデータ
 */
async function fetchAndCacheSheet(spreadsheetId, sheetName) {
  // キャッシュキーを生成
  const cacheKey = `${spreadsheetId}:${sheetName}`;
  
  // すでにキャッシュがあれば、それを返す
  if (sheetCache.has(cacheKey)) {
    console.log(`キャッシュから ${sheetName} シートのデータを取得`);
    return sheetCache.get(cacheKey);
  }
  
  console.log(`シート全体を読み込み中: ${sheetName}`);
  const sheets = initSheetsClient();
  
  try {
    // A1:Z100の範囲でシートデータを取得 (必要に応じて範囲を調整)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:Z100`
    });
    
    // 行と列のデータを整理
    const rows = response.data.values || [];
    
    // キャッシュに格納するデータ構造
    const sheetData = {
      name: sheetName,
      rows,
      timestamp: Date.now(),
      // A1:Z100を行列としてアクセスするためのヘルパー
      getValue: function(cellRef) {
        const match = cellRef.match(/([A-Z]+)([0-9]+)/);
        if (!match) return null;
        
        const colLetter = match[1];
        const rowNum = parseInt(match[2], 10);
        
        // A1形式を配列インデックスに変換
        let colIndex = 0;
        for (let i = 0; i < colLetter.length; i++) {
          colIndex = colIndex * 26 + colLetter.charCodeAt(i) - 'A'.charCodeAt(0) + 1;
        }
        colIndex -= 1; // 0ベースに調整
        const rowIndex = rowNum - 1; // 0ベースに調整
        
        // 範囲外チェック
        if (rowIndex < 0 || rowIndex >= rows.length) return null;
        if (!rows[rowIndex] || colIndex < 0 || colIndex >= rows[rowIndex].length) return null;
        
        return rows[rowIndex][colIndex];
      }
    };
    
    // キャッシュに保存
    sheetCache.set(cacheKey, sheetData);
    console.log(`シート ${sheetName} をキャッシュしました (${rows.length}行)`);
    
    return sheetData;
  } catch (error) {
    console.error(`スプレッドシート取得エラー: ${error.message}`);
    process.exit(1); // エラー時は終了
  }
}

/**
 * GoogleスプレッドシートAPI用のクライアントを初期化
 * @returns {Object} Google Sheets APIクライアント
 */
function initSheetsClient() {
  try {
    // サービスアカウントキーパスを取得
    const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
    if (!keyPath || !fs.existsSync(keyPath)) {
      console.error('サービスアカウントキーが見つかりません');
      process.exit(1);
    }
    
    // サービスアカウントキーを読み込み
    const serviceAccountKey = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    
    // 認証クライアントの初期化
    const auth = new google.auth.JWT(
      serviceAccountKey.client_email,
      null,
      serviceAccountKey.private_key,
      ['https://www.googleapis.com/auth/spreadsheets.readonly']
    );
    
    // Sheets APIクライアントの初期化
    return google.sheets({ version: 'v4', auth });
  } catch (error) {
    console.error(`SheetsAPIクライアント初期化エラー: ${error.message}`);
    process.exit(1);
  }
}

/**
 * スプレッドシートの特定セルの値を取得
 * @param {string} spreadsheetId - スプレッドシートID 
 * @param {string} rangeNotation - A1形式の範囲表記（例: "Sheet1!A1"）
 * @returns {Promise<any>} セルの値
 */
async function getCellValue(spreadsheetId, rangeNotation) {
  try {
    // シート名とセル参照を分離
    const parts = rangeNotation.split('!');
    if (parts.length !== 2) {
      console.error(`無効な範囲指定です: ${rangeNotation}`);
      return null;
    }
    
    const sheetName = parts[0];
    const cellRef = parts[1];
    
    // シート全体をキャッシュから取得または新規取得
    const sheetData = await fetchAndCacheSheet(spreadsheetId, sheetName);
    
    // キャッシュからセル値を取得
    const value = sheetData.getValue(cellRef);
    
    console.log(`セル ${rangeNotation} の値を取得: ${value}`);
    return value;
  } catch (error) {
    console.error(`セル値取得エラー: ${error.message}`);
    process.exit(1); // エラー時は終了
  }
}

/**
 * スプレッドシート参照（=シート名!セル参照 形式）を解決する
 * @param {string} spreadsheetId - スプレッドシートID
 * @param {string} reference - スプレッドシート参照文字列（"=Sheet1!A1" 形式）
 * @returns {Promise<any>} 解決された値
 */
async function resolveReference(spreadsheetId, reference) {
  // スプレッドシート参照形式の確認
  if (typeof reference !== 'string' || !reference.startsWith('=')) {
    return reference; // スプレッドシート参照でない場合はそのまま返す
  }
  
  // '=' を除去してシート参照に変換
  const rangeNotation = reference.substring(1);
  
  try {
    return await getCellValue(spreadsheetId, rangeNotation);
  } catch (error) {
    console.error(`参照解決エラー: ${error.message}`);
    process.exit(1); // エラー時は終了
  }
}

/**
 * YAMLノードツリー内のスプレッドシート参照を解決する
 * @param {Object} node - KPIツリーノード
 * @param {string} spreadsheetId - スプレッドシートID
 * @returns {Promise<Object>} 参照が解決されたノード
 */
async function resolveNodeReferences(node, spreadsheetId) {
  if (!node) return node;
  
  // value_daily と value_monthly の参照を解決
  if (node.value_daily) {
    node.value_daily = await resolveReference(spreadsheetId, node.value_daily);
  }
  
  if (node.value_monthly) {
    node.value_monthly = await resolveReference(spreadsheetId, node.value_monthly);
  }
  
  // 通常の value も解決（後方互換性）
  if (node.value && typeof node.value === 'string' && node.value.startsWith('=')) {
    node.value = await resolveReference(spreadsheetId, node.value);
  }
  
  // 子ノードを再帰的に処理
  if (node.children && Array.isArray(node.children)) {
    for (let i = 0; i < node.children.length; i++) {
      node.children[i] = await resolveNodeReferences(node.children[i], spreadsheetId);
    }
  }
  
  return node;
}

/**
 * YAMLのルートノードからスプレッドシート参照を解決
 * @param {Object} rootNode - KPIツリーのルートノード
 * @returns {Promise<Object>} 参照が解決されたルートノード
 */
async function resolveSpreadsheetReferences(rootNode) {
  if (!rootNode) return rootNode;
  
  console.log('スプレッドシート参照の解決を開始します...');
  
  // スプレッドシートIDを取得（ノード、グローバル設定、環境変数の順で確認）
  let spreadsheetId = null;
  
  // ノードに直接指定されたID（最優先）
  if (rootNode.spreadsheet && rootNode.spreadsheet.id) {
    spreadsheetId = rootNode.spreadsheet.id;
    console.log(`ノードに直接指定されたスプレッドシートIDを使用: ${spreadsheetId}`);
  }
  // グローバル設定からID（YAMLファイルのルートレベル設定）
  else if (global.kpiTreeConfig && global.kpiTreeConfig.spreadsheet && global.kpiTreeConfig.spreadsheet.id) {
    spreadsheetId = global.kpiTreeConfig.spreadsheet.id;
    console.log(`YAMLファイル設定からスプレッドシートIDを使用: ${spreadsheetId}`);
  }
  // 環境変数からID（最後の選択肢）
  else if (process.env.KPI_TREE_SPREADSHEET_ID) {
    spreadsheetId = process.env.KPI_TREE_SPREADSHEET_ID;
    console.log(`YAMLに指定がないため、環境変数からスプレッドシートIDを使用: ${spreadsheetId}`);
  }
  
  if (!spreadsheetId) {
    console.error('スプレッドシートIDが見つかりません。設定ファイルまたは環境変数で指定してください。');
    process.exit(1);
  }
  
  // ルートから再帰的にノードの参照を解決
  const resolvedRoot = await resolveNodeReferences(rootNode, spreadsheetId);
  console.log('スプレッドシート参照の解決が完了しました');
  
  return resolvedRoot;
}

module.exports = {
  resolveSpreadsheetReferences,
  getCellValue,
  fetchAndCacheSheet
};