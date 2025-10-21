import { AppDataSource } from '../config/database';
import logger from '../config/logger';

export class RecommendationService {
  /**
   * 사용자 기반 뉴스 추천
   * 협업 필터링 + 콘텐츠 기반 필터링 하이브리드 접근
   */
  async getPersonalizedRecommendations(
    userId: number,
    limit: number = 20
  ): Promise<any[]> {
    try {
      // 1. 캐시된 추천 확인
      const cached = await this.getCachedRecommendations(userId);
      if (cached && cached.length > 0) {
        logger.info(`Using cached recommendations for user ${userId}`);
        return cached.slice(0, limit);
      }

      // 2. 신규 추천 생성
      const recommendations = await this.generateRecommendations(userId, limit);

      // 3. 캐시에 저장
      await this.cacheRecommendations(userId, recommendations);

      return recommendations;
    } catch (error) {
      logger.error('Personalized recommendations error:', error);
      // 오류 시 인기 기사 반환
      return await this.getPopularArticles(limit);
    }
  }

  /**
   * 추천 생성 메인 로직
   */
  private async generateRecommendations(
    userId: number,
    limit: number
  ): Promise<any[]> {
    // 1. 사용자 선호도 분석
    const userPreferences = await this.getUserPreferences(userId);

    // 2. 활동 기록이 없는 경우 (Cold Start) - 실시간 인기 기사 5개만 반환
    const hasActivity = userPreferences.total_read > 0 ||
                       userPreferences.total_likes > 0 ||
                       userPreferences.preferred_categories.length > 0 ||
                       userPreferences.preferred_sources.length > 0;

    if (!hasActivity) {
      logger.info(`No activity for user ${userId}, returning top 5 trending articles`);
      return await this.getMostViewedArticles(5);
    }

    // 3. 협업 필터링 - 유사한 사용자 찾기
    const similarUsers = await this.findSimilarUsers(userId, 10);

    // 4. 유사 사용자가 좋아한 기사
    const collaborativeArticles = await this.getArticlesFromSimilarUsers(
      userId,
      similarUsers,
      limit * 2
    );

    // 5. 콘텐츠 기반 추천 - 사용자가 읽은 기사와 유사한 기사
    const contentBasedArticles = await this.getSimilarArticles(
      userId,
      userPreferences,
      limit * 2
    );

    // 6. 키워드 기반 추천 - 사용자가 읽은 기사의 키워드와 유사한 기사
    const keywordBasedArticles = await this.getKeywordBasedArticles(
      userId,
      limit * 2
    );

    // 7. 정치 편향 기반 추천 - 사용자의 정치 성향에 맞는 기사
    const biasBasedArticles = await this.getBiasBasedArticles(
      userId,
      limit
    );

    // 8. 트렌딩 기사
    const trendingArticles = await this.getTrendingArticles(limit);

    // 9. 하이브리드 점수 계산 및 병합
    const scoredArticles = this.mergeAndScoreArticles(
      collaborativeArticles,
      contentBasedArticles,
      keywordBasedArticles,
      biasBasedArticles,
      trendingArticles,
      userPreferences
    );

    // 10. 상위 N개 반환
    return scoredArticles.slice(0, limit);
  }

  /**
   * 사용자 선호도 가져오기
   */
  private async getUserPreferences(userId: number): Promise<any> {
    // 1. 먼저 활동 기록 조회 (user_preferences 없어도 가능)
    const activityResult = await AppDataSource.query(
      `SELECT
        COUNT(DISTINCT article_id) as total_read,
        COUNT(CASE WHEN activity_type = 'like' THEN 1 END) as total_likes,
        AVG(reading_time_seconds) as avg_reading_time
      FROM user_activity_log
      WHERE user_id = $1`,
      [userId]
    );

    // 2. user_preferences 조회 (있으면 가져오고 없으면 기본값)
    const prefsResult = await AppDataSource.query(
      `SELECT preferred_categories, preferred_sources
      FROM user_preferences
      WHERE user_id = $1`,
      [userId]
    );

    const activity = activityResult[0] || {};
    const prefs = prefsResult[0] || {};

    return {
      preferred_categories: this.parseJsonField(prefs.preferred_categories),
      preferred_sources: this.parseJsonField(prefs.preferred_sources),
      total_read: parseInt(activity.total_read) || 0,
      total_likes: parseInt(activity.total_likes) || 0,
      avg_reading_time: parseFloat(activity.avg_reading_time) || 0
    };
  }

