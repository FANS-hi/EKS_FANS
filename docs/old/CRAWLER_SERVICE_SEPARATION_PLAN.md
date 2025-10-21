# 크롤링 서비스 분리 및 Active-Active 클러스터 구축 계획

## 1. 개요

현재 백엔드 API 서버에 통합되어 있는 크롤링 서비스를 독립적인 마이크로서비스로 분리하고, Active-Active 구조의 이중화된 크롤러 클러스터를 구축하여 성능과 안정성을 향상시킵니다.

---

## 2. 현재 상황 분석

### 2.1 기존 구조
```
Backend API Server (Port 3000)
├── News Crawler Service (통합)
│   └── Naver API 크롤러 (검색 쿼리 기반)
├── Auth Service
├── News Feed Service
├── Market Summary Service
└── AI Integration Service
```

### 2.2 현재 크롤링 방식

**Naver API 크롤러**:
- 검색 쿼리를 통한 뉴스 수집
- 다양한 언론사의 최신 뉴스 획득 시도
- 필터링 후 실제 저장률: **16.7%**

**Puppeteer 크롤러**:
- Daum 뉴스 포털을 통한 동적 콘텐츠 크롤링
- 여러 언론사 기사를 통일된 형식으로 수집
- 3개 인스턴스로 시간차 분산 처리

### 2.3 핵심 문제점

1. **데이터 품질 문제**
   - Naver API: 원하는 언론사 필터링 불가
   - 지역/소규모 언론사 위주 결과
   - 실제 사용 가능한 기사 부족

2. **시스템 구조 문제**
   - API/Puppeteer 크롤러가 독립적으로 처리
   - 크롤링 문제 시 메인 API 서버에 영향
   - 단일 장애점으로 전체 서비스 중단 위험

---

## 3. 목표 아키텍처: API/Puppeteer 크롤러 클러스터

### 3.1 새로운 시스템 구조
```
┌─────────────────────────────────────────────────────────────┐
│                    FANS 시스템 아키텍처                      │
├─────────────────────────────────────────────────────────────┤
│  Frontend (Port 3001)                                       │
├─────────────────────────────────────────────────────────────┤
│  Backend API Server (Port 3000)                             │
│  ├── Auth Service                                           │
│  ├── News Feed Service                                      │
│  ├── Market Summary Service                                 │
│  └── AI Integration Service                                 │
├─────────────────────────────────────────────────────────────┤
│  Crawler Service Cluster                                    │
│  ├── API Crawler (Port 4003)                                │
│  ├── Puppeteer Crawler 1 (Port 4004)                        │
│  ├── Puppeteer Crawler 2 (Port 4004)                        │
│  └── Puppeteer Crawler 3 (Port 4004)                        │
├─────────────────────────────────────────────────────────────┤
│  AI Service (Port 8002)                                     │
│  └── Bias Analysis (편향성 분석)                            │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL Database (Port 5432)                            │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 크롤러별 설정

#### API 크롤러
```javascript
const API_CRAWLER_CONFIG = {
  type: 'NAVER_API',
  searchQuery: '최신 뉴스',
  interval: 300000,     // 5분
  maxResults: 100,      // API 최대 결과
  filterEnabled: true   // 품질 필터링
};
```

#### Puppeteer 크롤러
```javascript
const PUPPETEER_CRAWLER_CONFIG = {
  type: 'DAUM_NEWS',
  interval: 180000,          // 3분
  replicas: 3,               // 인스턴스 수
  browserPool: 5,            // 브라우저 풀 크기
  targetUrl: 'https://news.daum.net'
};
```

### 3.3 시간차 크롤링 전략
```
시간축: 0초        60초       120초      180초      240초
Puppeteer 1: ●                           ●
Puppeteer 2:         ●                           ●
Puppeteer 3:                   ●                           ●

