import { AppDataSource } from '../shared/config/database';
import { NewsArticle, Source, Category } from '../shared/entities';
import logger from './logger';
import puppeteer, { Browser, Page } from 'puppeteer';
import { DaumJsonParser, DaumNewsData } from './daumJsonParser';
import { NaverMetaParser, NaverNewsData } from './naverMetaParser';
import { summarizeArticle, analyzeBias } from '../shared/services/aiService';

/**
 * 통합 크롤러 서비스
 * 다음(JSON 방식) + 네이버(메타 방식)를 하나의 서비스로 통합
 */

export class UnifiedCrawlerService {
  private daumParser: DaumJsonParser;
  private naverParser: NaverMetaParser;
  private sourceMap: Map<string, Source> = new Map();
  private categoryMap: Map<string, Category> = new Map();
  private browser: Browser | null = null;
  private instanceId: string;
  private totalInstances: number;

  constructor() {
    this.daumParser = new DaumJsonParser();
    this.naverParser = new NaverMetaParser();

    // 환경변수로 인스턴스 ID 및 전체 인스턴스 수 설정
    this.instanceId = process.env.INSTANCE_ID || '0';
    this.totalInstances = parseInt(process.env.TOTAL_INSTANCES || '1', 10);

    logger.info(`🆔 인스턴스 ID: ${this.instanceId} (총 ${this.totalInstances}개 중)`);
  }

  /**
   * 데이터베이스 및 브라우저 초기화
   */
  async initialize(): Promise<void> {
    // 데이터베이스 초기화
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      logger.info('✅ 데이터베이스 연결 완료');
    }

    // Source 로드
    const sourceRepo = AppDataSource.getRepository(Source);
    const sources = await sourceRepo.find();
    sources.forEach((source) => {
      this.sourceMap.set(source.name, source);
    });
    logger.info(`📰 ${sources.length}개 언론사 로드 완료`);

    // Category 로드
    const categoryRepo = AppDataSource.getRepository(Category);
    const categories = await categoryRepo.find();
    categories.forEach((category) => {
      this.categoryMap.set(category.name, category);
    });
    logger.info(`📂 ${categories.length}개 카테고리 로드 완료`);

