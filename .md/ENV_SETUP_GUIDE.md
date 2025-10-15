# FANS 프로젝트 환경변수 설정 가이드

## 🔧 환경변수 통합 완료

이 프로젝트의 모든 환경변수는 **루트 디렉토리의 `.env` 파일 하나**에서 관리됩니다.

## 📋 수정된 주요 사항

### 1. **CRITICAL 버그 수정 (504 에러 원인)**

#### ✅ AI Service URL 수정
**파일**: `backend/api/src/services/aiService.ts:18`
```typescript
// 수정 전: this.baseURL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
// 수정 후: this.baseURL = process.env.AI_SERVICE_URL || 'http://summarize-ai:8000';
```
**이유**: Docker 환경에서 localhost 대신 서비스 이름을 사용해야 함

#### ✅ Database Host 수정
**파일**: `backend/api/src/config/database.ts:33`
```typescript
// 수정 전: host: process.env.DB_HOST || 'localhost',
// 수정 후: host: process.env.DB_HOST || 'postgres',
```
**이유**: Docker 환경에서 PostgreSQL 컨테이너 이름 사용

**파일**: `backend/crawler/shared/config/database.ts:9,13`
```typescript
// DB_HOST 수정
host: process.env.DB_HOST || 'postgres',

// DB_DATABASE -> DB_NAME 변수명 통일
database: process.env.DB_NAME || 'fans_db',
```

#### ✅ CORS 설정 동적화
**파일**: `backend/api/src/app.ts:31-36`
```typescript
// 수정 전: origin: ['http://localhost:3000', 'http://localhost:3001'],
// 수정 후: 환경변수 CORS_ALLOWED_ORIGINS 사용
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:3000', 'http://localhost:3001'];
```

#### ✅ Naver API 환경변수명 통일
**파일**: `backend/crawler/api-crawler/src/services/newsCrawlerService.ts:44-45`
```typescript
// 수정 전: NAVER_CLIENT_ID, NAVER_CLIENT_SECRET
// 수정 후: NAVER_SEARCH_CLIENT_ID, NAVER_SEARCH_CLIENT_SECRET
```
**이유**: `.env` 파일의 변수명과 통일

### 2. **docker-compose.yml 환경변수 명시 추가**

**파일**: `docker-compose.yml` - API Crawler 서비스
```yaml
environment:
  # 기존
  - API_CRAWLER_PORT=${API_CRAWLER_PORT:-4003}
  - AUTO_CRAWL=${AUTO_CRAWL:-true}
  - CRAWL_INTERVAL_MINUTES=${CRAWL_INTERVAL_MINUTES:-5}
  - CRAWL_LIMIT_PER_CATEGORY=${CRAWL_LIMIT_PER_CATEGORY:-5}
  # 추가
  - NAVER_SEARCH_CLIENT_ID=${NAVER_SEARCH_CLIENT_ID}
  - NAVER_SEARCH_CLIENT_SECRET=${NAVER_SEARCH_CLIENT_SECRET}
  - NAVER_CLIENT_ID_2=${NAVER_CLIENT_ID_2}
  - NAVER_CLIENT_SECRET_2=${NAVER_CLIENT_SECRET_2}
```

### 3. **중복 파일 제거**

- ❌ 삭제: `backend/database/docker-compose.yml` (중복)
- ✅ 사용: 루트의 `docker-compose.yml` 하나만 사용

### 4. **보안 강화**

**파일**: `backend/api/src/services/emailService.ts`
- 하드코딩된 이메일 인증정보 제거
- 환경변수 미설정시 명확한 에러 발생

## 🚀 사용 방법

### 1. `.env` 파일 설정

```bash
# .env.example을 복사하여 .env 파일 생성
cp .env.example .env

# .env 파일을 열어 실제 값으로 수정
vi .env
```

### 2. 필수 환경변수 설정

최소한 다음 항목들은 **반드시** 실제 값으로 변경해야 합니다:

