import { Router, Request, Response } from 'express';
import { AppDataSource } from '../../config/database';
import { Category } from '../../entities/Category';
import { Source } from '../../entities/Source';
import logger from '../../config/logger';

const router = Router();

// 검색 정렬 옵션
const SEARCH_OPTIONS = [
  { value: 'date', label: '최신순' },
  { value: 'sim', label: '정확도순' },
  { value: 'relevance', label: '관련도순' }
];

// 카테고리 목록 API
router.get('/common/categories', async (req: Request, res: Response) => {
  try {
    const categoryRepository = AppDataSource.getRepository(Category);
    const categories = await categoryRepository.find({
      order: { id: 'ASC' }
    });

    const categoryNames = categories.map(category => category.name);

    res.json({
      success: true,
      data: categoryNames,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('카테고리 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: '카테고리 목록을 불러올 수 없습니다.'
    });
  }
});

// 언론사 목록 API
router.get('/common/media-sources', async (req: Request, res: Response) => {
  try {
    const sourceRepository = AppDataSource.getRepository(Source);
    const sources = await sourceRepository.find({
      order: { id: 'ASC' }
    });

    // "기타-"로 시작하지 않는 주요 언론사만 필터링
    const majorSources = sources.filter(source => !source.name.startsWith('기타-'));

    // 프론트엔드에서 기대하는 형태로 변환 (name, domain, logo_url 포함)
    const sourcesWithDomain = majorSources.map(source => ({
      name: source.name,
      domain: `${source.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`, // 임시 도메인 생성
      oid: source.id.toString(),
      logo_url: source.logo_url
    }));

    // "기타" 추가 (oid는 특별한 값으로)
    sourcesWithDomain.push({
      name: '기타',
      domain: 'others.com',
      oid: 'others',
      logo_url: undefined
    });

    res.json({
      success: true,
      data: sourcesWithDomain,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('언론사 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: '언론사 목록을 불러올 수 없습니다.'
    });
  }
});

// 검색 옵션 API
router.get('/common/search-options', (req, res) => {
  res.json({
    success: true,
    data: {
      sort: SEARCH_OPTIONS,
      pageSize: [10, 20, 30, 50, 100]
    },
    timestamp: new Date().toISOString()
  });
});

// 모든 공통 데이터 한번에 가져오기
router.get('/common/all', async (req: Request, res: Response) => {
  try {
    const categoryRepository = AppDataSource.getRepository(Category);
    const sourceRepository = AppDataSource.getRepository(Source);

    const [categories, sources] = await Promise.all([
      categoryRepository.find({ order: { id: 'ASC' } }),
      sourceRepository.find({ order: { id: 'ASC' } })
    ]);

    const categoryNames = categories.map(category => category.name);

    // "기타-"로 시작하지 않는 주요 언론사만 필터링
    const majorSources = sources.filter(source => !source.name.startsWith('기타-'));

    const sourcesWithDomain = majorSources.map(source => ({
      name: source.name,
      domain: `${source.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      oid: source.id.toString(),
      logo_url: source.logo_url
    }));

    // "기타" 추가
    sourcesWithDomain.push({
      name: '기타',
      domain: 'others.com',
      oid: 'others',
      logo_url: undefined
    });

    res.json({
      success: true,
      data: {
        categories: categoryNames,
        mediaSources: sourcesWithDomain,
        searchOptions: {
          sort: SEARCH_OPTIONS,
          pageSize: [10, 20, 30, 50, 100]
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('공통 데이터 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: '공통 데이터를 불러올 수 없습니다.'
    });
  }
});

export default router;