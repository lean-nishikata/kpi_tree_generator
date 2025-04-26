FROM node:20-slim

WORKDIR /app

COPY package.json ./
RUN npm install

# 先に認証ディレクトリとファイルをコピー
COPY keys /app/keys
# 権限を設定（セキュリティのため、読み取り権限を制限）
RUN chmod -R 700 /app/keys

# その他のファイルをコピー
COPY . .

# 出力ディレクトリを作成し、権限を設定
RUN mkdir -p /app/output && chmod 777 /app/output

# 環境変数の設定
ENV GOOGLE_SERVICE_ACCOUNT_KEY_PATH=/app/keys/service-account-key.json

VOLUME ["/app/config"]
VOLUME ["/app/output"]
# keysディレクトリはイメージ内にあるものを使うため、VOLUMEは必要に応じて上書き

# デフォルトは引数なしでnpm startを実行（package.jsonのscripts.startを使用）
ENTRYPOINT ["node", "src/generator.js"]
CMD ["config"]