  /**
   * 유사한 사용자 찾기 (협업 필터링)
   */
  private async findSimilarUsers(userId: number, limit: number): Promise<number[]> {
    // 사용자가 좋아요한 기사를 기반으로 유사한 사용자 찾기
    const result = await AppDataSource.query(
      `SELECT ual2.user_id, COUNT(*) as common_likes
      FROM user_activity_log ual1
      JOIN user_activity_log ual2
        ON ual1.article_id = ual2.article_id
        AND ual1.user_id != ual2.user_id
      WHERE ual1.user_id = $1
        AND ual1.activity_type = 'like'
        AND ual2.activity_type = 'like'
      GROUP BY ual2.user_id
      ORDER BY common_likes DESC
      LIMIT $2`,
      [userId, limit]
    );

    return result.map((row: any) => row.user_id);
  }

  /**
   * 유사 사용자가 좋아한 기사 가져오기
   */
  private async getArticlesFromSimilarUsers(
    userId: number,
    similarUsers: number[],
    limit: number
  ): Promise<any[]> {
    if (similarUsers.length === 0) {
      return [];
    }

    const result = await AppDataSource.query(
      `SELECT DISTINCT na.*,
        s.name as source_name,
        c.name as category_name,
        COUNT(DISTINCT ual.user_id) as recommender_count
      FROM user_activity_log ual
      JOIN news_articles na ON ual.article_id = na.id
      LEFT JOIN sources s ON na.source_id = s.id
      LEFT JOIN categories c ON na.category_id = c.id
      WHERE ual.user_id = ANY($1::int[])
        AND ual.activity_type IN ('like', 'bookmark')
        AND na.id NOT IN (
          SELECT article_id FROM user_activity_log
          WHERE user_id = $2 AND activity_type IN ('view', 'like', 'bookmark')
        )
        AND na.pub_date > NOW() - INTERVAL '7 days'
      GROUP BY na.id, s.name, c.name
      ORDER BY recommender_count DESC
      LIMIT $3`,
      [similarUsers, userId, limit]
    );

    return result.map((article: any) => ({
      ...article,
      recommendation_type: 'collaborative',
      score: parseFloat(article.recommender_count) || 1
    }));
  }

  /**
   * 콘텐츠 기반 유사 기사 가져오기
   */
  private async getSimilarArticles(
    userId: number,
    userPreferences: any,
    limit: number
  ): Promise<any[]> {
    const categories = userPreferences.preferred_categories || [];
    const sources = userPreferences.preferred_sources || [];

    if (categories.length === 0 && sources.length === 0) {
      return [];
    }

    const result = await AppDataSource.query(
      `SELECT * FROM (
        SELECT DISTINCT na.*,
          s.name as source_name,
          c.name as category_name,
          CASE
            WHEN c.name = ANY($3::text[]) THEN 2
            ELSE 1
          END as category_match_score,
          CASE
            WHEN s.name = ANY($4::text[]) THEN 2
            ELSE 1
          END as source_match_score
        FROM news_articles na
        LEFT JOIN sources s ON na.source_id = s.id
        LEFT JOIN categories c ON na.category_id = c.id
        WHERE (c.name = ANY($3::text[]) OR s.name = ANY($4::text[]))
          AND na.id NOT IN (
            SELECT article_id FROM user_activity_log
            WHERE user_id = $1 AND activity_type IN ('view', 'like', 'bookmark')
          )
          AND na.pub_date > NOW() - INTERVAL '7 days'
      ) scored_articles
      ORDER BY (category_match_score + source_match_score) DESC, pub_date DESC
      LIMIT $2`,
      [userId, limit, categories.length > 0 ? categories : [''], sources.length > 0 ? sources : ['']]
    );

    return result.map((article: any) => ({
      ...article,
      recommendation_type: 'content_based',
      score: (article.category_match_score || 1) + (article.source_match_score || 1)
    }));
  }

