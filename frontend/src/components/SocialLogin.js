// src/components/SocialLogin.js
import React, { useState } from "react";
import "./SocialLogin.css";

const SocialLogin = ({ type = "login" }) => {
  const [loadingStates, setLoadingStates] = useState({
    kakao: false,
    naver: false
  });

  const resolveApiBase = () => {
    const fromEnv = (process.env.REACT_APP_API_BASE || '').trim();
    if (fromEnv) return fromEnv;

    try {
      return new URL(window.location.origin).toString();
    } catch {
      return 'https://www.fans.ai.kr';
    }
  };

  const go = async (provider) => {
    setLoadingStates(prev => ({ ...prev, [provider]: true }));

    const candidates = [];
    try {
      const sameOrigin = window.location.origin;
      if (sameOrigin) candidates.push(sameOrigin);
    } catch (err) {
      console.warn('[WARN] Failed to read window.location.origin', err);
    }

    const envBase = resolveApiBase();
    if (envBase && !candidates.includes(envBase)) {
      candidates.push(envBase);
    }

    let lastError;
    for (const base of candidates) {
      const normalized = base.replace(/\/$/, '');
      const startEndpoint = `${normalized}/api/auth/${provider}/start`;

      try {
        const response = await fetch(startEndpoint, {
          method: 'GET',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          lastError = new Error(`HTTP ${response.status}`);
          continue;
        }

        const data = await response.json();
        const redirectUrl = data?.data?.redirectUrl || data?.redirectUrl || data?.url;
        if (!redirectUrl) {
          lastError = new Error('redirect URL missing');
          continue;
        }

        window.location.assign(redirectUrl);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    // 모든 시도가 실패하면 기존 방식으로 직접 이동 시도 (마지막 후보 사용)
    const fallbackBase = candidates.length > 0 ? candidates[candidates.length - 1] : resolveApiBase();
    if (fallbackBase) {
      const target = new URL(`/api/auth/${provider}`, `${fallbackBase.replace(/\/$/, '')}/`).toString();
      window.location.assign(target);
      return;
    }

    setLoadingStates(prev => ({ ...prev, [provider]: false }));
    const message = lastError?.message ? `소셜 로그인 시작에 실패했습니다: ${lastError.message}` : '소셜 로그인 시작에 실패했습니다.';
    alert(message);
  };

  return (
    <div className="social-login">
      <div className="social-divider">
        <span>또는</span>
      </div>

      <div className="social-buttons">
        <button
          className="social-button kakao"
          onClick={() => go('kakao')}
          disabled={loadingStates.kakao}
        >
          <span>
            {loadingStates.kakao
              ? "처리 중..."
              : `카카오로 ${type === "login" ? "로그인" : "회원가입"}`}
          </span>
        </button>

        <button
          className="social-button naver"
          onClick={() => go('naver')}
          disabled={loadingStates.naver}
        >
          <span>
            {loadingStates.naver
              ? "처리 중..."
              : `네이버로 ${type === "login" ? "로그인" : "회원가입"}`}
          </span>
        </button>
      </div>
    </div>
  );
};

export default SocialLogin;
