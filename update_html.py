import pandas as pd
from google.cloud import bigquery
from google.cloud import storage
from google.oauth2 import service_account
import gspread
from oauth2client.service_account import ServiceAccountCredentials
from pathlib import Path   # 追加：パス操作を安全に行う
import json
import argparse
import re
import numpy as np
import subprocess

# --- Optional dependency check for db-dtypes -----------------
try:
    import db_dtypes  # noqa: F401
    _HAS_DBDTYPES = True
except ImportError:
    _HAS_DBDTYPES = False
    print("[WARN] 'db-dtypes' package not installed. Falling back to manual DataFrame conversion. "
          "Install with: pip install db-dtypes")

# --- SQL をファイルから読み込む ------------------------------

# --- コマンドライン引数 -------------------------------------
parser = argparse.ArgumentParser(description="Run BigQuery report and export to Google Sheets")
parser.add_argument('--target_date', '--target-date', dest='target_date',
                    help="YYYY-MM-DD 形式で target_date を上書き")
parser.add_argument('--cred_file', default='keys/service-account-key.json',
                    help="サービスアカウント JSON のパス (デフォルト: keys/service-account-key.json)")
parser.add_argument('--yaml_file', default='yyyymmdd.yaml',
                    help="使用するYAMLファイル名 (デフォルト: yyyymmdd.yaml)")
parser.add_argument('--today', action='store_true',
                    help="ファイルをindex.htmlとしてGCSにアップロードするオプション")
args = parser.parse_args()

 # --- 認証ファイルパスを正規化 ---------------------------------
cred_path = Path(args.cred_file).expanduser().resolve()
if not cred_path.exists():
    raise FileNotFoundError(f'認証ファイルが見つかりません: {cred_path}')
SERVICE_ACCOUNT_FILE = str(cred_path)

# BigQuery クライアント
bq_credentials = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE,
    scopes=[
        "https://www.googleapis.com/auth/cloud-platform",
        "https://www.googleapis.com/auth/drive",
    ],
)
bq_client = bigquery.Client(
    credentials=bq_credentials,
    project=bq_credentials.project_id,
    location="asia-northeast1",  # 東京リージョンに合わせて明示
)

SQL_PATH = Path('sql/daily_kpi_tree_report.sql')
if not SQL_PATH.exists():
    raise FileNotFoundError(f'SQL ファイルが見つかりません: {SQL_PATH.resolve()}')

query_raw = SQL_PATH.read_text(encoding='utf-8')

# target_date を引数で上書きしたい場合、SET 行を書き換える
if args.target_date:
    pattern = r"SET\s+target_date\s*=\s*DATE\s*'[^']+';"
    replacement = f"SET target_date = DATE '{args.target_date}';"
    query = re.sub(pattern, replacement, query_raw)
else:
    query = query_raw

# --- BigQuery へクエリ実行 -----------------------------------
if _HAS_DBDTYPES:
    df = bq_client.query(query).to_dataframe()
else:
    # 手動で RowIterator から DataFrame へ変換（型は文字列化される可能性あり）
    rows = bq_client.query(query).result()
    df = pd.DataFrame([dict(row) for row in rows])

# --- Google Sheets 認証＆書き込み ----------------------------
scope = [
    'https://spreadsheets.google.com/feeds',
    'https://www.googleapis.com/auth/drive',
]
credentials = ServiceAccountCredentials.from_json_keyfile_name(SERVICE_ACCOUNT_FILE, scope)
gc = gspread.authorize(credentials)

SPREADSHEET_ID = '1ngQYtKC0cF9H89URP0CLDZRcABCaFPduQelECFByZWI'

# 既存スプレッドシートを ID で開く（アクセス権が無ければ付与してリトライ）
try:
    sh = gc.open_by_key(SPREADSHEET_ID)
except (gspread.exceptions.APIError, gspread.exceptions.PermissionError):
    # サービスアカウントのメールを取得して共有権限を付与
    service_email = credentials.service_account_email
    print(f"[INFO] Sharing spreadsheet with service account: {service_email}")
    # insert_permission(file_id, value, perm_type, role, notify=False)
    gc.insert_permission(SPREADSHEET_ID, service_email,
                         perm_type='user', role='writer', notify=False)
    # 共有設定後に再試行
    sh = gc.open_by_key(SPREADSHEET_ID)

# 「抽出データ」という名前のワークシートを取得（無ければ作成）
try:
    worksheet = sh.worksheet('抽出データ')
except gspread.exceptions.WorksheetNotFound:
    worksheet = sh.add_worksheet(title='抽出データ', rows=1, cols=1)

 # --- Data sanitization: replace NaN/Inf and prepare JSON‑safe values ----
df = df.replace([np.inf, -np.inf], np.nan)

# 数値カラムを明示的に float 化（シート側で数値として扱わせる）
numeric_cols = [
    'current_value',
    'prev_value',
    'mtd_value',
    'prev_mtd_todate_value',
    'prev_month_total_value',
]
for col in numeric_cols:
    if col in df.columns:
        df[col] = pd.to_numeric(df[col], errors='coerce')