  /**
   * 키워드 기반 추천 - 사용자가 읽은 기사의 키워드와 유사한 기사
   * 예: 금값 관련 기사 읽음 → 금값 관련 다른 기사 추천
   */
  private async getKeywordBasedArticles(
    userId: number,
    limit: number
  ): Promise<any[]> {
    // 1. 사용자가 최근 읽은 기사들의 키워드 추출
    const userKeywords = await AppDataSource.query(
      `SELECT k.id, k.keyword, COUNT(*) as frequency,
        MAX(ual.created_at) as last_read
      FROM user_activity_log ual
      JOIN news_keywords nk ON ual.article_id = nk.news_id
      JOIN keywords k ON nk.keyword_id = k.id
      WHERE ual.user_id = $1
        AND ual.activity_type IN ('view', 'like', 'bookmark')
        AND ual.created_at > NOW() - INTERVAL '30 days'
      GROUP BY k.id, k.keyword
      ORDER BY frequency DESC, last_read DESC
      LIMIT 20`,
      [userId]
    );

    if (userKeywords.length === 0) {
      return [];
    }

    // 2. 추출된 키워드를 가진 다른 기사 추천
    const keywordIds = userKeywords.map((k: any) => k.id);

    const result = await AppDataSource.query(
      `SELECT DISTINCT na.*,
        s.name as source_name,
        c.name as category_name,
        COUNT(DISTINCT nk.keyword_id) as keyword_match_count,
        SUM(nk.relevance) as total_relevance
      FROM news_articles na
      JOIN news_keywords nk ON na.id = nk.news_id
      LEFT JOIN sources s ON na.source_id = s.id
      LEFT JOIN categories c ON na.category_id = c.id
      WHERE nk.keyword_id = ANY($2::bigint[])
        AND na.id NOT IN (
          SELECT article_id FROM user_activity_log
          WHERE user_id = $1 AND activity_type IN ('view', 'like', 'bookmark')
        )
        AND na.pub_date > NOW() - INTERVAL '7 days'
      GROUP BY na.id, s.name, c.name
      HAVING COUNT(DISTINCT nk.keyword_id) >= 1
      ORDER BY keyword_match_count DESC, total_relevance DESC, na.pub_date DESC
      LIMIT $3`,
      [userId, keywordIds, limit]
    );

    return result.map((article: any) => ({
      ...article,
      recommendation_type: 'keyword_based',
      score: (parseInt(article.keyword_match_count) || 1) * (parseFloat(article.total_relevance) || 1)
    }));
  }

  /**
   * 정치 편향 기반 추천 - 사용자의 정치 성향에 맞는 기사 추천
   * 예: 긍정적 정치 기사 → 긍정적 기사 추천, 부정적 기사 → 부정적 기사 추천
   */
  private async getBiasBasedArticles(
    userId: number,
    limit: number
  ): Promise<any[]> {
    // 1. 사용자가 최근 읽은 정치 기사의 편향 분석
    const userBiasPreference = await AppDataSource.query(
      `SELECT
        ba.political_leaning,
        COUNT(*) as frequency,
        AVG(ba.bias_score) as avg_bias_score,
        AVG(ual.reading_time_seconds) as avg_reading_time
      FROM user_activity_log ual
      JOIN news_articles na ON ual.article_id = na.id
      JOIN categories c ON na.category_id = c.id
      LEFT JOIN bias_analysis ba ON na.id = ba.article_id
      WHERE ual.user_id = $1
        AND c.name = '정치'
        AND ual.activity_type IN ('view', 'like', 'bookmark')
        AND ual.created_at > NOW() - INTERVAL '30 days'
        AND ba.political_leaning IS NOT NULL
      GROUP BY ba.political_leaning
      ORDER BY frequency DESC, avg_reading_time DESC
      LIMIT 3`,
      [userId]
    );

    if (userBiasPreference.length === 0) {
      return [];
    }

    // 2. 선호하는 편향의 정치 기사 추천
    const preferredLeanings = userBiasPreference.map((p: any) => p.political_leaning);

    const result = await AppDataSource.query(
      `SELECT na.*,
        s.name as source_name,
        c.name as category_name,
        ba.political_leaning,
        ba.bias_score,
        ba.confidence
      FROM news_articles na
      JOIN categories c ON na.category_id = c.id
      LEFT JOIN sources s ON na.source_id = s.id
      LEFT JOIN bias_analysis ba ON na.id = ba.article_id
      WHERE c.name = '정치'
        AND ba.political_leaning = ANY($2::text[])
        AND ba.confidence > 0.6
        AND na.id NOT IN (
          SELECT article_id FROM user_activity_log
          WHERE user_id = $1 AND activity_type IN ('view', 'like', 'bookmark')
        )
        AND na.pub_date > NOW() - INTERVAL '7 days'
      ORDER BY ba.confidence DESC, na.pub_date DESC
      LIMIT $3`,
      [userId, preferredLeanings, limit]
    );

    return result.map((article: any) => ({
      ...article,
      recommendation_type: 'bias_based',
      score: (parseFloat(article.confidence) || 0.5) * 10
    }));
  }

