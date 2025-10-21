import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware';
import { RecommendationService } from '../services/recommendationService';
import logger from '../config/logger';

const router = Router();
const recommendationService = new RecommendationService();

/**
 * 개인화 추천 뉴스
 * GET /api/recommendations
 */
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 20;

    logger.info(`Generating recommendations for user ${userId}`);

    const recommendations = await recommendationService.getPersonalizedRecommendations(
      userId,
      limit
    );

    return res.json({
      success: true,
      data: {
        recommendations,
        count: recommendations.length,
        generated_at: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error('Recommendations API error:', error);
    return res.status(500).json({
      success: false,
      error: '추천 생성 중 오류가 발생했습니다.'
    });
  }
});

/**
 * 추천 새로고침 (캐시 무효화)
 * POST /api/recommendations/refresh
 */
router.post('/refresh', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // 캐시 삭제
    const { AppDataSource } = await import('../config/database');
    await AppDataSource.query(
      `DELETE FROM user_recommendations WHERE user_id = $1`,
      [userId]
    );

    logger.info(`Refreshed recommendations cache for user ${userId}`);

    return res.json({
      success: true,
      message: '추천이 새로고침되었습니다.'
    });
  } catch (error: any) {
    logger.error('Recommendations refresh error:', error);
    return res.status(500).json({
      success: false,
      error: '추천 새로고침 중 오류가 발생했습니다.'
    });
  }
});

export default router;
