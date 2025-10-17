#!/bin/bash
set -e

# 로그 파일
LOG_FILE="/var/log/k3s-install.log"
exec > >(tee -a $LOG_FILE)
exec 2>&1

echo "=========================================="
echo "K3s FANS Installation Started"
echo "Time: $(date)"
echo "=========================================="

# 시스템 업데이트
echo "[1/5] Updating system packages..."
apt-get update -y
apt-get upgrade -y

# 필수 패키지 설치
echo "[2/5] Installing required packages..."
apt-get install -y \
    curl \
    wget \
    git \
    vim \
    htop \
    net-tools \
    ca-certificates \
    gnupg \
    lsb-release

# K3s 설치
echo "[3/5] Installing K3s..."
curl -sfL https://get.k3s.io | sh -s - \
    --write-kubeconfig-mode 644 \
    --disable traefik \
    --node-name k3s-fans-node

# K3s 상태 확인
echo "[4/5] Waiting for K3s to be ready..."
sleep 10
systemctl status k3s --no-pager

# kubectl 설정
echo "[5/5] Configuring kubectl..."
mkdir -p /home/ubuntu/.kube
cp /etc/rancher/k3s/k3s.yaml /home/ubuntu/.kube/config
chown ubuntu:ubuntu /home/ubuntu/.kube/config

# kubectl alias 설정
echo "alias k='kubectl'" >> /home/ubuntu/.bashrc
echo "export KUBECONFIG=/home/ubuntu/.kube/config" >> /home/ubuntu/.bashrc

# Docker Hub secret 생성 (주석 처리 - 나중에 수동으로)
# kubectl create namespace fans
# kubectl create secret docker-registry dockerhub-secret \
#   --docker-server=https://index.docker.io/v1/ \
#   --docker-username=${docker_username} \
#   --docker-password=<TOKEN_HERE> \
#   -n fans

echo "=========================================="
echo "K3s FANS Installation Completed!"
echo "Time: $(date)"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. SSH into the instance"
echo "2. Check K3s status: sudo systemctl status k3s"
echo "3. Check nodes: kubectl get nodes"
echo "4. Create Docker Hub secret manually"
echo "5. Deploy applications"
echo ""
echo "Kubeconfig is available at: /etc/rancher/k3s/k3s.yaml"
echo "=========================================="