  /**
   * 트렌딩 기사 가져오기
   */
  private async getTrendingArticles(limit: number): Promise<any[]> {
    const result = await AppDataSource.query(
      `SELECT na.*,
        s.name as source_name,
        c.name as category_name,
        COUNT(DISTINCT ual.user_id) as view_count,
        COUNT(CASE WHEN ual.activity_type = 'like' THEN 1 END) as like_count
      FROM news_articles na
      LEFT JOIN sources s ON na.source_id = s.id
      LEFT JOIN categories c ON na.category_id = c.id
      LEFT JOIN user_activity_log ual ON na.id = ual.article_id
      WHERE na.pub_date > NOW() - INTERVAL '24 hours'
      GROUP BY na.id, s.name, c.name
      ORDER BY COUNT(DISTINCT ual.user_id) + COUNT(CASE WHEN ual.activity_type = 'like' THEN 1 END) * 2 DESC
      LIMIT $1`,
      [limit]
    );

    return result.map((article: any) => ({
      ...article,
      recommendation_type: 'trending',
      score: (parseInt(article.view_count) || 0) + (parseInt(article.like_count) || 0) * 2
    }));
  }

  /**
   * 실시간 가장 많이 조회되는 기사 (Cold Start용)
   * 최근 24시간 내에 가장 많이 조회된 기사 반환
   */
  private async getMostViewedArticles(limit: number): Promise<any[]> {
    const result = await AppDataSource.query(
      `SELECT na.*,
        s.name as source_name,
        c.name as category_name,
        COUNT(DISTINCT CASE WHEN ual.activity_type = 'view' THEN ual.user_id END) as view_count,
        COUNT(DISTINCT CASE WHEN ual.activity_type = 'like' THEN ual.user_id END) as like_count,
        COUNT(DISTINCT CASE WHEN ual.activity_type = 'comment' THEN ual.user_id END) as comment_count
      FROM news_articles na
      LEFT JOIN sources s ON na.source_id = s.id
      LEFT JOIN categories c ON na.category_id = c.id
      LEFT JOIN user_activity_log ual ON na.id = ual.article_id
      WHERE na.pub_date > NOW() - INTERVAL '24 hours'
      GROUP BY na.id, s.name, c.name
      HAVING COUNT(DISTINCT CASE WHEN ual.activity_type = 'view' THEN ual.user_id END) > 0
      ORDER BY
        COUNT(DISTINCT CASE WHEN ual.activity_type = 'view' THEN ual.user_id END) DESC,
        COUNT(DISTINCT CASE WHEN ual.activity_type = 'like' THEN ual.user_id END) DESC,
        COUNT(DISTINCT CASE WHEN ual.activity_type = 'comment' THEN ual.user_id END) DESC,
        na.pub_date DESC
      LIMIT $1`,
      [limit]
    );

    return result.map((article: any) => ({
      ...article,
      recommendation_type: 'most_viewed',
      view_count: parseInt(article.view_count) || 0,
      like_count: parseInt(article.like_count) || 0,
      comment_count: parseInt(article.comment_count) || 0
    }));
  }

