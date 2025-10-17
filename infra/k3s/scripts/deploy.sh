#!/bin/bash
set -e

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}FANS K8s Deployment Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 디렉토리 확인
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MANIFESTS_DIR="$SCRIPT_DIR/../k8s-manifests"

if [ ! -d "$MANIFESTS_DIR" ]; then
    echo -e "${RED}Error: Manifests directory not found${NC}"
    exit 1
fi

# kubectl 확인
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ kubectl is installed${NC}"
echo ""

# 배포 순서
echo -e "${YELLOW}Deploying FANS to K3s...${NC}"
echo ""

echo -e "${BLUE}[1/12] Creating namespace...${NC}"
kubectl apply -f "$MANIFESTS_DIR/00-namespace.yaml"

echo -e "${BLUE}[2/12] Creating ConfigMap...${NC}"
kubectl apply -f "$MANIFESTS_DIR/01-configmap.yaml"

echo -e "${BLUE}[3/12] Creating Secrets...${NC}"
kubectl apply -f "$MANIFESTS_DIR/02-secrets.yaml"

echo -e "${BLUE}[4/12] Deploying PostgreSQL...${NC}"
kubectl apply -f "$MANIFESTS_DIR/10-postgres.yaml"

echo -e "${BLUE}[5/12] Deploying Redis...${NC}"
kubectl apply -f "$MANIFESTS_DIR/11-redis.yaml"

# 데이터베이스가 준비될 때까지 대기
echo -e "${YELLOW}Waiting for database to be ready...${NC}"
kubectl wait --for=condition=ready pod -l app=postgres -n fans --timeout=120s

echo -e "${BLUE}[6/12] Deploying Main API...${NC}"
kubectl apply -f "$MANIFESTS_DIR/20-api.yaml"

echo -e "${BLUE}[7/12] Deploying Frontend...${NC}"
kubectl apply -f "$MANIFESTS_DIR/21-frontend.yaml"

echo -e "${BLUE}[8/12] Deploying Summarize AI...${NC}"
kubectl apply -f "$MANIFESTS_DIR/30-ai-summarize.yaml"

echo -e "${BLUE}[9/12] Deploying Bias Analysis AI...${NC}"
kubectl apply -f "$MANIFESTS_DIR/31-ai-bias-analysis.yaml"

echo -e "${BLUE}[10/12] Deploying API Crawler...${NC}"
kubectl apply -f "$MANIFESTS_DIR/40-crawler-api.yaml"

echo -e "${BLUE}[11/12] Deploying Puppeteer Crawler...${NC}"
kubectl apply -f "$MANIFESTS_DIR/41-crawler-puppeteer.yaml"

echo -e "${BLUE}[12/12] Creating Ingress...${NC}"
kubectl apply -f "$MANIFESTS_DIR/50-ingress.yaml"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Deployment Completed!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo -e "${YELLOW}Checking deployment status...${NC}"
kubectl get pods -n fans

echo ""
echo -e "${YELLOW}Services:${NC}"
kubectl get svc -n fans

echo ""
echo -e "${GREEN}Next steps:${NC}"
echo "  1. Wait for all pods to be Running"
echo "  2. Check logs: kubectl logs -f deployment/main-api -n fans"
echo "  3. Access frontend: http://<NODE_IP>:30080"
echo "  4. Access API: http://<NODE_IP>:30000"
echo ""
