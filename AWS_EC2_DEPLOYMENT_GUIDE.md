# AWS EC2 배포 가이드 - FANS 프로젝트

## 📋 사전 준비사항

### 1. AWS EC2 인스턴스
- **인스턴스 타입**: t3.medium 이상 권장 (2 vCPU, 4GB RAM)
- **OS**: Ubuntu 22.04 LTS
- **스토리지**: 최소 30GB (AI 모델 포함 시 50GB 권장)
- **보안 그룹 설정**:
  - HTTP: 80 (0.0.0.0/0)
  - HTTPS: 443 (0.0.0.0/0)
  - SSH: 22 (관리자 IP만)
  - PostgreSQL: 5432 (선택사항, 내부망만)

### 2. 도메인 설정
- **도메인**: minwoo.shop
- **A 레코드**: EC2 Public IP 주소로 설정
- **TTL**: 300초 권장

## 🚀 배포 순서

### Step 1: EC2 인스턴스 접속 및 기본 설정

```bash
# SSH 접속
ssh -i your-key.pem ubuntu@<EC2-Public-IP>

# 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# 필수 패키지 설치
sudo apt install -y git curl wget vim net-tools
```

### Step 2: Docker & Docker Compose 설치

```bash
# Docker 설치
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 현재 사용자를 docker 그룹에 추가
sudo usermod -aG docker $USER

# Docker Compose 설치
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 재접속 (docker 그룹 권한 적용)
exit
# SSH 다시 접속

# 설치 확인
docker --version
docker-compose --version
```

### Step 3: 프로젝트 배포

```bash
# 홈 디렉토리로 이동
cd ~

# Git 저장소 클론 (또는 파일 업로드)
# Option 1: Git 사용
git clone <your-git-repo-url> FANS
cd FANS

# Option 2: 파일 직접 업로드 (로컬에서 실행)
# scp -i your-key.pem -r /home/minwoo/project/FANS ubuntu@<EC2-IP>:~/
```

### Step 4: 환경변수 설정

```bash
cd ~/FANS

# .env 파일 확인 (.env 파일이 이미 있는지 확인)
ls -la .env

# .env 파일 내용 확인 및 수정
vi .env

# 중요: 다음 항목들을 실제 값으로 변경
# - KAKAO_CLIENT_ID, KAKAO_CLIENT_SECRET
# - NAVER_CLIENT_ID, NAVER_CLIENT_SECRET
# - NAVER_SEARCH_CLIENT_ID, NAVER_SEARCH_CLIENT_SECRET
# - EMAIL_USER, EMAIL_PASSWORD
# - JWT_SECRET, SESSION_SECRET
```

### Step 5: Nginx 설정 선택

#### Option A: HTTP만 사용 (SSL 인증서 없을 때)

```bash
# HTTPS 설정 파일 비활성화
cd ~/FANS/backend/nginx/conf.d
mv minwoo.shop.conf minwoo.shop.conf.backup
mv minwoo.shop.http.conf minwoo.shop.conf

# 또는 심볼릭 링크 사용
rm minwoo.shop.conf
ln -s minwoo.shop.http.conf minwoo.shop.conf
```

#### Option B: HTTPS 사용 (Let's Encrypt SSL 인증서 발급)

```bash
# Certbot 설치
sudo apt install -y certbot

# SSL 인증서 발급 (웹서버 중지 필요)
sudo certbot certonly --standalone -d minwoo.shop -d www.minwoo.shop

# 인증서 파일 복사
sudo cp /etc/letsencrypt/live/minwoo.shop/fullchain.pem ~/FANS/backend/nginx/ssl/
sudo cp /etc/letsencrypt/live/minwoo.shop/privkey.pem ~/FANS/backend/nginx/ssl/
sudo chown -R $USER:$USER ~/FANS/backend/nginx/ssl/

# Nginx HTTPS 설정 활성화
cd ~/FANS/backend/nginx/conf.d
# minwoo.shop.conf 파일에서 SSL 관련 주석 제거
vi minwoo.shop.conf

# 다음 줄들의 주석(#) 제거:
# ssl_certificate /etc/nginx/ssl/fullchain.pem;
# ssl_certificate_key /etc/nginx/ssl/privkey.pem;
# ssl_protocols TLSv1.2 TLSv1.3;
# ssl_ciphers HIGH:!aNULL:!MD5;
# ssl_prefer_server_ciphers on;
```

