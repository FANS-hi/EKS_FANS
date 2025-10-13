# 🚀 AWS EC2 배포 준비 완료 - 변경 사항 요약

## ✅ 완료된 작업

### 1. **환경변수 설정 (.env)**
- ✅ `localhost` → `minwoo.shop` 도메인으로 변경
- ✅ `FRONTEND_URL`: https://minwoo.shop
- ✅ `CORS_ALLOWED_ORIGINS`: https://minwoo.shop,http://minwoo.shop
- ✅ `KAKAO_REDIRECT_URI`: https://minwoo.shop/api/auth/kakao/callback
- ✅ `NAVER_REDIRECT_URI`: https://minwoo.shop/api/auth/naver/callback

### 2. **Docker Compose 설정 (docker-compose.yml)**
- ✅ 모든 서비스 포트를 `expose`로 변경 (내부 통신만)
- ✅ Nginx 리버스 프록시 서비스 추가 (80, 443 포트)
- ✅ AWS EC2 환경에 최적화된 네트워크 구성

### 3. **Nginx 설정 파일**
생성된 파일:
- ✅ `backend/nginx/nginx.conf` - 메인 설정
- ✅ `backend/nginx/conf.d/minwoo.shop.conf` - HTTPS 전용 (SSL 인증서 필요)
- ✅ `backend/nginx/conf.d/minwoo.shop.http.conf` - HTTP 전용 (SSL 없이 시작)

라우팅 설정:
- `/` → Frontend (React, 3001)
- `/api/` → Backend API (3000)
- `/uploads/` → Static Files (3000)
- `/ai/` → AI Service (8000)

### 4. **코드 수정**
수정된 파일:
- ✅ `frontend/src/services/api.js` - API URL 동적 설정
- ✅ `frontend/src/components/SocialLogin.js` - fallback URL 수정
- ✅ `backend/api/src/app.ts` - 로그 메시지 개선

### 5. **배포 가이드 문서**
- ✅ `AWS_EC2_DEPLOYMENT_GUIDE.md` - 상세한 단계별 배포 가이드
- ✅ 문제 해결, 보안 설정, 모니터링 방법 포함

## 📋 배포 전 확인사항

### 필수 작업 (반드시 해야 함)

