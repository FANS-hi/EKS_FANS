import { Page } from 'puppeteer';
import { classifySource } from './sourceClassifier';
import logger from './logger';

/**
 * 다음 뉴스 JSON 기반 파서
 * window.__DAUMCHANNEL_NEWSVIEW_DATA__ 객체를 활용하여 정확한 데이터 추출
 */

export interface DaumNewsData {
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

export class DaumJsonParser {

  /**
   * 다음 뉴스 섹션 URL 목록
   */
  getSectionUrls(): string[] {
    return [
      'https://news.daum.net/politics',   // 정치
      'https://news.daum.net/economic',   // 경제
      'https://news.daum.net/society',    // 사회
      'https://news.daum.net/foreign',    // 국제
      'https://news.daum.net/culture',    // 문화
      'https://news.daum.net/digital',    // IT
      'https://news.daum.net/entertain',  // 연예
    ];
  }

  /**
   * 섹션 페이지에서 기사 URL 추출
   */
  async extractArticleUrls(page: Page, sectionUrl: string): Promise<string[]> {
    try {
      logger.info(`[Daum JSON Parser] 섹션 접속: ${sectionUrl}`);

      await page.goto(sectionUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // 동적 콘텐츠 로딩 대기
      await page.waitForTimeout(2000);

      // 기사 URL 수집
      const urls = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="v.daum.net/v/"]'));
        return links
          .map((a) => (a as HTMLAnchorElement).href)
          .filter((href) => href && href.includes('v.daum.net/v/'));
      });

      // 중복 제거
      const uniqueUrls = [...new Set(urls)];
      logger.info(`[Daum JSON Parser] ${uniqueUrls.length}개 기사 URL 발견`);

