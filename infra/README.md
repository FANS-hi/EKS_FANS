# FANS Infrastructure

FANS 프로젝트의 모든 인프라 코드를 관리하는 디렉토리입니다.

## 📂 디렉토리 구조

```
infra/
├── terraform/          # AWS 인프라 (IaC)
│   ├── main.tf        # Provider 설정
│   ├── eks.tf         # EKS 클러스터 및 노드 그룹
│   ├── network.tf     # VPC, Subnet, NAT Gateway
│   ├── security.tf    # Security Groups
│   ├── frontend.tf    # S3, CloudFront (React 앱)
│   ├── variables.tf   # 변수
│   ├── outputs.tf     # 출력값
│   └── README.md      # Terraform 가이드
│
└── kubernetes/        # Kubernetes 리소스
    ├── base/          # 공통 리소스 (Namespace, ConfigMap)
    ├── apps/          # FANS 애플리케이션 Deployments
    │   ├── main-api.yaml
    │   ├── unified-crawler.yaml
    │   ├── summarize-ai.yaml
    │   └── bias-analysis-ai.yaml
    ├── jobs/          # CronJobs (크롤러 스케줄링)
    └── ingress.yaml   # Ingress 설정
```

## 🚀 빠른 시작

### 1. AWS 인프라 구축 (Terraform)

```bash
cd infra/terraform

# 초기화
terraform init

# 계획 확인
terraform plan

# 인프라 생성 (EKS 포함)
terraform apply
```

**생성되는 리소스**:
- VPC, Subnets (Public/Private)
- NAT Gateway (Multi-AZ)
- Security Groups (5개)
- EKS 클러스터 (eks-FANS-Cluster)
- EKS 노드 그룹 (t3.large × 1~2개)
- S3 + CloudFront (프론트엔드)

### 2. EKS 클러스터 접근 설정

```bash
# kubeconfig 업데이트
aws eks update-kubeconfig --name eks-FANS-Cluster --region ap-northeast-2

# 클러스터 확인
kubectl get nodes
kubectl get namespaces
```

### 3. Kubernetes 리소스 배포

```bash
cd infra/kubernetes

# Base 리소스 (Namespace, ConfigMap, Secrets)
kubectl apply -f base/

# 애플리케이션 배포
kubectl apply -f apps/

# Ingress 설정
kubectl apply -f ingress.yaml

# 배포 상태 확인
kubectl get pods -n fans
kubectl get svc -n fans
```

### 4. 자동 스케일링 설정 (기본 활성화)

Crawler v2와 AI 서비스는 **기본적으로 자동 스케일링**이 적용됩니다.

```bash
# HPA (Horizontal Pod Autoscaler) 적용
kubectl apply -f autoscaling/

# HPA 상태 확인
kubectl get hpa -n fans

# 출력 예시:
# NAME                   REFERENCE                     TARGETS         MINPODS   MAXPODS   REPLICAS
# crawler-v2-hpa         Deployment/crawler-v2         15%/60%         1         3         1
# summarize-ai-hpa       Deployment/summarize-ai       25%/70%         1         4         1
# bias-analysis-ai-hpa   Deployment/bias-analysis-ai   20%/70%         1         4         1
```

**스케일링 설정:**
- **Crawler v2**: 1~3개 (CPU 60%, 메모리 75%)
- **Summarize AI**: 1~4개 (CPU 70%, 메모리 80%)
- **Bias Analysis AI**: 1~4개 (CPU 70%, 메모리 80%)

**수동 조절 (HPA 비활성화 시):**
```bash
# HPA 삭제 (수동 모드)
kubectl delete hpa crawler-v2-hpa -n fans

# 수동으로 replicas 조정
kubectl scale deployment/crawler-v2 --replicas=2 -n fans

# HPA 재활성화
kubectl apply -f autoscaling/crawler-v2-hpa.yaml
```

**크롤러 로그 확인:**
```bash
kubectl logs -f deployment/crawler-v2 -n fans
```

