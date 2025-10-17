/**
 * 언론사 분류 모듈
 * 주요 언론사는 그대로, 미등록 언론사는 '기타-' prefix 추가
 */

// 주요 언론사 목록 (init.sql에 정의된 14개만)
const MAJOR_NEWS_SOURCES = [
  '연합뉴스',
  '동아일보',
  '문화일보',
  '세계일보',
  '조선일보',
  '중앙일보',
  '한겨레',
  '경향신문',
  '한국일보',
  '매일경제',
  '한국경제',
  '머니투데이',
  'YTN',
  'JTBC',
];

/**
 * 언론사명을 분류하여 반환
 * @param sourceName 원본 언론사명
 * @returns 분류된 언론사명 (주요 언론사 또는 '기타-' prefix 추가)
 */
export function classifySource(sourceName: string | undefined): string {
  // 언론사명이 없거나 빈 문자열인 경우
  if (!sourceName || sourceName.trim() === '') {
    return '기타';
  }

  const trimmedName = sourceName.trim();

  // 주요 언론사 목록에 있는지 확인
  if (MAJOR_NEWS_SOURCES.includes(trimmedName)) {
    return trimmedName;
  }

  // Daum 포털 자체 기사인 경우
  if (trimmedName === '다음' || trimmedName === 'Daum') {
    return '기타-다음';
  }

  // 이미 '기타-'로 시작하는 경우 그대로 반환
  if (trimmedName.startsWith('기타-')) {
    return trimmedName;
  }

  // 주요 언론사가 아닌 경우 '기타-' prefix 추가
  return `기타-${trimmedName}`;
}

/**
 * 언론사명이 주요 언론사인지 확인
 * @param sourceName 언론사명
 * @returns 주요 언론사 여부
 */
export function isMajorSource(sourceName: string): boolean {
  return MAJOR_NEWS_SOURCES.includes(sourceName);
}

/**
 * 기타 언론사명에서 원본 언론사명 추출
 * @param sourceName 분류된 언론사명
 * @returns 원본 언론사명
 */
export function extractOriginalSourceName(sourceName: string): string {
  if (sourceName.startsWith('기타-')) {
    return sourceName.substring(3);
  }
  return sourceName;
}

/**
 * 언론사 통계 정보
 */
export interface SourceStatistics {
  majorSources: string[];
  minorSources: string[];
  totalMajor: number;
  totalMinor: number;
  total: number;
}

/**
 * 언론사 목록에서 통계 생성
 * @param sources 언론사명 배열
 * @returns 통계 정보
 */
export function generateSourceStatistics(sources: string[]): SourceStatistics {
  const majorSources = new Set<string>();
  const minorSources = new Set<string>();

  for (const source of sources) {
    if (source.startsWith('기타-')) {
      minorSources.add(source);
    } else if (source !== '기타') {
      majorSources.add(source);
    }
  }

  return {
    majorSources: Array.from(majorSources),
    minorSources: Array.from(minorSources),
    totalMajor: majorSources.size,
    totalMinor: minorSources.size,
    total: majorSources.size + minorSources.size,
  };
}

export default {
  classifySource,
  isMajorSource,
  extractOriginalSourceName,
  generateSourceStatistics,
  MAJOR_NEWS_SOURCES,
};