# FANS 프로젝트 아키텍처 문서

## 목차
1. [전체 시스템 아키텍처](#전체-시스템-아키텍처)
2. [네트워크 구조](#네트워크-구조)
3. [서비스 구성요소](#서비스-구성요소)
4. [데이터 플로우](#데이터-플로우)
5. [보안 구조](#보안-구조)
6. [데이터베이스 스키마](#데이터베이스-스키마)

---

## 전체 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                              Internet                                │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               │ HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        CloudFront (CDN)                              │
│                  https://dl8va6yrt5vtj.cloudfront.net               │
│                                                                       │
│  ┌─────────────────────────┐  ┌─────────────────────────┐          │
│  │   Origin: S3 Bucket     │  │   Origin: ALB           │          │
│  │   (Frontend Files)      │  │   (/api/* → ALB)        │          │
│  │   Default: /*           │  │   Cache Behavior        │          │
│  └─────────────────────────┘  └─────────────────────────┘          │
└──────────────────┬──────────────────────────┬─────────────────────┘
                   │                           │
                   │                           │ HTTP
                   ▼                           ▼
┌──────────────────────────────┐  ┌──────────────────────────────────┐
│   S3 Bucket (Frontend)       │  │   Application Load Balancer       │
│   dw-fans-frontend-prod      │  │   dw-FANS-ALB                    │
│                              │  │                                   │
│   - index.html               │  │   Listeners:                      │
│   - static/js/*.js           │  │   - Port 80  (HTTP → Forward)     │
│   - static/css/*.css         │  │   - Port 443 (HTTPS)              │
│   - logo.svg                 │  │                                   │
└──────────────────────────────┘  │   Routing Rules:                  │
                                   │   - /api/*        → Main API      │
                                   │   - /ai/summarize/* → Summarize   │
                                   │   - /ai/bias/*    → Bias AI       │
                                   └────────────┬──────────────────────┘
                                                │
                     ┌──────────────────────────┼──────────────────────┐
                     │                          │                       │
                     ▼                          ▼                       ▼
          ┌──────────────────┐    ┌─────────────────────┐  ┌─────────────────────┐
          │  Target Group 1  │    │  Target Group 2     │  │  Target Group 3     │
          │  Main API        │    │  Summarize AI       │  │  Bias Analysis AI   │
          │  Port: 31800     │    │  Port: 30187        │  │  Port: 32565        │
          │  (NodePort)      │    │  (NodePort)         │  │  (NodePort)         │
          └──────┬───────────┘    └─────────┬───────────┘  └─────────┬───────────┘
                 │                           │                         │
                 │                           │                         │
═════════════════╪═══════════════════════════╪═════════════════════════╪══════════
                 │         EKS Cluster       │                         │
                 │         (Kubernetes)      │                         │
═════════════════╪═══════════════════════════╪═════════════════════════╪══════════
                 │                           │                         │
                 ▼                           ▼                         ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                          EKS Worker Nodes                                   │
│                          (EC2 Instances)                                    │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐           │
│  │  Main API Pod   │  │ Summarize AI    │  │ Bias AI Pod     │           │
│  │                 │  │ Pod             │  │                 │           │
│  │  Express.js     │  │                 │  │ FastAPI         │           │
│  │  TypeScript     │  │ FastAPI         │  │ Python          │           │
│  │  Port: 3000     │  │ Python          │  │ Port: 8002      │           │
│  │                 │  │ Port: 8000      │  │                 │           │
│  │  Replicas: 1-3  │  │                 │  │ Replicas: 1-2   │           │
│  │  (HPA)          │  │ Replicas: 1-2   │  │ (HPA)           │           │
│  └────────┬────────┘  │ (HPA)           │  └────────┬────────┘           │
│           │           └────────┬────────┘           │                     │
│           │                    │                    │                     │
│           │                    │                    │                     │
│  ┌────────▼──────────────────────────────────────────▼──────┐             │
│  │                                                           │             │
│  │  ┌─────────────────┐  ┌─────────────────┐               │             │
│  │  │ API Crawler Pod │  │ Puppeteer       │               │             │
│  │  │                 │  │ Crawler Pod     │               │             │
│  │  │ Node.js         │  │                 │               │             │
│  │  │ Port: 4003      │  │ Headless Chrome │               │             │
│  │  │                 │  │ Port: 4001      │               │             │
│  │  │ Schedule: 5min  │  │ Schedule: 5min  │               │             │
│  │  └────────┬────────┘  └────────┬────────┘               │             │
│  │           │                     │                        │             │
│  └───────────┼─────────────────────┼────────────────────────┘             │
└──────────────┼─────────────────────┼──────────────────────────────────────┘
               │                     │
               │                     │
               │                     │
    ┌──────────▼─────────────────────▼───────────┐
    │                                             │
    │     ┌──────────────────┐                   │
    │     │  RDS PostgreSQL  │                   │
    │     │  fans_db         │                   │
    │     │                  │                   │
    │     │  - users         │                   │
    │     │  - news_feed     │                   │
    │     │  - interactions  │                   │
    │     │  - ...           │                   │
    │     │                  │                   │
    │     │  Port: 5432      │                   │
    │     └──────────────────┘                   │
    │                                             │
    │     ┌──────────────────┐                   │
    │     │ ElastiCache Redis│                   │
    │     │                  │                   │
    │     │  - Session Cache │                   │
    │     │  - Rate Limiting │                   │
    │     │                  │                   │
    │     │  Port: 6379      │                   │
    │     └──────────────────┘                   │
    │                                             │
    └─────────────────────────────────────────────┘
                    Private Subnet
```

---

## 네트워크 구조

### VPC 구성
```
VPC: 10.0.30.0/24

┌─────────────────────────────────────────────────────────────┐
│  Region: ap-northeast-2 (Seoul)                             │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Availability Zone A (ap-northeast-2a)              │   │
│  │                                                       │   │
│  │  ┌──────────────────────────────────────┐           │   │
│  │  │  Public Subnet A                     │           │   │
│  │  │  10.0.30.0/26 (64 IPs)              │           │   │
│  │  │                                      │           │   │
│  │  │  - ALB (dw-FANS-ALB)                │           │   │
│  │  │  - NAT Gateway A                    │           │   │
│  │  │  - Internet Gateway (IGW)           │           │   │
│  │  └──────────────────────────────────────┘           │   │
│  │                                                       │   │
│  │  ┌──────────────────────────────────────┐           │   │
│  │  │  Private Subnet A                    │           │   │
│  │  │  10.0.30.64/26 (64 IPs)             │           │   │
│  │  │                                      │           │   │
│  │  │  - EKS Worker Node 1                │           │   │
│  │  │  - RDS Primary (if Multi-AZ)        │           │   │
│  │  │  - ElastiCache Node 1               │           │   │
│  │  └──────────────────────────────────────┘           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Availability Zone B (ap-northeast-2b)              │   │
│  │                                                       │   │
│  │  ┌──────────────────────────────────────┐           │   │
│  │  │  Public Subnet B                     │           │   │
│  │  │  10.0.30.128/26 (64 IPs)            │           │   │
│  │  │                                      │           │   │
│  │  │  - ALB (Second Target)              │           │   │
│  │  │  - NAT Gateway B                    │           │   │
│  │  └──────────────────────────────────────┘           │   │
│  │                                                       │   │
│  │  ┌──────────────────────────────────────┐           │   │
│  │  │  Private Subnet B                    │           │   │
│  │  │  10.0.30.192/26 (64 IPs)            │           │   │
│  │  │                                      │           │   │
│  │  │  - EKS Worker Node 2                │           │   │
│  │  │  - RDS Standby (if Multi-AZ)        │           │   │
│  │  │  - ElastiCache Node 2               │           │   │
│  │  └──────────────────────────────────────┘           │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 라우팅 테이블

**Public Subnet Route Table**:
```
Destination         Target
10.0.30.0/24       local
0.0.0.0/0          igw-xxxxx (Internet Gateway)
```

**Private Subnet A Route Table**:
```
Destination         Target
10.0.30.0/24       local
0.0.0.0/0          nat-xxxxx (NAT Gateway A)
```

**Private Subnet B Route Table**:
```
Destination         Target
10.0.30.0/24       local
0.0.0.0/0          nat-yyyyy (NAT Gateway B)
```

---

## 서비스 구성요소

### 1. 프론트엔드 (Frontend)

**기술 스택**:
- React 18.x
- React Router v6
- CSS Modules

**호스팅**:
- S3 Bucket: `dw-fans-frontend-production`
- CloudFront Distribution
- URL: `https://dl8va6yrt5vtj.cloudfront.net`

**주요 기능**:
- 뉴스 피드 표시
- 카테고리/언론사 필터링
- 검색 기능
- 사용자 인증 (로그인/회원가입)
- 활동 로그
- 북마크/좋아요/싫어요

**환경 변수**:
```bash
REACT_APP_API_URL=          # 비워둠 (상대 경로 사용)
REACT_APP_API_BASE=         # 비워둠
REACT_APP_AI_SERVICE_URL=   # 비워둠
```

---

### 2. Main API (백엔드 API)

**기술 스택**:
- Node.js 18.x
- Express.js
- TypeScript
- TypeORM

**컨테이너**:
- ECR: `907123164281.dkr.ecr.ap-northeast-2.amazonaws.com/dw-fans/main-api:latest`
- Kubernetes Deployment
- Replicas: 1-3 (HPA)
- Port: 3000
- NodePort: 31800

**주요 API 엔드포인트**:
```
GET  /health                    # Health check
GET  /api/feed                  # 뉴스 피드 조회
GET  /api/feed/:id              # 뉴스 상세 조회
POST /api/auth/login            # 로그인
POST /api/auth/register         # 회원가입
POST /api/auth/logout           # 로그아웃
GET  /api/auth/kakao            # Kakao OAuth
GET  /api/auth/naver            # Naver OAuth
POST /api/interactions/view     # 조회수 증가
POST /api/interactions/like     # 좋아요
POST /api/interactions/dislike  # 싫어요
POST /api/interactions/bookmark # 북마크
GET  /api/user/activity-log     # 활동 로그
GET  /api/categories            # 카테고리 목록
GET  /api/media-sources         # 언론사 목록
```

**환경 변수**:
```yaml
PORT: "3000"
NODE_ENV: "production"
DATABASE_URL: "postgresql://..."
REDIS_URL: "redis://..."
AI_SERVICE_URL: "http://summarize-ai:8000"
BIAS_AI_SERVICE_URL: "http://bias-analysis-ai:8002"
CORS_ALLOWED_ORIGINS: "https://dl8va6yrt5vtj.cloudfront.net,..."
FRONTEND_URL: "https://dl8va6yrt5vtj.cloudfront.net"
```

---

### 3. Summarize AI Service (요약 AI)

**기술 스택**:
- Python 3.11
- FastAPI
- Transformers (Hugging Face)
- PyTorch

**컨테이너**:
- ECR: `907123164281.dkr.ecr.ap-northeast-2.amazonaws.com/dw-fans/summarize-ai:latest`
- Kubernetes Deployment
- Replicas: 1-2 (HPA)
- Port: 8000
- NodePort: 30187

**주요 API 엔드포인트**:
```
GET  /health          # Health check
POST /ai/summarize    # 뉴스 요약 생성
```

**요약 알고리즘**:
- Pre-trained 모델: `gogamza/kobart-summarization`
- 최대 입력 길이: 1024 tokens
- 최대 출력 길이: 128 tokens

---

### 4. Bias Analysis AI Service (편향 분석 AI)

**기술 스택**:
- Python 3.11
- FastAPI
- Transformers
- scikit-learn

**컨테이너**:
- ECR: `907123164281.dkr.ecr.ap-northeast-2.amazonaws.com/dw-fans/bias-analysis-ai:latest`
- Kubernetes Deployment
- Replicas: 1-2 (HPA)
- Port: 8002
- NodePort: 32565

**주요 API 엔드포인트**:
```
GET  /health          # Health check
POST /ai/bias         # 편향 분석
```

**분석 항목**:
- 정치적 편향도
- 감정 분석 (긍정/부정/중립)
- 신뢰도 점수

---

### 5. API Crawler (뉴스 크롤러)

**기술 스택**:
- Node.js 18.x
- Axios
- Cheerio

**컨테이너**:
- ECR: `907123164281.dkr.ecr.ap-northeast-2.amazonaws.com/dw-fans/api-crawler:latest`
- Kubernetes Deployment
- Replicas: 1
- Port: 4003

**크롤링 소스**:
- 네이버 뉴스 API
- 다음 뉴스 API
- RSS Feeds

**스케줄**:
- 자동 실행: 5분마다 (카테고리당 20개)
- 수동 실행: `/crawler/run` 엔드포인트

**데이터 처리**:
1. 뉴스 수집
2. 중복 제거
3. 본문 추출
4. 키워드 추출
5. DB 저장

---

### 6. Puppeteer Crawler (동적 크롤러)

**기술 스택**:
- Node.js 18.x
- Puppeteer
- Headless Chrome

**컨테이너**:
- ECR: `907123164281.dkr.ecr.ap-northeast-2.amazonaws.com/dw-fans/puppeteer-crawler:latest`
- Kubernetes Deployment
- Replicas: 1
- Port: 4001

**용도**:
- JavaScript 렌더링이 필요한 페이지 크롤링
- 스크린샷 캡처
- PDF 생성

---

## 데이터 플로우

### 1. 사용자 뉴스 조회 플로우

```
User Browser
    │
    │ HTTPS GET https://dl8va6yrt5vtj.cloudfront.net
    ▼
CloudFront
    │
    │ (Cache Miss)
    ▼
S3 Bucket
    │
    │ Return index.html + JS/CSS
    ▼
CloudFront
    │
    │ Cache & Return
    ▼
User Browser
    │
    │ JS Execution
    │ API Call: /api/feed?limit=60
    │ (Relative Path)
    ▼
CloudFront
    │
    │ Cache Behavior: /api/*
    │ Forward to ALB Origin
    ▼
ALB (Port 80)
    │
    │ Listener Rule: /api/* → Main API TG
    ▼
Target Group (NodePort 31800)
    │
    │ Health Check: /health
    ▼
EKS Service (main-api)
    │
    │ Load Balance
    ▼
Main API Pod (Port 3000)
    │
    │ 1. Authentication Check (JWT)
    │ 2. Query PostgreSQL
    │ 3. Check Redis Cache
    ▼
RDS PostgreSQL
    │
    │ SELECT * FROM news_feed
    │ WHERE ...
    │ LIMIT 60
    ▼
Main API Pod
    │
    │ 4. Format Response JSON
    │ 5. Cache to Redis (if needed)
    ▼
ALB
    │
    │ Return JSON
    ▼
CloudFront
    │
    │ (No Cache for API)
    ▼
User Browser
    │
    │ Render News Feed
    ▼
Display News
```

---

### 2. 뉴스 크롤링 플로우

```
Kubernetes CronJob (30초마다)
    │
    │ Trigger
    ▼
API Crawler Pod
    │
    │ 1. Fetch News from APIs
    │    - 네이버 뉴스 API
    │    - 다음 뉴스 API
    │
    │ 2. Parse & Clean Data
    │    - Remove HTML tags
    │    - Extract keywords
    │    - Deduplicate
    │
    │ 3. Check if exists
    │    Query: SELECT id FROM news_feed WHERE url = ?
    ▼
RDS PostgreSQL
    │
    │ Return existing IDs
    ▼
API Crawler Pod
    │
    │ 4. Filter new articles
    │ 5. Insert to DB
    │    INSERT INTO news_feed (...)
    │    VALUES (...)
    ▼
RDS PostgreSQL
    │
    │ Store new articles
    │ Trigger: After Insert
    │
    │ (Optional) Call AI Service
    │ for summarization
    ▼
API Crawler Pod
    │
    │ POST /ai/summarize
    │ { "content": "..." }
    ▼
Summarize AI Pod
    │
    │ 1. Tokenize text
    │ 2. Generate summary (KoBART)
    │ 3. Return JSON
    ▼
API Crawler Pod
    │
    │ UPDATE news_feed
    │ SET ai_summary = ?
    │ WHERE id = ?
    ▼
RDS PostgreSQL
    │
    │ Update summary
    ▼
Complete
```

---

### 3. 사용자 인증 플로우 (OAuth)

```
User Browser
    │
    │ Click "Kakao/Naver Login"
    ▼
CloudFront → ALB → Main API
    │
    │ GET /api/auth/kakao (or /api/auth/naver)
    │
    │ Redirect to Kakao/Naver OAuth
    ▼
Kakao/Naver OAuth Server
    │
    │ User Login & Consent
    │
    │ Callback with code
    ▼
CloudFront → ALB → Main API
    │
    │ GET /api/auth/kakao/callback?code=xxx
    │
    │ 1. Exchange code for token
    │ 2. Get user info from Kakao/Naver
    │ 3. Check if user exists in DB
    ▼
RDS PostgreSQL
    │
    │ SELECT * FROM users WHERE email = ?
    │
    │ (If not exists)
    │ INSERT INTO users (...)
    ▼
Main API Pod
    │
    │ 4. Generate JWT token
    │ 5. Store session in Redis
    ▼
Redis (ElastiCache)
    │
    │ SET session:xxx { userId: 1, ... }
    │ EXPIRE 86400 (24 hours)
    ▼
Main API Pod
    │
    │ 6. Set cookie
    │ 7. Redirect to frontend
    ▼
User Browser
    │
    │ Store token in localStorage
    │ Redirect to homepage
    ▼
Authenticated Session
```

---

## 보안 구조

### Security Groups

#### 1. ALB Security Group (`sg-072e82467f26e3387`)

**Ingress (인바운드)**:
```
Protocol  Port       Source              Description
TCP       80         0.0.0.0/0           HTTP from internet
TCP       443        0.0.0.0/0           HTTPS from internet
```

**Egress (아웃바운드)**:
```
Protocol  Port       Destination              Description
TCP       31800      EKS Node SG              Main API NodePort
TCP       30187      EKS Node SG              Summarize AI NodePort
TCP       32565      EKS Node SG              Bias AI NodePort
TCP       3000       Web SG (legacy)          Main API direct
TCP       8000-8002  Web SG (legacy)          AI Services direct
```

---

#### 2. EKS Node Security Group (`sg-0754fafe3df807759`)

**Ingress (인바운드)**:
```
Protocol  Port       Source              Description
TCP       31800      ALB SG              Main API NodePort from ALB
TCP       30187      ALB SG              Summarize AI NodePort
TCP       32565      ALB SG              Bias AI NodePort
TCP       All        EKS Node SG (self)  Inter-node communication
TCP       443        EKS Control Plane   Kubelet API
```

**Egress (아웃바운드)**:
```
Protocol  Port       Destination         Description
TCP       All        0.0.0.0/0          Internet (via NAT Gateway)
TCP       5432       RDS SG             PostgreSQL access
TCP       6379       ElastiCache SG     Redis access
```

---

#### 3. RDS Security Group (`sg-028b5a66510b66892`)

**Ingress (인바운드)**:
```
Protocol  Port       Source              Description
TCP       5432       EKS Node SG         PostgreSQL from EKS
TCP       5432       Web SG (legacy)     PostgreSQL from web tier
```

**Egress (아웃바운드)**:
```
Protocol  Port       Destination         Description
None      -          -                   No outbound (managed)
```

---

#### 4. ElastiCache Security Group (`sg-050a0859a28639798`)

**Ingress (인바운드)**:
```
Protocol  Port       Source              Description
TCP       6379       EKS Node SG         Redis from EKS
TCP       6379       Web SG (legacy)     Redis from web tier
```

**Egress (아웃바운드)**:
```
Protocol  Port       Destination         Description
None      -          -                   No outbound (managed)
```

---

### IAM Roles

#### 1. EKS Cluster Role
- Policy: `AmazonEKSClusterPolicy`
- Purpose: EKS 클러스터 관리

#### 2. EKS Node Group Role
- Policies:
  - `AmazonEKSWorkerNodePolicy`
  - `AmazonEKS_CNI_Policy`
  - `AmazonEC2ContainerRegistryReadOnly`
- Purpose: Worker Node 관리, ECR 이미지 pull

#### 3. AWS Load Balancer Controller Role
- Policy: Custom policy for ALB/NLB management
- Purpose: Kubernetes에서 ALB/NLB 생성/관리

---

## 데이터베이스 스키마

### 1. users (사용자)
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    user_name VARCHAR(100),
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255),  -- NULL for OAuth users
    profile_image VARCHAR(500),
    provider VARCHAR(20),  -- 'local', 'kakao', 'naver'
    provider_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_provider ON users(provider, provider_id);
```

---

### 2. news_feed (뉴스 피드)
```sql
CREATE TABLE news_feed (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    url VARCHAR(1000) UNIQUE NOT NULL,
    image_url VARCHAR(1000),
    content TEXT NOT NULL,
    ai_summary TEXT,
    summary TEXT,  -- Manual summary
    source VARCHAR(100) NOT NULL,  -- 언론사
    category VARCHAR(50) NOT NULL,  -- 카테고리
    journalist VARCHAR(100),
    pub_date TIMESTAMP NOT NULL,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    dislike_count INTEGER DEFAULT 0,
    bookmark_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_news_feed_pub_date ON news_feed(pub_date DESC);
CREATE INDEX idx_news_feed_category ON news_feed(category);
CREATE INDEX idx_news_feed_source ON news_feed(source);
CREATE INDEX idx_news_feed_url ON news_feed(url);
```

---

### 3. keywords (키워드)
```sql
CREATE TABLE keywords (
    id SERIAL PRIMARY KEY,
    news_id INTEGER REFERENCES news_feed(id) ON DELETE CASCADE,
    keyword VARCHAR(100) NOT NULL,
    relevance_score FLOAT,  -- 관련도 점수
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_keywords_news_id ON keywords(news_id);
CREATE INDEX idx_keywords_keyword ON keywords(keyword);
```

---

### 4. interactions (사용자 상호작용)
```sql
CREATE TABLE interactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    news_id INTEGER REFERENCES news_feed(id) ON DELETE CASCADE,
    interaction_type VARCHAR(20) NOT NULL,  -- 'view', 'like', 'dislike', 'bookmark'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, news_id, interaction_type)
);

CREATE INDEX idx_interactions_user_id ON interactions(user_id);
CREATE INDEX idx_interactions_news_id ON interactions(news_id);
CREATE INDEX idx_interactions_type ON interactions(interaction_type);
CREATE INDEX idx_interactions_created_at ON interactions(created_at DESC);
```

---

### 5. categories (카테고리 마스터)
```sql
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Default categories
INSERT INTO categories (name, display_order) VALUES
('전체', 0),
('정치', 1),
('경제', 2),
('사회', 3),
('국제', 4),
('문화', 5),
('스포츠', 6),
('IT/과학', 7);
```

---

### 6. media_sources (언론사 마스터)
```sql
CREATE TABLE media_sources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    url VARCHAR(500),
    logo_url VARCHAR(500),
    bias_score FLOAT,  -- 정치적 편향도 (-1.0 ~ 1.0)
    credibility_score FLOAT,  -- 신뢰도 (0.0 ~ 1.0)
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_media_sources_name ON media_sources(name);
```

---

### 7. user_preferences (사용자 설정)
```sql
CREATE TABLE user_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    preferred_categories TEXT[],  -- 선호 카테고리 배열
    preferred_sources TEXT[],     -- 선호 언론사 배열
    email_notification BOOLEAN DEFAULT TRUE,
    push_notification BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
```

---

### ER Diagram (주요 관계)

```
┌─────────────┐
│   users     │
│             │
│ id (PK)     │───┐
│ username    │   │
│ email       │   │
│ provider    │   │
└─────────────┘   │
                  │
                  │ 1:N
                  ▼
          ┌──────────────────┐
          │  interactions    │
          │                  │
          │ id (PK)          │
          │ user_id (FK)     │
          │ news_id (FK)     │───────┐
          │ interaction_type │       │
          └──────────────────┘       │
                                     │
                                     │ N:1
                                     ▼
                              ┌──────────────┐
                              │  news_feed   │
                              │              │
                              │ id (PK)      │───┐
                              │ title        │   │
                              │ url          │   │
                              │ source       │   │
                              │ category     │   │
                              └──────────────┘   │
                                                 │
                                                 │ 1:N
                                                 ▼
                                          ┌──────────────┐
                                          │  keywords    │
                                          │              │
                                          │ id (PK)      │
                                          │ news_id (FK) │
                                          │ keyword      │
                                          └──────────────┘
```

---

## 성능 최적화

### 1. Caching Strategy

**Redis 캐시 키 구조**:
```
# Session
session:{sessionId}          TTL: 24h

# API Response
api:feed:{params_hash}       TTL: 60s
api:news:{newsId}            TTL: 5m
api:categories               TTL: 1h
api:sources                  TTL: 1h

# Rate Limiting
ratelimit:{ip}:{endpoint}    TTL: 1m
```

**CloudFront 캐시**:
- Static files (JS/CSS/Images): 24시간
- HTML: 1시간
- API responses (`/api/*`): No cache (TTL = 0)

---

### 2. Database Indexing

**주요 인덱스**:
- `news_feed.pub_date` (DESC) - 최신 뉴스 조회
- `news_feed.category` - 카테고리 필터
- `news_feed.source` - 언론사 필터
- `interactions(user_id, news_id)` - 사용자 상호작용 조회
- `keywords.keyword` - 키워드 검색

---

### 3. Auto Scaling

**EKS Horizontal Pod Autoscaler (HPA)**:
```yaml
# Main API
minReplicas: 1
maxReplicas: 3
targetCPUUtilizationPercentage: 70
targetMemoryUtilizationPercentage: 80

# AI Services
minReplicas: 1
maxReplicas: 2
targetCPUUtilizationPercentage: 80
```

**EKS Cluster Autoscaler**:
- Min nodes: 2
- Max nodes: 5
- Scale up when: CPU > 80% or Pending Pods
- Scale down when: CPU < 50% for 10 minutes

---

## 모니터링 & 로깅

### CloudWatch Metrics

**ALB Metrics**:
- `TargetResponseTime`
- `HTTPCode_Target_2XX_Count`
- `HTTPCode_Target_4XX_Count`
- `HTTPCode_Target_5XX_Count`
- `HealthyHostCount`
- `UnHealthyHostCount`

**EKS Metrics**:
- `node_cpu_utilization`
- `node_memory_utilization`
- `pod_cpu_utilization`
- `pod_memory_utilization`

**RDS Metrics**:
- `CPUUtilization`
- `DatabaseConnections`
- `FreeableMemory`
- `ReadLatency`
- `WriteLatency`

---

## 비용 최적화

### 월 예상 비용 (대략)

| 서비스 | 스펙 | 월 비용 (USD) |
|--------|------|---------------|
| EKS Cluster | Control Plane | $73 |
| EC2 (Worker Nodes) | t3.medium x 2 | $60 |
| NAT Gateway | 2개 | $64 |
| RDS PostgreSQL | db.t3.micro | $15 |
| ElastiCache Redis | cache.t3.micro | $12 |
| ALB | 1개 | $20 |
| S3 | 10GB | $0.23 |
| CloudFront | 100GB 전송 | $8.5 |
| **총 예상 비용** | | **~$253/월** |

---

**마지막 업데이트**: 2025-10-14
**작성자**: DW (DongWon)
**프로젝트**: FANS (Financial & Analytics News Service)
