import { AppDataSource } from '../../shared/config/database';
import { NewsArticle, Source, Category, BiasAnalysis } from '../../shared/entities';
import logger from '../../shared/config/logger';
import { getPuppeteerPool } from './puppeteerPoolService';
import {
  JTBCParser,
  MunhwaParser,
  JoongangParser,
  HankookParser,
  DaumParser,
  SiteParser,
  ParsedArticle,
} from './siteParsers';
import axios from 'axios';
import { summarizeArticle, analyzeBias } from '../../shared/services/aiService';
import { classifySource } from '../../shared/utils/sourceClassifier';

export class NewsCrawlerService {
  private parsers: Map<string, SiteParser> = new Map();
  private sourceMap: Map<string, Source> = new Map();
  private categoryMap: Map<string, Category> = new Map();

  constructor() {
    // 파서 등록 - Daum만 사용
    this.parsers.set('다음', new DaumParser());

    // 다른 파서들은 주석 처리
    // this.parsers.set('JTBC', new JTBCParser());
    // this.parsers.set('문화일보', new MunhwaParser());
    // this.parsers.set('중앙일보', new JoongangParser());
    // this.parsers.set('한국일보', new HankookParser());
  }

  /**
   * 데이터베이스 초기화 및 Source/Category 로드
   */
  async initialize(): Promise<void> {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      logger.info('데이터베이스 연결 완료');
    }

    // Source 로드
    const sourceRepo = AppDataSource.getRepository(Source);
    const sources = await sourceRepo.find();
    sources.forEach((source) => {
      this.sourceMap.set(source.name, source);
    });
    logger.info(`${sources.length}개 언론사 로드 완료`);

