FROM node:20-slim

# Puppeteer 의존성 설치
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

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
