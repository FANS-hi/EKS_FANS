import { Router, Request, Response } from "express";
import { AppDataSource } from "../config/database";
import { NewsArticle } from "../entities/NewsArticle";
import { Category } from "../entities/Category";
import { Source } from "../entities/Source";
import { ArticleStat } from "../entities/ArticleStat";
import { Bookmark } from "../entities/Bookmark";
import { BiasAnalysis } from "../entities/BiasAnalysis";
import { ILike, In } from "typeorm";
import logger from "../config/logger";

const router = Router();

/** 응답 형태로 매핑 */
async function mapArticle(a: NewsArticle) {
  // 통계 정보 가져오기
  const statRepo = AppDataSource.getRepository(ArticleStat);
  const stats = await statRepo.findOne({ where: { articleId: a.id } });

  // 카테고리와 소스 정보 가져오기
  const categoryRepo = AppDataSource.getRepository(Category);
  const sourceRepo = AppDataSource.getRepository(Source);

  const category = await categoryRepo.findOne({ where: { id: a.categoryId } });
  const source = await sourceRepo.findOne({ where: { id: a.sourceId } });

  // 편향성 분석 정보 가져오기
  const biasRepo = AppDataSource.getRepository(BiasAnalysis);
  const biasData = await biasRepo.findOne({ where: { articleId: a.id } });

  // 요약: AI 요약 → 본문 앞부분
  const fallbackSummary =
    (a.content || "").replace(/\s+/g, " ").slice(0, 160) +
    ((a.content || "").length > 160 ? "…" : "");

  return {
    id: a.id,
    title: a.title,
    url: a.url,
    image_url: a.imageUrl || null,

    // 기사 본문
    content: a.content || null,

    // 요약 필드들
    ai_summary: a.aiSummary || null,
    summary: a.aiSummary || fallbackSummary,

    // 메타 정보
    source: source?.name || null,
    category: category?.name || null,
    journalist: a.journalist || null,
    pub_date: a.pubDate,

    // 통계 정보
    view_count: stats?.viewCount || 0,
    like_count: stats?.likeCount || 0,
    dislike_count: stats?.dislikeCount || 0,
    bookmark_count: stats?.bookmarkCount || 0,

    // 편향성 분석 정보
    bias_score: biasData?.biasScore || null,
    political_leaning: biasData?.politicalLeaning || null,
    confidence: biasData?.confidence || null,
    analysis_data: biasData?.analysisData || null,

    // 시간 정보
    created_at: a.createdAt,
    updated_at: a.updatedAt,

    // 키워드 정보 (기본값)
    keywords: [] as any[]
  };
}

/**
 * GET /api/feed
 * ?topics=정치,경제,사회,세계,IT/과학,생활/문화
 * ?limit=60
 * ?sort=latest|popular
 */
router.get("/feed", async (req: Request, res: Response) => {
  try {
    const newsRepo = AppDataSource.getRepository(NewsArticle);
    const categoryRepo = AppDataSource.getRepository(Category);

    const limit = Math.min(Number(req.query.limit) || 60, 200);
    const topicsRaw = String(req.query.topics || "");
    const sort = String(req.query.sort || "latest");
    const topics = topicsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean) || [];

    let query = newsRepo.createQueryBuilder("article")
      .leftJoinAndSelect("article.source", "source")
      .leftJoinAndSelect("article.category", "category")
      .leftJoinAndSelect("article.stats", "stats");

    // 카테고리 필터
    if (topics.length > 0) {
      const categories = await categoryRepo.find({
        where: topics.map(name => ({ name }))
      });
      const categoryIds = categories.map(c => c.id);
      if (categoryIds.length > 0) {
        query = query.where("article.categoryId IN (:...categoryIds)", { categoryIds });
      }
    }

    // 정렬
    if (sort === "popular") {
      query = query.orderBy("stats.viewCount", "DESC")
        .addOrderBy("stats.likeCount", "DESC");
    } else if (sort === "created_at") {
      query = query.orderBy("article.createdAt", "DESC");
    } else {
      query = query.orderBy("article.pubDate", "DESC");
    }

    const articles = await query.take(limit).getMany();
    const items = await Promise.all(articles.map(mapArticle));

    res.json({ items });
  } catch (e: any) {
    logger.error("FEED_ERROR:", e);
    res.status(500).json({ items: [], error: e?.message || "FEED_FAILED" });
  }
});

