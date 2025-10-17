# FANS Database Schema Documentation

## 📁 스키마 파일 위치

### ✅ 실제 사용 중인 파일

#### 1. Docker 자동 실행 (프로덕션/EC2)
- **파일**: `backend/database/init.sql`
- **용도**: Docker Compose로 PostgreSQL 시작 시 자동 실행
- **테이블**: 14개 (users, sources, categories, keywords, news_articles, news_keywords, user_actions, bookmarks, comments, article_stats, ai_recommendations, bias_analysis, user_preferences, market_summary)
- **실행**: `docker-compose up -d` 시 자동

#### 2. 수동 실행 (로컬 개발)
- **파일**: `backend/api/src/database/schemas/01_create_tables.sql`
- **용도**: Docker 없이 로컬 PostgreSQL에 직접 스키마 생성
- **상태**: `backend/database/init.sql`과 동일
- **실행**: `npm run db:init` 또는 `npm run db:schema`

## 📦 TypeORM 엔티티

- **위치**: `backend/api/src/entities/`
- **상태**: 실제 DB 스키마와 100% 일치
- **파일**:
  - User.ts
  - Source.ts
  - Category.ts
  - Keyword.ts
  - NewsArticle.ts
  - NewsKeyword.ts
  - UserAction.ts
  - Bookmark.ts
  - Comment.ts
  - ArticleStat.ts
  - AIRecommendation.ts
  - BiasAnalysis.ts
  - UserPreference.ts
  - MarketSummary.ts

## 🛠️ 유틸리티 파일

### 테이블 초기화
- **파일**: `backend/database/reset_tables.sql`
- **용도**: 모든 테이블 DROP (개발 환경용)

### 초기 데이터
- **파일**: `backend/api/src/database/seeds/02_initial_data.sql`
- **용도**: 기본 카테고리, 언론사 등 초기 데이터 삽입
- **실행**: `npm run db:seed`

## 🔄 스키마 동기화 정책

### TypeORM Synchronize: ❌ 비활성화
```typescript
// backend/api/src/config/database.ts
synchronize: false  // 프로덕션 안전을 위해 완전 비활성화
```

### 스키마 변경 방법
1. `backend/database/init.sql` 수정
2. `backend/api/src/database/schemas/01_create_tables.sql` 동기화
3. TypeORM 엔티티 파일 수정
4. 마이그레이션 파일 생성 (선택)

## 📊 주요 테이블 구조

### news_articles (뉴스 기사)
- source_id: INTEGER (OID 기반, 14개 타겟 언론사)
- category_id: BIGINT
- 전문검색: search_vector (tsvector)

### bias_analysis (편향성 분석)
- bias_score: NUMERIC(3,2) - 단일 편향 점수
- political_leaning: VARCHAR(50) - 정치 성향 (문자열)
- confidence: NUMERIC(3,2) - 신뢰도
- analysis_data: JSONB - 추가 분석 데이터

### market_summary (증시 정보)
- market_type: VARCHAR(50) - 지수/환율/상품
- UNIQUE(market_type, name)
- volume, trading_value, high_value, low_value 포함

## ⚠️ 주의사항

1. **절대 직접 수정하지 마세요**:
   - 프로덕션 DB에 직접 ALTER TABLE 금지
   - 반드시 init.sql 수정 후 마이그레이션

2. **동기화 유지**:
   - init.sql 변경 시 → 01_create_tables.sql도 업데이트
   - 엔티티 파일도 함께 수정

3. **팀 협업**:
   - 데이터베이스 변경 시 팀원과 사전 협의
   - 기존 데이터와 호환성 검토 필수

## 📝 변경 이력

- 2025-09-20: 초기 스키마 생성 (13개 테이블)
- 2025-09-22: comments, market_summary 테이블 추가 (14개 테이블)
- 현재: 최종 안정화 버전
