FROM node:20-slim

WORKDIR /app

# Pythonとpipをインストール
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    python3-google-auth \
    python3-requests \
    jq \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Pythonのシンボリックリンクを作成（pythonコマンドでpython3を実行可能に）
RUN ln -s /usr/bin/python3 /usr/bin/python

# 仮想環境を作成し、その中にライブラリをインストール
RUN python3 -m venv /app/venv
ENV PATH="/app/venv/bin:$PATH"

# Python依存ライブラリをインストール
RUN /app/venv/bin/pip install --no-cache-dir \
    google-api-python-client \
    google-auth-httplib2 \
    google-auth-oauthlib

# Node.jsの依存関係のインストール
COPY package.json ./
RUN npm install

# 先に認証ディレクトリを作成
RUN mkdir -p /app/keys && chmod 700 /app/keys

# 空のダミーファイルを作成（認証失敗時の動作確認用）
RUN touch /app/keys/dummy-auth.json

# その他のファイルをコピー
COPY . .

# 権限を設定（セキュリティのため、読み取り権限を制限）
RUN chmod -R 700 /app/keys

# 出力ディレクトリを作成し、権限を設定
RUN mkdir -p /app/output && chmod 777 /app/output

# 環境変数の設定
ENV GOOGLE_SERVICE_ACCOUNT_KEY_PATH=/app/keys/service-account-key.json
ENV PYTHONUNBUFFERED=1

VOLUME ["/app/config"]
VOLUME ["/app/output"]
VOLUME ["/app/static"]
# keysディレクトリはイメージ内にあるものを使うため、VOLUMEは必要に応じて上書き

# デフォルトは引数なしでnpm startを実行（package.jsonのscripts.startを使用）
ENTRYPOINT ["node", "src/generator.js"]
CMD ["config"]