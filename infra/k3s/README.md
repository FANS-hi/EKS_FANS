# K3s FANS 배포 가이드

K3s (경량 Kubernetes) 기반 FANS 프로젝트 배포 문서

## 📋 목차

1. [사전 준비](#사전-준비)
2. [인프라 배포](#인프라-배포)
3. [로컬 빌드 & Push](#로컬-빌드--push)
4. [애플리케이션 배포](#애플리케이션-배포)
5. [관리 명령어](#관리-명령어)

---

## 🔧 사전 준비

### 1. 필요한 도구

```bash
# Terraform 설치 확인
terraform version

# AWS CLI 설치 확인
aws --version

# Docker 설치 확인
docker --version

# kubectl 설치 (Mac)
brew install kubectl
```

### 2. AWS 설정

```bash
# AWS 자격증명 설정
aws configure

# SSH 키페어 확인 (없으면 생성)
aws ec2 describe-key-pairs --region ap-northeast-2
```

### 3. Docker Hub 로그인

```bash
docker login -u hodduk
# 비밀번호 또는 Access Token 입력
```

---

## 🚀 인프라 배포

### 1. Terraform 설정

```bash
cd infra/k3s/terraform

# terraform.tfvars 파일 생성
cp terraform.tfvars.example terraform.tfvars

# terraform.tfvars 편집
vi terraform.tfvars
```

**terraform.tfvars 예시:**
```hcl
aws_region = "ap-northeast-2"
environment = "production"
instance_type = "t3.xlarge"
key_name = "your-key-name"  # 실제 키 이름으로 변경!
docker_username = "hodduk"
```

### 2. Terraform 실행

```bash
# 초기화
terraform init

# 플랜 확인
terraform plan

# 배포 (약 3-5분 소요)
terraform apply

# 출력 확인
terraform output
```

**출력 예시:**
```
instance_public_ip = "3.34.40.123"
ssh_command = "ssh -i ~/.ssh/your-key.pem ubuntu@3.34.40.123"
k3s_api_endpoint = "https://3.34.40.123:6443"
```

### 3. K3s 설치 확인

```bash
# SSH 접속
ssh -i ~/.ssh/your-key.pem ubuntu@<PUBLIC_IP>

# K3s 상태 확인
sudo systemctl status k3s

# 노드 확인
kubectl get nodes

# 출력 예시:
# NAME             STATUS   ROLES                  AGE   VERSION
# k3s-fans-node    Ready    control-plane,master   2m    v1.28.2+k3s1
```

---

## 🐳 로컬 빌드 & Push

### 방법 1: 자동 스크립트 (추천)

```bash
cd infra/k3s/scripts

# 전체 빌드 & Push
./build-all.sh

# 특정 서비스만
./build-all.sh api frontend
```

### 방법 2: 수동 빌드

```bash
# API
cd backend/api
docker build -t hodduk/k3s_FANS-api:latest .
docker push hodduk/k3s_FANS-api:latest

# Frontend
cd frontend
docker build -t hodduk/k3s_FANS-frontend:latest .
docker push hodduk/k3s_FANS-frontend:latest

# Summarize AI
cd backend/ai/summarize-ai
docker build -t hodduk/k3s_FANS-summarize-ai:latest .
docker push hodduk/k3s_FANS-summarize-ai:latest

# Bias Analysis AI
cd backend/ai/bias-analysis-ai
docker build -t hodduk/k3s_FANS-bias-analysis-ai:latest .
docker push hodduk/k3s_FANS-bias-analysis-ai:latest

# API Crawler
cd backend/crawler/api-crawler
docker build -t hodduk/k3s_FANS-api-crawler:latest .
docker push hodduk/k3s_FANS-api-crawler:latest

# Puppeteer Crawler
cd backend/crawler/puppeteer-crawler
docker build -t hodduk/k3s_FANS-puppeteer-crawler:latest .
docker push hodduk/k3s_FANS-puppeteer-crawler:latest
```

---

## ☸️ 애플리케이션 배포

### 1. kubeconfig 설정 (로컬)

```bash
# kubeconfig 가져오기
scp -i ~/.ssh/your-key.pem \
  ubuntu@<PUBLIC_IP>:/etc/rancher/k3s/k3s.yaml \
  ~/.kube/k3s-config

# 서버 주소 변경
sed -i '' "s/127.0.0.1/<PUBLIC_IP>/g" ~/.kube/k3s-config

# kubeconfig 설정
export KUBECONFIG=~/.kube/k3s-config

# 확인
kubectl get nodes
```

### 2. Docker Hub Secret 생성

```bash
# EC2에 SSH 접속
ssh -i ~/.ssh/your-key.pem ubuntu@<PUBLIC_IP>

# Namespace 생성
kubectl create namespace fans

# Docker Hub Secret 생성
kubectl create secret docker-registry dockerhub-secret \
  --docker-server=https://index.docker.io/v1/ \
  --docker-username=hodduk \
  --docker-password=<YOUR_DOCKER_TOKEN> \
  -n fans

# 확인
kubectl get secret dockerhub-secret -n fans
```

### 3. 애플리케이션 배포

```bash
# 전체 배포
cd infra/k3s/k8s-manifests
kubectl apply -f .

# 또는 순서대로
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f secrets.yaml
kubectl apply -f postgres.yaml
kubectl apply -f redis.yaml
kubectl apply -f api.yaml
kubectl apply -f frontend.yaml
kubectl apply -f ai-services.yaml
kubectl apply -f crawlers.yaml
kubectl apply -f ingress.yaml
```

### 4. 배포 확인

```bash
# Pod 상태 확인
kubectl get pods -n fans

# 서비스 확인
kubectl get svc -n fans

# Ingress 확인
kubectl get ingress -n fans

# 로그 확인
kubectl logs -f deployment/main-api -n fans
```

---

## 📊 관리 명령어

### Pod 관리

```bash
# Pod 목록
kubectl get pods -n fans

# Pod 상세 정보
kubectl describe pod <POD_NAME> -n fans

# Pod 로그
kubectl logs -f <POD_NAME> -n fans

# Pod 접속
kubectl exec -it <POD_NAME> -n fans -- /bin/bash

# Pod 재시작
kubectl rollout restart deployment/main-api -n fans
```

### 스케일링

```bash
# 수동 스케일링
kubectl scale deployment main-api --replicas=3 -n fans

# HPA (자동 스케일링) 설정
kubectl autoscale deployment main-api \
  --cpu-percent=70 \
  --min=2 \
  --max=5 \
  -n fans

# HPA 확인
kubectl get hpa -n fans
```

### 리소스 모니터링

```bash
# 노드 리소스
kubectl top nodes

# Pod 리소스
kubectl top pods -n fans

# 전체 리소스 사용량
kubectl describe node k3s-fans-node
```

### 배포 업데이트

```bash
# 이미지 업데이트
kubectl set image deployment/main-api \
  api=hodduk/k3s_FANS-api:v2.0 \
  -n fans

# 롤아웃 상태
kubectl rollout status deployment/main-api -n fans

# 롤백
kubectl rollout undo deployment/main-api -n fans
```

---

## 💰 비용 관리

### Spot 인스턴스 상태 확인

```bash
# AWS CLI로 확인
aws ec2 describe-spot-instance-requests \
  --region ap-northeast-2 \
  --filters "Name=state,Values=active"

# Spot 종료 알림 확인 (EC2 내부)
curl -s http://169.254.169.254/latest/meta-data/spot/instance-action
```

### 인스턴스 중지/시작

```bash
# Terraform으로 삭제 (비용 절감)
terraform destroy

# 다시 생성
terraform apply
```

---

## 🔍 트러블슈팅

### K3s 재시작

```bash
sudo systemctl restart k3s
sudo systemctl status k3s
```

### Docker Hub Pull 제한

```bash
# Secret 확인
kubectl get secret dockerhub-secret -n fans -o yaml

# Secret 재생성
kubectl delete secret dockerhub-secret -n fans
kubectl create secret docker-registry dockerhub-secret \
  --docker-username=hodduk \
  --docker-password=<NEW_TOKEN> \
  -n fans
```

### Pod가 Pending 상태

```bash
# 이벤트 확인
kubectl describe pod <POD_NAME> -n fans

# 리소스 부족 확인
kubectl top nodes
kubectl describe node k3s-fans-node
```

---

## 📞 참고 자료

- [K3s 공식 문서](https://docs.k3s.io/)
- [Kubernetes 공식 문서](https://kubernetes.io/docs/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
