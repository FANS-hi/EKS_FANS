import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCommonData } from '../hooks/useCommonData';
import './Header.css';

const Header = ({ onSortChange, onSearch, selectedSort, onCategoryFilter, onSourceFilter }) => {
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [showSearchBar, setShowSearchBar] = useState(false); // 검색창 표시 여부
  const navigate = useNavigate();
  const location = useLocation();
  const searchInputRef = useRef(null); // ✅ 검색창 참조
  
  // 공통 데이터 가져오기
  const { categories, mediaSources, searchOptions, loading, error } = useCommonData();

  // 토큰 만료 확인 함수 (소셜 로그인 고려)
  const isTokenExpired = (token) => {
    if (!token) return true;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;

      // 소셜 로그인의 경우 24시간 후 만료
      const isSocialLogin = sessionStorage.getItem('socialLogin') === 'true';
      if (isSocialLogin) {
        const socialLoginTime = sessionStorage.getItem('socialLoginTime');
        if (socialLoginTime) {
          const loginTime = parseInt(socialLoginTime);
          const twentyFourHours = 24 * 60 * 60 * 1000; // 24시간
          return (Date.now() - loginTime) > twentyFourHours;
        }
      }

      return payload.exp < currentTime;
    } catch (error) {
      return true;
    }
  };

  // 자동 로그아웃 함수
  const performAutoLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('rememberMe');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('socialLogin');
    sessionStorage.removeItem('lastHidden');
    setIsLoggedIn(false);
    setUser(null);
    alert('로그인이 만료되어 자동으로 로그아웃되었습니다.');
    navigate('/login');
  };

  // 로그인 상태 확인
  useEffect(() => {
    const checkLoginStatus = () => {
      const isSocialLogin = sessionStorage.getItem('socialLogin') === 'true';
      let token, userData, isRememberMe = false;

      if (isSocialLogin) {
        // 소셜 로그인의 경우 sessionStorage 우선 사용
        token = sessionStorage.getItem('token');
        userData = sessionStorage.getItem('user');

        // 소셜 로그인 시간 확인 및 설정
        if (!sessionStorage.getItem('socialLoginTime')) {
          sessionStorage.setItem('socialLoginTime', Date.now().toString());
        }
      } else {
        // 일반 로그인의 경우 localStorage 먼저 확인
        token = localStorage.getItem('token');
        userData = localStorage.getItem('user');
        isRememberMe = localStorage.getItem('rememberMe') === 'true';

        // localStorage에 없으면 sessionStorage 확인
        if (!token || !userData) {
          token = sessionStorage.getItem('token');
          userData = sessionStorage.getItem('user');
        }
      }

      if (token && userData) {
        // 토큰 만료 확인
        if (isTokenExpired(token)) {
          performAutoLogout();
          return;
        }

        setIsLoggedIn(true);
        setUser(JSON.parse(userData));

        // 소셜 로그인이 아닌 경우에만 30분 전 알림 설정
        if (!isSocialLogin && !isRememberMe) {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const expirationTime = payload.exp * 1000;
          const warningTime = expirationTime - (30 * 60 * 1000); // 30분 전
          const currentTime = Date.now();

          if (currentTime < warningTime) {
            const timeoutId = setTimeout(() => {
              if (confirm('로그인이 30분 후 만료됩니다. 연장하시겠습니까?')) {
                // 토큰 갱신 요청
                window.location.reload();
              }
            }, warningTime - currentTime);

            return () => clearTimeout(timeoutId);
          }
        }
      } else {
        setIsLoggedIn(false);
        setUser(null);
      }
    };

    // 초기 로그인 상태 확인
    checkLoginStatus();

    // localStorage 변화 감지를 위한 이벤트 리스너
    const handleStorageChange = (e) => {
      if (e.key === 'token' || e.key === 'user') {
        checkLoginStatus();
      }
    };

    // storage 이벤트 리스너 등록 (다른 탭에서의 변화 감지)
    window.addEventListener('storage', handleStorageChange);

    // 커스텀 이벤트 리스너 등록 (같은 탭에서의 변화 감지)
    window.addEventListener('loginStatusChange', checkLoginStatus);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('loginStatusChange', checkLoginStatus);
    };
  }, []);

  // 로그아웃 함수
  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        // localStorage와 sessionStorage 모두에서 데이터 삭제
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('rememberMe');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('socialLogin');
        sessionStorage.removeItem('lastHidden');
        setIsLoggedIn(false);
        setUser(null);
        setActiveDropdown(null);
        alert('로그아웃되었습니다.');
        // 뉴스 상세 페이지가 아닐 때만 홈으로 이동
        if (!location.pathname.startsWith('/news/')) {
          navigate('/');
        }
      }
    } catch (error) {
      console.error('로그아웃 에러:', error);
      // 에러가 발생해도 로컬 스토리지는 정리
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('rememberMe');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('socialLogin');
      sessionStorage.removeItem('lastHidden');
      setIsLoggedIn(false);
      setUser(null);
      setActiveDropdown(null);
      // 뉴스 상세 페이지가 아닐 때만 홈으로 이동
      if (!location.pathname.startsWith('/news/')) {
        navigate('/');
      }
    }
  };

  const toggleDropdown = (type) => {
    setActiveDropdown(activeDropdown === type ? null : type);
  };

  // 클릭 외부 영역 감지를 위한 이벤트 핸들러
  useEffect(() => {
    const handleClickOutside = (event) => {
      // 드롭다운 메뉴의 링크를 클릭한 경우는 외부 클릭으로 처리하지 않음
      if (event.target.tagName === 'A' && event.target.closest('.user-dropdown-content')) {
        return; // 링크 클릭은 무시
      }

      // 드롭다운 내부의 다른 요소들도 체크
      if (!event.target.closest('.dropdown') && !event.target.closest('.user-dropdown')) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const handleSortClick = (sortType, displayText) => {
    onSortChange(sortType, displayText);
    setActiveDropdown(null);
  };

  
  const handleSearch = (e) => {
    const query = e.key === 'Enter' ? e.target.value : (searchInputRef.current?.value ?? '');

    if (e.key === 'Enter' || e.type === 'click') {
      setShowSearchBar(false); // 검색 후 검색창 숨기기

      // 디테일 페이지에서 검색하는 경우 메인 페이지로 이동하면서 검색
      if (location.pathname.startsWith('/news/')) {
        navigate(`/?search=${encodeURIComponent(query)}`);
      } else {
        // 메인 페이지에서 검색하는 경우 기존 방식
        if (onSearch) {
          onSearch(query);
        }
      }
    }
  };

  const toggleSearchBar = () => {
    setShowSearchBar(!showSearchBar);
    if (!showSearchBar) {
      // 검색창이 나타날 때 포커스 주기
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 100);
    }
  };

  const handleActivityLog = () => {
    if (isLoggedIn) {
      // 활동로그 페이지로 이동
      navigate('/activity-log');
    } else {
      alert('로그인이 필요한 서비스입니다.');
      navigate('/login');
    }
  };

  const handleLogoClick = () => {
    // 메인 페이지에서 로고 클릭 시 새로고침
    if (location.pathname === '/') {
      window.location.reload();
      return;
    }

    // ✅ 검색창 입력값 비우고 포커스 해제 + 상태 초기화
    if (searchInputRef.current) {
      searchInputRef.current.value = '';
      searchInputRef.current.blur();
    }
    setActiveDropdown(null);
    if (onSearch) {
      onSearch('');     // 전체 뉴스로
    }

    // 필터 초기화 강제 실행
    if (onCategoryFilter) {
      onCategoryFilter('전체');
    }
    if (onSourceFilter) {
      onSourceFilter(null);
    }

    // 홈으로 이동
    navigate('/');
  };

  return (
    <header className="header">
      <div className="header-left">
        <div className="logo" onClick={handleLogoClick}>FANS</div>

        {/* 검색 아이콘 - FANS 로고 오른쪽에 배치 */}
        <div
          className="search-icon-button"
          onClick={toggleSearchBar}
          title="검색"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 21L16.514 16.506L21 21ZM19 10.5C19 15.194 15.194 19 10.5 19C5.806 19 2 15.194 2 10.5C2 5.806 5.806 2 10.5 2C15.194 2 19 5.806 19 10.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <div className="dropdown">
          <button
            className={`dropdown-button agency-button ${activeDropdown === 'agency' ? 'active' : ''}`}
            onClick={() => toggleDropdown('agency')}
          >
            📰 언론사
          </button>
          <div
            id="agency-dropdown"
            className={`dropdown-content ${activeDropdown === 'agency' ? 'show' : ''}`}
          >
            {loading ? (
              <div style={{padding: '10px', textAlign: 'center'}}>로딩 중...</div>
            ) : (
              mediaSources.map((source, index) => (
                <a
                  key={index}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (onSourceFilter) {
                      onSourceFilter(source.name);
                    }
                    setActiveDropdown(null);
                  }}
                >
                  {source.name}
                </a>
              ))
            )}
          </div>
        </div>

        <div className="dropdown">
          <button
            className={`dropdown-button category-button ${activeDropdown === 'category' ? 'active' : ''}`}
            onClick={() => toggleDropdown('category')}
          >
            📂 카테고리
          </button>
          <div
            id="category-dropdown"
            className={`dropdown-content ${activeDropdown === 'category' ? 'show' : ''}`}
          >
            {loading ? (
              <div style={{padding: '10px', textAlign: 'center'}}>로딩 중...</div>
            ) : (
              categories.map((category, index) => (
                <a
                  key={index}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (onCategoryFilter) {
                      onCategoryFilter(category);
                    }
                    setActiveDropdown(null);
                  }}
                >
                  {category}
                </a>
              ))
            )}
          </div>
        </div>

        {/* 활동로그 버튼 - 카테고리 옆에 배치 */}
        <button
          className="activity-log-button"
          onClick={handleActivityLog}
          title="나의 활동로그"
        >
          📊 활동로그
        </button>

      </div>

      <div className="header-right">
        {/* 여기는 비워둠 */}
      </div>

      {/* 검색창 - 돋보기 클릭시 나타남 */}
      {showSearchBar && (
        <div className="search-overlay">
          <div className="search-section-expanded">
            <div className="dropdown">
              <div
                className="search-filter"
                onClick={() => toggleDropdown('sort')}
              >
                <span className="search-filter-text">{selectedSort}</span>
                <span>▼</span>
              </div>
              <div
                id="sort-dropdown"
                className={`dropdown-content ${activeDropdown === 'sort' ? 'show' : ''}`}
              >
                {loading ? (
                  <div style={{padding: '10px', textAlign: 'center'}}>로딩 중...</div>
                ) : (
                  searchOptions.sort?.map((option, index) => (
                    <a
                      key={index}
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        handleSortClick(option.value, option.label);
                      }}
                    >
                      {option.label}
                    </a>
                  ))
                )}
              </div>
            </div>

            <input
              ref={searchInputRef}
              type="text"
              className="search-input-expanded"
              placeholder="검색어를 입력하세요"
              onKeyUp={handleSearch}
            />

            <div
              className="search-button"
              onClick={handleSearch}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 21L16.514 16.506L21 21ZM19 10.5C19 15.194 15.194 19 10.5 19C5.806 19 2 15.194 2 10.5C2 5.806 5.806 2 10.5 2C15.194 2 19 5.806 19 10.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            <button
              className="close-search-button"
              onClick={() => setShowSearchBar(false)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
      
      <div className="user-menu">
        <div className="user-dropdown">
          <div className="user-section">
            {isLoggedIn && (user?.userName || user?.name || user?.username) && (
              <div className="welcome-message">
                환영합니다 <span className="user-name-highlight">{user.userName || user.name || user.username}</span>님
              </div>
            )}
            <div
              className="user-icon"
              onClick={() => toggleDropdown('user')}
            >
              {isLoggedIn ? (
                user?.profileImage && user.profileImage.trim() !== '' ? (
                  <>
                    <img
                      src={user.profileImage.startsWith('http') ? user.profileImage : `${user.profileImage}?t=${Date.now()}`}
                      alt="프로필 이미지"
                      className="user-profile-image"
                      crossOrigin="anonymous"
                      onLoad={() => {
                        console.log('✅ 헤더 이미지 로드 성공:', user.profileImage);
                      }}
                      onError={(e) => {
                        console.error('❌ 헤더 이미지 로드 실패:', e.target.src);
                        console.error('❌ 헤더 원본 경로:', user.profileImage);
                        e.target.style.display = 'none';
                        // 대체 텍스트 표시
                        const fallback = e.target.nextElementSibling;
                        if (fallback && fallback.classList.contains('user-profile-fallback')) {
                          fallback.style.display = 'block';
                        }
                      }}
                    />
                    <span
                      className="user-profile-fallback"
                      style={{
                        display: 'none',
                        fontSize: '18px',
                        fontWeight: 'bold'
                      }}
                    >
                      {(user?.userName || user?.name || user?.username) ? (user.userName || user.name || user.username).charAt(0).toUpperCase() : '👤'}
                    </span>
                  </>
                ) : (
                  // 이미지가 없을 때 이름 첫 글자 또는 기본 아이콘 표시
                  (user?.userName || user?.name || user?.username) ? (user.userName || user.name || user.username).charAt(0).toUpperCase() : '👤'
                )
              ) : '👤'}
            </div>
          </div>
          <div 
            id="user-dropdown" 
            className={`user-dropdown-content ${activeDropdown === 'user' ? 'show' : ''}`}
          >
            {isLoggedIn ? (
              <>
                <div className="user-info">
                  <span className="user-name">{user?.userName || user?.name || user?.username || '사용자'}</span>
                  <span className="user-email">{user?.email}</span>
                </div>
                <a href="#" onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveDropdown(null);
                  setTimeout(() => navigate('/mypage'), 100);
                }}>마이페이지</a>
                <a href="#" onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveDropdown(null);
                  setTimeout(() => handleLogout(), 100);
                }}>로그아웃</a>
              </>
            ) : (
              <>
                <a href="#" onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveDropdown(null);
                  setTimeout(() => navigate('/login'), 100);
                }}>로그인</a>
                <a href="#" onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveDropdown(null);
                  setTimeout(() => navigate('/register'), 100);
                }}>회원가입</a>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
