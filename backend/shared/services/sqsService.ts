import { SQS } from '@aws-sdk/client-sqs';
import logger from '../config/logger';

/**
 * SQS 서비스
 * AI 작업을 큐에 전송하는 서비스
 */

const sqs = new SQS({
  region: process.env.AWS_REGION || 'ap-northeast-2',
});

// 큐 URL (환경 변수에서 가져오거나 기본값)
const SUMMARIZE_QUEUE_URL = process.env.SQS_SUMMARIZE_QUEUE_URL || '';
const BIAS_QUEUE_URL = process.env.SQS_BIAS_QUEUE_URL || '';

export interface SummarizeJob {
  type: 'summarize';
  articleId: number;
  content: string;
}

export interface BiasAnalysisJob {
  type: 'bias';
  articleId: number;
  content: string;
  sourceName?: string;
}

/**
 * AI 요약 작업을 SQS에 전송
 */
export async function sendSummarizeJob(articleId: number, content: string): Promise<void> {
  if (!SUMMARIZE_QUEUE_URL) {
    logger.warn('[SQS] SUMMARIZE_QUEUE_URL이 설정되지 않음 - 직접 호출로 fallback');
    throw new Error('SQS_SUMMARIZE_QUEUE_URL not configured');
  }

  if (!content || content.length < 100) {
    logger.info(`[SQS 스킵] 요약 작업 ${articleId}: 내용이 너무 짧음`);
    return;
  }

  try {
    const message: SummarizeJob = {
      type: 'summarize',
      articleId,
      content: content.substring(0, 200000), // 최대 200KB (SQS 제한 256KB)
    };

    await sqs.sendMessage({
      QueueUrl: SUMMARIZE_QUEUE_URL,
      MessageBody: JSON.stringify(message),
      MessageAttributes: {
        articleId: {
          DataType: 'Number',
          StringValue: String(articleId),
        },
        type: {
          DataType: 'String',
          StringValue: 'summarize',
        },
      },
    });

    logger.info(`[SQS 전송 완료] 요약 작업 ${articleId}`);
  } catch (error: any) {
    logger.error(`[SQS 전송 실패] 요약 작업 ${articleId}:`, error?.message || error);
    throw error;
  }
}

/**
 * AI 편향 분석 작업을 SQS에 전송
 */
export async function sendBiasAnalysisJob(
  articleId: number,
  content: string,
  sourceName?: string
): Promise<void> {
  if (!BIAS_QUEUE_URL) {
    logger.warn('[SQS] BIAS_QUEUE_URL이 설정되지 않음 - 직접 호출로 fallback');
    throw new Error('SQS_BIAS_QUEUE_URL not configured');
  }

  if (!content || content.length < 100) {
    logger.info(`[SQS 스킵] 편향 분석 작업 ${articleId}: 내용이 너무 짧음`);
    return;
  }

  try {
    const message: BiasAnalysisJob = {
      type: 'bias',
      articleId,
      content: content.substring(0, 200000),
      sourceName,
    };

    await sqs.sendMessage({
      QueueUrl: BIAS_QUEUE_URL,
      MessageBody: JSON.stringify(message),
      MessageAttributes: {
        articleId: {
          DataType: 'Number',
          StringValue: String(articleId),
        },
        type: {
          DataType: 'String',
          StringValue: 'bias',
        },
      },
    });

    logger.info(`[SQS 전송 완료] 편향 분석 작업 ${articleId}`);
  } catch (error: any) {
    logger.error(`[SQS 전송 실패] 편향 분석 작업 ${articleId}:`, error?.message || error);
    throw error;
  }
}

/**
 * 큐 상태 확인 (모니터링용)
 */
export async function getQueueStats() {
  try {
    const [summarizeStats, biasStats] = await Promise.all([
      sqs.getQueueAttributes({
        QueueUrl: SUMMARIZE_QUEUE_URL,
        AttributeNames: ['ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible'],
      }),
      sqs.getQueueAttributes({
        QueueUrl: BIAS_QUEUE_URL,
        AttributeNames: ['ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible'],
      }),
    ]);

    return {
      summarize: {
        waiting: parseInt(summarizeStats.Attributes?.ApproximateNumberOfMessages || '0'),
        processing: parseInt(summarizeStats.Attributes?.ApproximateNumberOfMessagesNotVisible || '0'),
      },
      bias: {
        waiting: parseInt(biasStats.Attributes?.ApproximateNumberOfMessages || '0'),
        processing: parseInt(biasStats.Attributes?.ApproximateNumberOfMessagesNotVisible || '0'),
      },
    };
  } catch (error: any) {
    logger.error('[SQS] 큐 상태 조회 실패:', error?.message || error);
    return null;
  }
}
