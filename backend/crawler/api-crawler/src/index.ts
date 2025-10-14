import 'reflect-metadata';
import dotenv from 'dotenv';

// 환경변수 먼저 로드 (docker-compose의 env_file이 우선, 없으면 로컬 .env)
dotenv.config();

import express from 'express';
import cors from 'cors';
import { AppDataSource } from '../shared/config/database';
import { newsCrawlerService } from './services/newsCrawlerService';
import { SchedulerService } from '../shared/services/schedulerService';
import logger from '../shared/config/logger';

const app = express();
const PORT = parseInt(process.env.API_CRAWLER_PORT || '4003', 10);

// 스케줄러 인스턴스 생성
const schedulerService = new SchedulerService(
  undefined,
  'API Crawler'
);

app.use(cors());
app.use(express.json());

// 헬스체크
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'FANS API Crawler Service'
  });
});

// API 크롤링 시작
app.post('/crawl/start', async (req, res) => {
  try {
    logger.info('Request body:', req.body);
    const limit = Number(req.body?.limit) || 5; // 기본값 5
    logger.info(`📰 API 크롤링 시작... (카테고리당 ${limit}개)`);
    const results = await newsCrawlerService.crawlAllCategories(limit);

    let totalCollected = 0;
    const summary: string[] = [];

    for (const [category, articles] of Object.entries(results)) {
      totalCollected += articles.length;
      summary.push(`${category}: ${articles.length}개`);
    }

    res.json({
      message: 'API 크롤링 완료',
      totalCollected,
      results: summary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('API 크롤링 실패:', error);
    res.status(500).json({ error: 'API 크롤링 실행 중 오류가 발생했습니다' });
  }
});

// 지원하는 카테고리 조회
app.get('/categories', (req, res) => {
  res.json({
    supportedCategories: newsCrawlerService.getSupportedCategories(),
    timestamp: new Date().toISOString()
  });
});

// 기존 기사 편향성 분석 (분석 안된 기사들)
app.post('/analyze/backfill', async (req, res) => {
  try {
    const limit = Number(req.body?.limit) || 100; // 기본값 100개씩
    logger.info(`📊 기존 기사 편향성 분석 시작... (최대 ${limit}개)`);

    const result = await newsCrawlerService.analyzeExistingArticles(limit);

    res.json({
      message: '기존 기사 분석 완료',
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('기존 기사 분석 실패:', error);
    res.status(500).json({ error: '기존 기사 분석 중 오류가 발생했습니다' });
  }
});

// 크롤러 상태 조회
app.get('/status', (_req, res) => {
  const schedulerStatus = schedulerService.getStatus();
  res.json({
    status: 'running',
    scheduler: schedulerStatus,
    supportedCategories: newsCrawlerService.getSupportedCategories(),
    endpoints: [
      'POST /crawl/start - API 크롤링 시작',
      'POST /analyze/backfill - 기존 기사 편향성 분석',
      'POST /scheduler/start - 스케줄러 시작',
      'POST /scheduler/stop - 스케줄러 중지',
      'GET /categories - 지원하는 카테고리 목록',
      'GET /status - 크롤러 상태 조회',
      'GET /health - 헬스체크'
    ],
    timestamp: new Date().toISOString()
  });
});

// 스케줄러 시작
app.post('/scheduler/start', (req, res) => {
  try {
    const config = req.body;
    schedulerService.start(config);
    res.json({
      message: '스케줄러가 시작되었습니다',
      status: schedulerService.getStatus()
    });
  } catch (error: any) {
    logger.error('스케줄러 시작 실패:', error);
    res.status(500).json({ error: error?.message || '스케줄러 시작 실패' });
  }
});

// 스케줄러 중지
app.post('/scheduler/stop', (_req, res) => {
  try {
    schedulerService.stop();
    res.json({
      message: '스케줄러가 중지되었습니다',
      status: schedulerService.getStatus()
    });
  } catch (error: any) {
    logger.error('스케줄러 중지 실패:', error);
    res.status(500).json({ error: error?.message || '스케줄러 중지 실패' });
  }
});

async function startServer() {
  try {
    await AppDataSource.initialize();
    logger.info('✅ Database connected successfully');

    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 API Crawler Service running on port ${PORT}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      logger.info(`📰 API crawl: POST http://localhost:${PORT}/crawl/start`);
      logger.info(`📋 API categories: GET http://localhost:${PORT}/categories`);
      logger.info(`🕒 Scheduler status: GET http://localhost:${PORT}/status`);

      // 자동 크롤링 활성화 (환경변수로 제어)
      const autoStart = process.env.AUTO_CRAWL === 'true';
      if (autoStart) {
        const limitPerCategory = parseInt(process.env.CRAWL_LIMIT_PER_CATEGORY || '20');

        logger.info(`\n⏰ 자동 크롤링 활성화 (카테고리당 ${limitPerCategory}개)`);

        // 크롤링 함수 설정
        schedulerService.setCrawlFunction(async () => {
          const results = await newsCrawlerService.crawlAllCategories(limitPerCategory);

          let totalCollected = 0;
          for (const [category, articles] of Object.entries(results)) {
            totalCollected += articles.length;
            logger.info(`  ✓ ${category}: ${articles.length}개`);
          }

          logger.info(`📊 총 ${totalCollected}개 수집`);
        }, 'API Crawler');

        schedulerService.start({
          enabled: true
        });
      } else {
        logger.info('\n⏸️  자동 크롤링 비활성화 - 수동 실행 모드');
        logger.info('   시작하려면: POST http://localhost:${PORT}/scheduler/start');
      }
    });
  } catch (error) {
    logger.error('❌ Failed to start API crawler service:', error);
    process.exit(1);
  }
}

startServer();