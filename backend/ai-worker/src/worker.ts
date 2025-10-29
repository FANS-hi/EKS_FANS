import { SQS, Message } from '@aws-sdk/client-sqs';
import axios from 'axios';
import { AppDataSource } from './config/database';
import logger from './config/logger';

/**
 * AI Worker
 * SQS에서 AI 작업을 가져와서 처리하는 워커
 */

const sqs = new SQS({
  region: process.env.AWS_REGION || 'ap-northeast-2',
});

const SUMMARIZE_QUEUE_URL = process.env.SQS_SUMMARIZE_QUEUE_URL || '';
const BIAS_QUEUE_URL = process.env.SQS_BIAS_QUEUE_URL || '';
const SUMMARIZE_AI_URL = process.env.SUMMARIZE_AI_URL || 'http://summarize-ai:8000';
const BIAS_AI_URL = process.env.BIAS_AI_URL || 'http://bias-analysis-ai:8002';

// 동시 처리 제한 (환경 변수로 조정 가능)
const MAX_CONCURRENT_JOBS = parseInt(process.env.MAX_CONCURRENT_JOBS || '5');

interface SummarizeJob {
  type: 'summarize';
  articleId: number;
  content: string;
}

interface BiasAnalysisJob {
  type: 'bias';
  articleId: number;
  content: string;
  sourceName?: string;
}

export class AIWorker {
  private isRunning = false;
  private activeJobs = 0;

  /**
   * Worker 시작
   */
  async start(): Promise<void> {
    this.isRunning = true;
    logger.info('🚀 AI Worker 시작');
    logger.info(`   동시 처리 제한: ${MAX_CONCURRENT_JOBS}개`);
    logger.info(`   요약 큐: ${SUMMARIZE_QUEUE_URL}`);
    logger.info(`   편향 큐: ${BIAS_QUEUE_URL}`);

    // 두 큐를 동시에 폴링
    const promises = [
      this.pollQueue('summarize', SUMMARIZE_QUEUE_URL),
      this.pollQueue('bias', BIAS_QUEUE_URL),
    ];

    await Promise.all(promises);
  }

  /**
   * Worker 정지
   */
  stop(): void {
    this.isRunning = false;
    logger.info('⏹️  AI Worker 정지 중...');
  }

  /**
   * 큐 폴링 (Long Polling)
   */
  private async pollQueue(queueType: 'summarize' | 'bias', queueUrl: string): Promise<void> {
    while (this.isRunning) {
      try {
        // 동시 처리 제한 확인
        if (this.activeJobs >= MAX_CONCURRENT_JOBS) {
          logger.debug(`동시 작업 제한 도달 (${this.activeJobs}/${MAX_CONCURRENT_JOBS}), 대기 중...`);
          await this.sleep(1000);
          continue;
        }

        // SQS에서 메시지 수신 (Long Polling 20초)
        const response = await sqs.receiveMessage({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: 1,
          WaitTimeSeconds: 20, // Long Polling
          VisibilityTimeout: 60, // 처리 중 다른 worker가 가져가지 못하게
        });

        if (!response.Messages || response.Messages.length === 0) {
          continue; // 메시지 없음, 다시 폴링
        }

        // 메시지 처리 (비동기로 처리하고 바로 다음 메시지 폴링)
        const message = response.Messages[0];
        this.processMessage(queueType, queueUrl, message).catch((error) => {
          logger.error(`메시지 처리 실패:`, error);
        });

      } catch (error: any) {
        logger.error(`큐 폴링 오류 (${queueType}):`, error?.message || error);
        await this.sleep(5000); // 에러 시 5초 대기
      }
    }
  }

  /**
   * 메시지 처리
   */
  private async processMessage(
    queueType: 'summarize' | 'bias',
    queueUrl: string,
    message: Message
  ): Promise<void> {
    this.activeJobs++;
    const startTime = Date.now();

    try {
      const job = JSON.parse(message.Body || '{}');
      logger.info(`[${queueType}] 작업 시작: 기사 ${job.articleId}`);

      if (queueType === 'summarize') {
        await this.processSummarize(job as SummarizeJob);
      } else {
        await this.processBias(job as BiasAnalysisJob);
      }

      // 처리 완료 - 메시지 삭제
      await sqs.deleteMessage({
        QueueUrl: queueUrl,
        ReceiptHandle: message.ReceiptHandle!,
      });

      const duration = Date.now() - startTime;
      logger.info(`[${queueType}] 작업 완료: 기사 ${job.articleId} (${duration}ms)`);

    } catch (error: any) {
      logger.error(`메시지 처리 실패:`, error?.message || error);
      // 메시지 삭제 안 함 → 자동으로 다시 큐에 들어감 (최대 3번 재시도)
    } finally {
      this.activeJobs--;
    }
  }

  /**
   * AI 요약 처리
   */
  private async processSummarize(job: SummarizeJob): Promise<void> {
    try {
      const response = await axios.post(
        `${SUMMARIZE_AI_URL}/ai/summarize`,
        {
          text: job.content,
          max_length: 150,
        },
        { timeout: 30000 }
      );

      if (response.data && response.data.summary) {
        // DB 업데이트
        await AppDataSource.query(
          'UPDATE news_articles SET ai_summary = $1 WHERE id = $2',
          [response.data.summary, job.articleId]
        );

        logger.info(`✅ 요약 완료: 기사 ${job.articleId}`);
      }
    } catch (error: any) {
      logger.error(`요약 처리 실패 (기사 ${job.articleId}):`, error?.message || error);
      throw error;
    }
  }

  /**
   * AI 편향 분석 처리
   */
  private async processBias(job: BiasAnalysisJob): Promise<void> {
    try {
      // 언론사 이름 조회 (없으면 DB에서)
      let sourceName = job.sourceName;
      if (!sourceName) {
        const result = await AppDataSource.query(
          `SELECT s.name FROM news_articles a
           JOIN sources s ON a.source_id = s.id
           WHERE a.id = $1`,
          [job.articleId]
        );
        sourceName = result[0]?.name || '기타';
      }

      const response = await axios.post(
        `${BIAS_AI_URL}/analyze/full`,
        {
          text: job.content,
          article_id: job.articleId,
          source_name: sourceName,
        },
        { timeout: 30000 }
      );

      if (response.data) {
        // bias_analysis 테이블에 저장
        await AppDataSource.query(
          `INSERT INTO bias_analysis (article_id, bias_score, political_leaning, confidence, analysis_data, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
           ON CONFLICT (article_id) DO UPDATE SET
             bias_score = $2,
             political_leaning = $3,
             confidence = $4,
             analysis_data = $5,
             updated_at = NOW()`,
          [
            job.articleId,
            response.data.bias_score || 0,
            response.data.political_leaning || '중립',
            response.data.confidence || 0,
            JSON.stringify(response.data),
          ]
        );

        logger.info(`✅ 편향 분석 완료: 기사 ${job.articleId} (${sourceName}): ${response.data.bias_score || 0}`);
      }
    } catch (error: any) {
      logger.error(`편향 분석 실패 (기사 ${job.articleId}):`, error?.message || error);
      throw error;
    }
  }

  /**
   * Sleep 헬퍼
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
