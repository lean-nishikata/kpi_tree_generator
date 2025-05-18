#!/usr/bin/env python3
"""
KPIツリー過去データ生成スクリプト - Python版
使用方法: python generate_historical_report.py YYYY-MM-DD

このスクリプトは以下の処理を行います:
1. Googleスプレッドシートのデータコネクトのターゲット日付を更新
2. データ抽出シートを更新を待機
3. KPIツリーHTMLを生成
4. GCSにアップロード
5. カレンダーデータを更新

必要な依存関係:
- google-api-python-client
- google-auth-httplib2
- google-auth-oauthlib
- jq

インストール方法:
pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib
"""

import argparse
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

try:
    from googleapiclient.discovery import build
    from google.oauth2 import service_account
except ImportError:
    print("Google APIライブラリがインストールされていません。以下のコマンドでインストールしてください:")
    print("pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib")
    sys.exit(1)

# Dockerコンテナ内かどうかを判定
IS_DOCKER = os.path.exists('/.dockerenv') or os.path.exists('/app')

# 設定
SPREADSHEET_ID = "1913pwtcPIZcQZBC6F6tp6_16itxjwOOVRkj6wS1B8-U"
if IS_DOCKER:
    # Dockerコンテナ内
    OUTPUT_DIR = "/app/output"
    CONFIG_FILE = "/app/config/index.yaml"
    CALENDAR_DATA_FILE = "/app/static/calendar-data.json"
    SERVICE_ACCOUNT_FILE = "/app/keys/service-account-key.json"
else:
    # ホスト環境
    OUTPUT_DIR = "./output"
    CONFIG_FILE = "./config/index.yaml"
    CALENDAR_DATA_FILE = "./static/calendar-data.json"
    SERVICE_ACCOUNT_FILE = "./keys/service-account-key.json"

GCS_BASE_PATH = "gs://cc-data-platform-kpi-tree-viewer-prod"

