FROM node:20-slim

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

VOLUME ["/app/config"]
VOLUME ["/app/output"]

# Default config is 'config' but can be overridden as docker run command argument
ENTRYPOINT ["node", "src/generator.js"]
CMD ["config"]