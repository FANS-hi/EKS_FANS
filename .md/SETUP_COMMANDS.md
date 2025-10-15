# FANS 프로젝트 개발환경 설정 명령어

## 전체 설정 순서

### 1. Node.js 설치 확인
```bash
node --version
npm --version
```

### 2. Python 설치 (3.11 이상 필요)
#### Windows
```powershell
# 공식 사이트에서 다운로드 설치 (가장 확실한 방법)
# https://python.org 에서 Python 3.11+ 다운로드
# 설치시 "Add Python to PATH" 체크 필수

# 설치 확인
python --version
py --version
```

#### macOS
```bash
# Homebrew 사용
brew install python3

# 설치 확인
python3 --version
```

#### Linux/Ubuntu
```bash
# apt 사용
sudo apt update
sudo apt install python3 python3-pip python3-venv

# 설치 확인
python3 --version
```

#### 설치 확인
```bash
python --version
# 또는
python3 --version
# 또는
py --version
```

### 3. Docker 설치 확인
```bash
docker --version
```

---

## PowerShell 명령어 (Windows)

### Backend API 설정
```powershell
cd backend\api
npm install
cd ..\..
```

### Frontend 설정
```powershell
cd frontend
npm install
cd ..
```

### Python AI Service 설정
```powershell
cd backend\ai-service
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
deactivate
cd ..\..
```

### PostgreSQL 시작
```powershell
docker run -d --name fans-postgres -e POSTGRES_DB=fans_db -e POSTGRES_USER=fans_user -e POSTGRES_PASSWORD=fans_password -p 5432:5432 postgres:15
```

### 서비스 실행 (각각 새 터미널에서)
```powershell
# 터미널 1: Backend API
cd backend\api
npm run dev

# 터미널 2: AI Service  
cd backend\ai-service
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000

# 터미널 3: Frontend
cd frontend
npm start
```

---

## Bash 명령어 (macOS/Linux)

### Backend API 설정
```bash
cd backend/api
npm install
cd ../..
```

### Frontend 설정
```bash
cd frontend
npm install
cd ..
```

### Python AI Service 설정
```bash
cd backend/ai-service
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
deactivate
cd ../..
```

### PostgreSQL 시작
```bash
docker run -d --name fans-postgres -e POSTGRES_DB=fans_db -e POSTGRES_USER=fans_user -e POSTGRES_PASSWORD=fans_password -p 5432:5432 postgres:15
```

### 서비스 실행 (각각 새 터미널에서)
```bash
# 터미널 1: Backend API
cd backend/api
npm run dev

# 터미널 2: AI Service
cd backend/ai-service
source venv/bin/activate
uvicorn app.main:app --reload --port 8000

# 터미널 3: Frontend
cd frontend
npm start
```

---

## 환경변수 파일 생성

### backend/api/.env
```env
NODE_ENV=development
PORT=3000

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=fans_user
DB_PASSWORD=fans_password
DB_NAME=fans_db

# Python AI Service
AI_SERVICE_URL=http://localhost:8000

# Naver API Keys
NAVER_CLIENT_ID=XqQjKhBGlQbHUwQzaXjX
NAVER_CLIENT_SECRET=82CP_wfP9w
```

### backend/ai-service/.env
```env
NAVER_CLIENT_ID=XqQjKhBGlQbHUwQzaXjX
NAVER_CLIENT_SECRET=82CP_wfP9w
ALLOW_ORIGIN=http://localhost:3000

# AI Model Configuration (로컬 모델 사용)
MODEL_NAME=eenzeenee/t5-base-korean-summarization
MAX_SUMMARY_LENGTH=100
```

---

## 테스트 명령어

### API 엔드포인트 테스트
```bash
# 서버 상태 확인
curl http://localhost:3000/health
curl http://localhost:8000/health

# 공통 데이터 API 테스트
curl http://localhost:3000/api/common/categories
curl http://localhost:3000/api/common/media-sources
curl http://localhost:3000/api/common/search-options
curl http://localhost:3000/api/common/all

# 크롤러 상태 확인
curl http://localhost:3000/api/crawler/status

# AI 분석 테스트
curl -X POST http://localhost:8000/api/ai/analyze -H "Content-Type: application/json" -d '{"text": "테스트 뉴스 내용입니다."}'
```

---

## 문제 해결

### Node.js 설치가 필요한 경우
- Windows: https://nodejs.org 에서 다운로드
- macOS: `brew install node` 또는 https://nodejs.org
- Linux: `sudo apt install nodejs npm`

### Python 설치가 필요한 경우  
- Windows: https://python.org 에서 다운로드 (PATH 추가 체크)
- macOS: `brew install python3`
- Linux: `sudo apt install python3 python3-pip python3-venv`

### Docker 설치가 필요한 경우
- Windows: https://docker.com/products/docker-desktop
- macOS: `brew install --cask docker`
- Linux: https://docs.docker.com/engine/install/