def check_dependencies():
    """必要な依存関係をチェック"""
    try:
        subprocess.run(["gsutil", "--version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("エラー: gsutilコマンドが見つかりません。Google Cloud SDKをインストールしてください。")
        sys.exit(1)
    
    try:
        subprocess.run(["jq", "--version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("エラー: jqコマンドが見つかりません。インストールしてください (brew install jq)。")
        sys.exit(1)
    
    try:
        subprocess.run(["node", "--version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("エラー: nodeコマンドが見つかりません。Node.jsをインストールしてください。")
        sys.exit(1)

def update_spreadsheet_sql(target_date):
    """スプレッドシートのSQLクエリの日付を更新"""
    if not os.path.exists(SERVICE_ACCOUNT_FILE):
        print(f"警告: サービスアカウントキーファイル {SERVICE_ACCOUNT_FILE} が見つかりません")
        print("手動でスプレッドシートを更新する必要があります")
        print("GoogleスプレッドシートURL: https://docs.google.com/spreadsheets/d/1913pwtcPIZcQZBC6F6tp6_16itxjwOOVRkj6wS1B8-U/edit")
        print("データコネクトシートのSQLクエリの中の")
        print("  SET target_date = DATE '2025-05-09';")
        print("を以下のように変更してください:")
        print(f"  SET target_date = DATE '{target_date}';")
        input("変更が完了したらEnterキーを押してください...")
        return
    
    try:
        # サービスアカウントの認証情報を取得
        credentials = service_account.Credentials.from_service_account_file(
            SERVICE_ACCOUNT_FILE, scopes=['https://www.googleapis.com/auth/spreadsheets']
        )
        
        # Google Sheets APIクライアントの作成
        service = build('sheets', 'v4', credentials=credentials)
        sheets = service.spreadsheets()
        
        # データコネクトシートからSQLクエリを取得
        result = sheets.values().get(
            spreadsheetId=SPREADSHEET_ID,
            range='データソース!A1:D10'  # SQL文があるセル範囲（実際の範囲に調整）
        ).execute()
        
        if 'values' not in result:
            print("警告: データソースシートからデータを取得できませんでした")
            print("手動でスプレッドシートを更新する必要があります")
            input("手動で更新完了したらEnterキーを押してください...")
            return
        
        values = result['values']
        sql_query = None
        row_index = None
        
        # SQL文を含む行を探す
        for i, row in enumerate(values):
            for cell in row:
                if isinstance(cell, str) and "SET target_date = DATE" in cell:
                    sql_query = cell
                    row_index = i
                    break
            if sql_query:
                break
        
        if not sql_query:
            print("警告: SQLクエリの中のtarget_date設定が見つかりませんでした")
            print("手動でスプレッドシートを更新する必要があります")
            input("手動で更新完了したらEnterキーを押してください...")
            return
        
        # 日付パターンを置換
        new_sql_query = re.sub(
            r"SET target_date = DATE '\d{4}-\d{2}-\d{2}'",
            f"SET target_date = DATE '{target_date}'",
            sql_query
        )
        
        if new_sql_query == sql_query:
            print("警告: SQLクエリの日付パターンが見つからないか、既に更新されています")
            print(f"現在のSQL: {sql_query}")
            proceed = input("手動で更新しますか？(y/n): ")
            if proceed.lower() != 'y':
                return
        else:
            # 更新したSQLをシートに書き込み
            sheets.values().update(
                spreadsheetId=SPREADSHEET_ID,
                range=f'データソース!A{row_index+1}',  # 行番号は1から始まる
                valueInputOption='RAW',
                body={'values': [[new_sql_query]]}
            ).execute()
            
            print(f"スプレッドシートのSQLクエリを更新しました:")
            print(f"旧: {sql_query}")
            print(f"新: {new_sql_query}")
        
        # データコネクトの更新を実行するには手動操作が必要
        print("\nデータコネクトクエリを手動で実行してください:")
        print("1. スプレッドシートを開く: https://docs.google.com/spreadsheets/d/1913pwtcPIZcQZBC6F6tp6_16itxjwOOVRkj6wS1B8-U/edit")
        print("2. 「データソース」シートを選択")
        print("3. データコネクトの「更新」ボタンをクリック")
        print("4. 「抽出データ」シートと「for_generator」シートの更新を確認")
        
        input("\n更新が完了したらEnterキーを押してください...")
        
    except Exception as e:
        print(f"スプレッドシート更新中にエラーが発生しました: {e}")
        print("手動でスプレッドシートを更新する必要があります")
        input("手動で更新完了したらEnterキーを押してください...")

def generate_kpi_tree_html(target_date):
    """KPIツリーHTMLを生成"""
    print(f"KPIツリーHTMLを生成しています... (日付: {target_date})")
    cmd = ["node", "src/generator.js", CONFIG_FILE, "--date", target_date]
    try:
        subprocess.run(cmd, check=True)
        
        # 生成されたHTMLを確認
        index_html = Path(OUTPUT_DIR) / "index.html"
        if not index_html.exists():
            print(f"エラー: {index_html} が生成されませんでした")
            sys.exit(1)
            
        # 日付確認
        with open(index_html, 'r') as f:
            content = f.read()
            
        # 年月日の表記に変換
        date_obj = datetime.strptime(target_date, '%Y-%m-%d')
        formatted_date = f"{date_obj.year}年{date_obj.month:02d}月{date_obj.day:02d}日"
        
        if f"現在のデータ: {formatted_date}" not in content:
            print(f"警告: 生成されたHTMLに正しい日付 ({formatted_date}) が含まれていません")
            print("内容を確認してください")
            proceed = input("続行しますか？(y/n): ")
            if proceed.lower() != 'y':
                sys.exit(1)
        
        print(f"HTMLファイルが生成されました: {index_html}")
        return index_html
    
    except subprocess.CalledProcessError as e:
        print(f"HTMLファイル生成中にエラーが発生しました: {e}")
        sys.exit(1)

def upload_to_gcs(html_file, target_date):
    """生成したHTMLファイルをGCSにアップロード"""
    print("GCSにアップロードしています...")
    
    # GCSへのアクセス権限を確認
    try:
        subprocess.run(["gsutil", "ls", GCS_BASE_PATH], 
                      stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    except subprocess.CalledProcessError:
        print("警告: GCSバケットへのアクセス権限がないか、認証が必要です")
        print("gcloud auth loginを実行して認証してください")
        sys.exit(1)
    
    # index.htmlアップロード
    print(f"メインのindex.htmlをアップロードしています: {GCS_BASE_PATH}/index.html")
    subprocess.run(["gsutil", "cp", str(html_file), f"{GCS_BASE_PATH}/index.html"], check=True)
    
    # 日付別レポートをアップロード
    yyyymmdd = target_date.replace('-', '')
    print(f"日付別レポートをアップロードしています: {GCS_BASE_PATH}/reports/{yyyymmdd}.html")
    subprocess.run(["gsutil", "cp", str(html_file), f"{GCS_BASE_PATH}/reports/{yyyymmdd}.html"], check=True)

def update_calendar_data(target_date):
    """カレンダーデータを更新"""
    print("カレンダーデータを更新しています...")
    
    # ファイルバックアップ
    calendar_file = Path(CALENDAR_DATA_FILE)
    backup_file = calendar_file.with_suffix(calendar_file.suffix + '.bak')
    subprocess.run(["cp", str(calendar_file), str(backup_file)], check=True)
    
    # JSONを読み込み
    with open(calendar_file, 'r') as f:
        calendar_data = json.load(f)
    
    # 日付が既に存在するかチェック
    if target_date in calendar_data['datesWithData']:
        print(f"日付 {target_date} は既にカレンダーデータに存在しています")
    else:
        # 日付を追加してソート
        calendar_data['datesWithData'].append(target_date)
        calendar_data['datesWithData'].sort()
        
        # ファイルに書き戻し
        with open(calendar_file, 'w') as f:
            json.dump(calendar_data, f, indent=2)
        
        print(f"カレンダーデータに日付 {target_date} を追加しました")
        
        # 更新したカレンダーデータをGCSにアップロード
        print("更新したカレンダーデータをGCSにアップロードしています...")
        subprocess.run(["gsutil", "cp", str(calendar_file), f"{GCS_BASE_PATH}/static/calendar-data.json"], check=True)

def main():
    """メイン処理"""
    parser = argparse.ArgumentParser(description='KPIツリー過去データ生成スクリプト')
    parser.add_argument('date', help='対象日付 (YYYY-MM-DD形式)')
    args = parser.parse_args()
    
    target_date = args.date
    
    # 引数の日付形式をチェック
    date_pattern = re.compile(r'^\d{4}-\d{2}-\d{2}$')
    if not date_pattern.match(target_date):
        print("エラー: 日付はYYYY-MM-DD形式で指定してください")
        sys.exit(1)
    
    # 依存関係チェック
    check_dependencies()
    
    print(f"========== KPIツリー過去データ生成 ({target_date}) ==========")
    
    # ディレクトリ作成
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # 1. スプレッドシートの更新
    print("\n1. スプレッドシートの更新")
    update_spreadsheet_sql(target_date)
    
    # 2. KPIツリーHTMLを生成
    print("\n2. KPIツリーHTML生成")
    html_file = generate_kpi_tree_html(target_date)
    
    # 3. GCSにアップロード
    print("\n3. GCSへのアップロード")
    upload_to_gcs(html_file, target_date)
    
    # 4. カレンダーデータを更新
    print("\n4. カレンダーデータの更新")
    update_calendar_data(target_date)
    
    print("\n========== 処理が完了しました ==========")
    print(f"ターゲット日付: {target_date}")
    print(f"GCS URL: {GCS_BASE_PATH}/index.html")
    print(f"日付別レポート: {GCS_BASE_PATH}/reports/{target_date.replace('-', '')}.html")
    print("カレンダーデータが更新されました")

if __name__ == "__main__":
    main()