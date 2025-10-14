# FANS Infrastructure

FANS 프로젝트의 모든 인프라 코드를 관리하는 디렉토리입니다.

## 📂 디렉토리 구조

```
infra/
├── terraform/          # AWS 인프라 (IaC)
│   ├── main.tf        # Provider 설정
│   ├── network.tf     # VPC, Subnet, NAT Gateway
│   ├── security.tf    # Security Groups
│   ├── variables.tf   # 변수
│   ├── outputs.tf     # 출력값
│   └── README.md      # Terraform 가이드
│
└── kubernetes/        # Kubernetes 리소스
    ├── base/          # 공통 리소스 (Namespace, ConfigMap)
    ├── monitoring/    # Prometheus, Grafana 설정
    └── apps/          # FANS 애플리케이션 매니페스트
```

## 🚀 빠른 시작

### 1. AWS 인프라 구축

```bash
cd infra/terraform
terraform init
terraform plan
terraform apply
```

→ VPC, Subnet, NAT Gateway, Security Groups 생성

### 2. Kubernetes 리소스 배포

```bash
cd infra/kubernetes

# Namespace 생성
kubectl apply -f base/

# 모니터링 스택 설치 (Helm)
helm install monitoring prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace \
  -f monitoring/prometheus-values.yaml

# 애플리케이션 배포
kubectl apply -f apps/
```

## 📚 상세 가이드

- [Terraform 가이드](./terraform/README.md)
- Kubernetes 가이드 (작성 예정)

## 🔄 작업 순서

1. **Terraform으로 AWS 인프라 구축**
   - VPC, Subnet 생성
   - NAT Gateway 설정
   - Security Groups 구성

2. **EKS 클러스터 생성** (Terraform 또는 콘솔)

3. **Kubernetes 리소스 배포**
   - Base 리소스
   - Monitoring 스택
   - Applications

## 💡 팁

- Terraform state 파일은 Git에 커밋하지 마세요 (`.gitignore` 설정됨)
- Kubernetes secrets는 별도 관리 필요
- 환경별로 values 파일 분리 권장

---

**작성일**: 2025-01-15
**팀**: FANS
