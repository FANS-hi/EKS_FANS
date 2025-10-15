// API 기본 설정 (CloudFront에서 /api/*를 프록시)
const API_BASE_URL = '';

// 공통 fetch 함수
const fetchApi = async (endpoint) => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('API fetch error:', error);
    throw error;
  }
};

// 공통 데이터 API 호출 함수들
export const commonAPI = {
  // 모든 공통 데이터 한번에 가져오기
  getAll: () => fetchApi('/api/common/all'),
  
  // 개별 데이터 가져오기
  getCategories: () => fetchApi('/api/common/categories'),
  getMediaSources: () => fetchApi('/api/common/media-sources'),
  getSearchOptions: () => fetchApi('/api/common/search-options')
};

// 뉴스 API 호출 함수들
export const newsAPI = {
  // 뉴스 검색 (검색어 입력시)
  search: (params) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchApi(`/api/search?${queryString}`);
  },

  // 최신 뉴스 (비로그인 사용자 - 시간순 정렬)
  getLatest: (params = {}) => {
    const defaultParams = {
      limit: 20,
      ...params
    };
    const queryString = new URLSearchParams(defaultParams).toString();
    return fetchApi(`/api/feed?${queryString}`);
  },

  // 맞춤 뉴스 (로그인 사용자 - 성향 기반)
  getPersonalized: (userId, params = {}) => {
    const defaultParams = {
      page: 1,
      limit: 20,
      userId: userId,
      ...params
    };
    const queryString = new URLSearchParams(defaultParams).toString();
    return fetchApi(`/api/news/personalized?${queryString}`);
  }
};

export default { commonAPI, newsAPI };