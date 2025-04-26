/**
 * シート情報を表示するツール
 * 
 * スプレッドシートの基本情報を取得し、利用可能なシート名を表示します
 */
const fs = require('fs');
const { GoogleSpreadsheet } = require('google-spreadsheet');

// 引数からスプレッドシートIDを取得
const spreadsheetId = process.argv[2] || '1913pwtcPIZcQZBC6F6tp6_16itxjwOOVRkj6wS1B8-U';

async function main() {
  try {
    console.log(`スプレッドシートID: ${spreadsheetId}`);
    
    // 認証情報の読み込み
    const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || '/app/keys/service-account-key.json';
    console.log(`認証ファイル: ${keyPath}`);
    
    if (!fs.existsSync(keyPath)) {
      console.error(`エラー: 認証ファイルが見つかりません: ${keyPath}`);
      process.exit(1);
    }
    
    const serviceAccountKey = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    console.log(`サービスアカウント: ${serviceAccountKey.client_email}`);
    
    // スプレッドシートへのアクセス
    const doc = new GoogleSpreadsheet(spreadsheetId);
    await doc.useServiceAccountAuth(serviceAccountKey);
    await doc.loadInfo();
    
    console.log(`\nスプレッドシート名: ${doc.title}`);
    console.log('利用可能なシート:');
    
    // すべてのシート情報を表示
    doc.sheetsByIndex.forEach((sheet, i) => {
      console.log(`  ${i}: ${sheet.title} (${sheet.rowCount}×${sheet.columnCount})`);
    });
    
    // 最初のシートの内容をサンプル表示
    if (doc.sheetsByIndex.length > 0) {
      const firstSheet = doc.sheetsByIndex[0];
      console.log(`\n最初のシート"${firstSheet.title}"のサンプルデータ:`);
      
      try {
        // 最初の数行を表示
        await firstSheet.loadCells('A1:E5');
        
        for (let row = 0; row < 5; row++) {
          let rowData = [];
          for (let col = 0; col < 5; col++) {
            const cell = firstSheet.getCell(row, col);
            rowData.push(cell.value || '');
          }
          console.log(`  行${row+1}: ${rowData.join(', ')}`);
        }
      } catch (err) {
        console.log(`  データ取得エラー: ${err.message}`);
      }
    }
    
    console.log('\nセル指定例:');
    if (doc.sheetsByIndex.length > 0) {
      const firstSheet = doc.sheetsByIndex[0];
      console.log(`  - "${firstSheet.title}!A1"  (最初のシートのA1セル)`);
      console.log(`  - "${firstSheet.title}!B2"  (最初のシートのB2セル)`);
    }
    
  } catch (error) {
    console.error('エラー:', error.message);
    if (error.response) {
      console.error('API応答:', error.response.data);
    }
  }
}

main();