간격: 3분 (180초)
지연: interval / replicas * index
```

---

## 4. 구현 계획

### 4.1 Phase 1: 크롤러 서비스 분리 (완료)
- [x] `backend/crawler` 디렉토리 생성
- [x] API/Puppeteer 크롤러 분리 구현
- [x] 환경변수 기반 설정
- [x] Docker 컨테이너화

### 4.2 Phase 2: Puppeteer 크롤러 클러스터 (완료)
- [x] 3개 Puppeteer 인스턴스 구성
- [x] 시간차 스케줄링 구현
- [x] 중복 방지 로직
- [x] 브라우저 풀링

### 4.3 Phase 3: 모니터링 시스템 (진행 예정)
- [ ] 헬스체크 엔드포인트
- [ ] 크롤링 통계 대시보드
- [ ] 장애 알림 시스템

---

## 5. Docker Compose 설정

```yaml
version: '3.8'

services:
  # API Crawler
  api-crawler:
    build:
      context: ./backend/crawler
      dockerfile: ./api-crawler/Dockerfile
    container_name: fans_api_crawler
    expose:
      - "4003"
    environment:
      - API_CRAWLER_PORT=${API_CRAWLER_PORT:-4003}
      - AUTO_CRAWL=${AUTO_CRAWL:-true}
      - CRAWL_INTERVAL_MINUTES=${CRAWL_INTERVAL_MINUTES:-5}
      - NAVER_SEARCH_CLIENT_ID=${NAVER_SEARCH_CLIENT_ID}
      - NAVER_SEARCH_CLIENT_SECRET=${NAVER_SEARCH_CLIENT_SECRET}
    depends_on:
      - postgres
      - bias-analysis-ai
    restart: unless-stopped

  # Puppeteer Crawlers
  puppeteer-crawler-1:
    build:
      context: ./backend/crawler
      dockerfile: ./puppeteer-crawler/Dockerfile
    container_name: fans_puppeteer_crawler_1
    expose:
      - "4004"
    environment:
      - PUPPETEER_CRAWLER_PORT=${PUPPETEER_CRAWLER_PORT:-4004}
      - AUTO_CRAWL=${AUTO_CRAWL:-true}
      - CRAWL_INTERVAL=${CRAWL_INTERVAL:-180000}
      - TOTAL_REPLICAS=${TOTAL_REPLICAS:-3}
      - REPLICA_INDEX=0
    depends_on:
      - postgres
    shm_size: '2gb'
    restart: unless-stopped

  puppeteer-crawler-2:
    build:
      context: ./backend/crawler
      dockerfile: ./puppeteer-crawler/Dockerfile
    container_name: fans_puppeteer_crawler_2
    environment:
      - REPLICA_INDEX=1
    restart: unless-stopped

  puppeteer-crawler-3:
    build:
      context: ./backend/crawler
      dockerfile: ./puppeteer-crawler/Dockerfile
    container_name: fans_puppeteer_crawler_3
    environment:
      - REPLICA_INDEX=2
    restart: unless-stopped
