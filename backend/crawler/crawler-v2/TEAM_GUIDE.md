# Unified Crawler 팀원 공유 가이드

## Docker Hub에서 이미지 받기

```bash
docker pull hodduk/unified-crawler:latest
```

## 단일 인스턴스 실행

가장 기본적인 실행 방법입니다:

```bash
docker run -d --name unified-crawler \
  -p 4005:4005 \
  -e DB_HOST=your_db_host \
  -e DB_PORT=5432 \
  -e DB_USER=fans_user \
  -e DB_PASSWORD=your_password \
  -e DB_NAME=fans_db \
  -e AUTO_CRAWL=true \
  -e CRAWL_INTERVAL_MINUTES=30 \
  -e CRAWL_LIMIT_PER_SECTION=20 \
  hodduk/unified-crawler:latest
```

## 다중 인스턴스 실행 (분산 크롤링)

여러 인스턴스를 실행하여 크롤링을 분산 처리할 수 있습니다:

### 인스턴스 1
```bash
docker run -d --name unified-crawler-1 \
  -p 4004:4005 \
  -e DB_HOST=your_db_host \
  -e DB_PORT=5432 \
  -e DB_USER=fans_user \
  -e DB_PASSWORD=your_password \
  -e DB_NAME=fans_db \
  -e AUTO_CRAWL=true \
  -e CRAWL_INTERVAL_MINUTES=30 \
  -e CRAWL_LIMIT_PER_SECTION=20 \
  -e INSTANCE_ID=0 \
  -e TOTAL_INSTANCES=2 \
  hodduk/unified-crawler:latest
```

### 인스턴스 2
```bash
docker run -d --name unified-crawler-2 \
  -p 4005:4005 \
  -e DB_HOST=your_db_host \
  -e DB_PORT=5432 \
  -e DB_USER=fans_user \
  -e DB_PASSWORD=your_password \
  -e DB_NAME=fans_db \
  -e AUTO_CRAWL=true \
  -e CRAWL_INTERVAL_MINUTES=30 \
  -e CRAWL_LIMIT_PER_SECTION=20 \
  -e INSTANCE_ID=1 \
  -e TOTAL_INSTANCES=2 \
  hodduk/unified-crawler:latest
```

## 환경 변수 설명

### 필수 환경 변수
| 변수명 | 설명 | 예시 |
|--------|------|------|
| `DB_HOST` | 데이터베이스 호스트 | `postgres` 또는 `localhost` |
| `DB_PORT` | 데이터베이스 포트 | `5432` |
| `DB_USER` | 데이터베이스 사용자 | `fans_user` |
| `DB_PASSWORD` | 데이터베이스 비밀번호 | `your_password` |
| `DB_NAME` | 데이터베이스 이름 | `fans_db` |

### 선택 환경 변수
| 변수명 | 설명 | 기본값 | 예시 |
|--------|------|--------|------|
| `AUTO_CRAWL` | 자동 크롤링 활성화 | `false` | `true` |
| `CRAWL_INTERVAL_MINUTES` | 크롤링 주기 (분) | `30` | `60` |
| `CRAWL_LIMIT_PER_SECTION` | 섹션당 크롤링 개수 | `20` | `50` |
| `INSTANCE_ID` | 인스턴스 ID (다중 실행 시) | `0` | `0`, `1`, `2` |
| `TOTAL_INSTANCES` | 총 인스턴스 수 (다중 실행 시) | `1` | `2`, `3` |

## 로그 확인

```bash
# 실시간 로그 확인
docker logs -f unified-crawler

# 최근 로그 확인
docker logs --tail 100 unified-crawler
```

## 컨테이너 관리

```bash
# 컨테이너 중지
docker stop unified-crawler

# 컨테이너 시작
docker start unified-crawler

# 컨테이너 재시작
docker restart unified-crawler

# 컨테이너 제거
docker rm -f unified-crawler
```

## API 엔드포인트

크롤러가 실행되면 다음 API를 사용할 수 있습니다:

- `GET /health` - 헬스 체크
- `POST /crawl/daum` - 다음 뉴스 크롤링 (수동)
- `POST /crawl/naver` - 네이버 뉴스 크롤링 (수동)
- `POST /crawl/all` - 전체 크롤링 (수동)

예시:
```bash
curl http://localhost:4005/health
curl -X POST http://localhost:4005/crawl/all
```

## 분산 크롤링 원리

- 각 인스턴스는 섹션 URL을 해시하여 담당 섹션을 자동으로 분배받습니다
- `TOTAL_INSTANCES=2`이면 2개 인스턴스가 섹션을 나눠서 크롤링합니다
- 중복 크롤링을 방지하기 위해 URL과 제목을 체크합니다

예시:
- 인스턴스 0: 정치, 경제 섹션 담당
- 인스턴스 1: 사회, 문화, IT/과학, 세계, 연예 섹션 담당

## 문제 해결

### 컨테이너가 바로 종료되는 경우
```bash
# 로그 확인
docker logs unified-crawler

# 주로 DB 연결 문제가 원인입니다
# DB_HOST, DB_PASSWORD 등 환경변수를 확인하세요
```

### 크롤링이 안 되는 경우
```bash
# 로그에서 에러 확인
docker logs -f unified-crawler

# 데이터베이스 연결 확인
# AI 서비스 연결 확인 (선택사항, 없어도 크롤링은 동작합니다)
```

## Docker Compose 예시

`docker-compose.yml`:
```yaml
version: '3.8'

services:
  unified-crawler-1:
    image: hodduk/unified-crawler:latest
    container_name: unified-crawler-1
    ports:
      - "4004:4005"
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USER: fans_user
      DB_PASSWORD: your_password
      DB_NAME: fans_db
      AUTO_CRAWL: "true"
      CRAWL_INTERVAL_MINUTES: 30
      CRAWL_LIMIT_PER_SECTION: 20
      INSTANCE_ID: 0
      TOTAL_INSTANCES: 2
    networks:
      - fans_network
    restart: unless-stopped

  unified-crawler-2:
    image: hodduk/unified-crawler:latest
    container_name: unified-crawler-2
    ports:
      - "4005:4005"
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USER: fans_user
      DB_PASSWORD: your_password
      DB_NAME: fans_db
      AUTO_CRAWL: "true"
      CRAWL_INTERVAL_MINUTES: 30
      CRAWL_LIMIT_PER_SECTION: 20
      INSTANCE_ID: 1
      TOTAL_INSTANCES: 2
    networks:
      - fans_network
    restart: unless-stopped

networks:
  fans_network:
    external: true
```

실행:
```bash
docker-compose up -d
```

## 성능 정보

- **성공률**: 97% (테스트 기준 35/36)
- **다음 뉴스**: 94% 성공률
- **네이버 뉴스**: 100% 성공률
- **지원 언론사**: 주요 언론사 자동 분류 + 기타 언론사 자동 추가

## 문의

문제가 발생하면 로그와 함께 팀원에게 문의하세요!
