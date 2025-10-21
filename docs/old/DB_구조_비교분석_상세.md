# FANS 프로젝트 DB 구조 비교 분석 보고서

## 📊 비교 개요
- **원본 구조**: 처음 제공한 database_structure_proposal (AI 분석/편향성 추적 중심)
- **새 구조**: 나중에 제공한 문서 (실용적 운영/성능 최적화 중심)

---

## 🔄 주요 차이점 분석

### 1. 설계 철학의 차이

| 구분 | 원본 구조 | 새 구조 | 추천 |
|------|----------|---------|------|
| **설계 방향** | AI 분석 중심, 편향성/전문성 추적 | 실용적 운영 중심, 성능 최적화 | ✅ 새 구조 |
| **복잡도** | 높음 (14개 테이블, 복잡한 관계) | 중간 (13개 테이블, 단순 관계) | ✅ 새 구조 |
| **정규화** | 과도한 정규화 | 적절한 정규화 + 전략적 비정규화 | ✅ 새 구조 |
| **확장성** | 분석 기능에 특화 | 범용적 확장 가능 | ✅ 새 구조 |
| **성능** | JOIN 많음, 복잡한 쿼리 | 집계 테이블 분리, 최적화됨 | ✅ 새 구조 |

---

## 📋 테이블별 상세 비교

### ✅ 공통 테이블 (이름/구조 차이)

#### 1. users 테이블
| 항목 | 원본 | 새 구조 | 차이점 |
|------|------|---------|--------|
| **기본 구조** | 16개 컬럼 | 17개 컬럼 | 새 구조가 더 실용적 |
| **선호도** | user_preferences 테이블 분리 | users 테이블에 통합 | 새 구조가 간단 |
| **특이사항** | is_active | active | 컬럼명만 다름 |
| **추가 필드** | - | user_name, tel, previous_pw | 실용적 필드 추가 |

#### 2. 언론사 테이블
| 항목 | 원본 (media_sources) | 새 구조 (sources) | 추천 |
|------|-------------------|------------------|------|
| **컬럼 수** | 11개 | 2개 | ✅ 새 구조 |
| **복잡도** | 높음 (credibility_score, founded_year 등) | 낮음 (id, name만) | ✅ 새 구조 |
| **확장성** | 제한적 | 유연함 | ✅ 새 구조 |

#### 3. categories 테이블
| 항목 | 원본 | 새 구조 | 차이점 |
|------|------|---------|--------|
| **자기참조** | parent_id로 계층구조 | 없음 (단순 구조) | 새 구조가 간단 |
| **메타정보** | color_code, icon, sort_order 등 | name만 | 새 구조가 간단 |
| **복잡도** | 높음 | 낮음 | ✅ 새 구조 |

#### 4. news_articles 테이블
| 항목 | 원본 | 새 구조 | 차이점 |
|------|------|---------|--------|
| **기자 정보** | journalist_id (FK) | journalist (문자열) | 새 구조가 유연 |
| **카운트** | 테이블에 포함 | article_stats 분리 | ✅ 새 구조 (성능) |
| **검색** | 인덱스만 | search_vector (tsvector) | ✅ 새 구조 (전문검색) |
| **레거시 호환** | 없음 | source, category 문자열 유지 | ✅ 새 구조 |

---

### ❌ 원본에만 있는 테이블 (8개)

| 테이블명 | 용도 | 필요성 평가 |
|----------|------|-------------|
| **journalists** | 기자 상세 정보 | ⚠️ 과도한 정규화 |
| **user_preferences** | 사용자 선호도 (1:1) | ❌ 불필요한 분리 |
| **user_reactions** | 사용자 반응 추적 | ⚠️ user_actions로 통합 가능 |
| **user_recommendations** | AI 추천 로그 | ⚠️ 별도 로그 시스템 권장 |
| **journalist_expertise** | 기자 전문성 점수 | ❌ 과도한 기능 |
| **journalist_bias_scores** | 기자 편향성 분석 | ❌ 과도한 기능 |
| **media_bias_scores** | 언론사 편향성 분석 | ❌ 과도한 기능 |
| **article_bias_scores** | 기사 편향성 분석 | ⚠️ article_analyses로 통합 가능 |

---

### ✨ 새 구조에만 있는 테이블 (5개)

| 테이블명 | 용도 | 장점 |
|----------|------|------|
| **user_actions** | 통합 사용자 행동 로그 | ✅ 단순하고 확장 가능 |
| **article_stats** | 기사 통계 집계 | ✅ 성능 최적화 핵심 |
| **user_category_interests** | 카테고리 선호도 | ✅ 추천 시스템 기초 |
| **user_keyword_interests** | 키워드 선호도 | ✅ 개인화 기초 |
| **article_analyses** | 통합 분석 결과 | ✅ JSON으로 유연한 저장 |

---

## 🎯 핵심 설계 패턴 비교

### 1. 사용자 행동 추적

