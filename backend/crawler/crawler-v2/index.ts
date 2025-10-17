import 'reflect-metadata';
import dotenv from 'dotenv';

// 환경변수 먼저 로드
dotenv.config();

import express from 'express';
import cors from 'cors';
import { unifiedCrawlerService } from './unifiedCrawlerService';
import logger from './logger';

const app = express();
const PORT = parseInt(process.env.UNIFIED_CRAWLER_PORT || '4005', 10);

app.use(cors());
app.use(express.json());

// 헬스체크
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'FANS Unified Crawler Service'
  });
});

// 다음 뉴스 크롤링
app.post('/crawl/daum', async (req, res) => {
  try {
    const limit = Number(req.body?.limit) || 20;
    logger.info(`🔵 다음 크롤링 요청 (섹션당 ${limit}개)`);

    const result = await unifiedCrawlerService.crawlDaum(limit);

    res.json({
      message: '다음 크롤링 완료',
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('다음 크롤링 실패:', error);
    res.status(500).json({ error: '다음 크롤링 중 오류가 발생했습니다' });
  }
});

// 네이버 뉴스 크롤링
app.post('/crawl/naver', async (req, res) => {
  try {
    const limit = Number(req.body?.limit) || 20;
    logger.info(`🟢 네이버 크롤링 요청 (섹션당 ${limit}개)`);

    const result = await unifiedCrawlerService.crawlNaver(limit);

    res.json({
      message: '네이버 크롤링 완료',
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('네이버 크롤링 실패:', error);
    res.status(500).json({ error: '네이버 크롤링 중 오류가 발생했습니다' });
  }
});

// 전체 크롤링
app.post('/crawl/all', async (req, res) => {
  try {
    const limit = Number(req.body?.limit) || 20;
    logger.info(`🚀 전체 크롤링 요청 (섹션당 ${limit}개)`);

    // 비동기로 실행
    unifiedCrawlerService.crawlAll(limit).catch((error) => {
      logger.error('전체 크롤링 실패:', error);
    });

    res.json({
      message: '전체 크롤링 시작됨 (백그라운드)',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('전체 크롤링 시작 실패:', error);
    res.status(500).json({ error: '전체 크롤링 시작 중 오류가 발생했습니다' });
  }
});

// 크롤러 상태 조회
app.get('/status', (req, res) => {
  res.json({
    status: 'running',
    parsers: ['Daum (JSON)', 'Naver (Meta)'],
    endpoints: [
      'POST /crawl/daum - 다음 뉴스 크롤링',
      'POST /crawl/naver - 네이버 뉴스 크롤링',
      'POST /crawl/all - 전체 크롤링',
      'GET /status - 크롤러 상태',
      'GET /health - 헬스체크'
    ],
    timestamp: new Date().toISOString()
  });
});

async function startServer() {
  try {
    // 크롤러 초기화
    await unifiedCrawlerService.initialize();

    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Unified Crawler Service running on port ${PORT}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      logger.info(`🔵 Daum crawl: POST http://localhost:${PORT}/crawl/daum`);
      logger.info(`🟢 Naver crawl: POST http://localhost:${PORT}/crawl/naver`);
      logger.info(`🚀 All crawl: POST http://localhost:${PORT}/crawl/all`);

      // 자동 크롤링 활성화 (환경변수로 제어)
      const autoStart = process.env.AUTO_CRAWL === 'true';
      if (autoStart) {
        const intervalMinutes = parseInt(process.env.CRAWL_INTERVAL_MINUTES || '30');
        const limitPerSection = parseInt(process.env.CRAWL_LIMIT_PER_SECTION || '20');

        logger.info(`\n⏰ 자동 크롤링 활성화 (${intervalMinutes}분마다, 섹션당 ${limitPerSection}개)`);

        setInterval(async () => {
          logger.info('\n⏱️  스케줄 크롤링 시작...');
          try {
            await unifiedCrawlerService.crawlAll(limitPerSection);
          } catch (error) {
            logger.error('스케줄 크롤링 실패:', error);
          }
        }, intervalMinutes * 60 * 1000);

        // 최초 1회 즉시 실행
        logger.info('📰 최초 크롤링 시작...');
        unifiedCrawlerService.crawlAll(limitPerSection).catch((error) => {
          logger.error('최초 크롤링 실패:', error);
        });
      } else {
        logger.info('\n⏸️  자동 크롤링 비활성화 - 수동 실행 모드');
        logger.info(`   시작하려면: POST http://localhost:${PORT}/crawl/all`);
      }
    });
  } catch (error) {
    logger.error('❌ Failed to start Unified Crawler service:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('\n🛑 SIGTERM 신호 수신, 종료 중...');
  await unifiedCrawlerService.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('\n🛑 SIGINT 신호 수신, 종료 중...');
  await unifiedCrawlerService.shutdown();
  process.exit(0);
});

startServer();
