FROM node:20-slim

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# 出力ディレクトリを作成し、権限を設定
RUN mkdir -p /app/output && chmod 777 /app/output

VOLUME ["/app/config"]
VOLUME ["/app/output"]

# Default config is 'config' but can be overridden as docker run command argument
ENTRYPOINT ["node", "src/generator.js"]
CMD ["config"]