      return uniqueUrls.slice(0, 30); // 최대 30개
    } catch (error) {
      logger.error(`[Daum JSON Parser] URL 추출 실패: ${sectionUrl}`, error);
      return [];
    }
  }

  /**
   * 개별 기사 파싱 (JSON 데이터 활용)
   */
  async parseArticle(page: Page, url: string): Promise<DaumNewsData | null> {
    try {
      logger.info(`[Daum JSON Parser] 기사 파싱 시작: ${url}`);

      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 45000
      });

      // JSON 데이터와 본문 추출
      const articleData = await page.evaluate(() => {
        // 1. JSON 데이터 추출 시도
        let jsonData: any = null;

        // window.__DAUMCHANNEL_NEWSVIEW_DATA__ 찾기
        const scripts = Array.from(document.querySelectorAll('script'));
        for (const script of scripts) {
          const text = script.textContent || '';

          // dmcf 객체 찾기
          const dmcfMatch = text.match(/const\s+dmcf\s*=\s*({[\s\S]*?});/);
          const cpMatch = text.match(/const\s+cp\s*=\s*({[\s\S]*?});/);

          if (dmcfMatch && cpMatch) {
            try {
              // eval 대신 안전한 방법으로 파싱
              const dmcfStr = dmcfMatch[1]
                .replace(/(\w+):/g, '"$1":')  // key를 문자열로
                .replace(/Number\("(\d+)"\)/g, '$1')  // Number() 제거
                .replace(/Boolean\([^)]+\)/g, 'false')  // Boolean() 처리
                .replace(/'/g, '"')  // 작은따옴표를 큰따옴표로
                .replace(/,\s*}/g, '}');  // 마지막 콤마 제거

              const cpStr = cpMatch[1]
                .replace(/(\w+):/g, '"$1":')
                .replace(/Number\("(\d+)"\)/g, '$1')
                .replace(/Boolean\([^)]+\)/g, 'false')
                .replace(/'/g, '"')
                .replace(/,\s*}/g, '}')
                .replace(/\/\/.*/g, '');  // 주석 제거

              // Unicode 이스케이프 문자열 처리
              const decodeUnicode = (str: string) => {
                return str.replace(/\\u([0-9a-fA-F]{4})/g, (match, hex) => {
                  return String.fromCharCode(parseInt(hex, 16));
                });
              };

              const dmcfDecoded = decodeUnicode(dmcfStr);
              const cpDecoded = decodeUnicode(cpStr);

              jsonData = {
                dmcf: JSON.parse(dmcfDecoded),
                cp: JSON.parse(cpDecoded)
              };
            } catch (e) {
              console.error('JSON 파싱 실패:', e);
            }
            break;
          }
        }

        // 2. 본문 추출 (개선된 방식)
        let content = '';
        const contentEl = document.querySelector('div.article_view') ||
                         document.querySelector('#harmonyContainer') ||
                         document.querySelector('.article_body');

        if (contentEl) {
          // 불필요한 요소 제거
          contentEl.querySelectorAll(
            '.ad, .advertisement, figure, .alex_area, ' +
            'script, style, iframe, .btn_fold, .link_figure'
          ).forEach(el => el.remove());

          // p 태그에서 추출 (최소 길이 20자로 완화)
          const paragraphs = Array.from(contentEl.querySelectorAll('p'))
            .map(p => p.textContent?.trim())
            .filter(text => text && text.length > 20);

          content = paragraphs.join('\n\n');

          // p 태그가 없거나 너무 짧으면 전체 텍스트 사용
          if (!content || content.length < 100) {
            content = contentEl.textContent?.trim() || '';

            // 중복 공백 및 줄바꿈 정리
            content = content
              .replace(/\s+/g, ' ')
              .replace(/\n\n\n+/g, '\n\n')
              .trim();
          }
        }

        // 3. 폴백: DOM에서 직접 추출
        const fallbackData = {
          title: document.querySelector('h3.tit_view')?.textContent?.trim() || '',
          source: document.querySelector('#kakaoServiceLogo')?.textContent?.trim() || '',
          journalist: '',
          imageUrl: '',
          pubDateStr: document.querySelector('.num_date')?.textContent?.trim() || ''
        };

        // 기자명 추출
        const infoEl = document.querySelector('.txt_info');
        if (infoEl && infoEl.textContent) {
          const match = infoEl.textContent.match(/([가-힣]{2,4})\s*기자/);
          if (match) {
            fallbackData.journalist = match[1];
          }
        }

        // 이미지 추출
        const imgEl = document.querySelector('div.article_view img');
        if (imgEl) {
          const src = imgEl.getAttribute('src') || imgEl.getAttribute('data-src');
          if (src && src.startsWith('http')) {
            fallbackData.imageUrl = src;
          }
        }

        return {
          jsonData,
          content,
          fallbackData
        };
      });

      // 데이터 조합
      let title = articleData.jsonData?.dmcf?.title || articleData.fallbackData.title;
      let originalSource = articleData.jsonData?.cp?.cpKorName || articleData.fallbackData.source;
      let content = articleData.content;
      let imageUrl = articleData.jsonData?.dmcf?.representImage || articleData.fallbackData.imageUrl;
      let journalist = articleData.fallbackData.journalist;
      let category = articleData.jsonData?.dmcf?.categoryName;

      // 날짜 파싱
      let pubDate: Date | undefined;
      if (articleData.jsonData?.dmcf?.regDt) {
        pubDate = new Date(parseInt(articleData.jsonData.dmcf.regDt));
      } else if (articleData.fallbackData.pubDateStr) {
        pubDate = this.parseKoreanDate(articleData.fallbackData.pubDateStr);
      }

      // 유효성 검사
      if (!title || !content) {
        logger.warn(`[Daum JSON Parser] 필수 데이터 누락: ${url}`);
        return null;
      }

      // 본문 최소 길이 80자로 완화 (너무 짧은 기사는 제외)
      if (content.length < 80) {
        logger.warn(`[Daum JSON Parser] 본문 너무 짧음 (${content.length}자): ${url}`);
        return null;
      }

      // 언론사 분류 (기타- prefix 적용)
      const classifiedSource = classifySource(originalSource);

      logger.info(`[Daum JSON Parser] 파싱 성공: ${title.substring(0, 30)}...`);
      logger.info(`  원본 언론사: ${originalSource} → 분류: ${classifiedSource}`);

      return {
        title,
        content: content.trim(),
        source: classifiedSource,        // 분류된 언론사명
        originalSource: originalSource || '알 수 없음',  // 원본 언론사명
        url,
        imageUrl,
        journalist,
        pubDate,
        category
      };

    } catch (error) {
      logger.error(`[Daum JSON Parser] 기사 파싱 실패: ${url}`, error);
      return null;
    }
  }

  /**
   * 한국어 날짜 문자열 파싱
   * 예: "2024.10.16. 오후 3:30"
   */
  private parseKoreanDate(dateStr: string): Date | undefined {
    try {
      // "2024.10.16. 오후 3:30" 형식 파싱
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

      // 다른 형식 시도
      return new Date(dateStr);
    } catch {
      logger.warn(`날짜 파싱 실패: ${dateStr}`);
      return undefined;
    }
  }

  /**
   * 파싱 결과 검증
   */
  validateArticle(article: DaumNewsData): boolean {
    if (!article.title || article.title.length < 10) {
      logger.warn('제목이 너무 짧습니다');
      return false;
    }

    if (!article.content || article.content.length < 100) {
      logger.warn('본문이 너무 짧습니다');
      return false;
    }

    if (!article.source || article.source === '기타') {
      logger.warn('언론사 정보가 없습니다');
      // 하지만 '기타'도 허용
    }

    return true;
  }
}

export default DaumJsonParser;