### Step 6: OAuth Redirect URI 업데이트

**중요**: Kakao, Naver 개발자 콘솔에서 Redirect URI를 업데이트하세요.

#### Kakao OAuth (https://developers.kakao.com/)
1. 내 애플리케이션 선택
2. 제품 설정 > 카카오 로그인 > Redirect URI
3. 추가: `https://minwoo.shop/api/auth/kakao/callback`

#### Naver OAuth (https://developers.naver.com/)
1. 내 애플리케이션 선택
2. API 설정 > 로그인 오픈 API 서비스 환경 > Callback URL
3. 추가: `https://minwoo.shop/api/auth/naver/callback`

### Step 7: Docker 컨테이너 실행

```bash
cd ~/FANS

# 모든 서비스 빌드 및 실행
docker compose up -d --build

# 로그 확인
docker compose logs -f

# 특정 서비스 로그만 보기
docker compose logs -f nginx
docker compose logs -f main-api
docker compose logs -f frontend

# 컨테이너 상태 확인
docker ps
```

### Step 8: 서비스 동작 확인

```bash
# Nginx 상태 확인
curl http://localhost

# 백엔드 API 확인
curl http://localhost/api/health

# 도메인으로 확인
curl http://minwoo.shop
curl https://minwoo.shop  # SSL 설정 시
```

## 🔧 문제 해결

### 1. 포트가 이미 사용 중일 때

```bash
# 80번 포트 사용 중인 프로세스 확인
sudo lsof -i :80
sudo netstat -tulpn | grep :80

# Apache2가 실행 중이면 중지
sudo systemctl stop apache2
sudo systemctl disable apache2
```

### 2. 컨테이너가 시작되지 않을 때

```bash
# 특정 컨테이너 로그 확인
docker logs fans_nginx
docker logs fans_main_api
docker logs fans_postgres

# 컨테이너 재시작
docker restart fans_nginx
docker restart fans_main_api

# 모든 컨테이너 재시작
docker compose restart
```

### 3. 데이터베이스 연결 실패

```bash
# PostgreSQL 컨테이너 상태 확인
docker exec fans_postgres pg_isready -U fans_user

# 데이터베이스 접속 테스트
docker exec -it fans_postgres psql -U fans_user -d fans_db

# 연결 확인
\l  # 데이터베이스 목록
\dt # 테이블 목록
\q  # 종료
```

### 4. Nginx 설정 문법 확인

```bash
# Nginx 설정 파일 테스트
docker exec fans_nginx nginx -t

# Nginx 재로드
docker exec fans_nginx nginx -s reload
```

### 5. SSL 인증서 갱신

```bash
# 인증서 만료일 확인
sudo certbot certificates

# 수동 갱신
sudo certbot renew

# 자동 갱신 설정 (cron)
sudo crontab -e
# 다음 줄 추가: 매일 오전 2시에 인증서 갱신 시도
0 2 * * * certbot renew --quiet --post-hook "docker exec fans_nginx nginx -s reload"
```

## 📊 모니터링

### 컨테이너 리소스 사용량 확인

```bash
# 실시간 모니터링
docker stats

# 디스크 사용량
docker system df

# 로그 크기 확인
du -sh ~/FANS/backend/nginx/logs/*
```

### 로그 관리

```bash
# 로그 파일 크기 제한 (docker-compose.yml에 추가)
# logging:
#   driver: "json-file"
#   options:
#     max-size: "10m"
#     max-file: "3"

# 로그 삭제
docker compose logs --tail=0 -f > /dev/null  # 기존 로그 무시
```

## 🔄 업데이트 및 배포

### 코드 업데이트

