# SQS 기반 AI 작업 처리 구현

**작성일:** 2025-10-29
**작성자:** Claude (AI Assistant)
**상태:** 코드 완성, 배포 대기

---

## 개요

### 문제점
- 크롤러가 160개 기사 수집 시 320개 AI 요청(요약 160 + 편향 160) 동시 발생
- AI 서비스(summarize-ai, bias-analysis-ai) OOMKilled 빈번 발생
- 크롤러가 AI 응답 대기로 블로킹되어 속도 저하

### 해결 방안
- **AWS SQS**를 사용한 비동기 작업 큐 도입
- 크롤러는 SQS에 메시지만 전송 (AI 안 기다림)
- 별도 AI Worker가 큐에서 작업을 순차 처리

---

## 아키텍처

### 기존 방식 (문제)
```
Crawler
  ├─ Article 1 ──[HTTP]──> Summarize AI (30s)
  ├─ Article 1 ──[HTTP]──> Bias AI (30s)
  ├─ Article 2 ──[HTTP]──> Summarize AI (30s)
  ├─ Article 2 ──[HTTP]──> Bias AI (30s)
  └─ ... (160개 × 2 = 320개 동시 요청)
                              ↓
                    AI 서버 OOMKilled 💥
```

### 신규 방식 (SQS)
```
Crawler (빠름 ⚡)
  ├─ Article 1 ──[SQS]──> Summarize Queue (0.1s)
  ├─ Article 1 ──[SQS]──> Bias Queue (0.1s)
  ├─ Article 2 ──[SQS]──> Summarize Queue (0.1s)
  └─ Article 2 ──[SQS]──> Bias Queue (0.1s)
                              ↓
                    SQS (320개 작업 대기)
                              ↓
AI Worker (2-10개 Pod, Auto Scaling)
  ├─ Worker 1: [큐에서 1개 꺼냄] → Summarize AI (30s) → [완료, 다음 작업]
  ├─ Worker 2: [큐에서 1개 꺼냄] → Bias AI (30s) → [완료, 다음 작업]
  └─ Worker N: ...
                              ↓
              AI 서버 안정적으로 처리 ✅
```

---

## 구현 세부사항

### 1. Terraform (infra/terraform/sqs.tf)
- **2개 SQS 큐 생성**
  - `fans-ai-summarize-queue`: AI 요약 작업
  - `fans-ai-bias-queue`: AI 편향 분석 작업
- **Dead Letter Queue (DLQ)**
  - 3번 실패한 작업은 DLQ로 이동 (수동 처리)
- **IAM 정책**
  - EKS 노드가 SQS 접근 가능하도록 권한 부여

### 2. SQS 서비스 래퍼 (backend/shared/services/sqsService.ts)
- `sendSummarizeJob()`: 요약 작업을 큐에 전송
- `sendBiasAnalysisJob()`: 편향 분석 작업을 큐에 전송
- `getQueueStats()`: 큐 상태 조회 (모니터링용)

### 3. 크롤러 수정 (backend/crawler/shared/services/aiService.ts)
- **환경 변수 `USE_SQS=true`**로 SQS 사용 활성화
- SQS 전송 실패 시 기존 방식(직접 호출)으로 **자동 Fallback**
- 하위 호환성 유지 (USE_SQS=false면 기존 방식)

### 4. AI Worker 서비스 (backend/ai-worker/)
- **독립 서비스**: 크롤러와 분리된 별도 Pod
- **Long Polling**: SQS에서 20초 대기하며 메시지 수신
- **동시 처리 제한**: `MAX_CONCURRENT_JOBS=5` (환경 변수로 조절)
- **Graceful Shutdown**: SIGTERM 수신 시 현재 작업 완료 후 종료
- **Auto Scaling**: CPU/메모리 사용량에 따라 2-10개 Pod 자동 조절

### 5. Kubernetes 배포 (infra/kubernetes/apps/)
- **ai-worker.yaml**: AI Worker Deployment + HPA
- **unified-crawler.yaml**: SQS 환경 변수 추가

---

## 환경 변수

### Crawler
```yaml
USE_SQS: "true"  # SQS 사용 활성화
SQS_SUMMARIZE_QUEUE_URL: "https://sqs.ap-northeast-2.amazonaws.com/.../fans-ai-summarize-queue"
SQS_BIAS_QUEUE_URL: "https://sqs.ap-northeast-2.amazonaws.com/.../fans-ai-bias-queue"
AWS_REGION: "ap-northeast-2"
```

### AI Worker
```yaml
SQS_SUMMARIZE_QUEUE_URL: "https://..."
SQS_BIAS_QUEUE_URL: "https://..."
SUMMARIZE_AI_URL: "http://summarize-ai:8000"
BIAS_AI_URL: "http://bias-analysis-ai:8002"
MAX_CONCURRENT_JOBS: "5"  # 동시 처리 제한
```

