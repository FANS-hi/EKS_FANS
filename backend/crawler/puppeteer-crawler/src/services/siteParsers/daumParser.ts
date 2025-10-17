import { Page } from 'puppeteer';
import { SiteParser, ParsedArticle, ParserUtils } from './baseParser';
import logger from '../../../shared/config/logger';

export class DaumParser implements SiteParser {
  private currentSectionUrl: string = ''; // 현재 크롤링 중인 섹션 URL 저장

  /**
   * URL에서 카테고리명 추출
   */
  private getCategoryFromUrl(url: string): string | undefined {
    if (url.includes('news.daum.net/politics')) return '정치';
    if (url.includes('news.daum.net/economic')) return '경제';
    if (url.includes('news.daum.net/society')) return '사회';
    if (url.includes('news.daum.net/foreign')) return '세계';
    if (url.includes('news.daum.net/culture')) return '생활/문화';
    if (url.includes('news.daum.net/digital')) return 'IT/과학';
    if (url.includes('entertain.daum.net')) return '연예';
    if (url.includes('sports.daum.net')) return '스포츠';
    return undefined; // 매칭 안되면 기본값 사용
  }

  getSectionUrls(): string[] {
    return [
      'https://news.daum.net/politics', // 정치
      'https://news.daum.net/economic', // 경제
      'https://news.daum.net/society', // 사회
      'https://news.daum.net/foreign', // 국제
      'https://news.daum.net/culture', // 문화
      'https://news.daum.net/digital', // IT
      'https://entertain.daum.net', // 연예 (별도 도메인)
      'https://sports.daum.net', // 스포츠 (별도 도메인)
    ];
  }

  async extractArticleUrls(page: Page, sectionUrl: string): Promise<string[]> {
    try {
      // 현재 섹션 URL 저장 (parseArticle에서 카테고리 추출에 사용)
      this.currentSectionUrl = sectionUrl;

      logger.info(`Daum 섹션 페이지 접속: ${sectionUrl}`);
      await page.goto(sectionUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

      // 페이지 로딩 및 동적 콘텐츠 대기
      await page.waitForTimeout(3000);

      const urls = await page.evaluate(() => {
        // Daum 뉴스 URL 패턴: v.daum.net/v/XXXXXXXXXX
        const links = Array.from(document.querySelectorAll('a[href*="v.daum.net/v/"]'));
        return links
          .map((a) => (a as HTMLAnchorElement).href)
          .filter((href) => href && href.includes('v.daum.net/v/') && !href.includes('javascript:'));
      }) as string[];

      // 중복 제거
      const uniqueUrls = [...new Set(urls)] as string[];
      logger.info(`Daum 섹션에서 ${uniqueUrls.length}개 기사 URL 발견`);

      return uniqueUrls.slice(0, 20); // 최대 20개
    } catch (error) {
      logger.error(`Daum URL 추출 실패: ${sectionUrl}`, error);
      return [];
    }
  }

  async parseArticle(page: Page, url: string): Promise<ParsedArticle | null> {
    try {
      logger.info(`Daum 기사 파싱: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 45000 });

      // 기사 제목과 언론사 로고가 로딩될 때까지 대기
      try {
        await page.waitForSelector('h3.tit_view', { timeout: 10000 });
        await page.waitForSelector('#kakaoServiceLogo', { timeout: 5000 });
      } catch {
        logger.warn(`Daum 필수 요소 대기 타임아웃: ${url}`);
      }

      // JavaScript 실행 완료 대기
      await page.waitForTimeout(2000);

      const article = await page.evaluate(() => {
        // 광고, 스크립트, 스타일 제거
        document.querySelectorAll('script, style, .ad, .advertisement, .aside_g, .cmt_fold').forEach(el => el.remove());

        // 제목: h3.tit_view
        let title = '';
        const titleEl = document.querySelector('h3.tit_view');
        if (titleEl && titleEl.textContent) {
          title = titleEl.textContent.trim();
        }

        // 이미지: article_view 내의 첫 번째 img (figure 제거 전에 먼저 추출!)
        let imageUrl = '';
        const imgEl = document.querySelector('div.article_view img');
        if (imgEl) {
          const src = imgEl.getAttribute('src') || imgEl.getAttribute('data-src');
          if (src && src.startsWith('http')) {
            imageUrl = src;
          }
        }

        // 본문: div.article_view
        let content = '';
        const contentEl = document.querySelector('div.article_view');
        if (contentEl) {
          // 불필요한 요소 제거 (이미지 추출 후에 실행)
          contentEl.querySelectorAll('.ad, .advertisement, .link_figure, figure, .btn_fold, .alex_area, .layer_video').forEach(el => el.remove());

          // p 태그들을 수집하여 문단 분리
          const paragraphs = Array.from(contentEl.querySelectorAll('p'))
            .map(p => p.textContent?.trim())
            .filter(text => text && text.length > 30); // 30자 이상인 문단만

          if (paragraphs.length > 0) {
            content = paragraphs.join('\n\n');
          } else {
            // p 태그가 없으면 전체 텍스트 추출
            content = contentEl.textContent?.trim() || '';
          }
        }

        // 원 언론사: #kakaoServiceLogo 링크 텍스트
        let originalSource = '';
        const sourceEl = document.querySelector('#kakaoServiceLogo');
        if (sourceEl && sourceEl.textContent) {
          originalSource = sourceEl.textContent.trim();
        }

        // 기자: .txt_info 안의 텍스트에서 추출
        let journalist = '';
        const infoEl = document.querySelector('.txt_info');
        if (infoEl && infoEl.textContent) {
          const match = infoEl.textContent.match(/([가-힣]{2,4})\s*기자/);
          if (match) {
            journalist = match[1];
          }
        }

        // 발행일: .num_date
        let pubDateStr = '';
        const dateEl = document.querySelector('.num_date');
        if (dateEl && dateEl.textContent) {
          pubDateStr = dateEl.textContent.trim();
        }

        return {
          title,
          content,
          imageUrl,
          originalSource,
          journalist,
          pubDateStr,
        };
      });

      // 유효성 검사
      if (!article.title || !article.content) {
        logger.warn(`Daum 기사 파싱 실패 (제목 또는 본문 없음): ${url}`);
        return null;
      }

      if (article.content.length < 100) {
        logger.warn(`Daum 기사 본문이 너무 짧음 (${article.content.length}자): ${url}`);
        return null;
      }

      // 날짜 파싱
      const pubDate = article.pubDateStr ? ParserUtils.parseDate(article.pubDateStr) : undefined;

      // 본문 정제
      const cleanedContent = article.content
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();

      // 카테고리 추출
      const categoryName = this.getCategoryFromUrl(this.currentSectionUrl);

      logger.info(`Daum 기사 파싱 성공: ${article.title.substring(0, 30)}... (원 언론사: ${article.originalSource}, 카테고리: ${categoryName})`);

      return {
        title: article.title,
        content: cleanedContent,
        url,
        imageUrl: article.imageUrl || undefined,
        journalist: article.journalist || undefined,
        pubDate,
        categoryName, // 카테고리 추가
        originalSource: article.originalSource, // 원 언론사명 추가
      } as any;
    } catch (error) {
      logger.error(`Daum 기사 파싱 실패: ${url}`, error);
      return null;
    }
  }
}
