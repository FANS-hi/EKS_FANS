#!/bin/bash
set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Docker Hub 설정
DOCKER_USERNAME="hodduk"
IMAGE_PREFIX="k3s_FANS"

# 프로젝트 루트 디렉토리
PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}FANS Docker Build & Push Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Docker 로그인 확인
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker is running${NC}"
echo ""

# 빌드할 서비스 목록
declare -A SERVICES=(
    ["api"]="backend/api"
    ["frontend"]="frontend"
    ["summarize-ai"]="backend/ai/summarize-ai"
    ["bias-analysis-ai"]="backend/ai/bias-analysis-ai"
    ["api-crawler"]="backend/crawler/api-crawler"
    ["puppeteer-crawler"]="backend/crawler/puppeteer-crawler"
)

# 특정 서비스만 빌드할 경우
if [ $# -gt 0 ]; then
    SELECTED_SERVICES=()
    for arg in "$@"; do
        if [ -z "${SERVICES[$arg]}" ]; then
            echo -e "${RED}Error: Unknown service '$arg'${NC}"
            echo "Available services: ${!SERVICES[@]}"
            exit 1
        fi
        SELECTED_SERVICES+=("$arg")
    done
else
    SELECTED_SERVICES=("${!SERVICES[@]}")
fi

echo -e "${YELLOW}Building services: ${SELECTED_SERVICES[*]}${NC}"
echo ""

# 각 서비스 빌드
for service in "${SELECTED_SERVICES[@]}"; do
    SERVICE_PATH="${SERVICES[$service]}"
    IMAGE_NAME="${DOCKER_USERNAME}/${IMAGE_PREFIX}-${service}:latest"

    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Building: $service${NC}"
    echo -e "${BLUE}Path: $SERVICE_PATH${NC}"
    echo -e "${BLUE}Image: $IMAGE_NAME${NC}"
    echo -e "${BLUE}========================================${NC}"

    # 디렉토리 확인
    if [ ! -d "$PROJECT_ROOT/$SERVICE_PATH" ]; then
        echo -e "${RED}Error: Directory not found: $SERVICE_PATH${NC}"
        continue
    fi

    # Dockerfile 확인
    if [ ! -f "$PROJECT_ROOT/$SERVICE_PATH/Dockerfile" ]; then
        echo -e "${RED}Error: Dockerfile not found in $SERVICE_PATH${NC}"
        continue
    fi

    # 빌드
    echo -e "${YELLOW}Building Docker image...${NC}"
    if docker build -t "$IMAGE_NAME" "$PROJECT_ROOT/$SERVICE_PATH"; then
        echo -e "${GREEN}✓ Build successful${NC}"

        # Push
        echo -e "${YELLOW}Pushing to Docker Hub...${NC}"
        if docker push "$IMAGE_NAME"; then
            echo -e "${GREEN}✓ Push successful${NC}"
        else
            echo -e "${RED}✗ Push failed${NC}"
        fi
    else
        echo -e "${RED}✗ Build failed${NC}"
    fi

    echo ""
done

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Build & Push Completed!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 생성된 이미지 목록
echo -e "${YELLOW}Built images:${NC}"
for service in "${SELECTED_SERVICES[@]}"; do
    IMAGE_NAME="${DOCKER_USERNAME}/${IMAGE_PREFIX}-${service}:latest"
    echo "  - $IMAGE_NAME"
done

echo ""
echo -e "${GREEN}Next steps:${NC}"
echo "  1. Deploy to K3s: cd ../k8s-manifests && kubectl apply -f ."
echo "  2. Check pods: kubectl get pods -n fans"
echo ""
