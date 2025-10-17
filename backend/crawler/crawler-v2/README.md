# Unified News Crawler (통합 뉴스 크롤러 v2)

다음 뉴스(JSON 방식) + 네이버 뉴스(메타 방식)를 하나의 서비스로 통합한 크롤러입니다.

## 주요 기능

- **다중 파서 지원**: Daum (JSON), Naver (Meta)
- **자동 언론사 분류**: 주요 언론사 자동 인식, 기타 언론사는 "기타-" prefix
- **중복 크롤링 방지**: URL 및 제목 기반 중복 체크
- **스케일 아웃 지원**: 여러 인스턴스 동시 실행 가능 (섹션 기반 분산)
- **AI 연동**: 자동 요약 및 편향성 분석 (비동기)

## 환경변수

### 필수

- `DB_HOST`: PostgreSQL 호스트 (기본값: postgres)
- `DB_PORT`: PostgreSQL 포트 (기본값: 5432)
- `DB_USER`: 데이터베이스 사용자
- `DB_PASSWORD`: 데이터베이스 비밀번호
- `DB_NAME`: 데이터베이스 이름

### 크롤러 설정

- `UNIFIED_CRAWLER_PORT`: 크롤러 서비스 포트 (기본값: 4005)
- `AUTO_CRAWL`: 자동 크롤링 활성화 여부 (기본값: false)
  - `true`: 자동 크롤링 시작
  - `false`: 수동 실행 모드 (API 호출 필요)

- `CRAWL_INTERVAL_MINUTES`: 자동 크롤링 간격 (분 단위, 기본값: 30)
- `CRAWL_LIMIT_PER_SECTION`: 섹션당 크롤링할 기사 수 (기본값: 20)

### 스케일 아웃 설정 (선택)

여러 인스턴스를 동시에 실행할 때 사용합니다.

- `INSTANCE_ID`: 인스턴스 고유 ID (기본값: 0)
  - 0부터 시작하는 정수
  - 예: 0, 1, 2, ...

- `TOTAL_INSTANCES`: 전체 인스턴스 수 (기본값: 1)
  - 실행 중인 전체 크롤러 인스턴스 개수
  - 각 인스턴스는 전체 섹션을 `TOTAL_INSTANCES`로 나눠서 처리

**예시: 3개 인스턴스로 분산**

```bash
# 인스턴스 1
INSTANCE_ID=0 TOTAL_INSTANCES=3 UNIFIED_CRAWLER_PORT=4005 npm start

# 인스턴스 2
INSTANCE_ID=1 TOTAL_INSTANCES=3 UNIFIED_CRAWLER_PORT=4006 npm start

# 인스턴스 3
INSTANCE_ID=2 TOTAL_INSTANCES=3 UNIFIED_CRAWLER_PORT=4007 npm start
```

각 인스턴스는 섹션 URL을 해시하여 자신에게 할당된 섹션만 크롤링합니다.

## API 엔드포인트

### 헬스체크
```bash
GET /health
```

### 다음 뉴스 크롤링
```bash
POST /crawl/daum
Content-Type: application/json

{
  "limit": 20  # 섹션당 크롤링할 기사 수
}
```

### 네이버 뉴스 크롤링
```bash
POST /crawl/naver
Content-Type: application/json

{
  "limit": 20
}
```

### 전체 크롤링 (다음 + 네이버)
```bash
POST /crawl/all
Content-Type: application/json

{
  "limit": 20
}
```

### 크롤러 상태 조회
```bash
GET /status
```

## 로컬 실행

```bash
# 의존성 설치
npm install

# 환경변수 설정
export DB_HOST=localhost
export DB_USER=fans_user
export DB_PASSWORD=1234
export DB_NAME=fans_db

# 개발 모드 (자동 재시작)
npm run dev

# 프로덕션 모드
npm start
```

## 로컬 테스트

```bash
# 테스트 스크립트 실행 (5개씩만 크롤링)
DB_HOST=localhost npx tsx test-unified.ts
```

## Docker 실행

```bash
# 이미지 빌드
docker build -t unified-crawler:latest -f crawler-v2/Dockerfile .

# 컨테이너 실행
docker run -d \
  --name unified-crawler \
  -p 4005:4005 \
  -e DB_HOST=postgres \
  -e DB_USER=fans_user \
  -e DB_PASSWORD=1234 \
  -e DB_NAME=fans_db \
  -e AUTO_CRAWL=true \
  -e CRAWL_INTERVAL_MINUTES=30 \
  unified-crawler:latest
```

## 중복 방지 메커니즘

1. **URL 기반 중복 체크**: 동일 URL의 기사는 저장하지 않음
2. **제목 기반 최근 중복 체크**: 1시간 이내 동일 제목 기사는 저장하지 않음
3. **섹션 분산**: 여러 인스턴스 실행 시 각 인스턴스가 서로 다른 섹션 담당

## 주의사항

- AI 서비스(`summarize-ai`, `bias-analysis-ai`)가 없어도 크롤링은 정상 작동
- AI 요약/분석은 비동기로 실행되며 실패해도 크롤링은 계속됨
- Puppeteer는 Chrome/Chromium이 필요하므로 Docker 이미지에 포함됨
