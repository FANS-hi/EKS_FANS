import { initializeDatabase, closeDatabase } from './config/database';
import { AIWorker } from './worker';
import logger from './config/logger';

/**
 * AI Worker 메인 엔트리 포인트
 */

async function main() {
  logger.info('===================================');
  logger.info('🤖 FANS AI Worker 시작');
  logger.info('===================================');

  let worker: AIWorker | null = null;

  try {
    // 1. 데이터베이스 초기화
    await initializeDatabase();

    // 2. Worker 시작
    worker = new AIWorker();
    await worker.start();

  } catch (error) {
    logger.error('AI Worker 오류:', error);
    process.exit(1);
  }

  // Graceful Shutdown
  const shutdown = async (signal: string) => {
    logger.info(`\n${signal} 신호 수신 - Graceful Shutdown 시작`);

    if (worker) {
      worker.stop();
    }

    await closeDatabase();

    logger.info('👋 AI Worker 종료');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  logger.error('AI Worker 실행 실패:', error);
  process.exit(1);
});
