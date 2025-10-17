# 네이버 뉴스 API 분석

## 1. 네이버 뉴스 검색 API (공식)

### API 정보
- **엔드포인트**: `https://openapi.naver.com/v1/search/news.json`
- **인증 방식**: Client ID & Client Secret
- **응답 형식**: JSON
- **제한사항**: 일일 25,000회 호출 제한

### 요청 예시
```bash
curl "https://openapi.naver.com/v1/search/news.json?query=정치&display=10&start=1&sort=date" \
  -H "X-Naver-Client-Id: {CLIENT_ID}" \
  -H "X-Naver-Client-Secret: {CLIENT_SECRET}"
```

### JSON 응답 구조
```json
{
  "lastBuildDate": "Thu, 16 Oct 2025 17:50:00 +0900",
  "total": 283910,
  "start": 1,
  "display": 10,
  "items": [
    {
      "title": "기사 제목",
      "originallink": "https://www.chosun.com/xxx",  // 원본 언론사 URL
      "link": "https://n.news.naver.com/xxx",       // 네이버 뉴스 URL
      "description": "기사 요약",
      "pubDate": "Thu, 16 Oct 2025 15:30:00 +0900"
    }
  ]
}
```

### 장점
1. **JSON 형식으로 직접 제공**
2. **원본 언론사 URL 포함** (originallink)
3. **안정적인 API**
4. **빠른 응답 속도**

### 단점
1. **API 키 필요**
2. **일일 호출 제한**
3. **본문 전체 미제공** (요약만 제공)
4. **언론사명 직접 추출 필요** (URL에서 파싱)

## 2. 네이버 뉴스 페이지 내 JSON 데이터

네이버 뉴스 개별 페이지는 Open Graph 메타 태그는 있지만,
다음처럼 구조화된 JSON 데이터는 제공하지 않음.

### 메타 태그에서 추출 가능한 정보
```html
<meta property="og:title" content="기사 제목">
<meta property="og:description" content="기사 요약">
<meta property="og:image" content="이미지 URL">
<meta property="article:author" content="언론사명">
```

## 3. 네이버 뉴스 URL에서 언론사 정보 추출

### URL 구조 분석
```
https://n.news.naver.com/article/{OID}/{AID}
```
- OID: 언론사 ID
- AID: 기사 ID

### 주요 언론사 OID 매핑
```javascript
const NAVER_OID_MAPPING = {
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
  '047': '오마이뉴스',
  '052': 'YTN',
  '055': 'SBS',
  '056': 'KBS',
  '214': 'MBC',
  '437': 'JTBC',
  '448': 'TV조선',
  // ... 더 많은 매핑
};
```

## 4. 권장 구현 방법

### Option 1: 네이버 검색 API 사용 (권장)
```typescript
async function fetchNaverNews(query: string) {
  const response = await axios.get('https://openapi.naver.com/v1/search/news.json', {
    params: {
      query,
      display: 100,
      sort: 'date'
    },
    headers: {
      'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
      'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET
    }
  });

  return response.data.items.map(item => ({
    title: item.title.replace(/<[^>]*>/g, ''),  // HTML 태그 제거
    url: item.originallink,  // 원본 URL 사용
    source: extractSourceFromUrl(item.originallink),
    pubDate: new Date(item.pubDate),
    description: item.description
  }));
}

function extractSourceFromUrl(url: string): string {
  // URL에서 도메인 추출하여 언론사명 매핑
  const domain = new URL(url).hostname;

  const domainToSource = {
    'www.chosun.com': '조선일보',
    'www.hani.co.kr': '한겨레',
    'www.joongang.co.kr': '중앙일보',
    // ...
  };

  return domainToSource[domain] || `기타-${domain}`;
}
```

### Option 2: 하이브리드 접근
1. 네이버 검색 API로 기사 목록 획득
2. 원본 언론사 페이지에서 본문 크롤링
3. 본문이 필요없으면 API 응답만 사용

## 5. 결론

- **네이버 API는 JSON 형식으로 데이터 제공** ✅
- **원본 언론사 정보 추출 가능** ✅
- **다음과 달리 언론사명은 직접 제공하지 않음** (URL 파싱 필요)
- **API 키 발급 필요** (무료, 하루 25,000회)

### 추천: 네이버 API + 다음 크롤러 조합
1. **네이버 API**: 최신 뉴스 빠르게 수집
2. **다음 크롤러**: 본문 전체 + 정확한 언론사명 수집
3. **중복 제거**: 제목 유사도로 판단