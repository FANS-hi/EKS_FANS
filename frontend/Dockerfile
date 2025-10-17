# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# package.json과 package-lock.json 복사
COPY package*.json ./

# 의존성 설치
RUN npm install

# 소스 코드 복사
COPY . .

# Production 빌드
RUN npm run build

# Production stage
FROM nginx:alpine

# 빌드된 파일을 nginx로 복사
COPY --from=builder /app/build /usr/share/nginx/html

# nginx 설정
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 포트 노출
EXPOSE 80

# nginx 시작
CMD ["nginx", "-g", "daemon off;"]