    // Category 로드
    const categoryRepo = AppDataSource.getRepository(Category);
    const categories = await categoryRepo.find();
    categories.forEach((category) => {
      this.categoryMap.set(category.name, category);
    });
    logger.info(`${categories.length}개 카테고리 로드 완료`);
  }

  /**
   * Source 또는 Category가 없으면 생성
   */
  private async ensureSourceAndCategory(sourceName: string, categoryName?: string): Promise<{ sourceId: number; categoryId: number }> {
    // Source 확인/생성
    let source = this.sourceMap.get(sourceName);
    if (!source) {
      const sourceRepo = AppDataSource.getRepository(Source);

      // "기타-"로 시작하는 언론사는 ID 1000번 이후 배정
      if (sourceName.startsWith('기타-')) {
        // 현재 최대 ID 조회
        const result = await sourceRepo
          .createQueryBuilder('source')
          .select('MAX(source.id)', 'maxId')
          .where('source.id >= 1000')
          .getRawOne();

        const nextId = result?.maxId ? result.maxId + 1 : 1000;
        source = sourceRepo.create({ id: nextId, name: sourceName });
      } else {
        source = sourceRepo.create({ name: sourceName });
      }

      source = await sourceRepo.save(source);
      this.sourceMap.set(sourceName, source);
      logger.info(`새 언론사 생성: ${sourceName} (ID: ${source.id})`);
    }

    // Category 확인/생성
    let category = this.categoryMap.get(categoryName || '기타');
    if (!category) {
      const categoryRepo = AppDataSource.getRepository(Category);
      category = categoryRepo.create({ name: categoryName || '기타' });
      category = await categoryRepo.save(category);
      this.categoryMap.set(categoryName || '기타', category);
      logger.info(`새 카테고리 생성: ${categoryName || '기타'}`);
    }

    return {
      sourceId: source.id,
      categoryId: category.id,
    };
  }

  /**
   * 특정 언론사 크롤링 실행
   */
  async crawlSource(sourceName: string): Promise<{ success: number; failed: number }> {
    const parser = this.parsers.get(sourceName);
    if (!parser) {
      logger.error(`파서를 찾을 수 없음: ${sourceName}`);
      return { success: 0, failed: 0 };
    }

    logger.info(`${sourceName} 크롤링 시작`);
    const pool = getPuppeteerPool();

    let totalSuccess = 0;
    let totalFailed = 0;

    try {
      // 각 섹션별로 URL 수집
      const sectionUrls = parser.getSectionUrls();

      for (const sectionUrl of sectionUrls) {
        try {
          // URL 목록 추출
          const articleUrls = await pool.withPage(async (page) => {
            return await parser.extractArticleUrls(page, sectionUrl);
          });

          logger.info(`${sourceName} - ${articleUrls.length}개 기사 URL 발견`);

          // 병렬로 기사 파싱 (5개씩)
          const articles = await pool.processUrls(
            articleUrls,
            async (url, page) => {
              return await parser.parseArticle(page, url);
            },
            5
          );

          // 데이터베이스 저장
          for (const article of articles) {
            if (!article) {
              totalFailed++;
              continue;
            }

            try {
              await this.saveArticle(sourceName, article);
              totalSuccess++;
            } catch (error) {
              logger.error(`기사 저장 실패: ${article.url}`, error);
              totalFailed++;
            }
          }
        } catch (error) {
          logger.error(`섹션 크롤링 실패: ${sectionUrl}`, error);
        }
      }

      logger.info(`${sourceName} 크롤링 완료 - 성공: ${totalSuccess}, 실패: ${totalFailed}`);
    } catch (error) {
      logger.error(`${sourceName} 크롤링 오류`, error);
    }

    return { success: totalSuccess, failed: totalFailed };
  }

  /**
   * 기사를 데이터베이스에 저장
   */
  private async saveArticle(sourceName: string, article: ParsedArticle & { originalSource?: string }): Promise<void> {
    const newsRepo = AppDataSource.getRepository(NewsArticle);

    // 중복 체크 (URL 기준)
    const existing = await newsRepo.findOne({ where: { url: article.url } });
    if (existing) {
      logger.debug(`이미 존재하는 기사: ${article.url}`);
      return;
    }

    // Daum의 경우 원 언론사 정보가 있으면 그걸 사용
    const originalSourceName = article.originalSource || sourceName;

    // 언론사 분류 (기타- prefix 자동 추가)
    const finalSourceName = classifySource(originalSourceName);

    // Source & Category 확보
    const { sourceId, categoryId } = await this.ensureSourceAndCategory(finalSourceName, article.categoryName);

    // 기사 저장
    const newsArticle = newsRepo.create({
      title: article.title,
      content: article.content,
      url: article.url,
      imageUrl: article.imageUrl,
      journalist: article.journalist,
      pubDate: article.pubDate || new Date(),
      sourceId,
      categoryId,
    });

    const saved = await newsRepo.save(newsArticle);

    // ArticleStat 초기화 (직접 SQL 실행)
    try {
      await AppDataSource.query(
        `INSERT INTO article_stats (article_id, view_count, like_count, dislike_count, bookmark_count, comment_count, updated_at)
         VALUES ($1, 0, 0, 0, 0, 0, NOW())
         ON CONFLICT (article_id) DO NOTHING`,
        [saved.id]
      );
    } catch (error) {
      logger.warn(`ArticleStat 초기화 실패 (이미 존재할 수 있음): ${saved.id}`);
    }

    logger.info(`새 기사 저장: ${article.title}`);

    // AI 요약 자동 실행 (비동기, 실패해도 계속)
    summarizeArticle(saved.id, article.content).catch((error: any) => {
      logger.error(`AI 요약 실패 (기사 ID: ${saved.id}):`, error);
    });

    // AI 편향 분석 요청 (비동기, 실패해도 계속)
    analyzeBias(saved.id, article.content).catch((error: any) => {
      logger.error(`AI 분석 요청 실패 (기사 ID: ${saved.id}):`, error);
    });
  }

  /**
   * 모든 언론사 크롤링
   */
  async crawlAll(): Promise<void> {
    logger.info('전체 크롤링 시작');

    for (const sourceName of this.parsers.keys()) {
      await this.crawlSource(sourceName);
    }

    logger.info('전체 크롤링 완료');
  }
}