# JSON に渡す前に object 型へキャストし、NaN/Inf を None に置換
df = df.astype(object).where(pd.notnull(df), None)

worksheet.clear()

# DataFrame を貼り付け
values = [df.columns.values.tolist()] + df.values.tolist()
worksheet.update(values)

print('✅ BigQuery の結果を Google スプレッドシートに書き込みました。')

# --- 後続処理: KPI ツリー静的サイト生成 -----------------------
if args.target_date:
    # Dockerの内部/外部を判断
    in_docker = Path('/.dockerenv').exists()
    
    if in_docker:
        # Docker内で実行している場合は直接実行
        cmd = [
            "node", "/app/src/generator.js", args.yaml_file,
            "--date", args.target_date
        ]
    else:
        # Docker外で実行している場合はdocker-composeを使用
        cmd = [
            "docker-compose", "run", "--rm",
            "kpi-generator", args.yaml_file,
            "--date", args.target_date
        ]
    
    print(f"[INFO] Running command: {' '.join(cmd)}")
    try:
        subprocess.run(cmd, check=True)
        # ファイルリネーム: output/yamlファイル名.html -> output/YYYYMMDD.html
        if args.target_date:
            # YAMLファイル名から拡張子を除去したベース名を取得
            yaml_base = Path(args.yaml_file).stem
            src_name = f"{yaml_base}.html"
            dst_name = f"{args.target_date.replace('-', '')}.html"
            src_path = Path("output") / src_name
            dst_path = Path("output") / dst_name
            if src_path.exists():
                try:
                    if dst_path.exists():
                        dst_path.unlink()  # 既存ファイルを削除して上書き
                    src_path.rename(dst_path)
                    print(f"[INFO] Renamed {src_path} -> {dst_path}")
                    # --- アップロード: GCS バケット ---------------
                    try:
                        storage_client = storage.Client.from_service_account_json(SERVICE_ACCOUNT_FILE)
                        bucket_name = "cc-data-platform-kpi-tree-viewer-prod"
                        bucket = storage_client.bucket(bucket_name)
                        
                        # 日付ごとのレポートとしてアップロード
                        blob_path = f"reports/{dst_name}"
                        blob = bucket.blob(blob_path)
                        blob.upload_from_filename(dst_path)
                        print(f"[INFO] Uploaded {dst_path} to gs://{bucket_name}/{blob_path}")
                        
                        # --today オプションが指定されていれば、index.htmlとしてもアップロード
                        if args.today:
                            index_blob_path = "index.html"  # ルートにindex.htmlとしてアップロード
                            index_blob = bucket.blob(index_blob_path)
                            index_blob.upload_from_filename(dst_path)
                            print(f"[INFO] Uploaded {dst_path} to gs://{bucket_name}/{index_blob_path} (as today's index)")
                    except Exception as gcs_err:
                        print(f"[ERROR] Failed to upload to GCS: {gcs_err}")
                except Exception as re_err:
                    print(f"[ERROR] Failed to rename file: {re_err}")
            else:
                print(f"[WARN] Expected output file not found: {src_path}")
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] Command failed with exit code {e.returncode}")
# --- Update static/calendar-data.json and upload to GCS -----------------
if args.target_date:
    cal_path = Path("static") / "calendar-data.json"
    # 既存ファイルを読み込み（無い場合は空の構造で開始）
    try:
        with cal_path.open("r", encoding="utf-8") as f:
            cal_data = json.load(f)
    except FileNotFoundError:
        cal_data = {"datesWithData": []}

    # datesWithData の健全性を確保
    if "datesWithData" not in cal_data or not isinstance(cal_data["datesWithData"], list):
        cal_data["datesWithData"] = []

    if args.target_date not in cal_data["datesWithData"]:
        cal_data["datesWithData"].append(args.target_date)
        cal_data["datesWithData"] = sorted(set(cal_data["datesWithData"]))  # ソート & 重複排除
        # ファイルへ書き戻し
        cal_path.parent.mkdir(parents=True, exist_ok=True)
        with cal_path.open("w", encoding="utf-8") as f:
            json.dump(cal_data, f, ensure_ascii=False, indent=2)
        print(f"[INFO] Added {args.target_date} to {cal_path}")
    else:
        print(f"[INFO] {args.target_date} already present in {cal_path}")

    # GCS へアップロード（上書き）
    try:
        storage_client = storage.Client.from_service_account_json(SERVICE_ACCOUNT_FILE)
        bucket_name = "cc-data-platform-kpi-tree-viewer-prod"
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob("static/calendar-data.json")
        blob.upload_from_filename(cal_path)
        print(f"[INFO] Uploaded {cal_path} to gs://{bucket_name}/static/calendar-data.json")
    except Exception as err:
        print(f"[ERROR] Failed to upload calendar-data.json to GCS: {err}")
else:
    print("[WARN] --target_date が指定されていないため後続処理をスキップしました。")