```

---

## 6. API 엔드포인트

### 6.1 크롤러 서비스 엔드포인트
```
GET  /health                    # 헬스체크
GET  /crawler/status            # 크롤링 상태
GET  /crawler/stats             # 크롤링 통계
POST /crawler/start             # 크롤링 시작
POST /crawler/stop              # 크롤링 중지
```

### 6.2 메인 API 프록시 엔드포인트
```
GET  /api/crawler/cluster/status   # 전체 클러스터 상태
GET  /api/crawler/cluster/stats    # 통합 통계
POST /api/crawler/cluster/control  # 클러스터 제어
```

---

## 7. 모니터링 및 관리

### 7.1 클러스터 상태 모니터링
```json
{
  "cluster_status": "healthy",
  "crawlers": {
    "api_crawler": {
      "type": "NAVER_API",
      "status": "active",
      "last_crawl": "2025-10-13T15:30:00Z",
      "success_rate": "16.7%"
    },
    "puppeteer_crawlers": [
      {
        "id": "puppeteer-1",
        "status": "active",
        "last_crawl": "2025-10-13T15:30:00Z",
        "replica_index": 0
      },
      {
        "id": "puppeteer-2",
        "status": "active",
        "last_crawl": "2025-10-13T15:31:00Z",
        "replica_index": 1
      },
      {
        "id": "puppeteer-3",
        "status": "active",
        "last_crawl": "2025-10-13T15:32:00Z",
        "replica_index": 2
      }
    ]
  },
  "statistics": {
    "total_articles_today": 1247,
    "api_articles": 150,
    "puppeteer_articles": 1097,
    "avg_crawl_time": "2.3s"
  }
}
```

### 7.2 알림 시스템
- 크롤러 인스턴스 다운 알림
- API 성공률 15% 미만 시 알림
- Puppeteer 크롤링 오류 발생 알림
- 데이터베이스 연결 실패 알림

---

## 8. 성능 개선 효과

### 8.1 예상 효과
| 항목 | 기존 | 개선 후 | 향상률 |
|------|------|---------|--------|
| 처리 속도 | 8분 | 2분 | 75% ↑ |
| 가용성 | 95% | 99.75% | 5% ↑ |
| 데이터 수집량 | 8개/분 | 50개/분 | 525% ↑ |
| 실시간성 | 30초 | 15초 | 2배 ↑ |

### 8.2 장애 대응
- **단일 Puppeteer 인스턴스 장애**: 나머지 인스턴스 독립 운영
- **API 크롤러 장애**: Puppeteer 크롤러 독립 운영
- **완전 복구**: 자동 재시작 (unless-stopped)

---

## 9. 개발 진행 현황 (2025-10-13)

### 9.1 완료된 작업 ✅
- Puppeteer 크롤러 구현 및 안정화
- Daum 뉴스 포털 동적 크롤링
- 3개 인스턴스 시간차 분산 처리
- AI 편향성 분석 서비스 통합
- API 크롤러 독립 분리
- Docker 컨테이너화 완료

### 9.2 제거된 기능 🗑️
- RSS 크롤러 (Puppeteer로 대체)

### 9.3 예정 📋
- 모니터링 대시보드
- 크롤링 통계 API
- 성능 메트릭 수집

---

## 10. 주요 의사결정 기록

### 10.1 카테고리 기반 → API/Puppeteer 기반 전환 (2025-09-24)

**문제점**:
- Naver API로 특정 언론사 필터링 불가
- 카테고리별 크롤링 시 데이터 절대량 부족
- 필터링 후 16.7%만 저장 가능

**해결책**:
- Naver API: 다양성 확보용 보조 수단
- Puppeteer 크롤러: Daum 뉴스 포털을 통한 동적 크롤링
- 시간차 분산 구조로 안정성 확보

### 10.2 RSS → Puppeteer 전환 결정 (2025-10-13)

**문제점**:
- RSS 크롤러의 제한적 데이터 수집
- SPA 사이트 처리의 한계

**해결책**:
- Puppeteer 크롤러 도입
- Daum 뉴스 포털 단일 크롤링으로 여러 언론사 커버
- 브라우저 풀링으로 성능 최적화

---

## 7. Puppeteer 크롤러 도입 (2025-10-01 추가)

### 7.1 도입 배경 및 전략 변경

**초기 계획 (폐기)**:
- ~~JTBC, 중앙일보, 한국일보 등 개별 언론사 사이트 직접 크롤링~~
- **문제점**: 각 언론사마다 HTML 구조 분석 필요, 유지보수 어려움

**최종 결정 (채택)**:
- **Daum 뉴스 포털 단일 크롤링 방식**
- Daum이 여러 언론사 기사를 통일된 형식으로 제공
- `.cp_name` 셀렉터로 원 언론사명 추출 가능

**Puppeteer 선택 이유**:
1. Daum 뉴스 동적 콘텐츠 렌더링 처리
2. 통일된 HTML 구조로 단일 파서만 필요
3. 브라우저 풀링으로 성능 최적화
4. 3개 인스턴스로 부하 분산

### 7.2 아키텍처

```
Puppeteer Crawler Service (Port 4004-4006)
├── Browser Pool (최대 5개 브라우저)
├── Site Parser
│   └── Daum Parser (단일 파서로 모든 언론사 처리)
│       ├── 제목 추출: h3.tit_view
│       ├── 본문 추출: div.article_view
│       ├── 원 언론사: .cp_name ⭐
│       └── 기자/날짜 추출
└── Auto-Crawling Scheduler (시간차 분산)
```

**크롤링 흐름**:
```
Daum 뉴스 섹션 페이지 접속
  ↓