/**
 * GET /api/search
 * ?q=검색어
 * ?sort=latest|views
 * ?limit=60
 */
router.get("/search", async (req: Request, res: Response) => {
  try {
    const newsRepo = AppDataSource.getRepository(NewsArticle);

    const q = String(req.query.q || "").trim();
    const limit = Math.min(Number(req.query.limit) || 60, 200);
    const sort = String(req.query.sort || "latest");

    if (!q) return res.json({ items: [] });

    let query = newsRepo.createQueryBuilder("article")
      .leftJoinAndSelect("article.source", "source")
      .leftJoinAndSelect("article.category", "category")
      .leftJoinAndSelect("article.stats", "stats")
      .where("article.title ILIKE :q OR article.content ILIKE :q OR article.aiSummary ILIKE :q",
        { q: `%${q}%` });

    // 정렬
    if (sort === "views") {
      query = query.orderBy("stats.viewCount", "DESC");
    } else {
      query = query.orderBy("article.pubDate", "DESC");
    }

    const articles = await query.take(limit).getMany();
    const items = await Promise.all(articles.map(mapArticle));

    res.json({ items });
  } catch (e: any) {
    logger.error("SEARCH_ERROR:", e);
    res.status(500).json({ items: [], error: e?.message || "SEARCH_FAILED" });
  }
});

/**
 * GET /api/news/trending
 * 인기 뉴스 조회
 */
router.get("/trending", async (req: Request, res: Response) => {
  try {
    const newsRepo = AppDataSource.getRepository(NewsArticle);
    const limit = Math.min(Number(req.query.limit) || 20, 100);

    // 7일 이내 뉴스 중 인기순
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const articles = await newsRepo.createQueryBuilder("article")
      .leftJoinAndSelect("article.source", "source")
      .leftJoinAndSelect("article.category", "category")
      .leftJoinAndSelect("article.stats", "stats")
      .where("article.pubDate > :date", { date: sevenDaysAgo })
      .orderBy("stats.viewCount", "DESC")
      .addOrderBy("stats.likeCount", "DESC")
      .take(limit)
      .getMany();

    const items = await Promise.all(articles.map(mapArticle));
    res.json({ items });
  } catch (e: any) {
    logger.error("TRENDING_ERROR:", e);
    res.status(500).json({ items: [], error: e?.message || "TRENDING_FAILED" });
  }
});

/**
 * GET /api/news/by-source/:sourceName
 * 특정 언론사의 뉴스 조회 (일주일치)
 * ?page=1&limit=20&days=7
 */
router.get("/news/by-source/:sourceName", async (req: Request, res: Response) => {
  try {
    const newsRepo = AppDataSource.getRepository(NewsArticle);
    const sourceRepo = AppDataSource.getRepository(Source);

    const sourceName = String(req.params.sourceName || "").trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const days = Math.min(Number(req.query.days) || 7, 30);

    if (!sourceName) {
      return res.status(400).json({ error: "SOURCE_NAME_REQUIRED" });
    }

    // N일 전 날짜 계산
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - days);

    const skip = (page - 1) * limit;

    let query = newsRepo.createQueryBuilder("article")
      .leftJoinAndSelect("article.source", "source")
      .leftJoinAndSelect("article.category", "category")
      .leftJoinAndSelect("article.stats", "stats");

    // "기타" 선택 시 모든 "기타-XXX" 언론사 포함
    if (sourceName === "기타") {
      // "기타-"로 시작하는 모든 언론사 찾기
      const otherSources = await sourceRepo
        .createQueryBuilder("source")
        .where("source.name LIKE :pattern", { pattern: "기타-%" })
        .getMany();

      if (otherSources.length === 0) {
        return res.json({
          items: [],
          pagination: { page, limit, total: 0, hasMore: false }
        });
      }

      const otherSourceIds = otherSources.map(s => s.id);
      query = query.where("article.sourceId IN (:...sourceIds)", { sourceIds: otherSourceIds });
    } else {
      // 특정 언론사 찾기
      const source = await sourceRepo.findOne({ where: { name: sourceName } });
      if (!source) {
        return res.status(404).json({ error: "SOURCE_NOT_FOUND" });
      }

      query = query.where("article.sourceId = :sourceId", { sourceId: source.id });
    }

    query = query.andWhere("article.pubDate > :date", { date: daysAgo })
      .orderBy("article.pubDate", "DESC")
      .skip(skip)
      .take(limit);

    const articles = await query.getMany();
    const items = await Promise.all(articles.map(mapArticle));

    // 전체 개수 계산
    let totalQuery = newsRepo.createQueryBuilder("article");

    if (sourceName === "기타") {
      const otherSources = await sourceRepo
        .createQueryBuilder("source")
        .where("source.name LIKE :pattern", { pattern: "기타-%" })
        .getMany();
      const otherSourceIds = otherSources.map(s => s.id);
      totalQuery = totalQuery.where("article.sourceId IN (:...sourceIds)", { sourceIds: otherSourceIds });
    } else {
      const source = await sourceRepo.findOne({ where: { name: sourceName } });
      if (source) {
        totalQuery = totalQuery.where("article.sourceId = :sourceId", { sourceId: source.id });
      }
    }

    const total = await totalQuery
      .andWhere("article.pubDate > :date", { date: daysAgo })
      .getCount();

    res.json({
      items,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + items.length < total
      }
    });
  } catch (e: any) {
    logger.error("BY_SOURCE_ERROR:", e);
    res.status(500).json({ items: [], error: e?.message || "BY_SOURCE_FAILED" });
  }
});

