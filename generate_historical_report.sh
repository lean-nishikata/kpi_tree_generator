#!/bin/bash
# KPIツリー過去データ生成スクリプト
# Usage: ./generate_historical_report.sh YYYY-MM-DD
# 
# 以下の処理を行います:
# 1. Googleスプレッドシートのデータコネクトのターゲット日付を更新
# 2. データ抽出シートを更新
# 3. KPIツリーHTMLを生成
# 4. GCSにアップロード
# 5. カレンダーデータを更新

set -e  # エラーが発生したら即座に終了

# 引数チェック
if [ "$#" -ne 1 ] || ! [[ "$1" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
    echo "Usage: $0 YYYY-MM-DD"
    exit 1
fi

TARGET_DATE="$1"
YYYYMMDD=$(echo "$TARGET_DATE" | tr -d '-')
OUTPUT_DIR="./output"
CONFIG_FILE="./config/index.yaml"
CALENDAR_DATA_FILE="./static/calendar-data.json"
GCS_BASE_PATH="gs://cc-data-platform-kpi-tree-viewer-prod"

# 必要なツールの確認
command -v python3 >/dev/null 2>&1 || { echo "python3が必要です"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "jqが必要です (brew install jq)"; exit 1; }
command -v gsutil >/dev/null 2>&1 || { echo "gsutilが必要です (Google Cloud SDKをインストールしてください)"; exit 1; }

echo "========== KPIツリー過去データ生成 ($TARGET_DATE) =========="

# ディレクトリの確認
mkdir -p "$OUTPUT_DIR"

# 1. Googleスプレッドシートのデータコネクト更新
echo "1. Googleスプレッドシートのターゲット日付を更新しています..."
echo "GoogleスプレッドシートURL: https://docs.google.com/spreadsheets/d/1913pwtcPIZcQZBC6F6tp6_16itxjwOOVRkj6wS1B8-U/edit"
echo "データコネクトシートのSQLクエリの中の"
echo "  SET target_date = DATE '2025-05-09';"
echo "を以下のように変更してください:"
echo "  SET target_date = DATE '$TARGET_DATE';"
echo ""
echo "変更が完了したらEnterキーを押してください..."
read -r

# 2. KPIツリーHTMLを生成
echo "2. KPIツリーHTMLを生成しています..."
echo "コマンド: node src/generator.js $CONFIG_FILE --date $TARGET_DATE"
node src/generator.js "$CONFIG_FILE" --date "$TARGET_DATE"

# 生成結果の確認
INDEX_HTML="$OUTPUT_DIR/index.html"
if [ ! -f "$INDEX_HTML" ]; then
    echo "エラー: $INDEX_HTML が生成されませんでした"
    exit 1
fi
echo "HTMLファイルが生成されました: $INDEX_HTML"

# 3. GCSにアップロード
echo "3. 生成したHTMLファイルをGCSにアップロードしています..."

# 日付パターンの置換確認
echo "GCSにアップロードする前にHTMLファイルの日付を確認"
DATE_PATTERN=$(grep -o "現在のデータ: [0-9]\{4\}年[0-9]\{2\}月[0-9]\{2\}日" "$INDEX_HTML" || echo "日付が見つかりません")
echo "HTMLに含まれる日付表示: $DATE_PATTERN"
echo "この日付でアップロードを続けますか？ (y/n)"
read -r CONFIRM
if [ "$CONFIRM" != "y" ]; then
    echo "アップロードをキャンセルしました"
    exit 1
fi

# 認証状態の確認
echo "Google Cloud認証状態を確認しています..."
gcloud auth list

echo "GSutilでGCSへのアップロード権限を確認しています..."
gsutil ls "$GCS_BASE_PATH" > /dev/null || { echo "GCSバケットへのアクセス権限がないか、GSutilの認証が必要です"; exit 1; }

# アップロード
echo "メインのindex.htmlをアップロードしています..."
gsutil cp "$INDEX_HTML" "$GCS_BASE_PATH/index.html"

echo "日付別レポートとしてアップロードしています: ${YYYYMMDD}.html"
gsutil cp "$INDEX_HTML" "$GCS_BASE_PATH/reports/${YYYYMMDD}.html"

# 4. カレンダーデータを更新
echo "4. カレンダーデータを更新しています..."

# ファイルをバックアップ
cp "$CALENDAR_DATA_FILE" "${CALENDAR_DATA_FILE}.bak"

# jqを使ってJSON更新（日付が既に存在しない場合のみ追加）
DATE_EXISTS=$(jq --arg date "$TARGET_DATE" '.datesWithData | any(. == $date)' "$CALENDAR_DATA_FILE")

if [ "$DATE_EXISTS" = "true" ]; then
    echo "日付 $TARGET_DATE は既にカレンダーデータに存在しています"
else
    echo "新しい日付 $TARGET_DATE をカレンダーデータに追加しています..."
    jq --arg date "$TARGET_DATE" '.datesWithData += [$date] | .datesWithData = (.datesWithData | sort)' "$CALENDAR_DATA_FILE" > "${CALENDAR_DATA_FILE}.tmp"
    mv "${CALENDAR_DATA_FILE}.tmp" "$CALENDAR_DATA_FILE"
    
    # 更新したカレンダーデータをGCSにアップロード
    echo "更新したカレンダーデータをアップロードしています..."
    gsutil cp "$CALENDAR_DATA_FILE" "$GCS_BASE_PATH/static/calendar-data.json"
fi

echo ""
echo "========== 処理が完了しました =========="
echo "ターゲット日付: $TARGET_DATE"
echo "GCS URL: $GCS_BASE_PATH/index.html"
echo "日付別レポート: $GCS_BASE_PATH/reports/${YYYYMMDD}.html"
echo "カレンダーデータが更新されました"