# K3s FANS 빠른 시작 가이드

## 📝 체크리스트

시작하기 전에 확인:

- [ ] Docker Hub 로그인 완료 (`docker login -u hodduk`)
- [ ] AWS 자격증명 설정 완료 (`aws configure`)
- [ ] SSH 키페어 준비 완료
- [ ] kubectl 설치 완료

---

## 🚀 5단계로 배포하기

### 1️⃣ EC2 인스턴스 생성 (Terraform)

```bash
cd infra/k3s/terraform

# 설정 파일 생성
cp terraform.tfvars.example terraform.tfvars

# terraform.tfvars 편집 (key_name 변경 필수!)
vi terraform.tfvars

# 배포 (약 5분)
terraform init
terraform apply
```

**출력 확인:**
```
instance_public_ip = "3.34.40.123"
ssh_command = "ssh -i ~/.ssh/your-key.pem ubuntu@3.34.40.123"

```

---

### 2️⃣ K3s 설치 확인

```bash
# SSH 접속
ssh -i ~/.ssh/your-key.pem ubuntu@<PUBLIC_IP>

# K3s 상태 확인
sudo systemctl status k3s
kubectl get nodes

# 출력:
# NAME             STATUS   ROLES                  AGE
# k3s-fans-node    Ready    control-plane,master   3m
```

---

### 3️⃣ Docker 이미지 빌드 (로컬)

```bash
# 프로젝트 루트로 이동
cd /Users/hodduk/Documents/git/AWS_FANS

# 전체 빌드 & Push (약 20-30분)
./infra/k3s/scripts/build-all.sh

# 특정 서비스만
./infra/k3s/scripts/build-all.sh api frontend
```

---

### 4️⃣ Docker Hub Secret 생성 (EC2에서)

```bash
# EC2에 SSH 접속
ssh -i ~/.ssh/your-key.pem ubuntu@<PUBLIC_IP>

# Namespace 생성
kubectl create namespace fans

# Docker Hub Token 생성
# https://hub.docker.com/settings/security → New Access Token

# Secret 생성 (TOKEN을 실제 토큰으로 변경!)
kubectl create secret docker-registry dockerhub-secret \
  --docker-server=https://index.docker.io/v1/ \
  --docker-username=hodduk \
  --docker-password=<YOUR_DOCKER_TOKEN> \
  -n fans
```

---

### 5️⃣ 애플리케이션 배포

```bash
# Secret 수정 (EC2에서)
cd /home/ubuntu
git clone https://github.com/your-org/AWS_FANS.git
cd AWS_FANS/infra/k3s/k8s-manifests

# Secret 파일 편집 (DB 비밀번호, JWT Secret 등)
vi 02-secrets.yaml

# 배포
kubectl apply -f .

# 또는 스크립트 사용
cd ../scripts
./deploy.sh
```

**배포 확인:**
```bash
# Pod 상태
kubectl get pods -n fans

# 모두 Running이 될 때까지 기다림 (약 5분)
watch kubectl get pods -n fans
```

---

## 🌐 접속하기

### Frontend
```
http://<PUBLIC_IP>:30080
```

### API
```
http://<PUBLIC_IP>:30000
```

### Health Check
```bash
curl http://<PUBLIC_IP>:30000/health
```

---

## 📊 모니터링

```bash
# Pod 상태
kubectl get pods -n fans

# 로그 확인
kubectl logs -f deployment/main-api -n fans

# 리소스 사용량
kubectl top nodes
kubectl top pods -n fans

# Pod 상세 정보
kubectl describe pod <POD_NAME> -n fans
```

---

## 🔧 문제 해결

### Pod가 ImagePullBackOff 상태

```bash
# Secret 확인
kubectl get secret dockerhub-secret -n fans

# Secret 재생성
kubectl delete secret dockerhub-secret -n fans
kubectl create secret docker-registry dockerhub-secret \
  --docker-username=hodduk \
  --docker-password=<NEW_TOKEN> \
  -n fans

# Pod 재시작
kubectl rollout restart deployment/main-api -n fans
```

### Pod가 CrashLoopBackOff 상태

```bash
# 로그 확인
kubectl logs <POD_NAME> -n fans

# 이벤트 확인
kubectl describe pod <POD_NAME> -n fans

# 환경변수 확인
kubectl exec -it <POD_NAME> -n fans -- env
```

### 데이터베이스 연결 실패

```bash
# PostgreSQL Pod 확인
kubectl get pod -l app=postgres -n fans

# PostgreSQL 로그 확인
kubectl logs -l app=postgres -n fans

# 데이터베이스 접속 테스트
kubectl exec -it deployment/main-api -n fans -- \
  nc -zv postgres-service 5432
```

---

## 🧹 정리

### 애플리케이션만 삭제
```bash
cd infra/k3s/scripts
./cleanup.sh
```

### EC2 인스턴스 삭제
```bash
cd infra/k3s/terraform
terraform destroy
```

---

## 💡 유용한 명령어

```bash
# 전체 리소스 확인
kubectl get all -n fans

# 특정 Pod 재시작
kubectl rollout restart deployment/main-api -n fans

# 스케일링
kubectl scale deployment main-api --replicas=3 -n fans

# ConfigMap 수정 후 적용
kubectl apply -f k8s-manifests/01-configmap.yaml
kubectl rollout restart deployment/main-api -n fans

# 로그 실시간 확인 (여러 Pod)
kubectl logs -f -l app=main-api -n fans
```

---

## 📞 도움말

- Terraform 오류: `infra/k3s/README.md` 참고
- Kubernetes 오류: `kubectl describe pod <POD_NAME> -n fans`
- K3s 오류: `sudo journalctl -u k3s -f` (EC2에서)
