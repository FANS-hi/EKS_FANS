# FANS - 뉴스 편향성 분석 플랫폼
🚀 DevOps Team | AWS 기반 클라우드 네이티브 뉴스 크롤링 및 AI 분석 시스템

### **📖 Contents**

1️⃣ [프로젝트 개요](#-프로젝트-개요)
2️⃣ [시스템 아키텍처](#-시스템-아키텍처)
3️⃣ [인프라 구성](#-인프라-구성)
4️⃣ [서비스 구성](#-서비스-구성)
5️⃣ [배포 및 운영](#-배포-및-운영)
6️⃣ [모니터링](#-모니터링)

<br>

## 🎯 프로젝트 개요

### ✔️ 프로젝트 목표
대한민국 주요 언론사의 뉴스 기사를 실시간으로 수집하고, AI를 활용하여 자동으로 요약 및 편향성 분석을 제공하는 클라우드 네이티브 플랫폼 구축

### ✔️ 핵심 기능
- 🔄 **자동화된 뉴스 크롤링**: 다음, 네이버 등 주요 포털 사이트에서 5분마다 자동 수집 (섹션당 20개 기사)
- 🤖 **AI 기반 분석**: 기사 자동 요약 및 정치적 편향성 분석
- 📊 **실시간 데이터 처리**: 크롤링부터 분석까지 완전 자동화된 파이프라인
- ⚡ **자동 스케일링**: HPA 기반 트래픽 대응 자동 확장/축소
- 🌐 **고가용성 웹 서비스**: www.fans.ai.kr

### ✔️ 기술 스택

#### 인프라 및 오케스트레이션
<img src="https://img.shields.io/badge/AWS-232F3E?style=flat-square&logo=amazonaws&logoColor=white"> <img src="https://img.shields.io/badge/Kubernetes-326CE5?style=flat-square&logo=kubernetes&logoColor=white"> <img src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white"> <img src="https://img.shields.io/badge/Terraform-7B42BC?style=flat-square&logo=terraform&logoColor=white">

#### 백엔드 & 크롤링
<img src="https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white"> <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white"> <img src="https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white"> <img src="https://img.shields.io/badge/Puppeteer-40B5A4?style=flat-square&logo=puppeteer&logoColor=white">

#### AI & ML
<img src="https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white"> <img src="https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white"> <img src="https://img.shields.io/badge/OpenAI-412991?style=flat-square&logo=openai&logoColor=white">

#### 데이터베이스
<img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white"> <img src="https://img.shields.io/badge/TypeORM-FE0803?style=flat-square&logo=typeorm&logoColor=white">

#### 프론트엔드
<img src="https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black"> <img src="https://img.shields.io/badge/CloudFront-FF9900?style=flat-square&logo=amazonaws&logoColor=white"> <img src="https://img.shields.io/badge/S3-569A31?style=flat-square&logo=amazons3&logoColor=white">

<br>

## 🏗️ 시스템 아키텍처

### ✔️ 전체 구성도

```
┌─────────────────────────────────────────────────────────────────┐
│                         사용자 (Users)                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CloudFront + S3                              │
│              (React Frontend - www.fans.ai.kr)                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Application Load Balancer                    │
│                      (ALB Ingress Controller)                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AWS EKS Cluster                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Main API (Node.js)  │  AI Services (Python FastAPI)      │  │
│  │  - 뉴스 CRUD          │  - 요약 AI (port 8000)              │  │
│  │  - 사용자 인증        │  - 편향성 분석 AI (port 8002)           │  │
│  │  - 검색/필터링        │                                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Unified Crawler v2 (TypeScript + Puppeteer)              │  │
│  │  - Daum 뉴스 크롤링 (JSON API)                               │  │
│  │  - Naver 뉴스 크롤링 (Meta Tags)                             │  │
│  │  - 자동 카테고리 분류                                          │  │
│  │  - 30분마다 자동 실행 (CronJob)                               │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  PostgreSQL (RDS)                                         │  │
│  │  - 뉴스 기사 저장                                             │  │
│  │  - AI 분석 결과 저장                                          │  │
│  │  - 사용자 데이터                                              │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│               External DB Sync (EC2 Instance)                   │
│            30분마다 외부 DB로 증분 백업 (Cron)                        │
└─────────────────────────────────────────────────────────────────┘
```

### ✔️ 데이터 플로우

```
뉴스 포털 (Daum/Naver)
         ↓
    [크롤링]
         ↓
  Unified Crawler v2
         ↓
    [파싱 & 분류]
         ↓
  PostgreSQL 저장
         ↓
    [AI 처리]
         ↓
  ┌─────────────────┐
  │  요약 AI         │ → AI 요약 결과 저장
  │  편향성 분석 AI    │ → 편향성 점수 저장
  └─────────────────┘
         ↓
    [API 제공]
         ↓
    React Frontend
         ↓
      사용자
```

<br>

## ☁️ 인프라 구성

### ✔️ AWS 리소스

#### EKS (Elastic Kubernetes Service)
- **클러스터**: eks-FANS-Cluster (v1.30)
- **노드 그룹**: t3.large × 1-2개 (Auto Scaling)
- **네트워크**: VPC (172.16.0.0/16), Public/Private Subnets
- **로드밸런서**: ALB Ingress Controller
- **자동 스케일링**: HPA 기반 Pod 자동 확장

#### 스토리지
- **S3**: 프론트엔드 정적 파일 호스팅
- **EBS**: EKS 노드 영구 스토리지
- **RDS PostgreSQL**: 메인 데이터베이스

#### CDN & DNS
- **CloudFront**: 글로벌 CDN
- **Route 53**: DNS 관리 (fans.ai.kr)

#### 크롤러 전용 인스턴스
- **EC2**: t2.medium (뉴스 크롤러 전용)
- **용도**:
  - Unified Crawler v2 실행 (Docker)
  - 30분마다 자동 크롤링
  - 외부 DB 동기화 (30분 간격)

### ✔️ Terraform으로 관리되는 리소스

```hcl
# infra/terraform/
├── main.tf          # Provider 설정
├── eks.tf           # EKS 클러스터, 노드그룹
├── network.tf       # VPC, Subnet, NAT Gateway
├── security.tf      # Security Groups
├── frontend.tf      # S3, CloudFront
└── variables.tf     # 변수 정의
```

**주요 설정**:
- EKS 버전: 1.28
- 노드 타입: t3.medium
- 최소/최대 노드: 2-4개
- 가용 영역: ap-northeast-2a, 2c

<br>

## 🔧 서비스 구성

### ✔️ Kubernetes Deployments

#### 1. Main API (backend/api)
```yaml
Replicas: 2
Port: 3000
Resources:
  CPU: 250m → 500m
  Memory: 512Mi → 1Gi
Health Check: /health
```

**주요 기능**:
- RESTful API 제공
- JWT 기반 인증
- 뉴스 CRUD
- 검색/필터링
- AI 서비스 연동

#### 2. Unified Crawler v2 (backend/crawler/crawler-v2)
```yaml
Replicas: 2
Port: 4005
Resources:
  CPU: 500m → 1000m
  Memory: 1Gi → 2Gi
Environment:
  - AUTO_CRAWL=true
  - CRAWL_INTERVAL_MINUTES=30
  - INSTANCE_ID=0,1
  - TOTAL_INSTANCES=2
```

**주요 기능**:
- 다음 뉴스: JSON API 방식 크롤링
- 네이버 뉴스: Meta Tags 방식 크롤링
- 자동 카테고리 분류 (정치, 경제, 사회, 세계, IT/과학, 생활/문화, 연예)
- 분산 크롤링 (2개 인스턴스)
- 중복 방지 (URL 기반)

#### 3. AI Services (backend/ai)

**요약 AI (Summarize)**:
```yaml
Replicas: 1
Port: 8000
Resources:
  CPU: 250m → 500m
  Memory: 512Mi → 1Gi
API: POST /ai/summarize
```

**편향성 분석 AI (Bias Analysis)**:
```yaml
Replicas: 1
Port: 8002
Resources:
  CPU: 250m → 500m
  Memory: 512Mi → 1Gi
API: POST /analyze/full
```

### ✔️ 데이터베이스 스키마

#### 주요 테이블
```sql
-- 뉴스 기사
news_articles (
  id, title, content, url, image_url,
  journalist, pub_date, source_id, category_id
)

-- 언론사
sources (
  id, name
)

-- 카테고리
categories (
  id, name
)

-- AI 요약
article_summaries (
  id, article_id, summary_text
)

-- 편향성 분석
bias_analysis (
  id, article_id, bias_score, political_leaning, confidence
)

-- 기사 통계
article_stats (
  article_id, view_count, like_count, bookmark_count
)
```

자세한 스키마는 [DATABASE.md](./docs/DATABASE.md) 참조

<br>

## 🚀 배포 및 운영

### ✔️ 배포 프로세스

#### 1. 인프라 구축
```bash
cd infra/terraform
terraform init
terraform plan
terraform apply
```

#### 2. Kubernetes 리소스 배포
```bash
# kubeconfig 설정
aws eks update-kubeconfig --name fans-eks-cluster --region ap-northeast-2

# Base 리소스
kubectl apply -f infra/kubernetes/base/

# 애플리케이션 배포
kubectl apply -f infra/kubernetes/apps/

# Ingress 설정
kubectl apply -f infra/kubernetes/ingress.yaml

# CronJob (크롤러 스케줄링)
kubectl apply -f infra/kubernetes/jobs/
```

#### 3. 배포 확인
```bash
kubectl get pods -n fans
kubectl get svc -n fans
kubectl get ingress -n fans
```

### ✔️ 자동화된 크롤링

#### 자동 크롤링 설정
```yaml
# 5분마다 자동 실행
AUTO_CRAWL: true
CRAWL_INTERVAL_MINUTES: 5
CRAWL_LIMIT_PER_SECTION: 20
```

#### 수동 크롤링
```bash
# Naver 크롤링
curl -X POST http://localhost:4005/crawl/naver \
  -H 'Content-Type: application/json' \
  -d '{"limit": 20}'

# Daum 크롤링
curl -X POST http://localhost:4005/crawl/daum \
  -H 'Content-Type: application/json' \
  -d '{"limit": 20}'

# 전체 크롤링
curl -X POST http://localhost:4005/crawl/all
```

### ✔️ 스케일링

#### 수평 스케일링 (HPA)
```bash
# API 서버 스케일링
kubectl scale deployment main-api --replicas=3 -n fans

# 크롤러 스케일링
kubectl scale deployment unified-crawler --replicas=4 -n fans
```

#### 수직 스케일링
리소스 제한 조정 후 재배포:
```yaml
resources:
  requests:
    cpu: 500m
    memory: 1Gi
  limits:
    cpu: 1000m
    memory: 2Gi
```

<br>

## 📊 모니터링

### ✔️ 로그 확인
```bash
# Pod 로그 확인
kubectl logs -f <pod-name> -n fans

# 크롤러 로그 필터링
kubectl logs -f unified-crawler-xxx -n fans | grep "카테고리:"

# 전체 Pod 로그
kubectl logs -l app=unified-crawler -n fans
```

### ✔️ 리소스 모니터링
```bash
# Pod 리소스 사용량
kubectl top pods -n fans

# 노드 리소스 사용량
kubectl top nodes

# 상세 정보
kubectl describe pod <pod-name> -n fans
```

### ✔️ 헬스체크
```bash
# API 헬스체크
curl http://api.fans.ai.kr/health

# 크롤러 헬스체크
curl http://crawler.fans.ai.kr/health
```

### ✔️ 데이터베이스 모니터링
```bash
# 최근 크롤링된 기사 수
kubectl exec -it postgres-xxx -n fans -- psql -U fans_user -d fans_db \
  -c "SELECT COUNT(*) FROM news_articles WHERE created_at > NOW() - INTERVAL '1 hour';"

# 카테고리별 통계
kubectl exec -it postgres-xxx -n fans -- psql -U fans_user -d fans_db \
  -c "SELECT c.name, COUNT(*) FROM news_articles n JOIN categories c ON n.category_id = c.id GROUP BY c.name;"
```

<br>

## 🛠️ 트러블슈팅

### ✔️ 일반적인 문제

#### Pod가 Pending 상태
```bash
kubectl describe pod <pod-name> -n fans
# 원인: 노드 리소스 부족, 스케줄링 실패
# 해결: 노드 추가 또는 리소스 제한 조정
```

#### ImagePullBackOff
```bash
# ECR 로그인 확인
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.ap-northeast-2.amazonaws.com
```

#### CrashLoopBackOff
```bash
# 이전 로그 확인
kubectl logs <pod-name> -n fans --previous

# 환경변수 확인
kubectl describe pod <pod-name> -n fans | grep -A 20 Environment
```

#### 크롤러 실패
```bash
# 크롤러 로그 확인
kubectl logs -f unified-crawler-xxx -n fans | tail -100

# 수동 크롤링 테스트
kubectl exec -it unified-crawler-xxx -n fans -- \
  curl -X POST http://localhost:4005/crawl/naver -d '{"limit": 3}'
```

<br>

## 📝 개발 가이드

### ✔️ 로컬 개발 환경

#### 필수 요구사항
- Node.js >= 20.19.5
- Python >= 3.10
- PostgreSQL >= 14
- Docker & Docker Compose

#### 로컬 실행
```bash
# 데이터베이스 시작
docker-compose up -d postgres

# API 서버
cd backend/api
npm install
npm run dev

# 크롤러 (로컬 테스트)
cd backend/crawler/crawler-v2
npm install
npm run dev

# AI 서비스
cd backend/ai/summarize-ai
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# 프론트엔드
cd frontend
npm install
npm start
```

### ✔️ 환경변수 설정

```bash
# backend/api/.env
DATABASE_URL=postgresql://fans_user:password@localhost:5432/fans_db
JWT_SECRET=your-secret-key
PORT=3000

# backend/crawler/crawler-v2/.env
DB_HOST=localhost
DB_PORT=5432
DB_USER=fans_user
DB_PASSWORD=password
DB_NAME=fans_db
AUTO_CRAWL=false

# backend/ai/.env
OPENAI_API_KEY=your-openai-key
```

<br>

## 📚 문서

- [시스템 아키텍처 (2025)](./docs/SYSTEM_ARCHITECTURE_2025.md) - 전체 시스템 설계
- [데이터베이스 스키마](./docs/DATABASE.md) - DB 구조 및 ERD
- [Terraform 가이드](./infra/terraform/README.md) - AWS 인프라 구축
- [Kubernetes 가이드](./infra/kubernetes/README.md) - EKS 리소스 배포
- [Crawler v2 가이드](./backend/crawler/crawler-v2/README.md) - 크롤러 상세 설명

<br>

## 🎯 주요 성과

### ✔️ 카테고리 자동 분류 개선
- **문제**: 네이버 뉴스 기사의 97.3%가 "기타" 카테고리로 잘못 분류
- **해결**: 섹션 URL 기반 자동 분류 로직 추가
- **결과**:
  - 정치, 경제, 사회 등 정확한 카테고리로 분류
  - 분류 정확도 100% 달성

### ✔️ 인프라 자동화
- Terraform으로 인프라 코드화 (IaC)
- Kubernetes로 컨테이너 오케스트레이션
- CronJob으로 크롤링 자동화 (30분 간격)

### ✔️ 고가용성 및 확장성
- EKS 클러스터 기반 컨테이너 환경
- Auto Scaling Group으로 자동 스케일링
- 다중 인스턴스 크롤링으로 부하 분산

<br>

## 🔮 향후 계획

### ✔️ 단기 목표
- [ ] Prometheus + Grafana 모니터링 스택 구축
- [ ] HPA (Horizontal Pod Autoscaler) 설정
- [ ] CI/CD 파이프라인 구축 (GitHub Actions)
- [ ] 크롤링 성능 최적화 (병렬 처리)

### ✔️ 중장기 목표
- [ ] 스포츠 뉴스 크롤링 추가
- [ ] 실시간 뉴스 알림 기능
- [ ] 언론사별 편향성 통계 대시보드
- [ ] 사용자 맞춤 뉴스 추천 알고리즘
- [ ] 모바일 앱 개발

<br>

## 👥 팀 정보

**FANS DevOps Team**

- Infrastructure & DevOps
- Backend Development
- AI/ML Integration
- Frontend Development

<br>

## 📄 라이선스

MIT License

---

**작성일**: 2025-01-15
**최종 업데이트**: 2025-10-17
**프로젝트 상태**: ✅ 운영 중 (www.fans.ai.kr)
