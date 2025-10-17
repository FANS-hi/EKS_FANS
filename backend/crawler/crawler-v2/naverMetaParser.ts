import { Page } from 'puppeteer';
import { classifySource } from './sourceClassifier';
import logger from './logger';

/**
 * 네이버 뉴스 메타 태그 + 셀렉터 기반 파서
 * Open Graph 메타 태그와 DOM 셀렉터를 조합하여 깨끗한 데이터 추출
 */

export interface NaverNewsData {
  title: string;
  content: string;
  source: string;           // 분류된 언론사명 (기타- prefix 포함)
  originalSource: string;    // 원본 언론사명
  url: string;
  imageUrl?: string;
  journalist?: string;
  pubDate?: Date;
  category?: string;
}

export class NaverMetaParser {

  /**
   * 네이버 뉴스 섹션 URL 목록
   */
  getSectionUrls(): string[] {
    return [
      'https://news.naver.com/section/100',  // 정치
      'https://news.naver.com/section/101',  // 경제
      'https://news.naver.com/section/102',  // 사회
      'https://news.naver.com/section/103',  // 생활/문화
      'https://news.naver.com/section/105',  // IT/과학
      'https://news.naver.com/section/104',  // 세계
      'https://news.naver.com/section/114',  // 연예
      'https://sports.news.naver.com/index', // 스포츠
    ];
  }

  /**
   * URL에서 카테고리 추출
   */
  private getCategoryFromUrl(url: string): string | undefined {
    if (url.includes('/section/100')) return '정치';
    if (url.includes('/section/101')) return '경제';
    if (url.includes('/section/102')) return '사회';
    if (url.includes('/section/103')) return '생활/문화';
    if (url.includes('/section/105')) return 'IT/과학';
    if (url.includes('/section/104')) return '세계';
    if (url.includes('/section/114')) return '연예';
    if (url.includes('sports.news.naver.com')) return '스포츠';
    return undefined;
  }

