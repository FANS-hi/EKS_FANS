# FANS Kubernetes Resources

EKS 클러스터에 배포할 Kubernetes 리소스 관리

## 📂 디렉토리 구조

```
kubernetes/
├── base/              # 기본 리소스
│   ├── namespace.yaml
│   └── configmap.yaml
│
├── monitoring/        # 모니터링 스택
│   ├── prometheus-values.yaml
│   └── grafana-values.yaml
│
└── apps/             # FANS 애플리케이션
    ├── main-api.yaml
    ├── summarize-ai.yaml
    ├── bias-analysis-ai.yaml
    ├── api-crawler.yaml
    └── rss-crawler.yaml
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

## 📝 TODO

- [ ] HPA (Horizontal Pod Autoscaler) 설정
- [ ] Ingress 설정
- [ ] Secret 관리 (Sealed Secrets 또는 External Secrets)
- [ ] Custom Grafana 대시보드 추가

---

**작성일**: 2025-01-15
**팀**: FANS