```bash
# 보안 관련 (강력한 랜덤 문자열 사용)
JWT_SECRET=your-strong-random-string-here
SESSION_SECRET=your-strong-random-string-here

# OAuth (실제 발급받은 키)
KAKAO_CLIENT_ID=실제-카카오-클라이언트-ID
KAKAO_CLIENT_SECRET=실제-카카오-시크릿
NAVER_CLIENT_ID=실제-네이버-클라이언트-ID
NAVER_CLIENT_SECRET=실제-네이버-시크릿

# Naver Search API (뉴스 크롤링용, 2세트 권장)
NAVER_SEARCH_CLIENT_ID=실제-네이버-검색-API-ID
NAVER_SEARCH_CLIENT_SECRET=실제-네이버-검색-API-시크릿
NAVER_CLIENT_ID_2=실제-네이버-검색-API-ID-2
NAVER_CLIENT_SECRET_2=실제-네이버-검색-API-시크릿-2

# 이메일 서비스 (Gmail SMTP)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-gmail-app-password
```

### 3. Docker Compose 실행

```bash
cd /home/minwoo/project/FANS

# 모든 서비스 빌드 및 실행
docker-compose up -d --build

# 로그 확인
docker-compose logs -f

# 특정 서비스 로그만 보기
docker-compose logs -f main-api
docker-compose logs -f summarize-ai
```

### 4. 환경변수 로딩 확인

```bash
# 컨테이너 내부의 환경변수 확인
docker exec fans_main_api printenv | grep -E "^(DB_|JWT_|AI_SERVICE_)"

# 데이터베이스 연결 확인
docker exec fans_main_api printenv | grep DB_

# API 키 확인 (일부만 표시)
docker exec fans_api_crawler printenv | grep NAVER
```

## 📊 환경변수 구조

```
/home/minwoo/project/FANS/
├── .env                  ← 모든 환경변수 통합 (실제 값)
├── .env.example          ← 환경변수 템플릿
├── docker-compose.yml    ← .env 파일 참조
└── backend/
    ├── api/              ← .env의 변수들 사용
    ├── crawler/          ← .env의 변수들 사용
    └── ai/               ← .env의 변수들 사용
```

## ⚠️ 주의사항

### 1. `.env` 파일 위치
- **반드시** 루트 디렉토리 (`/home/minwoo/project/FANS/.env`)에 있어야 함
- Git에 커밋하지 않도록 `.gitignore`에 포함되어 있음

### 2. Docker 네트워킹
- 서비스 간 통신은 **컨테이너 이름** 사용:
  - `postgres` (데이터베이스)
  - `summarize-ai` (AI 요약 서비스)
  - `bias-analysis-ai` (편향 분석 서비스)
  - `main-api` (백엔드 API)
- `localhost`는 사용하지 않음

### 3. 포트 매핑
```
호스트:컨테이너
3000:3000   → main-api (백엔드 API)
3001:3001   → frontend (프론트엔드)
4002:4002   → rss-crawler
4003:4003   → api-crawler
4004:4004   → puppeteer-crawler-1
4005:4004   → puppeteer-crawler-2
4006:4004   → puppeteer-crawler-3
5432:5432   → postgres (데이터베이스)
8000:8000   → summarize-ai (AI 요약)
8002:8002   → bias-analysis-ai (편향 분석)
```

## 🐛 트러블슈팅

### 504 Gateway Timeout 에러
**원인**: AI 서비스 연결 실패
**해결**:
1. `.env` 파일이 루트에 있는지 확인
2. `AI_SERVICE_URL=http://summarize-ai:8000` 설정 확인
3. AI 서비스 컨테이너 상태 확인: `docker ps | grep summarize-ai`
4. AI 서비스 로그 확인: `docker logs fans_summarize_ai`

### 데이터베이스 연결 실패
**원인**: DB 호스트 설정 오류
**해결**:
1. `.env` 파일에 `DB_HOST=postgres` 설정 확인
2. PostgreSQL 컨테이너 상태 확인: `docker ps | grep postgres`
3. 연결 테스트: `docker exec fans_postgres pg_isready -U fans_user`