#### 1. OAuth Redirect URI 업데이트
**Kakao 개발자 콘솔** (https://developers.kakao.com/)
```
기존: http://localhost:3000/api/auth/kakao/callback
변경: https://minwoo.shop/api/auth/kakao/callback
```

**Naver 개발자 콘솔** (https://developers.naver.com/)
```
기존: http://localhost:3000/api/auth/naver/callback
변경: https://minwoo.shop/api/auth/naver/callback
```

#### 2. .env 파일 실제 값 확인
다음 항목들이 실제 값으로 설정되어 있는지 확인:
- ✅ `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`
- ✅ `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`
- ✅ `NAVER_SEARCH_CLIENT_ID`, `NAVER_SEARCH_CLIENT_SECRET`
- ✅ `NAVER_CLIENT_ID_2`, `NAVER_CLIENT_SECRET_2`
- ✅ `EMAIL_USER`, `EMAIL_PASSWORD`
- ✅ `JWT_SECRET`, `SESSION_SECRET`

#### 3. 도메인 DNS 설정
```
도메인: minwoo.shop
타입: A 레코드
값: <EC2 Public IP>
TTL: 300
```

#### 4. EC2 보안 그룹 설정
```
HTTP:  포트 80  - 0.0.0.0/0
HTTPS: 포트 443 - 0.0.0.0/0
SSH:   포트 22  - 관리자 IP만
```

## 🚀 빠른 배포 순서

### EC2에서 실행할 명령어

```bash
# 1. 프로젝트 업로드 (로컬에서)
scp -i your-key.pem -r /home/minwoo/project/FANS ubuntu@<EC2-IP>:~/

# 2. EC2 접속
ssh -i your-key.pem ubuntu@<EC2-IP>

# 3. Docker 설치
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# 4. Docker Compose 설치
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 5. 재접속 (docker 그룹 적용)
exit
ssh -i your-key.pem ubuntu@<EC2-IP>

# 6. 프로젝트 디렉토리로 이동
cd ~/FANS

# 7. Nginx 설정 선택
# Option A: HTTP만 사용 (SSL 없음)
cd backend/nginx/conf.d
rm minwoo.shop.conf
ln -s minwoo.shop.http.conf minwoo.shop.conf

# Option B: HTTPS 사용 (SSL 인증서 발급 후)
# SSL 인증서 발급 과정은 AWS_EC2_DEPLOYMENT_GUIDE.md 참고

# 8. 서비스 시작
cd ~/FANS
docker compose up -d --build

# 9. 로그 확인
docker compose logs -f
```

## 🔍 배포 후 확인

### 1. 서비스 상태 확인
```bash
docker ps  # 모든 컨테이너 실행 중인지 확인
```

예상 출력:
```
fans_nginx               (80, 443 포트)
fans_frontend            (3001 내부 포트)
fans_main_api            (3000 내부 포트)
fans_postgres            (5432 내부 포트)
fans_summarize_ai        (8000 내부 포트)
fans_bias_analysis_ai    (8002 내부 포트)
fans_rss_crawler         (4002 내부 포트)
fans_api_crawler         (4003 내부 포트)
fans_puppeteer_crawler_1 (4004 내부 포트)
fans_puppeteer_crawler_2 (4004 내부 포트)
fans_puppeteer_crawler_3 (4004 내부 포트)
```

### 2. 웹사이트 접속
```
HTTP:  http://minwoo.shop
HTTPS: https://minwoo.shop (SSL 설정 후)
```

### 3. API 동작 확인
```bash
# 헬스 체크
curl http://minwoo.shop/api/health

# 마켓 요약
curl http://minwoo.shop/api/market/summary

# 카테고리 목록
curl http://minwoo.shop/api/common/categories
```

## 🔧 주요 설정 파일 위치

```
FANS/
├── .env                                    # 환경변수 (실제 값 포함)
├── docker-compose.yml                      # Docker 서비스 구성
├── backend/
│   └── nginx/
│       ├── nginx.conf                     # Nginx 메인 설정
│       ├── conf.d/
│       │   ├── minwoo.shop.conf          # HTTPS 설정
│       │   └── minwoo.shop.http.conf     # HTTP 설정
│       ├── ssl/                           # SSL 인증서 저장
│       └── logs/                          # Nginx 로그
├── AWS_EC2_DEPLOYMENT_GUIDE.md            # 상세 배포 가이드
└── DEPLOYMENT_SUMMARY.md                  # 이 파일
```

## ⚠️ 중요 보안 사항

### 1. 환경변수 보안
```bash
# .env 파일 권한 설정
chmod 600 ~/FANS/.env

# Git에 절대 커밋하지 않기
echo ".env" >> .gitignore
```

### 2. 방화벽 설정
```bash
# UFW 설치 및 설정
sudo apt install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 3. SSH 키 기반 인증 사용
- PasswordAuthentication 비활성화
- 루트 로그인 비활성화

## 📊 모니터링

### 실시간 로그 확인
```bash
# 전체 로그
docker compose logs -f

# 특정 서비스
docker compose logs -f nginx
docker compose logs -f main-api
docker compose logs -f frontend
```

### 리소스 사용량
```bash
docker stats
```

### 디스크 사용량
```bash
df -h
docker system df
```

## 🔄 업데이트 방법

### 코드 업데이트
```bash
cd ~/FANS

# 파일 업데이트 (scp 또는 git pull)
scp -i your-key.pem -r /path/to/updated/files ubuntu@<EC2-IP>:~/FANS/

# 재빌드 및 재시작
docker compose down
docker compose up -d --build
```

### 무중단 배포
```bash
# 프론트엔드만 업데이트
docker compose up -d --no-deps --build frontend

# API만 업데이트
docker compose up -d --no-deps --build main-api
```

## 🆘 문제 해결

### 1. 컨테이너가 시작되지 않을 때
```bash
docker compose logs <service-name>
docker compose restart <service-name>
```

### 2. 포트 충돌
```bash
# 80번 포트 사용 중인 프로세스 확인
sudo lsof -i :80
sudo systemctl stop apache2  # Apache 실행 중이면
```

### 3. 데이터베이스 연결 실패
```bash
docker exec fans_postgres pg_isready -U fans_user
docker logs fans_postgres
```

### 4. Nginx 설정 오류
```bash
docker exec fans_nginx nginx -t
docker logs fans_nginx
```

## 📞 추가 지원

- **상세 가이드**: `AWS_EC2_DEPLOYMENT_GUIDE.md` 참고
- **환경변수 가이드**: `ENV_SETUP_GUIDE.md` 참고
- **로그 위치**: `~/FANS/backend/nginx/logs/`

## ✅ 최종 체크리스트

배포 전:
- [ ] .env 파일 실제 값 확인
- [ ] Kakao OAuth Redirect URI 업데이트
- [ ] Naver OAuth Redirect URI 업데이트
- [ ] DNS A 레코드 설정 (minwoo.shop → EC2 IP)
- [ ] EC2 보안 그룹 설정 (80, 443 포트 오픈)

배포:
- [ ] Docker & Docker Compose 설치
- [ ] 프로젝트 파일 업로드
- [ ] Nginx 설정 선택 (HTTP 또는 HTTPS)
- [ ] Docker 컨테이너 실행
- [ ] 서비스 동작 확인

배포 후:
- [ ] 웹사이트 접속 확인
- [ ] API 동작 확인
- [ ] 로그인/소셜 로그인 테스트
- [ ] 방화벽 설정 (UFW)
- [ ] SSL 인증서 발급 (선택)

---

**배포 완료 후 접속 URL**: https://minwoo.shop

**작성일**: 2025-10-02
**환경**: AWS EC2 Ubuntu 22.04 LTS