```bash
cd ~/FANS

# Git 업데이트 (Option 1)
git pull origin main

# 파일 직접 업로드 (Option 2)
# scp -i your-key.pem -r /path/to/updated/files ubuntu@<EC2-IP>:~/FANS/

# 환경변수 변경사항 반영
vi .env

# 재빌드 및 재시작
docker compose down
docker compose up -d --build

# 또는 특정 서비스만 재빌드
docker compose up -d --build frontend
docker compose up -d --build main-api
```

### 무중단 배포 (Blue-Green)

```bash
# 새 이미지 빌드
docker compose build

# 순차적 재시작 (다운타임 최소화)
docker compose up -d --no-deps --build frontend
sleep 5
docker compose up -d --no-deps --build main-api
```

## 🔐 보안 설정

### 1. 방화벽 설정 (UFW)

```bash
# UFW 설치 및 활성화
sudo apt install -y ufw

# 기본 정책 설정
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 필요한 포트 열기
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS

# 활성화
sudo ufw enable

# 상태 확인
sudo ufw status verbose
```

### 2. SSH 보안 강화

```bash
# SSH 설정 파일 수정
sudo vi /etc/ssh/sshd_config

# 다음 설정 권장:
# PermitRootLogin no
# PasswordAuthentication no
# PubkeyAuthentication yes

# SSH 재시작
sudo systemctl restart sshd
```

### 3. 환경변수 보안

```bash
# .env 파일 권한 설정
chmod 600 ~/FANS/.env

# Git에서 .env 제외 확인
cat ~/FANS/.gitignore | grep .env
```

## 📈 성능 최적화

### 1. Docker 이미지 최적화

```bash
# 불필요한 이미지 삭제
docker image prune -a

# 빌드 캐시 정리
docker builder prune
```

### 2. Nginx 캐싱 설정

이미 `nginx/conf.d/minwoo.shop.conf`에 설정되어 있음:
- 정적 파일: 7일 캐시
- Gzip 압축 활성화

### 3. 로그 로테이션

```bash
# logrotate 설정 파일 생성
sudo vi /etc/logrotate.d/fans-nginx

# 내용:
# ~/FANS/backend/nginx/logs/*.log {
#     daily
#     rotate 7
#     compress
#     delaycompress
#     notifempty
#     create 0640 ubuntu ubuntu
#     sharedscripts
# }
```

## 🆘 긴급 복구

### 서비스 완전 재시작

```bash
cd ~/FANS

# 모든 컨테이너 중지 및 삭제
docker compose down

# 볼륨 포함 완전 삭제 (주의: 데이터베이스 삭제됨)
docker compose down -v

# 재시작
docker compose up -d --build
```

### 데이터베이스 백업

```bash
# 백업
docker exec fans_postgres pg_dump -U fans_user fans_db > backup_$(date +%Y%m%d_%H%M%S).sql

# 복원
docker exec -i fans_postgres psql -U fans_user fans_db < backup_20250102_120000.sql
```

## ✅ 배포 체크리스트

- [ ] EC2 인스턴스 생성 및 보안 그룹 설정
- [ ] 도메인 A 레코드 설정 (minwoo.shop → EC2 Public IP)
- [ ] Docker & Docker Compose 설치
- [ ] 프로젝트 파일 업로드
- [ ] .env 파일 실제 값으로 수정
- [ ] Kakao/Naver OAuth Redirect URI 업데이트
- [ ] SSL 인증서 발급 (선택사항)
- [ ] Nginx 설정 파일 선택 (HTTP 또는 HTTPS)
- [ ] Docker 컨테이너 실행
- [ ] 서비스 동작 확인
- [ ] 방화벽 설정 (UFW)
- [ ] 모니터링 및 로그 확인

## 📞 문제 발생 시

1. **로그 확인**: `docker compose logs -f`
2. **컨테이너 상태**: `docker ps -a`
3. **네트워크 확인**: `docker network inspect fans_fans_network`
4. **디스크 공간**: `df -h`
5. **메모리 사용량**: `free -h`

---

**배포 완료 후 접속 URL**: https://minwoo.shop (또는 http://minwoo.shop)
