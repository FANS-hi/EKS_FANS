# 소셜 로그인 설정 가이드

## 📋 개요
카카오와 네이버 소셜 로그인 기능이 구현되었습니다. 이 가이드를 따라 환경 변수를 설정하세요.

## 🔧 환경 변수 설정

### 백엔드 환경 변수 (.env)
`/home/ubuntu/git/FANS/backend/api/.env` 파일에 다음 변수들을 추가하세요:

```env
# 기존 환경 변수들...

# 프론트엔드 URL
FRONTEND_URL=http://localhost:3001

# 카카오 OAuth 설정
KAKAO_CLIENT_ID=your_kakao_client_id
KAKAO_CLIENT_SECRET=your_kakao_client_secret
KAKAO_REDIRECT_URI=http://localhost:3000/api/auth/kakao/callback

# 네이버 OAuth 설정
NAVER_CLIENT_ID=your_naver_client_id
NAVER_CLIENT_SECRET=your_naver_client_secret
NAVER_REDIRECT_URI=http://localhost:3000/api/auth/naver/callback
```

## 🚀 카카오 개발자 설정

### 1. 카카오 개발자 콘솔 접속
- [카카오 개발자 콘솔](https://developers.kakao.com/) 접속
- 카카오 계정으로 로그인

### 2. 애플리케이션 생성
1. "내 애플리케이션" → "애플리케이션 추가하기"
2. 앱 이름: "FANS 뉴스 포털"
3. 사업자명: 개인 또는 회사명

### 3. 플랫폼 설정
1. "앱 설정" → "플랫폼"
2. "Web 플랫폼 등록"
3. 사이트 도메인: `http://localhost:3000`

### 4. 제품 설정
1. "제품 설정" → "카카오 로그인"
2. "카카오 로그인 활성화" ON
3. "Redirect URI" 추가: `http://localhost:3000/api/auth/kakao/callback`

### 5. 동의항목 설정
1. "제품 설정" → "카카오 로그인" → "동의항목"
2. 필수 동의항목:
   - 닉네임 (선택)
   - 카카오계정(이메일) (선택)
3. 선택 동의항목:
   - 프로필 사진 (선택)

### 6. 앱 키 확인
1. "앱 설정" → "앱 키"
2. REST API 키를 `KAKAO_CLIENT_ID`로 사용
3. "보안" 탭에서 "Client Secret"을 `KAKAO_CLIENT_SECRET`로 사용

## 🌐 네이버 개발자 설정

### 1. 네이버 개발자 센터 접속
- [네이버 개발자 센터](https://developers.naver.com/) 접속
- 네이버 계정으로 로그인

### 2. 애플리케이션 등록
1. "Application" → "애플리케이션 등록"
2. 애플리케이션 이름: "FANS 뉴스 포털"
3. 사용 API: "네이버 아이디로 로그인"
4. 서비스 환경: "PC 웹"
5. 서비스 URL: `http://localhost:3001`
6. Callback URL: `http://localhost:3000/api/auth/naver/callback`

### 3. 애플리케이션 정보 확인
1. 등록된 애플리케이션 클릭
2. "Client ID"를 `NAVER_CLIENT_ID`로 사용
3. "Client Secret"을 `NAVER_CLIENT_SECRET`로 사용

## 🔄 서버 재시작

환경 변수 설정 후 서버를 재시작하세요:

```bash
# 백엔드 서버 재시작
cd /home/ubuntu/git/FANS/backend/api
npm run dev

# 프론트엔드 서버 재시작 (필요시)
cd /home/ubuntu/git/FANS/frontend
npm start
```

## 🧪 테스트 방법

### 1. 카카오 로그인 테스트
1. 프론트엔드에서 "카카오로 로그인" 버튼 클릭
2. 카카오 로그인 페이지로 리다이렉트
3. 카카오 계정으로 로그인
4. 성공 시 메인 페이지로 자동 이동

### 2. 네이버 로그인 테스트
1. 프론트엔드에서 "네이버로 로그인" 버튼 클릭
2. 네이버 로그인 페이지로 리다이렉트
3. 네이버 계정으로 로그인
4. 성공 시 메인 페이지로 자동 이동

## 📝 주요 특징

### 🔐 보안
- **CSRF 보호**: state 파라미터를 통한 CSRF 공격 방지
- **세션 관리**: 서버 세션을 통한 안전한 상태 관리
- **토큰 만료**: JWT 토큰 자동 만료 (30일)

### 🔄 사용자 경험
- **자동 계정 연동**: 기존 이메일과 동일한 소셜 계정 자동 연동
- **자동 회원가입**: 소셜 로그인 시 자동 계정 생성
- **로그인 상태 유지**: 30일간 자동 로그인 유지

### 🛠️ 기술적 특징
- **OAuth 2.0 표준**: 표준 OAuth 2.0 플로우 구현
- **에러 처리**: 상세한 에러 메시지 및 리다이렉트
- **타입 안전성**: TypeScript를 통한 타입 안전성 보장

## ⚠️ 주의사항

### 개발 환경
- **localhost만 지원**: 개발 환경에서는 localhost만 지원
- **HTTPS 필요**: 프로덕션 환경에서는 HTTPS 필수

### 프로덕션 배포 시
1. **도메인 변경**: 모든 URL을 실제 도메인으로 변경
2. **HTTPS 설정**: SSL 인증서 설정 필수
3. **환경 변수**: 프로덕션 환경 변수 설정
4. **보안 강화**: Client Secret 등 민감 정보 보호

## 🆘 문제 해결

### 자주 발생하는 오류

#### 1. "Invalid OAuth state" 에러
- **원인**: 세션 만료 또는 CSRF 공격 시도
- **해결**: 브라우저 새로고침 후 재시도

#### 2. "지원하지 않는 소셜 로그인 제공자" 에러
- **원인**: 환경 변수 설정 오류
- **해결**: .env 파일의 CLIENT_ID, CLIENT_SECRET 확인

#### 3. "Redirect URI mismatch" 에러
- **원인**: 개발자 콘솔의 Redirect URI와 서버 설정 불일치
- **해결**: 개발자 콘솔에서 Redirect URI 정확히 설정

### 로그 확인
```bash
# 백엔드 로그 확인
cd /home/ubuntu/git/FANS/backend/api
npm run dev

# 브라우저 개발자 도구에서 네트워크 탭 확인
```

## 📞 지원

문제가 지속되면 다음을 확인하세요:
1. 환경 변수 설정이 올바른지
2. 개발자 콘솔 설정이 정확한지
3. 서버가 정상적으로 실행 중인지
4. 네트워크 연결이 정상인지

