import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './DeleteAccount.css';

const DeleteAccount = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // 사용자 정보 가져오기
    const fetchUser = async () => {
      try {
        let token = localStorage.getItem('token');
        if (!token) {
          token = sessionStorage.getItem('token');
        }

        if (!token) {
          navigate('/login');
          return;
        }

        const response = await fetch('/api/auth/profile', {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          credentials: 'include'
        });

        if (response.ok) {
          const responseData = await response.json();
          console.log('사용자 정보 응답:', responseData); // 디버깅용
          setUser(responseData.data.user);
        } else {
          navigate('/login');
        }
      } catch (error) {
        console.error('사용자 정보 가져오기 에러:', error);
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [navigate]);

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    setError('');

    // 카카오나 네이버 로그인 사용자는 비밀번호 확인 불필요
    const isSocialLogin = user.provider === 'kakao' || user.provider === 'naver';
    
    if (!isSocialLogin && !password.trim()) {
      setError('비밀번호를 입력해주세요.');
      return;
    }

    if (!confirm('정말로 회원탈퇴를 하시겠습니까?\n탈퇴 후에는 복구할 수 없습니다.')) {
      return;
    }

    try {
      setDeleting(true);
      
      let token = localStorage.getItem('token');
      if (!token) {
        token = sessionStorage.getItem('token');
      }

      const response = await fetch('/api/auth/delete-account', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ 
          password: isSocialLogin ? null : password 
        })
      });

      if (response.ok) {
        // 로그아웃 처리
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('rememberMe');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        
        alert('회원탈퇴가 완료되었습니다.');
        navigate('/');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || '회원탈퇴에 실패했습니다.');
      }
    } catch (err) {
      console.error('회원탈퇴 에러:', err);
      setError(err.message || '회원탈퇴 중 오류가 발생했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="delete-account-container">
        <div className="loading">로딩 중...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="delete-account-container">
        <div className="error">사용자 정보를 찾을 수 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="delete-account-container">
      <div className="delete-account-header">
        <button 
          className="back-button" 
          onClick={() => navigate('/mypage')}
        >
          ← 마이페이지로
        </button>
        <h1>회원탈퇴</h1>
      </div>

      <div className="delete-account-content">
        <div className="warning-section">
          <h2>⚠️ 회원탈퇴 안내</h2>
          <div className="warning-box">
            <p><strong>회원탈퇴 시 다음 사항을 확인해주세요:</strong></p>
            <ul>
              <li>• 모든 개인정보가 완전히 삭제됩니다</li>
              <li>• 북마크, 좋아요, 댓글 기록이 모두 삭제됩니다</li>
              <li>• 탈퇴 후 동일한 이메일로 재가입이 제한될 수 있습니다</li>
              <li>• 탈퇴한 계정은 복구할 수 없습니다</li>
            </ul>
          </div>
        </div>

        <div className="user-info">
          <h3>현재 계정 정보</h3>
          <div className="user-details">
            <p><strong>이메일:</strong> {user.email}</p>
            <p><strong>사용자명:</strong> {user.username}</p>
            <p><strong>이름:</strong> {user.name}</p>
            <p><strong>로그인 방식:</strong> {user.provider === 'local' ? '일반 로그인' : user.provider === 'kakao' ? '카카오 로그인' : user.provider === 'naver' ? '네이버 로그인' : '일반 로그인'}</p>
          </div>
        </div>

        <form onSubmit={handleDeleteAccount} className="delete-form">
          {/* 카카오나 네이버 로그인 사용자가 아닌 경우에만 비밀번호 입력 필드 표시 */}
          {user.provider === 'local' && (
            <div className="form-group">
              <label htmlFor="password">현재 비밀번호</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="현재 비밀번호를 입력하세요"
                disabled={deleting}
                required
              />
            </div>
          )}

          {/* 소셜 로그인 사용자에게는 안내 메시지 표시 */}
          {(user.provider === 'kakao' || user.provider === 'naver') && (
            <div className="social-login-notice">
              <p>💡 {user.provider === 'kakao' ? '카카오' : '네이버'} 로그인 사용자는 비밀번호 확인 없이 바로 탈퇴할 수 있습니다.</p>
            </div>
          )}

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="cancel-btn"
              onClick={() => navigate('/mypage')}
              disabled={deleting}
            >
              취소
            </button>
            <button
              type="submit"
              className="delete-btn"
              disabled={deleting || (user.provider === 'local' && !password.trim())}
            >
              {deleting ? '탈퇴 처리 중...' : '회원탈퇴'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeleteAccount;