기사 URL 목록 추출 (v.daum.net/v/*)
  ↓
각 기사 페이지 파싱
  ↓
원 언론사명(.cp_name) 추출 → 해당 언론사로 저장
  예: 서울신문, 경향신문, 연합뉴스, 한겨레 등
```

### 7.3 시간차 크롤링 전략 (개선)

**기존 계획** (문서 3.3):
```
시간축: 0초   15초   30초   45초   60초   75초   90초
A1:     ●            ●            ●            ●
A2:           ●            ●            ●
```

**실제 구현** (Puppeteer 크롤러):
```
시간축: 0초        60초       120초      180초      240초
인스턴스 0: ●                           ●
인스턴스 1:         ●                           ●
인스턴스 2:                   ●                           ●

간격: 3분 (180초)
지연: interval / replicas * index
```

### 7.4 구현 방식 (2가지 제공)

#### 방법 1: 환경변수 기반 (현재 활성화) ✅
```yaml
# docker-compose.yml
puppeteer-crawler-1:
  environment:
    - REPLICA_INDEX=0  # 0초 지연
    - CRAWL_INTERVAL=180000

puppeteer-crawler-2:
  environment:
    - REPLICA_INDEX=1  # 60초 지연

puppeteer-crawler-3:
  environment:
    - REPLICA_INDEX=2  # 120초 지연
```

**장점**:
- 완벽한 시간차 분산
- 정확한 부하 제어
- 예측 가능한 실행 패턴

**단점**:
- 인스턴스 추가 시 docker-compose.yml 수동 편집 필요
- 확장성 제한적

#### 방법 2: 랜덤 지연 (주석 처리됨)
```typescript
// 0 ~ (interval / totalReplicas) 사이 랜덤 지연
const startDelay = Math.floor(Math.random() * maxDelay);
```

**장점**:
- `docker-compose up -d --scale puppeteer-crawler=N` 자동 확장
- 설정 간편

**단점**:
- 완벽한 균등 분배 아님
- 실행 시간 예측 불가

### 7.5 전환 방법

**코드 전환** (`src/index.ts`):
```typescript
function startAutoCrawling(service: NewsCrawlerService): void {
  // 방법 1: 환경변수 기반
  startAutoCrawlingWithEnv(service);

  // 방법 2: 랜덤 지연 (주석 해제 시 사용)
  // startAutoCrawlingWithRandom(service);
}
```

**설정 전환** (`docker-compose.yml`):
```yaml
# 방법 1 → 방법 2 전환
# 1. puppeteer-crawler-1, 2, 3 주석 처리
# 2. puppeteer-crawler-random 주석 해제
```

### 7.6 성능 비교

| 크롤러 | 속도 | JavaScript 지원 | 타겟 언론사 수집 | 비용 |
|--------|------|----------------|-----------------|------|
| API Crawler | 빠름 | ✗ | 낮음 | 낮음 |
| RSS Crawler | 빠름 | ✗ | 낮음 | 낮음 |
| **Puppeteer Crawler** | **중간** | **✓** | **높음** | **중간** |

**병렬 처리 성능**:
- 단일 인스턴스: 100개 URL → 2~3분
- 3개 인스턴스: 300개 URL → 3~4분 (시간차 분산)
- 브라우저 풀: 최대 5개 동시 실행

### 7.7 운영 가이드

**기본 실행**:
```bash
docker-compose up -d puppeteer-crawler-1 puppeteer-crawler-2 puppeteer-crawler-3
```

**간격 조정**:
```bash
# .env 파일 수정
CRAWL_INTERVAL=300000  # 5분으로 변경
```

**인스턴스 추가** (방법 1 사용 시):
```yaml
# docker-compose.yml에 추가
puppeteer-crawler-4:
  environment:
    - REPLICA_INDEX=3
  ports:
    - "4007:4004"
```

**로그 확인**:
```bash
docker logs fans_puppeteer_crawler_1 | grep "Auto-Crawl\|Instance"
```

### 7.8 향후 계획

1. **AI 편향 분석 연동** (다음 단계)
   - 크롤링 완료 후 자동으로 AI 분석 요청
   - BiasAnalysis 테이블 자동 업데이트

2. **추가 언론사 확장**
   - 기타 언론사 파서 추가
   - 범용 파서 개발

3. **성능 모니터링**
   - 크롤링 성공/실패율 추적
   - 브라우저 풀 사용률 모니터링

---

**문서 버전**: v4.0
**최종 수정**: 2025-10-01
**다음 검토**: 2025-10-08