## 📚 상세 가이드

- [Terraform 가이드](./terraform/README.md) - AWS 인프라 구축
- [Kubernetes 가이드](./kubernetes/README.md) - EKS 리소스 배포
- [시스템 아키텍처](../docs/SYSTEM_ARCHITECTURE_2025.md) - 전체 시스템 설계
- [AWS 마이그레이션 문서](../docs/aws-migration-architecture.md) - 클라우드 전환 계획

## 🔄 작업 순서

### Phase 1: 네트워크 인프라 (1일)
1. Terraform으로 VPC, Subnets, NAT Gateway 생성
2. Security Groups 구성
3. 네트워크 연결성 테스트

### Phase 2: EKS 클러스터 (1-2일)
1. Terraform으로 EKS 클러스터 생성
2. 노드 그룹 설정 및 확인
3. kubectl 접근 설정

### Phase 3: 애플리케이션 배포 (1-2일)
1. ConfigMaps/Secrets 설정
2. Deployments 배포 (API, Crawler, AI)
3. Services 및 Ingress 설정
4. 헬스체크 확인

### Phase 4: 모니터링 및 최적화 (1일)
1. CloudWatch 로그 설정
2. HPA (Horizontal Pod Autoscaler) 구성
3. 부하 테스트

## 🏗️ 현재 배포 상태

**인프라**: 설정 완료
- VPC: FANS_VPC_EKS (172.16.0.0/16)
- EKS 클러스터: eks-FANS-Cluster
- 노드 그룹: 1~2개 t3.large

**애플리케이션**: 설정 완료
- Main API: 1 Pod (port 3000)
- Crawler v2: 1 Pod (port 4005)
- Summarize AI: 1 Pod (port 8000)
- Bias Analysis AI: 1 Pod (port 8002)

**프론트엔드**: ✅ 배포 완료
- S3 버킷: fans-frontend
- CloudFront 배포: www.fans.ai.kr
- Route 53: fans.ai.kr

## 💡 운영 팁

### 비용 최적화
- 개발 환경: NAT Gateway 1개만 사용 (Single-AZ)
- 프로덕션 환경: NAT Gateway 2개 사용 (Multi-AZ)
- 야간/주말: 노드 그룹 최소 크기 조정

### 보안
- Terraform state 파일은 Git에 커밋 금지 (`.gitignore` 설정됨)
- Kubernetes Secrets는 AWS Secrets Manager 연동 권장
- ECR 이미지는 정기적으로 취약점 스캔

### 모니터링
- CloudWatch Logs: 모든 Pod 로그 자동 수집
- CloudWatch Metrics: CPU, Memory, 네트워크 모니터링
- 알람 설정: Pod 재시작, High CPU, API 에러율

### 유용한 명령어

```bash
# Pod 로그 확인
kubectl logs -f <pod-name> -n fans

# Pod 내부 접속
kubectl exec -it <pod-name> -n fans -- /bin/bash

# 리소스 사용량 확인
kubectl top pods -n fans
kubectl top nodes

# 배포 롤백
kubectl rollout undo deployment/main-api -n fans

# ConfigMap 수정
kubectl edit configmap fans-config -n fans
kubectl rollout restart deployment/main-api -n fans
```

## 🐛 트러블슈팅

### Pod가 Pending 상태
```bash
kubectl describe pod <pod-name> -n fans
# 원인: 노드 리소스 부족, PVC 마운트 실패 등
```

### ImagePullBackOff
```bash
# ECR 로그인 확인
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.ap-northeast-2.amazonaws.com

# 이미지 존재 확인
aws ecr describe-images --repository-name fans-main-api
```

### CrashLoopBackOff
```bash
# 이전 로그 확인
kubectl logs <pod-name> -n fans --previous

# 환경변수 확인
kubectl describe pod <pod-name> -n fans | grep -A 20 Environment
```

---

**작성일**: 2025-10-17
**최종 업데이트**: 2025-10-17
**팀**: FANS
**상태**: EKS 배포 완료