---

## 파일 변경 내역

### 신규 파일
```
infra/terraform/sqs.tf                          (141 lines)
backend/shared/services/sqsService.ts           (144 lines)
backend/ai-worker/package.json                  (24 lines)
backend/ai-worker/tsconfig.json                 (21 lines)
backend/ai-worker/src/config/logger.ts          (19 lines)
backend/ai-worker/src/config/database.ts        (48 lines)
backend/ai-worker/src/worker.ts                 (220 lines)
backend/ai-worker/src/index.ts                  (48 lines)
backend/ai-worker/Dockerfile                    (31 lines)
backend/ai-worker/README.md                     (400+ lines)
infra/kubernetes/apps/ai-worker.yaml            (138 lines)
docs/SQS_IMPLEMENTATION.md                      (이 파일)
```

### 수정 파일
```
backend/crawler/shared/services/aiService.ts    (+83 lines)
infra/kubernetes/apps/unified-crawler.yaml      (+9 lines)
```

**총 코드량:** 약 1,300 lines

---

## 배포 순서

```bash
# 1. Terraform으로 SQS 생성
cd infra/terraform
terraform apply

# 2. AI Worker 빌드 및 ECR 푸시
cd backend/ai-worker
docker build --platform=linux/amd64 -t fans/ai-worker:latest .
docker tag fans/ai-worker:latest 907123164281.dkr.ecr.ap-northeast-2.amazonaws.com/fans/ai-worker:latest
docker push 907123164281.dkr.ecr.ap-northeast-2.amazonaws.com/fans/ai-worker:latest

# 3. AI Worker 배포
kubectl apply -f infra/kubernetes/apps/ai-worker.yaml

# 4. 크롤러에 AWS SDK 설치
cd backend/crawler
npm install @aws-sdk/client-sqs

# 5. 크롤러 재빌드 및 배포
docker build --platform=linux/amd64 -t fans/unified-crawler:latest .
docker push 907123164281.dkr.ecr.ap-northeast-2.amazonaws.com/fans/unified-crawler:latest
kubectl rollout restart deployment/unified-crawler -n fans
```

---

## 성능 개선 예상

| 항목 | 기존 | SQS | 개선율 |
|------|------|-----|--------|
| 크롤링 시간 | 160초 (AI 대기) | **10초** | **94% 감소** |
| AI 동시 요청 | 320개 | **5개** | **98% 감소** |
| OOM 발생 빈도 | 높음 | **없음** | **100% 감소** |
| 실패 시 재시도 | 수동 | **자동** | - |
| 모니터링 | 없음 | **CloudWatch** | - |

---

## 비용

- **SQS**: 월 100만 요청 무료 (프리티어)
- **AI Worker Pod**: 기존 EKS 노드 사용 (추가 비용 없음)

**총 추가 비용: $0/월**

---

## 모니터링

### CloudWatch 메트릭
- `ApproximateNumberOfMessages`: 대기 중인 작업
- `ApproximateNumberOfMessagesNotVisible`: 처리 중인 작업
- `NumberOfMessagesSent`: 전송된 작업
- `NumberOfMessagesDeleted`: 완료된 작업

### Kubernetes
```bash
# AI Worker 로그
kubectl logs -n fans -l app=ai-worker -f

# HPA 상태 (Auto Scaling)
kubectl get hpa -n fans ai-worker-hpa

# Pod 개수
kubectl get pods -n fans -l app=ai-worker
```

---

## 롤백 방법

SQS 사용을 중단하고 기존 방식으로 복귀:

```bash
# 크롤러 환경 변수 변경
kubectl set env deployment/unified-crawler -n fans USE_SQS=false

# AI Worker 정지
kubectl scale deployment/ai-worker -n fans --replicas=0
```

---

## 다음 단계

### 단기 (배포 후)
1. 로그 모니터링 (1주일)
2. DLQ 메시지 확인 (실패 원인 분석)
3. MAX_CONCURRENT_JOBS 튜닝 (AI 서버 부하에 맞춰)

### 중기 (1개월 후)
1. CloudWatch 알람 설정
   - DLQ 메시지 > 10개: 알람
   - 큐 대기 시간 > 5분: 알람
2. 비용 분석 (프리티어 초과 여부)

### 장기 (3개월 후)
1. AI Worker 성능 최적화
2. 큐 우선순위 도입 (중요 기사 먼저 처리)
3. 배치 처리 (여러 기사를 묶어서 AI 호출)

---

## 참고 자료

- [AWS SQS 문서](https://docs.aws.amazon.com/sqs/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/sqs/)
- [Kubernetes HPA](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- `backend/ai-worker/README.md`: 상세 배포 가이드
