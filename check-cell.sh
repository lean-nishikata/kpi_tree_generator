#!/bin/sh
# セル値確認用のヘルパースクリプト

# 引数の取得
SPREADSHEET_ID=$1
CELL_RANGE=$2

if [ -z "$SPREADSHEET_ID" ] || [ -z "$CELL_RANGE" ]; then
  echo "使用法: $0 <スプレッドシートID> <セル範囲>"
  echo "例: $0 1AbCdEfGhIjK Sheet1!A1"
  exit 1
fi

# Docker Composeでcheck-sheets-valuesを実行
docker-compose run --rm --entrypoint node kpi-generator src/check-sheets-values.js "$SPREADSHEET_ID" "$CELL_RANGE"