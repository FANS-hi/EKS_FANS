# AI Worker Dockerfile
# SQS에서 AI 작업을 처리하는 워커 서비스

FROM node:18-alpine AS builder

WORKDIR /app

# 패키지 파일 복사 및 의존성 설치
COPY package*.json ./
RUN npm ci

# 소스 코드 복사 및 빌드
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Production 이미지
FROM node:18-alpine

WORKDIR /app

# 프로덕션 의존성만 설치
COPY package*.json ./
RUN npm ci --production

# 빌드된 파일 복사
COPY --from=builder /app/dist ./dist

# 환경 변수
ENV NODE_ENV=production
ENV AWS_REGION=ap-northeast-2

# Worker 실행
CMD ["node", "dist/index.js"]
