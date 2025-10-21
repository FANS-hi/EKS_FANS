-- ============================================
-- FANS Recommendation System Migration
-- 생성일: 2025-10-21
-- 목적: 개인화 추천 시스템 구축
-- ============================================

-- 1. user_recommendations 테이블 생성
CREATE TABLE IF NOT EXISTS user_recommendations (
    user_id BIGINT PRIMARY KEY,
    recommended_article_ids JSONB NOT NULL DEFAULT '[]',
    recommendation_scores JSONB NOT NULL DEFAULT '{}',
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 인덱스 추가
CREATE INDEX idx_user_recommendations_expires_at ON user_recommendations(expires_at);
CREATE INDEX idx_user_recommendations_user_id ON user_recommendations(user_id);

-- 2. user_activity_log VIEW 생성 (user_actions 테이블의 별칭)
-- RecommendationService가 user_activity_log를 참조하므로 VIEW 생성
CREATE OR REPLACE VIEW user_activity_log AS
SELECT
    id,
    user_id,
    article_id,
    action_type AS activity_type,
    reading_duration AS reading_time_seconds,
    created_at
FROM user_actions;

-- 3. 기존 테이블 확인 및 필요 컬럼 추가

-- news_keywords 테이블 존재 확인
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_name = 'news_keywords') THEN
        -- news_keywords 테이블이 없으면 생성
        CREATE TABLE news_keywords (
            id BIGSERIAL PRIMARY KEY,
            news_id BIGINT NOT NULL,
            keyword_id BIGINT NOT NULL,
            relevance DOUBLE PRECISION DEFAULT 1.0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            FOREIGN KEY (news_id) REFERENCES news_articles(id) ON DELETE CASCADE,
            FOREIGN KEY (keyword_id) REFERENCES keywords(id) ON DELETE CASCADE,
            UNIQUE(news_id, keyword_id)
        );

        CREATE INDEX idx_news_keywords_news_id ON news_keywords(news_id);
        CREATE INDEX idx_news_keywords_keyword_id ON news_keywords(keyword_id);
    END IF;
END $$;

-- bias_analysis 테이블 존재 확인
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_name = 'bias_analysis') THEN
        -- bias_analysis 테이블이 없으면 생성
        CREATE TABLE bias_analysis (
            id BIGSERIAL PRIMARY KEY,
            article_id BIGINT NOT NULL UNIQUE,
            political_leaning VARCHAR(50),
            bias_score DOUBLE PRECISION,
            confidence DOUBLE PRECISION,
            keywords JSONB,
            analysis_date TIMESTAMPTZ DEFAULT NOW(),
            FOREIGN KEY (article_id) REFERENCES news_articles(id) ON DELETE CASCADE
        );

        CREATE INDEX idx_bias_analysis_article_id ON bias_analysis(article_id);
        CREATE INDEX idx_bias_analysis_political_leaning ON bias_analysis(political_leaning);
    END IF;
END $$;

-- 4. 코멘트 추가
COMMENT ON TABLE user_recommendations IS '사용자별 개인화 추천 캐시 테이블 (1시간 TTL)';
COMMENT ON COLUMN user_recommendations.recommended_article_ids IS '추천된 기사 ID 배열 (JSONB)';
COMMENT ON COLUMN user_recommendations.recommendation_scores IS '각 기사의 추천 점수 (JSONB 객체)';
COMMENT ON COLUMN user_recommendations.expires_at IS '캐시 만료 시각 (1시간 후)';

-- 5. 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '✅ Recommendation system migration completed successfully!';
    RAISE NOTICE '📊 Created tables: user_recommendations';
    RAISE NOTICE '🔍 Created views: user_activity_log';
    RAISE NOTICE '📈 Verified tables: news_keywords, bias_analysis';
END $$;