/**
 * GET /api/news/:id
 * 뉴스 상세 조회
 */
router.get("/news/:id", async (req: Request, res: Response) => {
  try {
    const newsRepo = AppDataSource.getRepository(NewsArticle);

    const id = Number(req.params.id);
    const article = await newsRepo.findOne({
      where: { id },
      relations: ["source", "category", "stats"]
    });

    if (!article) return res.status(404).json({ error: "NOT_FOUND" });

    // 조회수 증가 (stats 테이블에) - Race condition 방지
    try {
      await AppDataSource.query(`
        INSERT INTO article_stats (article_id, view_count)
        VALUES ($1, 1)
        ON CONFLICT (article_id)
        DO UPDATE SET view_count = article_stats.view_count + 1
      `, [id]);
    } catch (error) {
      logger.warn('조회수 증가 실패:', error);
    }

    const result = await mapArticle(article);

    // 키워드 별도 조회 (옵셔널)
    try {
      const newsKeywordRepo = AppDataSource.getRepository('NewsKeyword');
      const keywords = await newsKeywordRepo
        .createQueryBuilder('nk')
        .leftJoinAndSelect('nk.keyword', 'k')
        .where('nk.article_id = :articleId', { articleId: id })
        .getMany();

      if (keywords && keywords.length > 0) {
        result.keywords = keywords.map((nk: any) => ({
          keyword: nk.keyword?.keyword,
          relevance: nk.relevance
        }));
      }
    } catch (keywordError) {
      logger.warn("키워드 조회 실패:", keywordError);
      // 키워드 조회 실패해도 기사는 반환
    }

    res.json(result);
  } catch (e: any) {
    logger.error("DETAIL_ERROR:", e);
    res.status(500).json({ error: e?.message || "DETAIL_FAILED" });
  }
});

/**
 * GET /api/news/:id/bookmark-status
 * 뉴스 북마크 상태 조회 (로그인한 사용자용)
 */
router.get("/news/:id/bookmark-status", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.json({ isBookmarked: false });
    }

    // JWT 토큰 검증
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const bookmarkRepo = AppDataSource.getRepository(Bookmark);

    const id = Number(req.params.id);
    const bookmark = await bookmarkRepo.findOne({
      where: { userId, newsId: id }
    });

    res.json({
      isBookmarked: !!bookmark,
      bookmarkId: bookmark?.id || null
    });
  } catch (e: any) {
    res.json({ isBookmarked: false });
  }
});

// 특정 기사의 통계 정보만 조회
router.get("/:id/stats", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: "유효하지 않은 기사 ID입니다."
      });
    }

    const statRepo = AppDataSource.getRepository(ArticleStat);
    const stats = await statRepo.findOne({ where: { articleId: id } });

    res.json({
      success: true,
      data: {
        likeCount: stats?.likeCount || 0,
        dislikeCount: stats?.dislikeCount || 0,
        viewCount: stats?.viewCount || 0,
        bookmarkCount: stats?.bookmarkCount || 0
      }
    });
  } catch (error) {
    logger.error("기사 통계 조회 실패:", error);
    res.status(500).json({
      success: false,
      error: "기사 통계를 조회하는 중 오류가 발생했습니다."
    });
  }
});

export default router;