### Naver API 크롤링 실패
**원인**: API 키 미설정 또는 환경변수명 불일치
**해결**:
1. `.env` 파일에 `NAVER_SEARCH_CLIENT_ID`, `NAVER_SEARCH_CLIENT_SECRET` 설정
2. API 크롤러 로그 확인: `docker logs fans_api_crawler`
3. 환경변수 로딩 확인: `docker exec fans_api_crawler printenv | grep NAVER`

### CORS 에러
**원인**: 허용된 Origin 설정 오류
**해결**:
1. `.env` 파일에 `CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001` 설정
2. 프론트엔드 URL과 일치하는지 확인
3. API 재시작: `docker-compose restart main-api`

## 📝 환경변수 전체 목록

### Core Service
- `NODE_ENV` - 환경 모드 (development/production)
- `PORT` - API 서버 포트 (기본: 3000)

### Database
- `DB_HOST` - 데이터베이스 호스트 (Docker: postgres)
- `DB_PORT` - 데이터베이스 포트 (기본: 5432)
- `DB_USERNAME` - 데이터베이스 사용자명
- `DB_PASSWORD` - 데이터베이스 비밀번호
- `DB_NAME` - 데이터베이스 이름
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` - PostgreSQL Docker 설정

### OAuth & External APIs
- `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`, `KAKAO_REDIRECT_URI`
- `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `NAVER_REDIRECT_URI`
- `NAVER_SEARCH_CLIENT_ID`, `NAVER_SEARCH_CLIENT_SECRET` - 뉴스 크롤링용
- `NAVER_CLIENT_ID_2`, `NAVER_CLIENT_SECRET_2` - 로드밸런싱용

### AI Services
- `AI_SERVICE_URL` - AI 요약 서비스 URL
- `SUMMARIZE_AI_URL`, `BIAS_AI_URL` - 개별 AI 서비스 URL
- `SUMMARIZE_AI_PORT`, `BIAS_ANALYSIS_AI_PORT` - AI 서비스 포트
- `MODEL_NAME`, `MAX_SUMMARY_LENGTH` - AI 모델 설정

### Crawler Services
- `RSS_CRAWLER_PORT`, `API_CRAWLER_PORT`, `PUPPETEER_CRAWLER_PORT`
- `AUTO_CRAWL`, `CRAWL_INTERVAL`, `CRAWL_INTERVAL_MINUTES`
- `CRAWL_LIMIT_PER_CATEGORY` - 카테고리당 크롤링 제한
- `TOTAL_REPLICAS`, `REPLICA_INDEX` - Puppeteer 크롤러 로드밸런싱

### Frontend
- `FRONTEND_URL` - 프론트엔드 URL
- `CORS_ALLOWED_ORIGINS` - CORS 허용 Origin
- `REACT_APP_API_BASE`, `REACT_APP_API_URL`, `REACT_APP_AI_SERVICE_URL`

### Security
- `JWT_SECRET` - JWT 토큰 시크릿
- `SESSION_SECRET` - 세션 시크릿

### Email Service
- `EMAIL_USER` - SMTP 사용자 (Gmail)
- `EMAIL_PASSWORD` - Gmail 앱 비밀번호

### Optional
- `REDIS_URL` - Redis 연결 URL (미구현)
- `LOG_LEVEL` - 로그 레벨 (debug, info, warn, error)

## ✅ 환경변수 통합 완료 체크리스트

- [x] 모든 환경변수를 `.env` 파일 하나로 통합
- [x] `docker-compose.yml`이 `.env` 참조하도록 수정
- [x] 중복 `docker-compose.yml` 파일 제거
- [x] 하드코딩된 값들을 환경변수로 교체
- [x] Docker 환경에 맞게 fallback 값 수정
- [x] 환경변수명 통일 (DB_DATABASE → DB_NAME)
- [x] Naver API 환경변수명 통일
- [x] 보안 취약점 제거 (하드코딩된 인증정보)
- [x] CORS 설정 동적화

---

**작성일**: 2025-10-02
**최종 수정**: 환경변수 통합 및 504 에러 수정 완료
