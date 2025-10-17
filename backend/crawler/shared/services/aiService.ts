import axios from 'axios';
import { AppDataSource } from '../config/database';
import logger from '../config/logger';

/**
 * AI 요약 서비스
 */
export async function summarizeArticle(articleId: number, content: string): Promise<void> {
  if (!content || content.length < 100) {
    logger.info(`[AI 요약 스킵] 기사 ${articleId}: 내용이 너무 짧음`);
    return;
  }

  try {
    const SUMMARIZE_AI_URL = process.env.SUMMARIZE_AI_URL || 'http://summarize-ai:8000';

    // summarize-ai 서비스 호출
    const response = await axios.post(`${SUMMARIZE_AI_URL}/ai/summarize`, {
      text: content,
      max_length: 150
    }, {
      timeout: 30000 // 30초 타임아웃
    });

    if (response.data && response.data.summary) {
      // news_articles 테이블의 ai_summary 업데이트
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
 * AI 편향성 분석 서비스
 */
export async function analyzeBias(articleId: number, content: string, sourceName?: string): Promise<void> {
  if (!content || content.length < 100) {
    logger.info(`[편향성 분석 스킵] 기사 ${articleId}: 내용이 너무 짧음`);
    return;
  }

  try {
    const BIAS_AI_URL = process.env.BIAS_AI_URL || 'http://bias-analysis-ai:8002';

    // 언론사 이름이 없으면 DB에서 조회
    let sourceNameToUse = sourceName;
    if (!sourceNameToUse) {
      const newsRepo = AppDataSource.getRepository('NewsArticle');
      const article = await newsRepo.findOne({
        where: { id: articleId },
        relations: ['source']
      });
      sourceNameToUse = article?.source?.name || '기타';
    }

    // bias-analysis-ai 서비스 호출
    const response = await axios.post(`${BIAS_AI_URL}/analyze/full`, {
      text: content,
      article_id: articleId,
      source_name: sourceNameToUse
    }, {
      timeout: 30000 // 30초 타임아웃
    });

    if (response.data) {
      // BiasAnalysis 엔티티에 저장
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