    // Puppeteer 브라우저 시작
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    logger.info('🌐 Puppeteer 브라우저 시작 완료');
  }

  /**
   * Source 또는 Category가 없으면 생성
   */
  private async ensureSourceAndCategory(
    sourceName: string,
    categoryName?: string
  ): Promise<{ sourceId: number; categoryId: number }> {
    // Source 확인/생성
    let source = this.sourceMap.get(sourceName);
    if (!source) {
      const sourceRepo = AppDataSource.getRepository(Source);

      // "기타-"로 시작하는 언론사는 ID 1000번 이후 배정
      if (sourceName.startsWith('기타-')) {
        const result = await sourceRepo
          .createQueryBuilder('source')
          .select('MAX(source.id)', 'maxId')
          .where('source.id >= 1000')
          .getRawOne();

        const nextId = result?.maxId ? result.maxId + 1 : 1000;
        source = sourceRepo.create({ id: nextId, name: sourceName });
      } else {
        // 주요 언론사도 DB에 없으면 자동 증가 ID로 생성
        // (데이터베이스 AUTO_INCREMENT 의존)
        const result = await sourceRepo
          .createQueryBuilder('source')
          .select('MAX(source.id)', 'maxId')
          .where('source.id < 1000')
          .getRawOne();

        const nextId = result?.maxId ? result.maxId + 1 : 1;
        source = sourceRepo.create({ id: nextId, name: sourceName });
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
   * 섹션 URL이 현재 인스턴스에 할당되었는지 확인
   */
  private isAssignedToThisInstance(sectionUrl: string): boolean {
    if (this.totalInstances === 1) {
      return true; // 단일 인스턴스면 모든 섹션 처리
    }

    // 섹션 URL을 해시하여 인스턴스에 할당
    let hash = 0;
    for (let i = 0; i < sectionUrl.length; i++) {
      hash = ((hash << 5) - hash) + sectionUrl.charCodeAt(i);
      hash = hash & hash; // 32bit 정수로 변환
    }

    const assignedInstance = Math.abs(hash) % this.totalInstances;
    return assignedInstance === parseInt(this.instanceId, 10);
  }

  /**
   * 다음 뉴스 크롤링
   */
  async crawlDaum(limitPerSection: number = 20): Promise<{ success: number; failed: number }> {
    if (!this.browser) {
      throw new Error('브라우저가 초기화되지 않았습니다');
    }

    logger.info('🔵 다음 뉴스 크롤링 시작');

    let totalSuccess = 0;
    let totalFailed = 0;

    const allSectionUrls = this.daumParser.getSectionUrls();

    // 이 인스턴스에 할당된 섹션만 필터링
    const sectionUrls = allSectionUrls.filter(url => this.isAssignedToThisInstance(url));

    logger.info(`📂 전체 ${allSectionUrls.length}개 섹션 중 ${sectionUrls.length}개 담당 (인스턴스 ${this.instanceId})`);

    for (const sectionUrl of sectionUrls) {
      const page = await this.browser.newPage();

      try {
        // URL 목록 추출
        const articleUrls = await this.daumParser.extractArticleUrls(page, sectionUrl);
        logger.info(`  📄 ${articleUrls.length}개 기사 URL 발견`);

        // 각 기사 파싱
        for (const url of articleUrls.slice(0, limitPerSection)) {
          try {
            const article = await this.daumParser.parseArticle(page, url);

            if (article && this.daumParser.validateArticle(article)) {
              await this.saveArticle(article);
              totalSuccess++;
            } else {
              totalFailed++;
            }
          } catch (error) {
            logger.error(`기사 파싱 실패: ${url}`, error);
            totalFailed++;
          }
        }
      } catch (error) {
        logger.error(`섹션 크롤링 실패: ${sectionUrl}`, error);
      } finally {
        await page.close();
      }
    }

    logger.info(`🔵 다음 크롤링 완료 - 성공: ${totalSuccess}, 실패: ${totalFailed}`);
    return { success: totalSuccess, failed: totalFailed };
  }

  /**
   * 네이버 뉴스 크롤링
   */
  async crawlNaver(limitPerSection: number = 20): Promise<{ success: number; failed: number }> {
    if (!this.browser) {
      throw new Error('브라우저가 초기화되지 않았습니다');
    }

    logger.info('🟢 네이버 뉴스 크롤링 시작');

    let totalSuccess = 0;
    let totalFailed = 0;

    const allSectionUrls = this.naverParser.getSectionUrls();

    // 이 인스턴스에 할당된 섹션만 필터링
    const sectionUrls = allSectionUrls.filter(url => this.isAssignedToThisInstance(url));

    logger.info(`📂 전체 ${allSectionUrls.length}개 섹션 중 ${sectionUrls.length}개 담당 (인스턴스 ${this.instanceId})`);

    for (const sectionUrl of sectionUrls) {
      const page = await this.browser.newPage();

      try {
        // URL 목록 추출
        const articleUrls = await this.naverParser.extractArticleUrls(page, sectionUrl);
        logger.info(`  📄 ${articleUrls.length}개 기사 URL 발견`);

        // 각 기사 파싱
        for (const url of articleUrls.slice(0, limitPerSection)) {
          try {
            const article = await this.naverParser.parseArticle(page, url);

            if (article && this.naverParser.validateArticle(article)) {
              await this.saveArticle(article);
              totalSuccess++;
            } else {
              totalFailed++;
            }
          } catch (error) {
            logger.error(`기사 파싱 실패: ${url}`, error);
            totalFailed++;
          }
        }
      } catch (error) {
        logger.error(`섹션 크롤링 실패: ${sectionUrl}`, error);
      } finally {
        await page.close();
      }
    }

    logger.info(`🟢 네이버 크롤링 완료 - 성공: ${totalSuccess}, 실패: ${totalFailed}`);
    return { success: totalSuccess, failed: totalFailed };
  }

  /**
   * 모든 사이트 크롤링 (순차 실행)
   */
  async crawlAll(limitPerSection: number = 20): Promise<void> {
    logger.info('🚀 전체 크롤링 시작');

    const daumResult = await this.crawlDaum(limitPerSection);
    const naverResult = await this.crawlNaver(limitPerSection);

    const totalSuccess = daumResult.success + naverResult.success;
    const totalFailed = daumResult.failed + naverResult.failed;

    logger.info(`\n✅ 전체 크롤링 완료`);
    logger.info(`  📊 총 성공: ${totalSuccess}개`);
    logger.info(`  ❌ 총 실패: ${totalFailed}개`);
  }

  /**
   * 기사 저장
   */
  private async saveArticle(
    article: DaumNewsData | NaverNewsData
  ): Promise<void> {
    const newsRepo = AppDataSource.getRepository(NewsArticle);

    // 중복 체크 (URL 기반)
    const existing = await newsRepo.findOne({ where: { url: article.url } });
    if (existing) {
      logger.debug(`이미 존재하는 기사: ${article.url}`);
      return;
    }

    // 최근 크롤링된 동일 제목 기사 체크 (1시간 이내)
    const recentDuplicate = await newsRepo
      .createQueryBuilder('article')
      .where('article.title = :title', { title: article.title })
      .andWhere('article.created_at > NOW() - INTERVAL \'1 hour\'')
      .getOne();

    if (recentDuplicate) {
      logger.debug(`최근 1시간 내 동일 제목 기사 존재: ${article.title.substring(0, 30)}...`);
      return;
    }

    // Source & Category 확보
    const { sourceId, categoryId } = await this.ensureSourceAndCategory(
      article.source,
      article.category
    );

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

    // ArticleStat 초기화
    try {
      await AppDataSource.query(
        `INSERT INTO article_stats (article_id, view_count, like_count, dislike_count, bookmark_count, comment_count, updated_at)
         VALUES ($1, 0, 0, 0, 0, 0, NOW())
         ON CONFLICT (article_id) DO NOTHING`,
        [saved.id]
      );
    } catch (error) {
      logger.warn(`ArticleStat 초기화 실패: ${saved.id}`);
    }

    logger.info(`💾 새 기사 저장: ${article.title.substring(0, 50)}...`);

    // AI 요약 (비동기, 실패해도 계속)
    summarizeArticle(saved.id, article.content).catch((error: any) => {
      logger.error(`AI 요약 실패 (기사 ID: ${saved.id}):`, error);
    });

    // AI 편향 분석 (비동기, 실패해도 계속)
    analyzeBias(saved.id, article.content).catch((error: any) => {
      logger.error(`AI 분석 실패 (기사 ID: ${saved.id}):`, error);
    });
  }

  /**
   * 종료
   */
  async shutdown(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      logger.info('🌐 Puppeteer 브라우저 종료');
    }

    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      logger.info('🗄️  데이터베이스 연결 종료');
    }
  }
}

export const unifiedCrawlerService = new UnifiedCrawlerService();
