# FANS Kubernetes Resources

EKS 클러스터에 배포할 Kubernetes 리소스 관리

> **📖 전체 시스템 아키텍처는 [SYSTEM_ARCHITECTURE_2025.md](../../docs/SYSTEM_ARCHITECTURE_2025.md)를 참고하세요.**

## 📂 디렉토리 구조

```
kubernetes/
├── base/              # 기본 리소스
│   ├── namespace.yaml
│   ├── configmap.yaml
│   └── secrets.yaml
│
├── apps/             # FANS 애플리케이션 Deployments
│   ├── main-api.yaml           # Main API (port 3000)
│   ├── unified-crawler.yaml    # Unified Crawler v2 (port 4005)
│   ├── summarize-ai.yaml       # Summarize AI (port 8000)
│   └── bias-analysis-ai.yaml   # Bias Analysis AI (port 8002)
│
├── jobs/             # CronJobs (스케줄링)
│   └── unified-crawler-job.yaml  # 크롤러 정기 실행 (매 1분)
│
├── ingress.yaml      # Ingress 설정 (ALB Controller)
│
└── monitoring/       # 모니터링 스택 (선택사항)
    ├── prometheus-values.yaml
    └── grafana-values.yaml
```

## 🚀 배포 순서

### 1. Base 리소스 배포

```bash
kubectl apply -f base/namespace.yaml
kubectl apply -f base/configmap.yaml
```

### 2. 모니터링 스택 설치 (Helm)

```bash
# Helm 차트 저장소 추가
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Prometheus + Grafana 설치
helm install monitoring prometheus-community/kube-prometheus-stack \
  -n monitoring \
  --create-namespace \
  -f monitoring/prometheus-values.yaml

# 설치 확인
kubectl get pods -n monitoring
```

### 3. 애플리케이션 배포

```bash
# 전체 배포
kubectl apply -f apps/

# 또는 개별 배포
kubectl apply -f apps/main-api.yaml
kubectl apply -f apps/summarize-ai.yaml
kubectl apply -f apps/bias-analysis-ai.yaml
```

## 🔍 모니터링 접근

### Grafana 대시보드

```bash
# Port-forward로 로컬 접속
kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80

# 브라우저에서 접속
open http://localhost:3000

# 기본 계정
# Username: admin
# Password: (helm values에서 설정한 비밀번호)
```

### Prometheus UI

```bash
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090
open http://localhost:9090
```

## 📊 주요 메트릭

### CPU/Memory
- `container_cpu_usage_seconds_total`
- `container_memory_usage_bytes`

### HTTP Requests
- `http_requests_total`
- `http_request_duration_seconds`

### Custom Metrics (추가 예정)
- `fans_news_crawled_total`
- `fans_ai_summary_requests_total`

## 🛠️ 유용한 명령어

```bash
# Pod 상태 확인
kubectl get pods -n fans

# 로그 확인
kubectl logs -n fans <pod-name> -f

# 리소스 사용량 확인
kubectl top pods -n fans
kubectl top nodes

# 서비스 확인
kubectl get svc -n fans

# 모든 리소스 확인
kubectl get all -n fans
```

## 🔧 트러블슈팅

### Pod가 Pending 상태
```bash
kubectl describe pod <pod-name> -n fans
# 원인: 리소스 부족, 스케줄링 실패 등
```

### ImagePullBackOff
```bash
# ECR 인증 확인
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.ap-northeast-2.amazonaws.com
```

### CrashLoopBackOff
```bash
# 로그 확인
kubectl logs <pod-name> -n fans --previous
```

## 📝 현재 배포 상태

### ✅ 배포 완료
- [x] Namespace (fans)
- [x] ConfigMaps (DB 연결 정보)
- [x] Secrets (API Keys, OAuth Credentials)
- [x] Deployments (Main API, Crawler, AI Services)
- [x] Services (ClusterIP)
- [x] Ingress (ALB Controller)
- [x] CronJobs (Crawler 스케줄링)

### 🔄 진행 중
- [ ] HPA (Horizontal Pod Autoscaler) 설정
- [ ] Prometheus/Grafana 모니터링 스택
- [ ] Custom Grafana 대시보드

### 📊 리소스 현황

| 서비스 | Replicas | CPU Request | Memory Request | Status |
|--------|----------|-------------|----------------|--------|
| Main API | 2 | 250m | 512Mi | ✅ Running |
| Unified Crawler | 2 | 500m | 1Gi | ✅ Running |
| Summarize AI | 1 | 250m | 512Mi | ✅ Running |
| Bias Analysis AI | 1 | 250m | 512Mi | ✅ Running |

### 🔗 관련 문서

- [시스템 아키텍처 (2025)](../../docs/SYSTEM_ARCHITECTURE_2025.md) - 전체 시스템 설계
- [Terraform 가이드](../terraform/README.md) - AWS 인프라 구축
- [Crawler v2 가이드](../../backend/crawler/crawler-v2/README.md) - 크롤러 상세
- [데이터베이스 스키마](../../docs/DATABASE.md) - DB 구조

---

**작성일**: 2025-01-15
**최종 업데이트**: 2025-10-17
**팀**: FANS
**상태**: EKS 운영 중