#### 원본 구조
```sql
-- 복잡한 다중 테이블 구조
user_reactions (반응별 추적)
user_recommendations (추천 로그)
bookmarks (북마크)
-- 각각 별도 쿼리 필요, JOIN 복잡
```

#### 새 구조 ✅
```sql
-- 통합된 단순 구조
user_actions (모든 행동 통합)
  - type: VIEW | LIKE | DISLIKE | BOOKMARK
  - weight: 가중치
-- 단일 테이블로 모든 행동 추적
```

### 2. 통계/집계 처리

#### 원본 구조
```sql
-- news_articles 테이블에 직접 카운트
UPDATE news_articles 
SET view_count = view_count + 1 
WHERE id = ?
-- 문제: 테이블 락, 동시성 이슈
```

#### 새 구조 ✅
```sql
-- 별도 article_stats 테이블
INSERT INTO user_actions (type) VALUES ('VIEW');
-- 배치/트리거로 article_stats 업데이트
-- 장점: 메인 테이블 부하 감소, 비동기 처리 가능
```

### 3. 분석 데이터 저장

#### 원본 구조
```sql
-- 4개의 별도 편향성 테이블
journalist_bias_scores
media_bias_scores
article_bias_scores
journalist_expertise
-- 복잡한 JOIN, 관리 어려움
```

#### 새 구조 ✅
```sql
-- 단일 article_analyses 테이블
article_analyses
  - keywords: JSON
  - topics: JSON
  - sentiment: ENUM
-- JSON으로 유연한 확장
```

---

## 💡 권장사항

### 🏆 최종 추천: **새 구조 채택**

#### 이유:
1. **성능 최적화**: article_stats 분리로 카운트 업데이트 부담 감소
2. **단순성**: 불필요한 정규화 제거, 관리 용이
3. **확장성**: JSON 필드 활용으로 유연한 확장
4. **실용성**: 레거시 호환, 점진적 마이그레이션 가능
5. **운영 효율**: 복잡한 JOIN 감소, 쿼리 단순화

### 🔧 구현 시 주의사항

#### 1. 마이그레이션 전략
```sql
-- 1단계: 새 테이블 생성
CREATE TABLE sources AS 
SELECT DISTINCT source as name FROM news_articles;

-- 2단계: FK 관계 추가
ALTER TABLE news_articles 
ADD COLUMN source_id BIGINT REFERENCES sources(id);

-- 3단계: 데이터 매핑
UPDATE news_articles n 
SET source_id = s.id 
FROM sources s 
WHERE n.source = s.name;

-- 4단계: 서비스 점진적 전환
-- source (문자열) → source_id (FK) 사용으로 전환
```

#### 2. 성능 최적화 구현
```sql
-- article_stats 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_article_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO article_stats (article_id, view_count)
    VALUES (NEW.article_id, 1)
    ON CONFLICT (article_id) 
    DO UPDATE SET 
      view_count = CASE 
        WHEN NEW.type = 'VIEW' 
        THEN article_stats.view_count + 1 
        ELSE article_stats.view_count 
      END,
      like_count = CASE 
        WHEN NEW.type = 'LIKE' 
        THEN article_stats.like_count + 1 
        ELSE article_stats.like_count 
      END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_stats
AFTER INSERT ON user_actions
FOR EACH ROW EXECUTE FUNCTION update_article_stats();
```

#### 3. 검색 최적화
```sql
-- search_vector 자동 업데이트
CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('korean', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('korean', coalesce(NEW.summary, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_search_vector
BEFORE INSERT OR UPDATE ON news_articles
FOR EACH ROW EXECUTE FUNCTION update_search_vector();
```

---

## 📊 비교 요약표

| 평가 항목 | 원본 구조 | 새 구조 | 승자 |
|-----------|----------|---------|------|
| **단순성** | ⭐⭐ | ⭐⭐⭐⭐⭐ | 새 구조 |
| **성능** | ⭐⭐ | ⭐⭐⭐⭐⭐ | 새 구조 |
| **확장성** | ⭐⭐⭐ | ⭐⭐⭐⭐ | 새 구조 |
| **분석 기능** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 원본 |
| **운영 편의성** | ⭐⭐ | ⭐⭐⭐⭐⭐ | 새 구조 |
| **레거시 호환** | ⭐ | ⭐⭐⭐⭐⭐ | 새 구조 |

### 총평: 새 구조 추천 ✅

새 구조는 실제 운영에 최적화되어 있으며, 필요시 분석 기능을 점진적으로 추가할 수 있는 유연성을 제공합니다.

---

## 🚀 실행 계획

### Phase 1 (1주차) - 기본 구조
1. sources, categories 마스터 테이블 생성
2. user_actions, article_stats 구현
3. 기존 데이터 마이그레이션

### Phase 2 (2주차) - 최적화
1. search_vector 구현
2. 트리거/배치 작업 설정
3. 인덱스 최적화

### Phase 3 (3주차) - 확장
1. user_interests 테이블 구현
2. article_analyses 구조 설계
3. 추천 시스템 기초 구현

---

*작성일: 2025년 9월 20일*
*작성자: Claude AI Assistant*
