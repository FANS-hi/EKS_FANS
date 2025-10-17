FROM node:20-alpine

# Puppeteer 의존성 설치
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    curl

# Puppeteer가 chromium을 다운로드하지 않도록 설정
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# shared 복사
COPY shared ./shared

# crawler-v2 복사
COPY crawler-v2/package*.json ./crawler-v2/
RUN cd crawler-v2 && npm install

COPY crawler-v2 ./crawler-v2

# 환경변수 기본값
ENV NODE_ENV=production
ENV UNIFIED_CRAWLER_PORT=4005
ENV AUTO_CRAWL=false
ENV NODE_PATH=/app/crawler-v2/node_modules

WORKDIR /app/crawler-v2

CMD ["npx", "tsx", "index.ts"]
