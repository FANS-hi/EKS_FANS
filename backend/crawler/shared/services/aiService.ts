import axios from 'axios';
import { AppDataSource } from '../config/database';
import logger from '../config/logger';
import { sendSummarizeJob, sendBiasAnalysisJob } from '../../../shared/services/sqsService';

/**
 * AI 요약 서비스 (SQS 사용)
 *
 * ❌ 기존: 크롤러에서 AI 서비스 직접 호출 → 동시 요청 폭주로 OOMKilled
 * ✅ 신규: SQS 큐에 작업만 전송 → AI Worker가 순차 처리
 */
export async function summarizeArticle(articleId: number, content: string): Promise<void> {
  // SQS 사용 여부 (환경 변수로 제어)
  const USE_SQS = process.env.USE_SQS === 'true';

  if (USE_SQS) {
    // ✅ SQS로 작업 전송 (비블로킹, 즉시 반환)
    try {
      await sendSummarizeJob(articleId, content);
    } catch (error: any) {
      logger.error(`[SQS 전송 실패] 요약 작업 ${articleId} - 직접 호출로 fallback:`, error?.message);
      // SQS 실패 시 기존 방식으로 fallback
      await summarizeArticleDirect(articleId, content);
    }
  } else {
    // ❌ 기존 방식: 직접 호출 (OOM 위험)
    await summarizeArticleDirect(articleId, content);
  }
}

/**
 * AI 편향성 분석 서비스 (SQS 사용)
 */
export async function analyzeBias(articleId: number, content: string, sourceName?: string): Promise<void> {
  const USE_SQS = process.env.USE_SQS === 'true';

  if (USE_SQS) {
    // ✅ SQS로 작업 전송
    try {
      await sendBiasAnalysisJob(articleId, content, sourceName);
    } catch (error: any) {
      logger.error(`[SQS 전송 실패] 편향 분석 작업 ${articleId} - 직접 호출로 fallback:`, error?.message);
      await analyzeBiasDirect(articleId, content, sourceName);
    }
  } else {
    // ❌ 기존 방식
    await analyzeBiasDirect(articleId, content, sourceName);
  }
}

// ==================== 직접 호출 함수 (Fallback용) ====================

/**
 * AI 요약 직접 호출 (기존 방식)
 */
async function summarizeArticleDirect(articleId: number, content: string): Promise<void> {
  if (!content || content.length < 100) {
    logger.info(`[AI 요약 스킵] 기사 ${articleId}: 내용이 너무 짧음`);
    return;
  }

  try {
    const SUMMARIZE_AI_URL = process.env.SUMMARIZE_AI_URL || 'http://summarize-ai:8000';

    const response = await axios.post(`${SUMMARIZE_AI_URL}/ai/summarize`, {
      text: content,
      max_length: 150
    }, {
      timeout: 30000
    });

    if (response.data && response.data.summary) {
      const newsRepo = AppDataSource.getRepository('NewsArticle');
      await newsRepo.update(articleId, {
        aiSummary: response.data.summary
      });

      logger.info(`[AI 요약 완료] 기사 ${articleId}`);
    }
  } catch (error: any) {
    logger.error(`[AI 요약 오류] 기사 ${articleId}:`, error?.message || error);
    throw error;
  }
}

/**
 * AI 편향 분석 직접 호출 (기존 방식)
 */
async function analyzeBiasDirect(articleId: number, content: string, sourceName?: string): Promise<void> {
  if (!content || content.length < 100) {
    logger.info(`[편향성 분석 스킵] 기사 ${articleId}: 내용이 너무 짧음`);
    return;
  }

  try {
    const BIAS_AI_URL = process.env.BIAS_AI_URL || 'http://bias-analysis-ai:8002';

    let sourceNameToUse = sourceName;
    if (!sourceNameToUse) {
      const newsRepo = AppDataSource.getRepository('NewsArticle');
      const article = await newsRepo.findOne({
        where: { id: articleId },
        relations: ['source']
      });
      sourceNameToUse = article?.source?.name || '기타';
    }

    const response = await axios.post(`${BIAS_AI_URL}/analyze/full`, {
      text: content,
      article_id: articleId,
      source_name: sourceNameToUse
    }, {
      timeout: 30000
    });

    if (response.data) {
      const biasRepo = AppDataSource.getRepository('BiasAnalysis');

      const biasAnalysis = biasRepo.create({
        articleId: articleId,
        biasScore: response.data.bias_score || 0,
        politicalLeaning: response.data.political_leaning || '중립',
        confidence: response.data.confidence || 0,
        analysisData: response.data
      });

      await biasRepo.save(biasAnalysis);
      logger.info(`[편향성 분석 완료] 기사 ${articleId} (${sourceNameToUse}): 점수 ${response.data.bias_score || 0}`);
    }
  } catch (error: any) {
    logger.error(`[편향성 분석 오류] 기사 ${articleId}:`, error?.message || error);
    throw error;
  }
}
