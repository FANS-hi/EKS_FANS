import { DataSource } from 'typeorm';
import logger from './logger';

/**
 * TypeORM 데이터 소스 설정
 * AI Worker는 news_articles와 bias_analysis 테이블만 사용
 */

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'fans_admin',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'fans_db',
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
  synchronize: false, // AI Worker는 스키마 변경 안 함
  logging: process.env.NODE_ENV === 'development',
  entities: [], // 엔티티 클래스 없이 raw query만 사용
  migrations: [],
});

/**
 * 데이터베이스 초기화
 */
export async function initializeDatabase(): Promise<void> {
  try {
    await AppDataSource.initialize();
    logger.info('✅ 데이터베이스 연결 완료');
  } catch (error) {
    logger.error('❌ 데이터베이스 연결 실패:', error);
    throw error;
  }
}

/**
 * 데이터베이스 종료
 */
export async function closeDatabase(): Promise<void> {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
    logger.info('🗄️  데이터베이스 연결 종료');
  }
}
