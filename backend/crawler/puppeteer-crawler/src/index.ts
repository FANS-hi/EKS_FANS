import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import os from 'os';
import logger from '../shared/config/logger';
import { SchedulerService } from '../shared/services/schedulerService';
import { NewsCrawlerService } from './services/newsCrawlerService';
import { getPuppeteerPool } from './services/puppeteerPoolService';

// 환경 변수 로드
dotenv.config({ path: '../../../.env' });

const app = express();
const PORT = process.env.PUPPETEER_CRAWLER_PORT || 4004;

app.use(express.json());

// 크롤러 서비스
let crawlerService: NewsCrawlerService;
let isInitialized = false;

// 스케줄러 인스턴스 생성
const schedulerService = new SchedulerService(
  undefined,
  'Puppeteer Crawler'
);

/**
 * 헬스체크
 */
app.get('/health', (req: Request, res: Response) => {
  const pool = getPuppeteerPool();
  const stats = pool.getPoolStats();

  res.json({
    status: 'ok',
    service: 'puppeteer-crawler',
    initialized: isInitialized,
    browserPool: stats,
  });
});

/**
 * 특정 언론사 크롤링
 * POST /crawl/:sourceName
 */
app.post('/crawl/:sourceName', async (req: Request, res: Response) => {
  if (!isInitialized) {
    return res.status(503).json({ error: 'Service not initialized' });
  }

  const { sourceName } = req.params;
  logger.info(`수동 크롤링 요청: ${sourceName}`);

  try {
    const result = await crawlerService.crawlSource(sourceName);
    res.json({
      success: true,
      sourceName,
      result,
    });
  } catch (error: any) {
    logger.error(`크롤링 실패: ${sourceName}`, error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Crawl failed',
    });
  }
});

/**
 * 전체 언론사 크롤링
 * POST /crawl-all
 */
app.post('/crawl-all', async (req: Request, res: Response) => {
  if (!isInitialized) {
    return res.status(503).json({ error: 'Service not initialized' });
  }

  logger.info('전체 크롤링 요청');

  try {
    // 비동기로 실행 (응답은 즉시)
    crawlerService.crawlAll().catch((error) => {
      logger.error('전체 크롤링 오류', error);
    });

    res.json({
      success: true,
      message: 'Crawling started in background',
    });
  } catch (error: any) {
    logger.error('전체 크롤링 시작 실패', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Crawl start failed',
    });
  }
});

/**
 * 브라우저 풀 상태 조회
 * GET /pool-stats
 */
app.get('/pool-stats', (req: Request, res: Response) => {
  const pool = getPuppeteerPool();
  const stats = pool.getPoolStats();

  res.json({
    success: true,
    stats,
  });
});

/**
 * 서버 시작
 */
async function startServer() {
  try {
    logger.info('Puppeteer Crawler 서비스 시작 중...');

    // 크롤러 서비스 초기화
    crawlerService = new NewsCrawlerService();
    await crawlerService.initialize();
    isInitialized = true;

    logger.info('크롤러 서비스 초기화 완료');

    // Express 서버 시작
    app.listen(PORT, () => {
      logger.info(`Puppeteer Crawler 서버 시작 - 포트: ${PORT}`);
    });

    // 자동 크롤링 활성화
    if (process.env.AUTO_CRAWL === 'true') {
      logger.info(`\n⏰ 자동 크롤링 활성화`);

      // 크롤링 함수 설정
      schedulerService.setCrawlFunction(async () => {
        await crawlerService.crawlAll();
      }, 'Puppeteer Crawler');

      schedulerService.start({
        enabled: true
      });
    }
  } catch (error) {
    logger.error('서버 시작 실패', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM 시그널 수신, 종료 중...');
  const pool = getPuppeteerPool();
  await pool.destroy();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT 시그널 수신, 종료 중...');
  const pool = getPuppeteerPool();
  await pool.destroy();
  process.exit(0);
});

// 서버 시작
startServer();
