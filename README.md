# KPI ツリージェネレーター

YAMLファイル形式の設定から、HTML形式のKPIツリーを生成するためのツールです。ローカルやDocker環境、Google Cloud Storageなどで利用できます。

## 特徴

- ノードと接続を持つKPIツリーの生成
- ノード間の演算記号（+, -, *, /）のサポート
- ノード内のテキストとハイパーリンク
- サブツリーの折りたたみ機能
- **日次・月次切替機能で異なる単位の数値を表示**
- **ツリーの折りたたみ状態と日次/月次表示を含む完全な状態をURLで共有可能**
- 特定ノードへのリンクの生成と共有
- スタンドアロンHTML形式によるCloud Storage等での簡単ホスティング
- **Googleスプレッドシートから値を取得する機能**

## 使用方法

### Dockerでの使用

```shell
docker-compose run kpi-generator index
```

### Googleスプレッドシートとの連携

#### イメージビルド時に認証情報を組み込む方法（推奨）

1. Google Cloud Platformでサービスアカウントを作成し、JSONキーをダウンロード
2. ダウンロードしたJSONキーを `keys/service-account-key.json` という名前で配置
3. Dockerイメージをビルド：
   ```shell
   docker-compose build
   ```
4. 連携したいGoogleスプレッドシートをサービスアカウントと共有（閲覧権限を付与）
5. YAMLファイルでスプレッドシート参照を指定（`config/spreadsheet-example.yaml` を参照）
6. 実行：
   ```shell
   docker-compose run --rm kpi-generator spreadsheet-example
   ```

#### 実行時に認証情報をマウントする方法

1. `docker-compose.yml` の以下の行のコメントを解除：
   ```yaml
   # - ./keys:/app/keys
   # - GOOGLE_SERVICE_ACCOUNT_KEY_PATH=/app/keys/service-account-key.json
   ```
2. Google Cloud Platformでサービスアカウントを作成し、JSONキーをダウンロード
3. ダウンロードしたJSONキーを `keys/service-account-key.json` という名前で配置
4. 実行：
   ```shell
   docker-compose run --rm kpi-generator spreadsheet-example
   ```

### Googleスプレッドシートの情報とセル値の確認

スプレッドシートの情報やセル値を確認するためのツールが含まれています。

1. スプレッドシートの基本情報を確認:
   ```shell
   make check-sheets id="あなたのスプレッドシートID"
   ```

2. 特定セルの値を確認:
   ```shell
   make check-value id="あなたのスプレッドシートID" range="シート名!A1"
   ```
   ※ シート名に空白や特殊文字が含まれる場合はダブルクォートで囲んでください
   例: `range="Sheet 1!A1"`

### 手動でビルドして実行

イメージビルド時に認証情報を含める場合：
```shell
# Dockerイメージをビルド
docker build -t kpi-tree-generator .

# コンテナを実行（例：sales.yamlから生成）
docker run -v $(pwd)/config:/app/config -v $(pwd)/output:/app/output kpi-tree-generator sales
```

実行時に認証情報をマウントする場合：
```shell
docker run -v $(pwd)/config:/app/config -v $(pwd)/output:/app/output -v $(pwd)/keys:/app/keys -e GOOGLE_SERVICE_ACCOUNT_KEY_PATH=/app/keys/service-account-key.json kpi-tree-generator sales
```

## 設定ファイルの指定

コマンドラインで設定ファイル名を指定できます（`.yaml` 拡張子は省略可能）:

```shell
docker run -v $(pwd)/config:/app/config -v $(pwd)/output:/app/output kpi-tree-generator my_tree
```

- 指定したファイル名（例：`my_tree`）を使って `config/my_tree.yaml` を探します
- 出力ファイルは自動的に `output/my_tree.html` になります
- ファイルが見つからない場合は、`example.yaml` がデフォルトとして使用されます

## 設定

設定ファイルは、次のようなYAML形式で作成します：

```yaml
title: "KPI ツリーの例"        # タイトル
theme: "default"              # テーマ（default, blue, red）
direction: "horizontal"       # レイアウト方向（horizontal または vertical）
public_url: "https://storage.cloud.google.com/my-bucket/kpi.html"  # 公開ホスティングURL

# ツリーのルートノード
root:
  text: "売上 (¥100M)"        # ノードのテキスト
  value: 500                  # 数値
  url: "https://example.com/revenue"  # オプションのリンク
  children:                   # 子ノード
    - text: "製品A"
      value: 300
      children:
        - text: "直販"
          value: 200
          operator: "+"       # 演算子（+, -, *, /）
        - text: "パートナー販売"
          value: 100
          operator: "+"
      operator: "+"
    - text: "製品B"
      value: 200
      children:
        - text: "地域X"
          value: 120
          operator: "+"
        - text: "地域Y"
          value: 80
          operator: "+"
      operator: "+"
```



## 付属の設定例

いくつかのサンプル設定ファイルが用意されています：

- `example.yaml` - 横向きのデフォルトテーマのKPIツリー
- `vertical_example.yaml` - 縦向きの赤テーマのKPIツリー
- `sales.yaml` - 縦向きの青テーマの売上ツリー
- `spreadsheet-example.yaml` - Googleスプレッドシートと連携する例

## ブラウザでの表示

生成されたHTMLファイルをブラウザで開くと、以下の機能が利用できます：

- **折りたたみ/展開**: 各ノードの下にある丸いボタンをクリックすると、サブツリーの折りたたみ/展開ができます
- **レイアウト切替**: 画面の右上にあるドロップダウンから、縦方向または横方向のレイアウトを選択できます
- **状態の保存**: 折りたたみ状態とレイアウト方向は自動的にlocalStorageに保存され、次回訪問時に復元されます

## カスタマイズ

- テーマを変更するには、YAMLファイルの `theme` パラメータを変更します（"default", "blue", "red"）
- ノードの色やサイズを変更する場合は、`static/style.css` ファイルをカスタマイズしてください

## Google Cloud Storage（GCS）での公開方法

生成したKPIツリーをGoogle Cloud Storageや他の静的ホスティングサービスで公開する方法です。

### 1. 準備と生成

1. YAML設定ファイルに `public_url` パラメータを設定

```yaml
title: "KPIツリー"
public_url: "https://storage.cloud.google.com/your-bucket/kpi.html"
root:
  # ツリーの定義
```

2. HTMLファイルの生成

```shell
node src/generator.js config/your-config.yaml
```

このコマンドにより `output/your-config.html` に単一のHTMLファイルが生成されます。

### 2. GCSへのアップロード

1. 生成されたHTMLファイルをGCSバケットにアップロード

```shell
gsutil cp output/your-config.html gs://your-bucket/kpi.html
```

2. ファイルを公開設定にする

```shell
gsutil acl ch -u AllUsers:R gs://your-bucket/kpi.html
```

### 3. 共有リンクの利用

これで、あなたのKPIツリーは以下の機能を備えたURLで共有できます：

- **ツリーの開閉状態を含むURL**: `https://storage.cloud.google.com/your-bucket/kpi.html#state=...`
- **特定ノードへのリンク**: `https://storage.cloud.google.com/your-bucket/kpi.html#state=...&node=...`

生成されたHTMLは以下の特徴を持ちます：

- スタンドアロンHTML: すべてのJSとCSSが埋め込まれているため、単一ファイルのみで動作
- リダイレクト対応: GCSが行うリダイレクト後もURLハッシュパラメータを保持
- 共有機能: 各ノードにアンカーリンク機能があり、クリックでそのノードへのリンクをコピー

### 注意点