  /**
   * 섹션 페이지에서 기사 URL 추출
   */
  async extractArticleUrls(page: Page, sectionUrl: string): Promise<string[]> {
    try {
      logger.info(`[Naver Meta Parser] 섹션 접속: ${sectionUrl}`);

      await page.goto(sectionUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // 동적 콘텐츠 로딩 대기
      await page.waitForTimeout(2000);

      // 기사 URL 수집 - 네이버 뉴스 기사 URL 패턴
      const urls = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/article/"]'));
        return links
          .map((a) => (a as HTMLAnchorElement).href)
          .filter((href) => {
            if (!href || !href.includes('/article/')) return false;
            if (href.includes('/comment')) return false;  // 댓글 페이지 제외
            if (href.includes('sports')) return false;    // 스포츠 제외

            // /article/언론사코드/기사번호 형식만 허용
            const match = href.match(/\/article\/(\d+)\/(\d+)/);
            return match !== null;
          });
      });

      // 중복 제거
      const uniqueUrls = [...new Set(urls)];
      logger.info(`[Naver Meta Parser] ${uniqueUrls.length}개 기사 URL 발견`);

      return uniqueUrls.slice(0, 30); // 최대 30개
    } catch (error) {
      logger.error(`[Naver Meta Parser] URL 추출 실패: ${sectionUrl}`, error);
      return [];
    }
  }

  /**
   * 개별 기사 파싱 (메타 태그 + 셀렉터 활용)
   */
  async parseArticle(page: Page, url: string, sectionUrl?: string): Promise<NaverNewsData | null> {
    try {
      logger.info(`[Naver Meta Parser] 기사 파싱 시작: ${url}`);

      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 45000
      });

      // 메타 태그와 본문 추출 (단순화된 버전)
      const articleData = await page.evaluate(() => {
        const result: any = {
          title: '',
          content: '',
          imageUrl: '',
          journalist: '',
          originalSource: '',
          pubDateStr: ''
        };

        // 1. 메타 태그에서 데이터 추출 (인라인으로 직접 처리)
        const ogTitle = document.querySelector('meta[property="og:title"]');
        const ogImage = document.querySelector('meta[property="og:image"]');
        const ogAuthor = document.querySelector('meta[property="og:article:author"]');

        if (ogTitle) result.title = ogTitle.getAttribute('content') || '';
        if (ogImage) result.imageUrl = ogImage.getAttribute('content') || '';
        if (ogAuthor) {
          const authorText = ogAuthor.getAttribute('content') || '';
          if (authorText.includes('|')) {
            result.originalSource = authorText.split('|')[0].trim();
          }
        }

        // 2. 제목 폴백
        if (!result.title) {
          const titleEl = document.querySelector('h2.media_end_head_headline');
          if (titleEl) result.title = titleEl.textContent?.trim() || '';
        }

        // 3. 본문 추출
        const contentEl = document.querySelector('#dic_area');
        if (contentEl) {
          // 불필요한 요소 제거
          const removeSelectors = contentEl.querySelectorAll('script, style, .ad, figure, .btn_fold');
          removeSelectors.forEach(el => el.remove());

          // 본문 텍스트
          result.content = contentEl.textContent?.trim() || '';
        }

        // 4. 이미지 폴백
        if (!result.imageUrl) {
          const imgEl = document.querySelector('#dic_area img');
          if (imgEl) {
            const src = imgEl.getAttribute('src');
            if (src && src.startsWith('http')) result.imageUrl = src;
          }
        }

        // 5. 기자명
        const journalistEl = document.querySelector('.media_end_head_journalist .name');
        if (journalistEl) {
          const text = journalistEl.textContent || '';
          const match = text.match(/([가-힣]{2,4})\s*기자/);
          if (match) result.journalist = match[1];
        }

        // 6. 언론사 폴백
        if (!result.originalSource) {
          const logoEl = document.querySelector('.media_end_head_top .media_logo img');
          if (logoEl) result.originalSource = logoEl.getAttribute('alt') || '';
        }

        // 7. 발행일
        const dateEl = document.querySelector('.media_end_head_info_datestamp_time');
        if (dateEl) result.pubDateStr = dateEl.textContent?.trim() || '';

        return result;
      });

      // URL에서 언론사 코드 추출 및 매핑
      const sourceFromUrl = this.extractSourceFromUrl(url);
      if (!articleData.originalSource && sourceFromUrl) {
        articleData.originalSource = sourceFromUrl;
      }

      // 유효성 검사
      if (!articleData.title || !articleData.content) {
        logger.warn(`[Naver Meta Parser] 필수 데이터 누락: ${url}`);
        return null;
      }

      if (articleData.content.length < 100) {
        logger.warn(`[Naver Meta Parser] 본문 너무 짧음 (${articleData.content.length}자): ${url}`);
        return null;
      }

      // 본문 정제
      const cleanedContent = this.cleanContent(articleData.content);

      // 날짜 파싱
      const pubDate = articleData.pubDateStr ? this.parseDate(articleData.pubDateStr) : undefined;

      // 언론사 분류
      const classifiedSource = classifySource(articleData.originalSource);

      // 카테고리 추출 (sectionUrl이 있으면 사용)
      const category = sectionUrl ? this.getCategoryFromUrl(sectionUrl) : undefined;

      logger.info(`[Naver Meta Parser] 파싱 성공: ${articleData.title.substring(0, 30)}...`);
      logger.info(`  원본 언론사: ${articleData.originalSource} → 분류: ${classifiedSource}`);
      if (category) {
        logger.info(`  카테고리: ${category}`);
      }

      return {
        title: articleData.title,
        content: cleanedContent,
        source: classifiedSource,
        originalSource: articleData.originalSource || '알 수 없음',
        url,
        imageUrl: articleData.imageUrl || undefined,
        journalist: articleData.journalist || undefined,
        pubDate,
        category
      };

    } catch (error) {
      logger.error(`[Naver Meta Parser] 기사 파싱 실패: ${url}`, error);
      return null;
    }
  }

  /**
   * URL에서 언론사 추출 (네이버 뉴스 언론사 코드 매핑)
   */
  private extractSourceFromUrl(url: string): string {
    const match = url.match(/\/article\/(\d+)/);
    if (!match) return '';

    const code = match[1];

    // 네이버 뉴스 언론사 코드 매핑 (주요 언론사만)
    const codeMap: { [key: string]: string } = {
      '001': '연합뉴스',
      '003': '뉴시스',
      '005': '국민일보',
      '008': '머니투데이',
      '009': '매일경제',
      '011': '서울경제',
      '014': '파이낸셜뉴스',
      '015': '한국경제',
      '016': '헤럴드경제',
      '018': '이데일리',
      '020': '동아일보',
      '021': '문화일보',
      '022': '세계일보',
      '023': '조선일보',
      '025': '중앙일보',
      '028': '한겨레',
      '032': '경향신문',
      '079': '노컷뉴스',
      '081': '서울신문',
      '052': 'YTN',
      '214': 'MBC',
      '056': 'KBS',
      '057': 'SBS',
      '055': 'JTBC'
    };

    return codeMap[code] || '';
  }

  /**
   * 본문 정제
   */
  private cleanContent(text: string): string {
    if (!text) return '';

    return text
      // 불필요한 패턴 제거
      .replace(/무단전재 및 재배포 금지/g, '')
      .replace(/ⓒ.+\s*무단.+/g, '')
      .replace(/기자\s*=\s*/g, '')
      .replace(/\[.+?기자\]/g, '')
      // 연속된 공백 정리
      .replace(/\s+/g, ' ')
      // 연속된 줄바꿈 정리 (3개 이상 → 2개)
      .replace(/\n\n\n+/g, '\n\n')
      .trim();
  }

  /**
   * 날짜 파싱
   */
  private parseDate(dateStr: string): Date | undefined {
    try {
      // "2024.10.17. 오전 12:06" 형식
      const match = dateStr.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})\.\s*(오전|오후)?\s*(\d{1,2}):(\d{2})/);

      if (match) {
        const [, year, month, day, ampm, hour, minute] = match;
        let hours = parseInt(hour);

        if (ampm === '오후' && hours !== 12) {
          hours += 12;
        } else if (ampm === '오전' && hours === 12) {
          hours = 0;
        }

        return new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          hours,
          parseInt(minute)
        );
      }

      // ISO 형식 시도
      return new Date(dateStr);
    } catch {
      logger.warn(`날짜 파싱 실패: ${dateStr}`);
      return undefined;
    }
  }

  /**
   * 파싱 결과 검증
   */
  validateArticle(article: NaverNewsData): boolean {
    if (!article.title || article.title.length < 10) {
      logger.warn('제목이 너무 짧습니다');
      return false;
    }

    if (!article.content || article.content.length < 100) {
      logger.warn('본문이 너무 짧습니다');
      return false;
    }

    return true;
  }
}

export default NaverMetaParser;
