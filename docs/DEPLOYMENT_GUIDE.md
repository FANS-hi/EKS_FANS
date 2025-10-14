# FANS 프로젝트 배포 가이드

## 목차
1. [사전 요구사항](#사전-요구사항)
2. [전체 인프라 배포 (처음부터)](#전체-인프라-배포-처음부터)
3. [부분 배포 (변경사항만)](#부분-배포-변경사항만)
4. [트러블슈팅](#트러블슈팅)
5. [롤백 절차](#롤백-절차)

---

## 사전 요구사항

### 1. AWS CLI 설정
```bash
# AWS CLI 설치 확인
aws --version

# AWS 자격증명 설정 확인
aws sts get-caller-identity

# 결과 예시:
# {
#     "UserId": "...",
#     "Account": "907123164281",
#     "Arn": "arn:aws:iam::907123164281:user/..."
# }
```

### 2. kubectl 설정
```bash
# kubectl 설치 확인
kubectl version --client

# EKS 클러스터 연결 (배포 후)
aws eks update-kubeconfig --region ap-northeast-2 --name dw-FANS-EKS-Cluster
```

### 3. Terraform 설치
```bash
# Terraform 설치 확인
terraform version

# Terraform 버전: v1.5.0 이상 권장
```

### 4. Docker 설치 (로컬 빌드용)
```bash
# Docker 설치 확인
docker --version
```

### 5. Node.js 설치 (프론트엔드 빌드용)
```bash
# Node.js 설치 확인
node --version  # v18 이상 권장
npm --version
```

---

## 전체 인프라 배포 (처음부터)

### Step 1: Terraform 인프라 배포

#### 1.1 Terraform 초기화
```bash
cd /Users/hodduk/Documents/git/AWS_FANS/infra/terraform

# 백엔드 초기화 (S3 state 사용 시)
terraform init

# 작업 공간 확인
terraform workspace list
```

#### 1.2 Terraform 변수 확인
`variables.tf`에서 다음 변수들을 확인하세요:
- `environment`: 배포 환경 (production/staging/dev)
- `region`: AWS 리전 (기본: ap-northeast-2)
- `project_name`: 프로젝트 이름 (FANS)

#### 1.3 Terraform Plan 실행
```bash
# 변경사항 미리보기
terraform plan

# 주요 생성 리소스 확인:
# - VPC (10.0.30.0/24)
# - Public Subnet 2개
# - Private Subnet 2개
# - NAT Gateway 2개
# - EKS Cluster
# - RDS PostgreSQL
# - ElastiCache Redis
# - ECR Repositories 5개
# - ALB
# - S3 Bucket (프론트엔드)
# - CloudFront Distribution
```

#### 1.4 Terraform Apply 실행
```bash
# 인프라 배포 (약 15-20분 소요)
terraform apply

# 확인 프롬프트에서 'yes' 입력

# 배포 완료 후 출력값 저장
terraform output > terraform-outputs.txt
```

#### 1.5 중요 출력값 저장
```bash
# ALB DNS 이름
terraform output alb_dns_name

# CloudFront 도메인
terraform output cloudfront_domain_name

# CloudFront Distribution ID
terraform output -json | grep -A 5 cloudfront

# ECR Repository URLs
terraform output ecr_repositories

# EKS Cluster 이름
terraform output eks_cluster_name

# RDS 엔드포인트
terraform output rds_endpoint

# Redis 엔드포인트
terraform output redis_endpoint
```

---

### Step 2: Docker 이미지 빌드 & ECR 푸시

#### 2.1 ECR 로그인
```bash
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin \
  907123164281.dkr.ecr.ap-northeast-2.amazonaws.com
```

#### 2.2 Main API 이미지 빌드 & 푸시
```bash
cd /Users/hodduk/Documents/git/AWS_FANS/backend/api

# 이미지 빌드
docker build -t fans-main-api .

# 태그 지정
docker tag fans-main-api:latest \
  907123164281.dkr.ecr.ap-northeast-2.amazonaws.com/dw-fans/main-api:latest

# ECR에 푸시
docker push 907123164281.dkr.ecr.ap-northeast-2.amazonaws.com/dw-fans/main-api:latest
```

#### 2.3 AI Service 이미지 빌드 & 푸시
```bash
cd /Users/hodduk/Documents/git/AWS_FANS/ai/summarize

docker build -t fans-summarize-ai .
docker tag fans-summarize-ai:latest \
  907123164281.dkr.ecr.ap-northeast-2.amazonaws.com/dw-fans/summarize-ai:latest
docker push 907123164281.dkr.ecr.ap-northeast-2.amazonaws.com/dw-fans/summarize-ai:latest
```

#### 2.4 Bias Analysis AI 이미지 빌드 & 푸시
```bash
cd /Users/hodduk/Documents/git/AWS_FANS/ai/bias_analysis

docker build -t fans-bias-ai .
docker tag fans-bias-ai:latest \
  907123164281.dkr.ecr.ap-northeast-2.amazonaws.com/dw-fans/bias-analysis-ai:latest
docker push 907123164281.dkr.ecr.ap-northeast-2.amazonaws.com/dw-fans/bias-analysis-ai:latest
```

#### 2.5 API Crawler 이미지 빌드 & 푸시
```bash
cd /Users/hodduk/Documents/git/AWS_FANS/backend/crawler/api_crawler

docker build -t fans-api-crawler .
docker tag fans-api-crawler:latest \
  907123164281.dkr.ecr.ap-northeast-2.amazonaws.com/dw-fans/api-crawler:latest
docker push 907123164281.dkr.ecr.ap-northeast-2.amazonaws.com/dw-fans/api-crawler:latest
```

#### 2.6 Puppeteer Crawler 이미지 빌드 & 푸시
```bash
cd /Users/hodduk/Documents/git/AWS_FANS/backend/crawler/puppeteer_crawler

docker build -t fans-puppeteer-crawler .
docker tag fans-puppeteer-crawler:latest \
  907123164281.dkr.ecr.ap-northeast-2.amazonaws.com/dw-fans/puppeteer-crawler:latest
docker push 907123164281.dkr.ecr.ap-northeast-2.amazonaws.com/dw-fans/puppeteer-crawler:latest
```

---

### Step 3: Kubernetes 리소스 배포

#### 3.1 EKS 클러스터 연결
```bash
# kubeconfig 업데이트
aws eks update-kubeconfig --region ap-northeast-2 --name dw-FANS-EKS-Cluster

# 연결 확인
kubectl get nodes

# 결과 예시:
# NAME                                               STATUS   ROLES    AGE   VERSION
# ip-10-0-30-xxx.ap-northeast-2.compute.internal    Ready    <none>   5m    v1.27.x
# ip-10-0-30-yyy.ap-northeast-2.compute.internal    Ready    <none>   5m    v1.27.x
```

#### 3.2 AWS Load Balancer Controller 설치

**중요**: 이미 설치되어 있을 수 있으므로 먼저 확인하세요.

```bash
# 설치 확인
kubectl get deployment -n kube-system aws-load-balancer-controller

# 설치되지 않았다면:
helm repo add eks https://aws.github.io/eks-charts
helm repo update

helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=dw-FANS-EKS-Cluster \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```

#### 3.3 Namespace 생성
```bash
cd /Users/hodduk/Documents/git/AWS_FANS/infra/kubernetes

# Namespace 생성
kubectl apply -f namespace.yaml

# 확인
kubectl get namespace fans
```

#### 3.4 Secrets 생성
```bash
# Secrets 파일 확인 및 수정
# secrets.yaml에서 다음 값들을 base64 인코딩하여 입력:
# - database-url
# - redis-url
# - email-user
# - email-password

# Base64 인코딩 방법:
echo -n "postgresql://fans_admin:CHANGE_ME_PLEASE_12345!@dw-fans-postgres.cz884ewuuhlv.ap-northeast-2.rds.amazonaws.com:5432/fans_db" | base64

# Secrets 적용
kubectl apply -f secrets.yaml

# 확인
kubectl get secrets -n fans
```

#### 3.5 애플리케이션 배포
```bash
# 모든 애플리케이션 배포
kubectl apply -f apps/

# 배포 확인
kubectl get pods -n fans

# 모든 Pod가 Running 상태가 될 때까지 대기 (약 2-3분)
kubectl get pods -n fans -w
```

#### 3.6 Service 확인
```bash
# Service 생성 확인
kubectl get svc -n fans

# 결과 예시:
# NAME                  TYPE       CLUSTER-IP       EXTERNAL-IP   PORT(S)          AGE
# main-api              NodePort   10.100.x.x       <none>        3000:31800/TCP   2m
# summarize-ai          NodePort   10.100.x.x       <none>        8000:30187/TCP   2m
# bias-analysis-ai      NodePort   10.100.x.x       <none>        8002:32565/TCP   2m
```

#### 3.7 TargetGroupBinding 적용
```bash
# ALB와 Kubernetes Service 연결
kubectl apply -f ingress.yaml

# TargetGroupBinding 확인
kubectl get targetgroupbindings -n fans

# 결과 예시:
# NAME                      SERVICE-NAME          SERVICE-PORT   TARGET-TYPE   AGE
# main-api-tgb             main-api              3000           instance      1m
# summarize-ai-tgb         summarize-ai          8000           instance      1m
# bias-analysis-ai-tgb     bias-analysis-ai      8002           instance      1m
```

#### 3.8 Target Group Health 확인
```bash
# Main API Target Group
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:ap-northeast-2:907123164281:targetgroup/dw-FANS-Main-API-TG/[TG-ID] \
  --query 'TargetHealthDescriptions[*].[Target.Id,TargetHealth.State]' \
  --output table

# 모든 Target이 'healthy' 상태여야 함
```

---

### Step 4: 프론트엔드 배포

#### 4.1 환경 변수 파일 생성 (.env)
```bash
cd /Users/hodduk/Documents/git/AWS_FANS/frontend

# .env 파일 생성 (중요: 값은 비워둠)
cat > .env << 'EOF'
REACT_APP_API_URL=
REACT_APP_API_BASE=
REACT_APP_AI_SERVICE_URL=
EOF

# 확인
cat .env
```

**중요**: `.env` 파일의 값들은 **반드시 비워두어야** 합니다!
- CloudFront를 통해 상대 경로로 API를 호출하기 때문
- 절대 경로를 입력하면 Mixed Content 오류 발생

#### 4.2 의존성 설치
```bash
# package.json이 있는지 확인
ls package.json

# 의존성 설치
npm install

# 설치 확인
ls node_modules/
```

#### 4.3 프론트엔드 빌드
```bash
# 캐시 삭제 (선택사항, 문제 발생 시)
rm -rf build node_modules/.cache

# 프로덕션 빌드
npm run build

# 빌드 결과 확인
ls build/
ls build/static/js/

# main.[hash].js 파일이 생성되었는지 확인
```

#### 4.4 S3에 업로드
```bash
# S3 버킷 이름 확인 (Terraform output에서)
# dw-fans-frontend-production

# S3에 업로드 (기존 파일 삭제하면서 동기화)
aws s3 sync build/ s3://dw-fans-frontend-production --delete

# 업로드 확인
aws s3 ls s3://dw-fans-frontend-production/

# 결과 예시:
#                            PRE static/
# 2025-10-14 15:23:41        459 index.html
# 2025-10-14 15:23:41       1234 asset-manifest.json
```

#### 4.5 CloudFront 캐시 무효화
```bash
# CloudFront Distribution ID 확인
# Terraform output 또는 AWS 콘솔에서 확인

# 캐시 무효화
aws cloudfront create-invalidation \
  --distribution-id [DISTRIBUTION-ID] \
  --paths "/*"

# 결과 예시:
# {
#     "Invalidation": {
#         "Id": "I7JTWX...",
#         "Status": "InProgress",
#         "CreateTime": "2025-10-14T06:23:41.458Z"
#     }
# }

# 무효화 완료 대기 (약 1-2분)
aws cloudfront get-invalidation \
  --distribution-id [DISTRIBUTION-ID] \
  --id [INVALIDATION-ID] \
  --query 'Invalidation.Status' \
  --output text

# 결과가 'Completed'가 될 때까지 대기
```

---

### Step 5: 배포 확인

#### 5.1 ALB Health Check 확인
```bash
# 각 Target Group의 Health 확인
# Main API
aws elbv2 describe-target-health \
  --target-group-arn [MAIN-API-TG-ARN] \
  --query 'TargetHealthDescriptions[*].[Target.Id,TargetHealth.State,TargetHealth.Reason]' \
  --output table

# 모든 Target이 'healthy' 상태여야 함
```

#### 5.2 ALB 엔드포인트 테스트
```bash
# ALB DNS 이름 확인
ALB_DNS=$(terraform output -raw alb_dns_name)

# HTTP 엔드포인트 테스트
curl -s "http://${ALB_DNS}/api/health" | jq

# 결과 예시:
# {
#   "status": "OK",
#   "timestamp": "2025-10-14T06:30:00.000Z"
# }

# HTTPS 엔드포인트 테스트 (인증서 검증 무시)
curl -s -k "https://${ALB_DNS}/api/health" | jq
```

#### 5.3 CloudFront 엔드포인트 테스트
```bash
# CloudFront 도메인 확인
CF_DOMAIN=$(terraform output -raw cloudfront_domain_name)

# 프론트엔드 페이지 테스트
curl -s "https://${CF_DOMAIN}" | grep -o "<title>.*</title>"

# 결과 예시:
# <title>FANS - Financial & Analytics News Service</title>

# API 프록시 테스트
curl -s "https://${CF_DOMAIN}/api/health" | jq

# 결과 예시:
# {
#   "status": "OK",
#   "timestamp": "2025-10-14T06:30:00.000Z"
# }
```

#### 5.4 브라우저 테스트
```bash
# CloudFront URL 출력
echo "https://${CF_DOMAIN}"

# 또는
terraform output cloudfront_domain_name
```

**브라우저에서 테스트**:
1. 새 시크릿/프라이빗 창 열기
2. CloudFront URL 접속
3. 개발자 도구 (F12) → Network 탭 확인
4. 뉴스 피드가 로드되는지 확인
5. Mixed Content 오류가 없는지 확인

#### 5.5 Kubernetes Pod 로그 확인
```bash
# Main API 로그
kubectl logs -n fans deployment/main-api --tail=50

# AI Service 로그
kubectl logs -n fans deployment/summarize-ai --tail=50

# Crawler 로그
kubectl logs -n fans deployment/api-crawler --tail=50

# 오류 메시지가 없는지 확인
```

---

## 부분 배포 (변경사항만)

### 프론트엔드만 재배포

#### 코드 변경 후
```bash
cd /Users/hodduk/Documents/git/AWS_FANS/frontend

# .env 파일 확인 (값이 비어있는지)
cat .env

# 캐시 삭제 & 빌드
rm -rf build node_modules/.cache
npm run build

# S3 업로드
aws s3 sync build/ s3://dw-fans-frontend-production --delete

# CloudFront 캐시 무효화
aws cloudfront create-invalidation \
  --distribution-id [DISTRIBUTION-ID] \
  --paths "/*"

# 완료 대기 (1-2분)
```

### 백엔드 API만 재배포

#### 코드 변경 후
```bash
cd /Users/hodduk/Documents/git/AWS_FANS/backend/api

# ECR 로그인
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin \
  907123164281.dkr.ecr.ap-northeast-2.amazonaws.com

# 이미지 빌드 & 푸시
docker build -t fans-main-api .
docker tag fans-main-api:latest \
  907123164281.dkr.ecr.ap-northeast-2.amazonaws.com/dw-fans/main-api:latest
docker push 907123164281.dkr.ecr.ap-northeast-2.amazonaws.com/dw-fans/main-api:latest

# Kubernetes Pod 재시작
kubectl rollout restart deployment/main-api -n fans

# 재시작 확인
kubectl rollout status deployment/main-api -n fans

# 새 Pod가 Running 상태인지 확인
kubectl get pods -n fans | grep main-api
```

### Terraform 인프라만 변경

#### 설정 변경 후
```bash
cd /Users/hodduk/Documents/git/AWS_FANS/infra/terraform

# 변경사항 미리보기
terraform plan

# 특정 리소스만 적용 (예: ALB)
terraform apply -target=aws_lb.main -target=aws_lb_listener.http

# 또는 전체 적용
terraform apply
```

### Kubernetes 설정만 변경

#### YAML 파일 변경 후
```bash
cd /Users/hodduk/Documents/git/AWS_FANS/infra/kubernetes

# 특정 리소스만 적용
kubectl apply -f apps/main-api.yaml

# 또는 전체 재적용
kubectl apply -f apps/

# 변경사항 확인
kubectl describe deployment main-api -n fans
```

---

## 트러블슈팅

### 1. Target Group이 Unhealthy 상태

**증상**:
```bash
aws elbv2 describe-target-health --target-group-arn [ARN]
# State: unhealthy
# Reason: Target.Timeout
```

**원인**: Security Group 설정 문제

**해결**:
```bash
# ALB Security Group ID 확인
ALB_SG=$(terraform output -raw alb_security_group_id)

# EKS Node Security Group ID 확인
kubectl get nodes -o jsonpath='{.items[0].spec.providerID}' | cut -d'/' -f5 | \
  xargs aws ec2 describe-instances --instance-ids --query 'Reservations[0].Instances[0].SecurityGroups[0].GroupId' --output text

# NodePort 확인
kubectl get svc -n fans

# ALB → EKS Node 규칙 추가 (NodePort 포트)
aws ec2 authorize-security-group-egress \
  --group-id $ALB_SG \
  --protocol tcp \
  --port 31800 \
  --source-group [EKS-NODE-SG]
```

### 2. Mixed Content 오류

**증상**: 브라우저 콘솔에 `blocked:mixed-content` 오류

**원인**: `.env` 파일에 HTTP URL이 있음

**해결**:
```bash
cd frontend

# .env 파일 확인
cat .env

# 값이 비어있지 않다면 수정
cat > .env << 'EOF'
REACT_APP_API_URL=
REACT_APP_API_BASE=
REACT_APP_AI_SERVICE_URL=
EOF

# 재빌드
rm -rf build node_modules/.cache
npm run build
aws s3 sync build/ s3://dw-fans-frontend-production --delete
aws cloudfront create-invalidation --distribution-id [ID] --paths "/*"
```

### 3. CloudFront 502 Bad Gateway

**증상**: CloudFront에서 502 오류 반환

**가능한 원인**:
1. ALB Origin Protocol이 잘못 설정됨
2. ALB가 unhealthy 상태
3. ALB Listener 설정 문제

**해결**:
```bash
# 1. CloudFront Origin Protocol 확인
cd infra/terraform
grep "origin_protocol_policy" frontend.tf

# 결과가 "http-only"여야 함
# 만약 "https-only"라면 수정:
# origin_protocol_policy = "http-only"

# 2. ALB Health 확인
aws elbv2 describe-target-health --target-group-arn [ARN]

# 3. ALB HTTP Listener 확인 (redirect가 아닌 forward여야 함)
grep -A 5 "aws_lb_listener.*http" alb.tf

# default_action이 "forward"여야 함
```

### 4. Pod가 ImagePullBackOff 상태

**증상**:
```bash
kubectl get pods -n fans
# STATUS: ImagePullBackOff
```

**원인**: ECR에 이미지가 없거나 권한 문제

**해결**:
```bash
# 1. ECR 이미지 확인
aws ecr describe-images \
  --repository-name dw-fans/main-api \
  --query 'imageDetails[*].[imageTags,imagePushedAt]' \
  --output table

# 2. 이미지가 없다면 다시 푸시
cd backend/api
docker build -t fans-main-api .
docker tag fans-main-api:latest \
  907123164281.dkr.ecr.ap-northeast-2.amazonaws.com/dw-fans/main-api:latest
docker push 907123164281.dkr.ecr.ap-northeast-2.amazonaws.com/dw-fans/main-api:latest

# 3. Pod 재시작
kubectl rollout restart deployment/main-api -n fans
```

### 5. Database Connection 실패

**증상**: Pod 로그에 DB 연결 오류
```bash
kubectl logs -n fans deployment/main-api
# Error: connect ETIMEDOUT
```

**원인**: RDS Security Group 또는 연결 정보 문제

**해결**:
```bash
# 1. RDS 엔드포인트 확인
terraform output rds_endpoint

# 2. Security Group 확인
RDS_SG=$(terraform output -raw rds_security_group_id)
EKS_SG=[EKS-NODE-SG]

# 3. RDS Security Group에 EKS Node 접근 허용
aws ec2 authorize-security-group-ingress \
  --group-id $RDS_SG \
  --protocol tcp \
  --port 5432 \
  --source-group $EKS_SG

# 4. Secret 확인
kubectl get secret fans-secrets -n fans -o jsonpath='{.data.database-url}' | base64 -d

# 5. Secret 수정이 필요하다면
kubectl edit secret fans-secrets -n fans
```

### 6. CORS 오류

**증상**: 브라우저 콘솔에 CORS 관련 오류

**원인**: 백엔드 CORS 설정 문제

**해결**:
```bash
# main-api.yaml 확인
cd infra/kubernetes/apps
grep -A 2 "CORS_ALLOWED_ORIGINS" main-api.yaml

# CloudFront URL이 포함되어 있는지 확인
# 수정 후:
kubectl apply -f main-api.yaml
kubectl rollout restart deployment/main-api -n fans
```

---

## 롤백 절차

### 프론트엔드 롤백

#### S3 버전 관리를 이용한 롤백
```bash
# S3 버전 관리가 활성화되어 있음
aws s3api list-object-versions \
  --bucket dw-fans-frontend-production \
  --prefix static/js/main \
  --query 'Versions[*].[Key,VersionId,LastModified]' \
  --output table

# 이전 버전으로 복원 (예시)
aws s3api get-object \
  --bucket dw-fans-frontend-production \
  --key static/js/main.[old-hash].js \
  --version-id [VERSION-ID] \
  main.js

# CloudFront 캐시 무효화
aws cloudfront create-invalidation \
  --distribution-id [DISTRIBUTION-ID] \
  --paths "/*"
```

#### Git을 이용한 롤백
```bash
cd frontend

# 이전 커밋 확인
git log --oneline

# 특정 커밋으로 체크아웃
git checkout [COMMIT-HASH]

# 재빌드 & 배포
npm run build
aws s3 sync build/ s3://dw-fans-frontend-production --delete
aws cloudfront create-invalidation --distribution-id [ID] --paths "/*"

# 다시 최신으로 돌아오기
git checkout main
```

### 백엔드 롤백

#### Docker 이미지 태그를 이용한 롤백
```bash
# ECR에서 이전 이미지 확인
aws ecr describe-images \
  --repository-name dw-fans/main-api \
  --query 'imageDetails[*].[imageTags,imagePushedAt,imageDigest]' \
  --output table

# Kubernetes Deployment 이미지 변경
kubectl set image deployment/main-api \
  main-api=907123164281.dkr.ecr.ap-northeast-2.amazonaws.com/dw-fans/main-api@sha256:[DIGEST] \
  -n fans

# 또는 YAML 직접 수정
kubectl edit deployment main-api -n fans
```

### Terraform 롤백

#### Terraform State를 이용한 롤백
```bash
cd infra/terraform

# 이전 상태 목록 확인 (S3 백엔드 사용 시)
terraform state list

# 특정 시점으로 롤백 (주의: 위험!)
terraform state pull > backup.tfstate
aws s3 cp s3://[BUCKET]/terraform.tfstate.backup terraform.tfstate
terraform state push terraform.tfstate

# 또는 코드 변경사항을 Git으로 되돌린 후
git checkout [PREVIOUS-COMMIT] -- *.tf
terraform plan
terraform apply
```

---

## 모니터링 & 로그

### CloudWatch Logs 확인
```bash
# EKS 클러스터 로그 (Control Plane)
aws logs tail /aws/eks/dw-FANS-EKS-Cluster/cluster --follow

# ALB 액세스 로그 (S3 버킷에 저장되어 있다면)
aws s3 ls s3://[ALB-LOGS-BUCKET]/ --recursive
```

### Kubernetes 이벤트 확인
```bash
# Namespace 이벤트
kubectl get events -n fans --sort-by='.lastTimestamp'

# 특정 Pod 이벤트
kubectl describe pod [POD-NAME] -n fans | grep Events -A 20
```

### 리소스 사용량 확인
```bash
# Node 리소스 사용량
kubectl top nodes

# Pod 리소스 사용량
kubectl top pods -n fans

# Metrics Server가 설치되어 있어야 함
```

---

## 보안 체크리스트

배포 전 반드시 확인:

- [ ] `.env` 파일이 Git에 커밋되지 않았는지 확인
- [ ] Kubernetes Secret이 base64 인코딩되어 있는지 확인
- [ ] RDS 비밀번호가 강력한지 확인
- [ ] Security Group 규칙이 최소 권한 원칙을 따르는지 확인
- [ ] S3 버킷이 public 접근이 차단되어 있는지 확인
- [ ] CloudFront가 HTTPS만 허용하는지 확인
- [ ] ALB Security Group에 불필요한 포트가 열려있지 않은지 확인
- [ ] EKS Node에 SSH 접근이 제한되어 있는지 확인

---

## 참고 문서

- [AWS EKS 공식 문서](https://docs.aws.amazon.com/eks/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS Load Balancer Controller](https://kubernetes-sigs.github.io/aws-load-balancer-controller/)
- [CloudFront 개발자 가이드](https://docs.aws.amazon.com/cloudfront/)

---

## 문의

배포 관련 문제가 발생하면:
1. 위의 트러블슈팅 섹션 참고
2. CloudWatch Logs 및 Kubernetes 로그 확인
3. GitHub Issues에 문제 등록

---

**마지막 업데이트**: 2025-10-14
**작성자**: DW (DongWon)
**프로젝트**: FANS (Financial & Analytics News Service)
