# FANS AI Worker

SQS를 사용한 AI 작업 처리 워커 서비스

## 개요

### 기존 문제
- **크롤러에서 AI 직접 호출** → 크롤링 160개 기사 시 320개 AI 요청 동시 발생
- **AI 서버 OOMKilled** → summarize-ai, bias-analysis-ai 파드 메모리 부족으로 죽음
- **크롤링 속도 느림** → AI 응답 대기로 크롤러 블로킹

### SQS 해결 방식
```
크롤러 (160개 기사 크롤링)
  ↓ 0.1초 (SQS에 메시지만 전송, AI 안 기다림)
SQS 큐 (320개 작업 대기)
  ↓ 순차 처리
AI Worker (초당 5개씩 처리)
  ↓ 64초 소요
AI 서비스 (안정적으로 처리)
```

**장점:**
- 크롤러 빨라짐 (AI 안 기다림)
- AI 서버 안정 (동시 요청 제한)
- 자동 재시도 (실패 시 자동으로 다시 큐에)
- 모니터링 (CloudWatch에서 큐 길이 확인)
- 비용 무료 (프리티어 월 100만 요청)

---

## 배포 순서

### 1. Terraform으로 SQS 생성

```bash
cd infra/terraform

# SQS 큐 생성
terraform apply -target=aws_sqs_queue.fans_ai_summarize
terraform apply -target=aws_sqs_queue.fans_ai_bias

# 큐 URL 확인 (배포 시 필요)
terraform output sqs_summarize_queue_url
terraform output sqs_bias_queue_url
```

출력 예시:
```
sqs_summarize_queue_url = "https://sqs.ap-northeast-2.amazonaws.com/907123164281/fans-ai-summarize-queue"
sqs_bias_queue_url = "https://sqs.ap-northeast-2.amazonaws.com/907123164281/fans-ai-bias-queue"
```

### 2. AI Worker 빌드 및 ECR 푸시

```bash
cd backend/ai-worker

# Docker 이미지 빌드 (amd64 플랫폼)
docker build --platform=linux/amd64 -t fans/ai-worker:latest .

# ECR 로그인
aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin 907123164281.dkr.ecr.ap-northeast-2.amazonaws.com

# ECR에 푸시
docker tag fans/ai-worker:latest 907123164281.dkr.ecr.ap-northeast-2.amazonaws.com/fans/ai-worker:latest
docker push 907123164281.dkr.ecr.ap-northeast-2.amazonaws.com/fans/ai-worker:latest
```

### 3. Kubernetes에 AI Worker 배포

```bash
# AI Worker 배포
kubectl apply -f infra/kubernetes/apps/ai-worker.yaml

# 배포 확인
kubectl get pods -n fans -l app=ai-worker

# 로그 확인
kubectl logs -n fans -l app=ai-worker -f
```

정상 출력 예시:
```
[INFO] 2025-10-29T... ===================================
[INFO] 2025-10-29T... 🤖 FANS AI Worker 시작
[INFO] 2025-10-29T... ===================================
[INFO] 2025-10-29T... ✅ 데이터베이스 연결 완료
[INFO] 2025-10-29T... 🚀 AI Worker 시작
[INFO] 2025-10-29T...    동시 처리 제한: 5개
[INFO] 2025-10-29T... [summarize] 작업 시작: 기사 1234
[INFO] 2025-10-29T... ✅ 요약 완료: 기사 1234
```

### 4. 크롤러 설정 업데이트

#### 4-1. package.json에 AWS SDK 추가

```bash
cd backend/crawler

# AWS SDK 설치
npm install @aws-sdk/client-sqs
```

#### 4-2. 크롤러 재배포 (SQS 사용 활성화)

```bash
cd backend/crawler

# Docker 이미지 빌드
docker build --platform=linux/amd64 -t fans/unified-crawler:latest .

# ECR에 푸시
docker tag fans/unified-crawler:latest 907123164281.dkr.ecr.ap-northeast-2.amazonaws.com/fans/unified-crawler:latest
docker push 907123164281.dkr.ecr.ap-northeast-2.amazonaws.com/fans/unified-crawler:latest

# Kubernetes 배포 업데이트
kubectl rollout restart deployment/unified-crawler -n fans

# 배포 확인
kubectl rollout status deployment/unified-crawler -n fans
```

#### 4-3. 크롤러 로그에서 SQS 전송 확인

```bash
kubectl logs -n fans -l app=unified-crawler -f | grep SQS
```

출력 예시:
```
[INFO] [SQS 전송 완료] 요약 작업 1234
[INFO] [SQS 전송 완료] 편향 분석 작업 1234
```

---

## 환경 변수 설명

### Crawler 환경 변수
```yaml
USE_SQS: "true"  # SQS 사용 여부 (false면 기존 방식 사용)
SQS_SUMMARIZE_QUEUE_URL: "https://sqs.ap-northeast-2.amazonaws.com/.../fans-ai-summarize-queue"
SQS_BIAS_QUEUE_URL: "https://sqs.ap-northeast-2.amazonaws.com/.../fans-ai-bias-queue"
AWS_REGION: "ap-northeast-2"
```

