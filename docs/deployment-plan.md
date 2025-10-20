# AWS 배포 및 CI/CD 계획

## 📋 목차
1. [인프라 준비](#1-인프라-준비-aws)
2. [CI/CD 설정](#2-cicd-설정-github-actions)
3. [모니터링 설정](#3-모니터링-설정)
4. [작업 순서](#4-작업-순서)

---

## 1. 인프라 준비 (AWS)

### 1-1. AWS 계정 및 IAM 설정
- [ ] AWS 계정 준비
- [ ] IAM 사용자 생성 (배포용)
  - 필요한 권한: `AmazonEC2ContainerRegistryFullAccess`, `AmazonECS_FullAccess`, `AmazonRDS_FullAccess`
- [ ] Access Key 발급 (GitHub Secrets에 저장)

### 1-2. ECR (Elastic Container Registry) 설정
- [ ] ECR 리포지토리 생성
  - `fans-main-api`
  - `fans-bias-analysis-ai`
  - `fans-puppeteer-crawler`
  - `fans-frontend` (Nginx)
- [ ] 리포지토리 URI 확인

### 1-3. RDS (PostgreSQL) 설정
- [ ] RDS 인스턴스 생성
  - Engine: PostgreSQL 15
  - Instance: db.t3.micro (프리티어) 또는 db.t3.small
  - Storage: 20GB (GP3)
  - Multi-AZ: No (비용 절감)
- [ ] 보안 그룹 설정 (ECS에서 접근 허용)
- [ ] 초기 데이터베이스 생성
- [ ] `init.sql` 실행

### 1-4. ECS (Elastic Container Service) 설정
- [ ] ECS 클러스터 생성
  - Launch Type: Fargate (서버리스)
  - 이름: `fans-cluster`
- [ ] Task Definition 생성 (서비스별)
  - `fans-main-api-task`
  - `fans-bias-analysis-ai-task`
  - `fans-puppeteer-crawler-task`
  - `fans-frontend-task`
- [ ] ECS Service 생성

### 1-5. ALB (Application Load Balancer) 설정
- [ ] ALB 생성
  - Target Groups:
    - `fans-frontend-tg` (포트 80)
    - `fans-api-tg` (포트 3000)
  - 리스너 규칙:
    - `/` → frontend
    - `/api/*` → main-api
    - `/ai/*` → bias-analysis-ai

### 1-6. Redis (ElastiCache) 설정
- [ ] ElastiCache for Redis 생성
  - Node Type: cache.t3.micro
  - Engine: Redis 7.x

### 1-7. 도메인 및 SSL (선택)
- [ ] Route 53에서 도메인 등록
- [ ] ACM에서 SSL 인증서 발급
- [ ] ALB에 SSL 인증서 연결

---

## 2. CI/CD 설정 (GitHub Actions)

### 2-1. GitHub Secrets 설정
```bash
# AWS 인증 정보
AWS_REGION=ap-northeast-2
AWS_ACCOUNT_ID=123456789012
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# ECR 리포지토리 URI
ECR_REGISTRY=123456789012.dkr.ecr.ap-northeast-2.amazonaws.com
ECR_REPOSITORY_API=fans-main-api
ECR_REPOSITORY_AI=fans-bias-analysis-ai
ECR_REPOSITORY_CRAWLER=fans-puppeteer-crawler
ECR_REPOSITORY_FRONTEND=fans-frontend

# ECS 설정
ECS_CLUSTER=fans-cluster
ECS_SERVICE_API=fans-main-api
ECS_SERVICE_AI=fans-bias-analysis-ai
ECS_SERVICE_CRAWLER=fans-puppeteer-crawler
ECS_SERVICE_FRONTEND=fans-frontend

# 환경 변수 (Production)
DATABASE_URL=postgresql://user:pass@rds-endpoint:5432/fans_db
JWT_SECRET=...
NAVER_SEARCH_CLIENT_ID=...
NAVER_SEARCH_CLIENT_SECRET=...
```

### 2-2. GitHub Actions Workflow 파일 생성
- [ ] `.github/workflows/deploy-api.yml`
- [ ] `.github/workflows/deploy-ai.yml`
- [ ] `.github/workflows/deploy-crawler.yml`
- [ ] `.github/workflows/deploy-frontend.yml`
- [ ] `.github/workflows/run-tests.yml` (선택)

### 2-3. Workflow 전략
```yaml
# 예시: deploy-api.yml
on:
  push:
    branches: [main]
    paths:
      - 'backend/api/**'
      - '.github/workflows/deploy-api.yml'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
      - name: Configure AWS credentials
      - name: Login to ECR
      - name: Build and push Docker image
      - name: Update ECS service
```

---

## 3. 모니터링 설정

### 3-1. CloudWatch 설정
- [ ] CloudWatch Logs 그룹 생성
  - `/ecs/fans-main-api`
  - `/ecs/fans-bias-analysis-ai`
  - `/ecs/fans-puppeteer-crawler`
- [ ] CloudWatch Metrics 대시보드 생성
  - CPU/Memory 사용률
  - Request Count
  - Error Rate
- [ ] CloudWatch Alarms 설정
  - CPU > 80%
  - Memory > 80%
  - 5XX Error Rate > 5%

### 3-2. 애플리케이션 로깅
- [ ] 구조화된 로그 포맷 (JSON)
- [ ] 로그 레벨 설정 (INFO, WARN, ERROR)
- [ ] 에러 추적 (Sentry 연동 - 선택)

### 3-3. 헬스체크
- [ ] `/health` 엔드포인트 구현 (각 서비스)
- [ ] ALB 헬스체크 설정
- [ ] ECS 헬스체크 설정

---

## 4. 작업 순서 (추천)

### Phase 1: 인프라 기본 설정 (2-3일)
1. ✅ AWS 계정 및 IAM 설정
2. ✅ RDS 생성 및 데이터베이스 초기화
3. ✅ ECR 리포지토리 생성
4. ✅ Redis (ElastiCache) 생성

### Phase 2: 컨테이너화 준비 (1-2일)
1. ✅ Dockerfile 최적화 (멀티스테이지 빌드)
2. ✅ 환경 변수 분리 (`.env.production`)
3. ✅ 헬스체크 엔드포인트 구현
4. ✅ 로컬에서 프로덕션 빌드 테스트

### Phase 3: ECS 배포 (2-3일)
1. ✅ Task Definition 작성
2. ✅ ECS 서비스 생성
3. ✅ ALB 설정 및 연결
4. ✅ 수동 배포 테스트

### Phase 4: CI/CD 자동화 (1-2일)
1. ✅ GitHub Secrets 설정
2. ✅ GitHub Actions Workflow 작성
3. ✅ 자동 배포 테스트
4. ✅ 롤백 전략 수립

### Phase 5: 모니터링 및 최적화 (1-2일)
1. ✅ CloudWatch 대시보드 생성
2. ✅ 알람 설정
3. ✅ 로그 분석
4. ✅ 성능 최적화

---

## 5. 예상 비용 (월간)

### AWS 리소스 비용
| 리소스 | 사양 | 예상 비용 |
|--------|------|-----------|
| RDS (PostgreSQL) | db.t3.micro | $15-20 |
| ECS Fargate (4 services) | 0.25 vCPU, 0.5GB | $30-40 |
| ALB | 기본 | $20-25 |
| ElastiCache (Redis) | cache.t3.micro | $12-15 |
| ECR (이미지 저장) | 10GB | $1-2 |
| CloudWatch Logs | 5GB | $2-3 |
| 데이터 전송 | 10GB | $1-2 |
| **총 예상 비용** | | **$80-110/월** |

### 비용 절감 팁
- [ ] Reserved Instances 사용 (RDS, ElastiCache)
- [ ] Auto Scaling 설정 (트래픽 적을 때 스케일 다운)
- [ ] CloudWatch Logs 보존 기간 설정 (7일)
- [ ] 개발/스테이징 환경은 필요할 때만 실행

---

## 6. 체크리스트

### 배포 전 체크리스트
- [ ] 모든 환경 변수 확인
- [ ] 데이터베이스 백업
- [ ] Docker 이미지 빌드 테스트
- [ ] 로컬에서 프로덕션 설정 테스트
- [ ] 보안 그룹 규칙 확인
- [ ] SSL 인증서 발급 (선택)

### 배포 후 체크리스트
- [ ] 헬스체크 정상 동작 확인
- [ ] API 엔드포인트 테스트
- [ ] 프론트엔드 접속 테스트
- [ ] 크롤러 동작 확인
- [ ] 로그 수집 확인
- [ ] 모니터링 대시보드 확인

---

## 7. 긴급 연락망 및 롤백 계획

### 롤백 절차
1. 이전 Task Definition으로 서비스 업데이트
2. 또는 이전 Docker 이미지 태그로 재배포
3. 데이터베이스 롤백 (필요 시)

### 장애 대응
- CloudWatch Alarm → SNS → 이메일/슬랙 알림
- 긴급 시 수동 스케일업
- 헬스체크 실패 시 자동 재시작

---

## 8. 참고 자료

- [AWS ECS Fargate 공식 문서](https://docs.aws.amazon.com/ecs/index.html)
- [GitHub Actions for AWS](https://github.com/aws-actions)
- [Docker 멀티스테이지 빌드](https://docs.docker.com/build/building/multi-stage/)
- [AWS 비용 계산기](https://calculator.aws/)
