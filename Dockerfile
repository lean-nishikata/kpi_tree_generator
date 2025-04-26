FROM node:20-slim

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# 出力ディレクトリとキーディレクトリを作成し、権限を設定
RUN mkdir -p /app/output && chmod 777 /app/output
RUN mkdir -p /app/keys && chmod 700 /app/keys

VOLUME ["/app/config"]
VOLUME ["/app/output"]
VOLUME ["/app/keys"]

# デフォルトは引数なしでnpm startを実行（package.jsonのscripts.startを使用）
ENTRYPOINT ["node", "src/generator.js"]
CMD ["config"]