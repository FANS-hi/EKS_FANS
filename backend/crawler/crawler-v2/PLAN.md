# FANS Crawler v2 개선 계획서

## 현재 문제점
1. **다음 뉴스 원본 언론사 추출 실패**
   - 현재: v.daum.net 기사 5,577개가 모두 "기타"로 분류됨
   - 실제: 조선일보, 한겨레 등 다양한 언론사의 기사들임

2. **DOM 기반 파싱의 한계**
   - UI 변경 시 파싱 실패
   - 정확한 데이터 추출 어려움
   - 느린 파싱 속도

## 개선 방안

### 1. JSON 데이터 직접 추출
다음 뉴스는 페이지에 구조화된 JSON 데이터를 포함하고 있음:

```javascript
window.__DAUMCHANNEL_NEWSVIEW_DATA__ = {
    cp: {
        cpKorName: "조선일보",  // 원본 언론사명
        cpId: 200
    },
    dmcf: {
        title: "기사 제목",
        description: "기사 요약",
        representImage: "대표 이미지 URL",
        content: "본문",
        regDt: 1759806107325  // 발행일시 (timestamp)
    }
}
```

### 2. 언론사 분류 체계 개선
- **주요 언론사**: 사전 정의된 리스트에 있는 언론사
  - 예: 조선일보, 한겨레, 연합뉴스 등
- **기타 언론사**: 리스트에 없는 중소 언론사
  - 명명 규칙: `기타-{원본언론사명}`
  - 예: `기타-싱글리스트`, `기타-교수신문`

### 3. 구현 방법

#### Puppeteer를 통한 JSON 추출
```javascript
async parseArticle(page, url) {
    await page.goto(url);

    // JSON 데이터 직접 추출
    const articleData = await page.evaluate(() => {
        if (window.__DAUMCHANNEL_NEWSVIEW_DATA__) {
            const data = window.__DAUMCHANNEL_NEWSVIEW_DATA__;
            return {
                source: data.cp?.cpKorName || '기타',
                title: data.dmcf?.title,
                content: document.querySelector('.article_view')?.innerText,
                imageUrl: data.dmcf?.representImage,
                pubDate: new Date(data.dmcf?.regDt)
            };
        }
    });

    return articleData;
}
```

## 기대 효과
1. **정확한 언론사 분류**: 5,577개 다음 기사의 원본 언론사 복원
2. **편향성 분석 개선**: 언론사별 기본 편향성 점수 적용 가능
3. **파싱 안정성**: JSON 기반으로 UI 변경에 강함
4. **성능 향상**: DOM 파싱보다 빠른 처리 속도

## 구현 단계
1. ✅ 계획서 작성 (현재)
2. ⏳ 언론사 분류 로직 구현 (기타- prefix)
3. ⏳ JSON 기반 Daum 파서 구현
4. ⏳ 기존 데이터 재분류 스크립트 작성
5. ⏳ 테스트 및 배포

## 타 뉴스 포털 적용 가능성
- **네이버 뉴스**: `window.__INITIAL_DATA__` 객체 활용 가능
- **구글 뉴스**: JSON-LD 구조화 데이터 활용 가능
- **개별 언론사**: Open Graph 메타 태그 + JSON-LD 활용