### AI Worker 환경 변수
```yaml
# SQS 큐 URL
SQS_SUMMARIZE_QUEUE_URL: "https://..."
SQS_BIAS_QUEUE_URL: "https://..."

# AI 서비스 URL
SUMMARIZE_AI_URL: "http://summarize-ai:8000"
BIAS_AI_URL: "http://bias-analysis-ai:8002"

# 동시 처리 제한 (AI 서버 부하 조절)
MAX_CONCURRENT_JOBS: "5"  # 기본값 5개
```

---

## 모니터링

### 1. SQS 큐 상태 확인 (AWS Console)

```bash
# AWS Console → SQS → fans-ai-summarize-queue
# - Messages Available: 대기 중인 작업
# - Messages in Flight: 처리 중인 작업
```

### 2. Worker 로그 확인

```bash
# 전체 로그
kubectl logs -n fans -l app=ai-worker -f

# 요약 작업만
kubectl logs -n fans -l app=ai-worker -f | grep summarize

# 편향 분석 작업만
kubectl logs -n fans -l app=ai-worker -f | grep bias
```

### 3. Worker Pod 개수 확인 (Auto Scaling)

```bash
# HPA 상태 확인
kubectl get hpa -n fans ai-worker-hpa

# Pod 개수 확인
kubectl get pods -n fans -l app=ai-worker
```

---

## 트러블슈팅

### 1. SQS 메시지가 쌓이기만 하고 처리 안 됨

**원인:** Worker Pod가 실행 안 됨 또는 죽음

```bash
# Worker Pod 상태 확인
kubectl get pods -n fans -l app=ai-worker

# Pod 로그 확인
kubectl logs -n fans -l app=ai-worker

# Pod 재시작
kubectl rollout restart deployment/ai-worker -n fans
```

### 2. 크롤러에서 "SQS 전송 실패" 에러

**원인:** IAM 권한 문제 또는 큐 URL 잘못됨

```bash
# 큐 URL 확인
terraform output sqs_summarize_queue_url

# IAM 정책 확인
aws iam get-policy --policy-arn arn:aws:iam::907123164281:policy/fans-sqs-access-policy

# 크롤러 로그에서 에러 확인
kubectl logs -n fans -l app=unified-crawler | grep "SQS 전송 실패"
```

### 3. AI 서비스 여전히 OOMKilled

**원인:** Worker 동시 처리 제한이 너무 높음

```bash
# MAX_CONCURRENT_JOBS 줄이기 (5 → 3)
kubectl set env deployment/ai-worker -n fans MAX_CONCURRENT_JOBS=3

# 또는 Worker Pod 개수 늘리기 (2 → 4)
kubectl scale deployment/ai-worker -n fans --replicas=4
```

### 4. Dead Letter Queue(DLQ)에 메시지 쌓임

**원인:** AI 서비스가 3번 연속 실패한 작업들

```bash
# DLQ 확인 (AWS Console)
# SQS → fans-ai-summarize-dlq → Messages Available

# 또는 CLI로 확인
aws sqs get-queue-attributes \
  --queue-url https://sqs.ap-northeast-2.amazonaws.com/.../fans-ai-summarize-dlq \
  --attribute-names ApproximateNumberOfMessages
```

**조치:**
1. AI 서비스 로그 확인해서 실패 원인 파악
2. 문제 해결 후 DLQ 메시지를 원래 큐로 다시 보내기 (AWS Console에서 수동)

---

## 롤백 방법

SQS 사용을 중단하고 기존 방식(직접 호출)으로 돌아가려면:

```bash
# 1. 크롤러 환경 변수 변경
kubectl set env deployment/unified-crawler -n fans USE_SQS=false

# 2. AI Worker 정지 (삭제는 안 해도 됨)
kubectl scale deployment/ai-worker -n fans --replicas=0

# 3. 확인
kubectl logs -n fans -l app=unified-crawler | grep "AI 요약"
# "AI 요약 완료" 로그가 나오면 직접 호출 방식으로 작동 중
```

---

## 비용

### SQS
- **프리티어**: 월 100만 요청 무료
- **이후**: 요청당 $0.40/백만개
- **예상 비용**: 월 $0 (프리티어 내)

### EKS Worker Pod
- **ai-worker**: 2개 Pod × 256MB = 512MB
- **비용**: 기존 EKS 노드에서 실행 (추가 비용 없음)

**총 추가 비용: 월 $0**

---

## 성능 비교

| 항목 | 기존 (직접 호출) | SQS 방식 |
|------|------------------|----------|
| 크롤링 속도 | 느림 (AI 대기) | **빠름** (즉시 반환) |
| AI 동시 요청 | 160-320개 | **5개 제한** |
| OOM 발생 | 자주 발생 | **발생 안 함** |
| 재시도 | 수동 | **자동 (3회)** |
| 모니터링 | 없음 | **CloudWatch** |
| 비용 | $0 | **$0** |

---

## 문의

문제 발생 시 로그와 함께 공유해주세요:

```bash
# 크롤러 로그
kubectl logs -n fans -l app=unified-crawler --tail=100 > crawler.log

# AI Worker 로그
kubectl logs -n fans -l app=ai-worker --tail=100 > worker.log

# SQS 상태
aws sqs get-queue-attributes \
  --queue-url https://sqs.ap-northeast-2.amazonaws.com/.../fans-ai-summarize-queue \
  --attribute-names All > sqs-status.json
```
