/**
 * スプレッドシートの特定セルの値を直接APIで取得するツール
 */
const fs = require('fs');
const { google } = require('googleapis');

// 引数取得
const spreadsheetId = process.argv[2] || '1913pwtcPIZcQZBC6F6tp6_16itxjwOOVRkj6wS1B8-U';
const rangeArg = process.argv[3] || 'summary!B1';

async function main() {
  try {
    console.log(`スプレッドシートID: ${spreadsheetId}`);
    console.log(`範囲: ${rangeArg}`);
    
    // 認証情報の読み込み
    const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || '/app/keys/service-account-key.json';
    console.log(`認証ファイル: ${keyPath}`);
    
    if (!fs.existsSync(keyPath)) {
      console.error(`エラー: 認証ファイルが見つかりません: ${keyPath}`);
      process.exit(1);
    }
    
    // サービスアカウントキーを読み込む
    const serviceAccountKey = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    console.log(`サービスアカウント: ${serviceAccountKey.client_email}`);
    
    // google-auth-libraryの認証オブジェクトを作成
    const auth = new google.auth.JWT(
      serviceAccountKey.client_email,
      null,
      serviceAccountKey.private_key,
      ['https://www.googleapis.com/auth/spreadsheets.readonly']
    );
    
    // Sheets APIクライアント作成
    const sheets = google.sheets({ version: 'v4', auth });
    
    // 値を取得（より直接的なAPIアクセス）
    console.log('APIで値を取得中...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: rangeArg,
    });
    
    // レスポンスの値を取得
    const values = response.data.values;
    if (!values || values.length === 0) {
      console.log(`セル ${rangeArg} に値が見つかりません（空）`);
    } else {
      console.log('取得した値:');
      console.log(`- 生データ: ${JSON.stringify(values)}`);
      console.log(`- 値の型: ${typeof values[0][0]}`);
      
      if (typeof values[0][0] === 'string' && !isNaN(Number(values[0][0]))) {
        console.log(`- 数値変換: ${Number(values[0][0])}`);
      }
      
      console.log('\nYAMLでの設定例:');
      console.log(`
value:
  spreadsheet:
    id: "${spreadsheetId}"
    range: "${rangeArg}"
`);
    }
    
    // スプレッドシートのプロパティも取得
    const sheetResponse = await sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId,
      includeGridData: false,
    });
    
    console.log('\nスプレッドシート情報:');
    console.log(`- タイトル: ${sheetResponse.data.properties.title}`);
    console.log('- シート一覧:');
    sheetResponse.data.sheets.forEach((sheet, i) => {
      const title = sheet.properties.title;
      console.log(`  ${i}: ${title}`);
    });
    
  } catch (error) {
    console.error('エラー:', error.message);
    if (error.response) {
      console.error('API応答:', error.response.data);
    }
  }
}

main();