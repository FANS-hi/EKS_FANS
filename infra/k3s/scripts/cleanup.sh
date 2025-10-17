#!/bin/bash
set -e

# 색상 정의
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}FANS K8s Cleanup Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

read -p "Are you sure you want to delete all FANS resources? (yes/no): " confirmation

if [ "$confirmation" != "yes" ]; then
    echo "Cleanup cancelled"
    exit 0
fi

echo ""
echo -e "${YELLOW}Deleting all FANS resources...${NC}"

# 순서대로 삭제
kubectl delete -f infra/k3s/k8s-manifests/50-ingress.yaml --ignore-not-found=true
kubectl delete -f infra/k3s/k8s-manifests/41-crawler-puppeteer.yaml --ignore-not-found=true
kubectl delete -f infra/k3s/k8s-manifests/40-crawler-api.yaml --ignore-not-found=true
kubectl delete -f infra/k3s/k8s-manifests/31-ai-bias-analysis.yaml --ignore-not-found=true
kubectl delete -f infra/k3s/k8s-manifests/30-ai-summarize.yaml --ignore-not-found=true
kubectl delete -f infra/k3s/k8s-manifests/21-frontend.yaml --ignore-not-found=true
kubectl delete -f infra/k3s/k8s-manifests/20-api.yaml --ignore-not-found=true
kubectl delete -f infra/k3s/k8s-manifests/11-redis.yaml --ignore-not-found=true
kubectl delete -f infra/k3s/k8s-manifests/10-postgres.yaml --ignore-not-found=true
kubectl delete -f infra/k3s/k8s-manifests/02-secrets.yaml --ignore-not-found=true
kubectl delete -f infra/k3s/k8s-manifests/01-configmap.yaml --ignore-not-found=true

# Namespace는 나중에 삭제 (리소스 정리를 기다림)
echo ""
echo -e "${YELLOW}Waiting for resources to be deleted...${NC}"
sleep 10

kubectl delete -f infra/k3s/k8s-manifests/00-namespace.yaml --ignore-not-found=true

echo ""
echo -e "${GREEN}Cleanup completed!${NC}"
