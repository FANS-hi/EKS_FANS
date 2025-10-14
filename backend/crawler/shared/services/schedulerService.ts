import logger from '../config/logger';

export interface SchedulerConfig {
  intervalMinutes: number;
  enabled: boolean;
}

type CrawlFunction = () => Promise<any>;

/**
 * 범용 스케줄러 서비스
 * API Crawler와 Puppeteer Crawler 모두에서 사용 가능
 * 환경변수 CRAWL_INTERVAL_MINUTES로 간격 통일 설정
 */
export class SchedulerService {
  private intervalId: NodeJS.Timeout | null = null;
  private config: SchedulerConfig = {
    intervalMinutes: parseInt(process.env.CRAWL_INTERVAL_MINUTES || '5'), // 환경변수에서 읽음
    enabled: false
  };
  private isRunning = false;
  private lastRunTime: Date | null = null;
  private nextRunTime: Date | null = null;
  private crawlFunction: CrawlFunction | null = null;
  private serviceName: string = 'Crawler';

  /**
   * 생성자
   * @param crawlFunction 크롤링 함수
   * @param serviceName 서비스 이름 (로그용)
   */
  constructor(crawlFunction?: CrawlFunction, serviceName?: string) {
    if (crawlFunction) {
      this.crawlFunction = crawlFunction;
    }
    if (serviceName) {
      this.serviceName = serviceName;
    }

    // 환경변수 로그
    logger.info(`[${this.serviceName}] Scheduler initialized with interval: ${this.config.intervalMinutes} minutes`);
  }

  /**
   * 크롤링 함수 설정
   */
  setCrawlFunction(crawlFunction: CrawlFunction, serviceName?: string): void {
    this.crawlFunction = crawlFunction;
    if (serviceName) {
      this.serviceName = serviceName;
    }
  }

  /**
   * 스케줄러 시작
   */
  start(config?: Partial<SchedulerConfig>): void {
    if (!this.crawlFunction) {
      throw new Error('크롤링 함수가 설정되지 않았습니다. setCrawlFunction()을 먼저 호출하세요.');
    }

    if (this.config.enabled) {
      logger.info(`📅 ${this.serviceName} 스케줄러가 이미 실행 중입니다.`);
      return;
    }

    // 설정 업데이트
    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.config.enabled = true;
    const intervalMs = this.config.intervalMinutes * 60 * 1000;

    logger.info(`🕒 ${this.serviceName} 스케줄러 시작: ${this.config.intervalMinutes}분마다 실행`);

    // 첫 실행은 즉시
    this.runCrawling();

    // 이후 주기적 실행
    this.intervalId = setInterval(() => {
      this.runCrawling();
    }, intervalMs);

    this.updateNextRunTime();
  }

  /**
   * 스케줄러 중지
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.config.enabled = false;
    this.nextRunTime = null;
    logger.info(`🛑 ${this.serviceName} 스케줄러 중지됨`);
  }

  /**
   * 크롤링 실행
   */
  private async runCrawling(): Promise<void> {
    if (this.isRunning) {
      logger.info(`⏳ ${this.serviceName}: 이전 크롤링이 아직 실행 중입니다. 건너뜁니다.`);
      return;
    }

    if (!this.crawlFunction) {
      logger.error(`❌ ${this.serviceName}: 크롤링 함수가 설정되지 않았습니다.`);
      return;
    }

    this.isRunning = true;
    this.lastRunTime = new Date();

    try {
      logger.info(`\n📰 [${this.lastRunTime.toLocaleString('ko-KR')}] ${this.serviceName} 크롤링 시작...`);

      await this.crawlFunction();

      logger.info(`✅ ${this.serviceName} 크롤링 완료\n`);
    } catch (error) {
      logger.error(`❌ ${this.serviceName} 크롤링 실패:`, error);
    } finally {
      this.isRunning = false;
      this.updateNextRunTime();
    }
  }

  /**
   * 다음 실행 시간 업데이트
   */
  private updateNextRunTime(): void {
    if (this.config.enabled) {
      const nextTime = new Date(Date.now() + this.config.intervalMinutes * 60 * 1000);
      this.nextRunTime = nextTime;
    }
  }

  /**
   * 스케줄러 상태 조회
   */
  getStatus(): {
    enabled: boolean;
    isRunning: boolean;
    lastRunTime: Date | null;
    nextRunTime: Date | null;
    config: SchedulerConfig;
  } {
    return {
      enabled: this.config.enabled,
      isRunning: this.isRunning,
      lastRunTime: this.lastRunTime,
      nextRunTime: this.nextRunTime,
      config: { ...this.config }
    };
  }

  /**
   * 스케줄러 설정 업데이트
   */
  updateConfig(config: Partial<SchedulerConfig>): void {
    const wasEnabled = this.config.enabled;

    // 설정 업데이트
    this.config = { ...this.config, ...config };

    // 실행 중이면 재시작
    if (wasEnabled && this.config.enabled) {
      this.stop();
      this.start(this.config);
    }
  }
}