  /**
   * 기사 병합 및 점수 계산
   */
  private mergeAndScoreArticles(
    collaborative: any[],
    contentBased: any[],
    keywordBased: any[],
    biasBased: any[],
    trending: any[],
    userPreferences: any
  ): any[] {
    const articleMap = new Map<number, any>();

    // 협업 필터링 결과 (가중치 0.25)
    collaborative.forEach(article => {
      const id = article.id;
      articleMap.set(id, {
        ...article,
        final_score: article.score * 0.25
      });
    });

    // 콘텐츠 기반 결과 (가중치 0.2)
    contentBased.forEach(article => {
      const id = article.id;
      if (articleMap.has(id)) {
        const existing = articleMap.get(id);
        existing.final_score += article.score * 0.2;
        existing.recommendation_type = 'hybrid';
      } else {
        articleMap.set(id, {
          ...article,
          final_score: article.score * 0.2
        });
      }
    });

    // 키워드 기반 결과 (가중치 0.3) - 가장 중요!
    keywordBased.forEach(article => {
      const id = article.id;
      if (articleMap.has(id)) {
        const existing = articleMap.get(id);
        existing.final_score += article.score * 0.3;
        existing.recommendation_type = 'hybrid';
      } else {
        articleMap.set(id, {
          ...article,
          final_score: article.score * 0.3
        });
      }
    });

    // 편향 기반 결과 (가중치 0.15)
    biasBased.forEach(article => {
      const id = article.id;
      if (articleMap.has(id)) {
        const existing = articleMap.get(id);
        existing.final_score += article.score * 0.15;
        existing.recommendation_type = 'hybrid';
      } else {
        articleMap.set(id, {
          ...article,
          final_score: article.score * 0.15
        });
      }
    });

    // 트렌딩 결과 (가중치 0.1)
    trending.forEach(article => {
      const id = article.id;
      if (articleMap.has(id)) {
        const existing = articleMap.get(id);
        existing.final_score += article.score * 0.1;
        existing.recommendation_type = 'hybrid';
      } else {
        articleMap.set(id, {
          ...article,
          final_score: article.score * 0.1
        });
      }
    });

    // 점수순 정렬
    return Array.from(articleMap.values()).sort((a, b) => b.final_score - a.final_score);
  }

  /**
   * 인기 기사 (fallback)
   */
  private async getPopularArticles(limit: number): Promise<any[]> {
    const result = await AppDataSource.query(
      `SELECT na.*,
        s.name as source_name,
        c.name as category_name
      FROM news_articles na
      LEFT JOIN sources s ON na.source_id = s.id
      LEFT JOIN categories c ON na.category_id = c.id
      WHERE na.pub_date > NOW() - INTERVAL '7 days'
      ORDER BY na.pub_date DESC
      LIMIT $1`,
      [limit]
    );

    return result;
  }

  /**
   * 캐시된 추천 가져오기
   */
  private async getCachedRecommendations(userId: number): Promise<any[] | null> {
    const result = await AppDataSource.query(
      `SELECT recommended_article_ids, expires_at
      FROM user_recommendations
      WHERE user_id = $1 AND expires_at > NOW()`,
      [userId]
    );

    if (result.length === 0) {
      return null;
    }

    const articleIds = this.parseJsonField(result[0].recommended_article_ids);
    if (!articleIds || articleIds.length === 0) {
      return null;
    }

    // 기사 정보 가져오기
    const articles = await AppDataSource.query(
      `SELECT na.*, s.name as source_name, c.name as category_name
      FROM news_articles na
      LEFT JOIN sources s ON na.source_id = s.id
      LEFT JOIN categories c ON na.category_id = c.id
      WHERE na.id = ANY($1::int[])`,
      [articleIds]
    );

    return articles;
  }

  /**
   * 추천 캐시 저장
   */
  private async cacheRecommendations(userId: number, articles: any[]): Promise<void> {
    const articleIds = articles.map(a => a.id);
    const scores = articles.reduce((acc: any, a: any) => {
      acc[a.id] = a.final_score || 1;
      return acc;
    }, {});

    await AppDataSource.query(
      `INSERT INTO user_recommendations (user_id, recommended_article_ids, recommendation_scores, expires_at)
      VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour')
      ON CONFLICT (user_id)
      DO UPDATE SET
        recommended_article_ids = $2,
        recommendation_scores = $3,
        generated_at = NOW(),
        expires_at = NOW() + INTERVAL '1 hour'`,
      [userId, JSON.stringify(articleIds), JSON.stringify(scores)]
    );
  }

  /**
   * JSON 필드 파싱 헬퍼
   */
  private parseJsonField(field: any): any[] {
    if (!field) return [];
    if (Array.isArray(field)) return field;
    if (typeof field === 'string') {
      try {
        return JSON.parse(field);
      } catch {
        return [];
      }
    }
    return [];
  }
}
