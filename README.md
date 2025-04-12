# KPI ツリージェネレーター

YAMLファイル形式の設定から、HTML形式のKPIツリーを生成するためのツールです。Dockerで実行するよう設計されています。

## 特徴

- ノードと接続を持つKPIツリーの生成
- ノード間の演算記号（+, -, *, /）のサポート
- ノード内のテキストとハイパーリンク
- サブツリーの折りたたみ機能
- 折りたたみ状態の保存と記憶
- 縦向き・横向きレイアウトの切り替え

## Dockerでの使用方法

### クイックスタート

1. YAMLファイルを `config` ディレクトリに配置します（`config/example.yaml` を参考にしてください）
2. 次のコマンドを実行して特定の設定ファイルからHTMLを生成します：
   ```shell
   docker-compose run kpi-generator example
   ```
   （この例では `config/example.yaml` を使用します）
3. 生成されたHTMLファイルは `output/example.html` に保存されます

### 手動でビルドして実行

```shell
# Dockerイメージをビルド
docker build -t kpi-tree-generator .

# コンテナを実行（例：sales.yamlから生成）
docker run -v $(pwd)/config:/app/config -v $(pwd)/output:/app/output kpi-tree-generator sales
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

## ブラウザでの表示

生成されたHTMLファイルをブラウザで開くと、以下の機能が利用できます：

- **折りたたみ/展開**: 各ノードの下にある丸いボタンをクリックすると、サブツリーの折りたたみ/展開ができます
- **レイアウト切替**: 画面の右上にあるドロップダウンから、縦方向または横方向のレイアウトを選択できます
- **状態の保存**: 折りたたみ状態とレイアウト方向は自動的にlocalStorageに保存され、次回訪問時に復元されます

## カスタマイズ

- テーマを変更するには、YAMLファイルの `theme` パラメータを変更します（"default", "blue", "red"）
- ノードの色やサイズを変更する場合は、`static/style.css` ファイルをカスタマイズしてください