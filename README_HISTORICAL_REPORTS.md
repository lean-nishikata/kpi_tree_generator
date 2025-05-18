# 過去データ生成ツール 使用方法

このドキュメントでは、過去の日付のKPIツリーレポートを生成し、GCSにアップロードするスクリプトの使用方法を説明します。

## スクリプトの概要

2種類のスクリプトが用意されています：

1. **generate_historical_report.sh** - シェルスクリプト版（手動操作が必要）
2. **generate_historical_report.py** - Python版（より自動化されています）

どちらのスクリプトも以下の処理を行います：

1. Googleスプレッドシートのデータコネクトのターゲット日付を更新
2. データ抽出シートの更新を待機
3. KPIツリーHTMLを生成
4. GCSにアップロード（2箇所）
5. カレンダーデータを更新

## 前提条件

### 共通の前提条件

- Google Cloud SDKのインストール (`gsutil` コマンドが使用可能であること)
- GCSバケットへの書き込み権限

### ホスト環境での実行時の追加条件

- `jq` コマンドのインストール (`brew install jq`)
- Python 3.6以上 (Python版を使用する場合)
- Google API Pythonクライアントライブラリ (Python版を使用する場合)

```bash
pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib
```

### Docker環境での実行時の前提条件

- Docker および docker-compose がインストール済み
- マウントされたボリュームへの書き込み権限

Dockerイメージには以下が含まれています:
- Node.js
- Python 3 および pip
- jq
- Google API Pythonクライアントライブラリ

## 使用方法

### ホスト環境から実行

#### シェルスクリプト版

```bash
./generate_historical_report.sh YYYY-MM-DD
```

例：
```bash
./generate_historical_report.sh 2025-06-01
```

#### Python版

```bash
python generate_historical_report.py YYYY-MM-DD
```

または

```bash
./generate_historical_report.py YYYY-MM-DD
```

例：
```bash
./generate_historical_report.py 2025-06-01
```

### Dockerコンテナから実行（推奨）

Dockerコンテナから実行する場合は、以下のMakeコマンドを使用します：

#### シェルスクリプト版

```bash
make historical-report date=YYYY-MM-DD
```

例：
```bash
make historical-report date=2025-06-01
```

#### Python版

```bash
make historical-report-py date=YYYY-MM-DD
```

例：
```bash
make historical-report-py date=2025-06-01
```

## Dockerビルドと環境準備

初回実行前には、以下の手順でDockerイメージをビルドします：

```bash
# Dockerイメージをビルド
make build

# 必要に応じてサービスアカウントキーを配置
cp /path/to/your-service-account-key.json ./keys/service-account-key.json
```

## スクリプトのフロー

1. **Googleスプレッドシートの更新**：
   - 「データソース」シートのSQLクエリ内の `SET target_date = DATE 'YYYY-MM-DD'` を更新
   - Python版ではサービスアカウントキー（`/app/keys/service-account-key.json`）があれば自動的に更新
   - データコネクトの更新ボタンは手動でクリックする必要があります

2. **データ抽出と確認**：
   - 「抽出データ」シート、「for_generator」シートの更新を確認
   - 更新完了後に次のステップに進みます

3. **KPIツリーHTML生成**：
   - `node src/generator.js config/index.yaml --date YYYY-MM-DD` を実行
   - 指定された日付でHTMLファイルを生成

4. **GCSへのアップロード**：
   - 生成したHTMLファイルを2箇所にアップロード：
     1. `gs://cc-data-platform-kpi-tree-viewer-prod/index.html`
     2. `gs://cc-data-platform-kpi-tree-viewer-prod/reports/YYYYMMDD.html`

5. **カレンダーデータの更新**：
   - `static/calendar-data.json` の `datesWithData` 配列に新しい日付を追加
   - 更新したJSONファイルをGCSにアップロード

## トラブルシューティング

### 認証エラー

GCSへのアップロードで認証エラーが発生した場合：

```bash
gcloud auth login
```

を実行してGoogleアカウントで認証してください。

### スプレッドシートのアクセス権

Python版でスプレッドシートを自動更新するには、正しい権限を持つサービスアカウントキーが必要です：

1. Google Cloud ConsoleでサービスアカウントキーをJSON形式でダウンロード
2. `./keys/service-account-key.json` として配置
3. 対象のスプレッドシートでサービスアカウントに編集権限を付与

### GCS権限の確認

GCSへのアップロード権限を確認するには：

```bash
gsutil ls gs://cc-data-platform-kpi-tree-viewer-prod
```

このコマンドでバケットの内容をリストできれば、権限は正しく設定されています。

## 注意事項

- スクリプト実行前に、適切なGoogle Cloud環境に認証されていることを確認してください
- スプレッドシートのデータコネクト更新には数分かかる場合があります
- 更新前に既存のデータのバックアップを取ることをお勧めします