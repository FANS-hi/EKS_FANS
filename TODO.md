# FANS 프로젝트 TODO List

## 📅 작성일: 2025-10-17
## 🎯 목표: AI 분석 시스템 개선

---

## 🔴 우선순위 1: 편향성 점수 가중치 조정
**문제점**
- 언론사 기본 성향이 기사 내용에 의해 뒤집어짐
- 한겨레(진보)가 보수로, 경향신문(진보)가 보수로 분류되는 문제
- 같은 언론사의 점수 편차가 너무 큼 (경향신문: -5.00 ~ 7.33)

**작업 내용**
- [ ] `backend/ai/bias-analysis-ai/source_bias_analyzer.py` 수정
  - 현재: 언론사 60% + 내용 40%
  - 변경: 언론사 70-80% + 내용 20-30%
- [ ] 테스트 데이터로 검증
- [ ] AWS 서버 배포

**예상 소요시간**: 1-2시간

---

## 🟡 우선순위 2: 키워드 추출 로직 개선
**문제점**
- "있다", "하다", "이다" 같은 무의미한 단어가 키워드로 추출됨
- 조사, 동사, 형용사 등이 필터링되지 않음

**작업 내용**
- [ ] `backend/ai/bias-analysis-ai/keyword_extractor.py` 개선
- [ ] konlpy 라이브러리 추가 (형태소 분석)
- [ ] 한국어 불용어(stopwords) 리스트 구축
  ```python
  stopwords = ['있다', '하다', '되다', '이다', '그', '저', '것', ...]
  ```
- [ ] 품사 태깅으로 명사(NN), 고유명사(NNP)만 추출
- [ ] 최소 단어 길이 2글자 이상 필터링
- [ ] requirements.txt에 konlpy, JPype1 추가

**예상 소요시간**: 3-4시간

---

## 🟢 우선순위 3: 편향성 분석 카테고리 확장
**문제점**
- 현재 모든 카테고리가 정치 기준(진보/보수)으로만 분석
- 경제, 사회 카테고리에 맞는 분석 지표 부재

**작업 내용**

### 3-1. 경제 카테고리 분석기 추가
- [ ] `backend/ai/bias-analysis-ai/economic_analyzer.py` 신규 생성
- [ ] 분석 지표:
  - 경제 전망: 낙관적 vs 비관적
  - 정책 성향: 시장주의 vs 개입주의
- [ ] 키워드 사전 구축:
  ```python
  optimistic = ['성장', '상승', '회복', '호조', ...]
  pessimistic = ['하락', '침체', '불황', '위기', ...]
  ```

### 3-2. 사회 카테고리 분석기 추가
- [ ] `backend/ai/bias-analysis-ai/social_analyzer.py` 신규 생성
- [ ] 분석 지표:
  - 사회 가치관: 진보적 vs 보수적
  - 이슈별 관점 분석
- [ ] 키워드 사전 구축:
  ```python
  progressive = ['인권', '다양성', '평등', '환경', ...]
  conservative = ['전통', '질서', '안전', '책임', ...]
  ```

### 3-3. 통합 로직 수정
- [ ] `backend/ai/bias-analysis-ai/main.py` 수정
  - 카테고리별 분석기 라우팅 추가
  - `/analyze/full` 엔드포인트에 카테고리 파라미터 추가
- [ ] 크롤러 서비스에서 카테고리 정보 전달
  - `backend/crawler/shared/services/aiService.ts` 수정

**예상 소요시간**: 4-5시간

---

## 📊 전체 작업 요약

| 작업 | 우선순위 | 예상 시간 | 난이도 | 비고 |
|------|---------|-----------|--------|------|
| 편향성 점수 가중치 조정 | 🔴 높음 | 1-2시간 | ⭐ 낮음 | 즉시 효과 |
| 키워드 추출 개선 | 🟡 중간 | 3-4시간 | ⭐⭐ 중간 | konlpy 필요 |
| 카테고리별 분석 확장 | 🟢 낮음 | 4-5시간 | ⭐⭐⭐ 높음 | 프론트 수정 필요 |
| 기타 카테고리 분류 해결 | 🔵 보통 | 3-4시간 | ⭐⭐ 중간 | 1,354개 기사 영향 |
| "기타-" 언론사 처리 | 🔵 보통 | 1-2시간 | ⭐ 낮음 | 98개 언론사 영향 |

**총 예상 소요시간**: 12-17시간

---

## 🚨 주의사항

### **프론트엔드 수정 필요 여부**
- **우선순위 1, 2, 4**: 백엔드만 수정 (프론트 변경 없음)
- **우선순위 3 (카테고리별 분석)**: 프론트엔드 수정 필요
  - 카테고리별 다른 UI 컴포넌트
  - 새로운 필드 표시 (경제: 낙관/비관, 사회: 가치관 등)

---

## 🔵 우선순위 4: 기타 카테고리 분류 문제 해결
**문제점**
- 전체 기사 4,997개 중 1,354개(27.1%)가 "기타" 카테고리로 잘못 분류됨
- 주요 14개 언론사 기사도 545개(40%)가 기타로 분류됨
- 연합뉴스 93개, 한국경제 63개 등 주요 언론사도 영향받음
- 최근 크롤러 수정 후 해결되었지만 기존 데이터 문제 남아있음

**확인 방법**
```sql
-- 기타 카테고리 비율 확인
SELECT c.name, COUNT(*), ROUND(COUNT(*)*100.0/(SELECT COUNT(*) FROM news_articles), 2) as percent
FROM news_articles na JOIN categories c ON na.category_id = c.id
GROUP BY c.name ORDER BY percent DESC;

-- 주요 언론사 중 기타 카테고리 확인
SELECT s.name, COUNT(*) FROM news_articles na
JOIN categories c ON na.category_id = c.id
JOIN sources s ON na.source_id = s.id
WHERE c.name = '기타' AND s.name IN ('연합뉴스','한국경제','머니투데이'...)
GROUP BY s.name ORDER BY COUNT(*) DESC;

-- 최근 크롤링 확인 (정상 동작 여부)
SELECT c.name, COUNT(*) FROM news_articles na
JOIN categories c ON na.category_id = c.id
WHERE na.created_at >= NOW() - INTERVAL '1 hour'
GROUP BY c.name;
```

**작업 내용**
- [ ] 카테고리 분류 로직 확인
  - `backend/crawler/crawler-v2/naverMetaParser.ts` - 네이버 섹션 URL 매핑
  - `backend/crawler/crawler-v2/daumJsonParser.ts` - 다음 카테고리 매핑
  - `backend/crawler/shared/entities/NewsArticle.ts` - 카테고리 저장 로직

- [ ] 기존 데이터 재분류 스크립트 작성
  ```typescript
  // 기사 URL이나 제목으로 실제 카테고리 추론
  // 네이버: /politics/, /economy/ 등 URL 패턴 활용
  // 다음: API 응답의 카테고리 정보 재확인
  ```

- [ ] 카테고리 매핑 테이블 강화
  - 네이버/다음 섹션 → DB 카테고리 매핑 명확히
  - 매핑 실패 시 로그 남기기
  - 기본값 "기타" 대신 URL 패턴 분석으로 추론

- [ ] 모니터링 추가
  - 기타 카테고리 비율이 10% 넘으면 알림
  - 주요 언론사가 기타로 분류되면 즉시 알림

**예상 소요시간**: 3-4시간

---

## 🔵 우선순위 5: "기타-" 언론사 편향성 분석 처리
**문제점**
- 98개의 "기타-" 언론사 존재 (기타-뉴시스, 기타-오마이뉴스 등)
- 1,019개 기사 중 0개만 분석됨 (AI 서비스 꺼져있음)
- 코드상 "기타-뉴시스"를 그대로 전달하면 source_profiles에서 못 찾음
- 모든 기타 언론사가 동일하게 중립(0.0)으로 처리됨

**작업 내용**
- [ ] `backend/ai/bias-analysis-ai/source_bias_analyzer.py` 수정
  - "기타-" prefix 처리 로직 추가
  ```python
  def calculate_final_bias(self, source_name: str, text: str) -> Dict:
      # "기타-"로 시작하는 언론사 처리
      if source_name.startswith('기타-'):
          # 옵션 1: 일괄 중립 처리
          source_profile = self.source_profiles['기타']

          # 옵션 2: 주요 기타 언론사는 개별 처리
          known_others = {
              '기타-오마이뉴스': {'base_score': -4.0, 'leaning': '진보'},
              '기타-조선비즈': {'base_score': 5.0, 'leaning': '보수'},
              '기타-이데일리': {'base_score': 3.0, 'leaning': '중도우'},
              '기타-프레시안': {'base_score': -5.0, 'leaning': '진보'}
          }
          source_profile = known_others.get(source_name, self.source_profiles['기타'])
  ```
- [ ] 테스트 케이스 추가 (기타- 언론사 포함)
- [ ] 기존 분석되지 않은 기사 재분석 배치 작업

**예상 소요시간**: 1-2시간

---

## 🎯 기대 효과

1. **더 정확한 편향성 분석**
   - 언론사 성향이 올바르게 반영됨
   - 극단적인 점수 변동 방지

2. **의미있는 키워드 추출**
   - 실제 핵심 주제어만 추출
   - 트렌드 분석 품질 향상

3. **카테고리별 맞춤 분석**
   - 정치: 진보/보수 편향성
   - 경제: 낙관/비관, 시장/개입
   - 사회: 가치관, 이슈별 관점

---

## 📝 참고사항

- AI 서비스 재배포 시 Docker 이미지 재빌드 필요
- 테스트는 로컬에서 먼저 진행 후 AWS 배포
- 기존 데이터와의 호환성 고려 (bias_analysis 테이블 구조 유지)

---

## 🚀 작업 시작 전 체크리스트

- [ ] 현재 AI 서비스 Docker 이미지 백업
- [ ] 로컬 개발환경 Python 환경 설정
- [ ] AWS 서버 접속 권한 확인
- [ ] 테스트용 뉴스 데이터 준비

---

## 📅 2025-10-20 작업 로그

### ✅ 완료된 작업

#### 1. 카테고리 목록에서 '기타' 제외 확인
- **파일**: `backend/api/src/routes/common/index.ts:26-27`
- **상태**: 이미 API에서 필터링 중 (변경 불필요)

#### 2. 프론트엔드 카테고리 필터링 개선
- **파일**: `frontend/src/App.js:255-303`
- **변경 사항**:
  - 클라이언트 사이드 필터링 → 서버 API 호출로 변경
  - 최대 200개 기사 로드 (기존: 60개)
  - 무한 루프 방지를 위한 `lastAppliedCategoryRef` 추가
  - URL 파라미터 업데이트: `/?category=카테고리명`

#### 3. 뒤로가기 네비게이션 수정
- **파일**: `frontend/src/App.js:255-355`
- **변경 사항**:
  - 카테고리/언론사 선택 시 URL 파라미터 유지
  - 기사 상세에서 뒤로가기 시 선택한 카테고리/언론사로 복귀
  - `NewsGrid.js:29-40`: 현재 경로와 스크롤 위치 전달
  - `NewsDetailPage.js:751-769`: 뒤로가기 시 이전 위치 복원

#### 4. 언론사 필터링 URL 파라미터 추가
- **파일**: `frontend/src/App.js:305-355`
- **변경 사항**:
  - URL 파라미터 업데이트: `/?source=언론사명`
  - 무한 루프 방지를 위한 `lastAppliedSourceRef` 추가
  - 뒤로가기 지원 추가

### 🔍 테스트 결과

#### API 테스트
```bash
# 경제 카테고리 기사 수 확인
DB: 2,113개 기사 존재 ✅
API: 200개 기사 정상 반환 ✅
```

#### 브라우저 동작
- 카테고리 선택 시 URL 변경: `/?category=정치` ✅
- 뒤로가기 시 선택한 카테고리로 복귀 ✅
- 언론사 선택 시 URL 변경: `/?source=한겨레` ✅

### 📦 수정된 파일 목록
1. `frontend/src/App.js` - 카테고리/언론사 필터링 및 URL 로직
2. `frontend/src/components/NewsGrid.js` - 네비게이션 상태 전달 (기존 코드 확인)
3. `frontend/src/pages/NewsDetailPage.js` - 뒤로가기 로직 (기존 코드 확인)

### 💡 남은 작업
- ✅ api-crawler 중단 (더 이상 사용하지 않음)
- ✅ 파비콘 추가
- ✅ Race condition 수정 (500 에러)
- ✅ 문단 분리 개선

---

## 🚀 2025-10-20: AWS CI/CD 자동화 준비

### 📋 목표
GitHub Actions를 이용한 완전 자동 배포 시스템 구축

### ✅ 완료된 작업

#### 1. 배포 계획 문서 작성
- **파일**: `docs/deployment-plan.md`
- **내용**:
  - Phase별 배포 전략 (4단계)
  - AWS 리소스 요구사항
  - 비용 예측 ($80-110/월)
  - CI/CD 워크플로우 설계
  - 모니터링 전략
  - 롤백 절차

#### 2. IAM 정책 파일 생성
- **파일**: `docs/iam-github-actions-policy.json`
- **권한**:
  - ECR: 이미지 푸시
  - ECS: 서비스 업데이트 (향후 사용)
  - S3: 프론트엔드 배포
  - CloudFront: 캐시 무효화
  - CloudWatch: 로그 관리
  - IAM PassRole: Task 역할 전달

#### 3. 배포 가이드 업데이트
- **파일**: `docs/DEPLOYMENT_GUIDE.md`
- **추가 내용**:
  - GitHub Actions 준비사항
  - IAM 사용자 생성 가이드
  - GitHub Secrets 설정
  - 백엔드/프론트엔드 워크플로우 예시
  - 배포 프로세스 설명

### 🔲 남은 작업

#### Phase 1: IAM 설정 (1시간)
- [ ] IAM 사용자 생성: `github-actions-deployer`
- [ ] IAM 정책 생성: `GitHubActionsDeployPolicy`
- [ ] 정책을 사용자에 연결
- [ ] Access Key 발급
- [ ] Access Key 안전하게 보관

#### Phase 2: GitHub Secrets 설정 (30분)
- [ ] AWS 인증 정보 등록
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_ACCOUNT_ID`
  - `AWS_REGION`
- [ ] ECR 정보 등록
  - `ECR_REGISTRY`
  - `ECR_REPOSITORY_API`
  - `ECR_REPOSITORY_AI`
  - `ECR_REPOSITORY_CRAWLER`
- [ ] S3/CloudFront 정보 등록
  - `S3_BUCKET`
  - `CLOUDFRONT_DISTRIBUTION_ID`
- [ ] 환경 변수 등록
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `OPENAI_API_KEY`

#### Phase 3: GitHub Actions 워크플로우 작성 (2-3시간)
- [ ] `.github/workflows/deploy-backend.yml` 생성
  - Docker 이미지 빌드
  - ECR 푸시
  - Matrix 전략으로 여러 서비스 병렬 처리
- [ ] `.github/workflows/deploy-frontend.yml` 생성
  - React 빌드
  - S3 업로드
  - CloudFront 캐시 무효화
- [ ] 워크플로우 테스트
  - 개별 서비스별 트리거 확인
  - 빌드 성공 여부 확인
  - ECR 이미지 푸시 확인

#### Phase 4: 모니터링 설정 (1-2시간)
- [ ] CloudWatch 대시보드 생성
  - ECR 이미지 푸시 메트릭
  - S3 업로드 메트릭
  - CloudFront 무효화 메트릭
- [ ] GitHub Actions 알림 설정
  - Slack 웹훅 연동 (선택)
  - 이메일 알림 설정
- [ ] 배포 실패 시 롤백 전략 수립

#### Phase 5: 테스트 및 검증 (1-2시간)
- [ ] 백엔드 배포 테스트
  - main-api 변경 후 푸시
  - ECR 이미지 확인
  - EKS Pod 업데이트 (수동)
- [ ] 프론트엔드 배포 테스트
  - 코드 변경 후 푸시
  - S3 파일 확인
  - CloudFront 캐시 무효화 확인
  - 브라우저에서 변경사항 확인
- [ ] 롤백 테스트
  - 이전 이미지로 복원
  - 정상 동작 확인

### 📊 작업 우선순위

| 단계 | 작업 | 우선순위 | 예상 시간 | 난이도 |
|------|------|---------|-----------|--------|
| Phase 1 | IAM 설정 | 🔴 최우선 | 1시간 | ⭐ 쉬움 |
| Phase 2 | GitHub Secrets | 🔴 최우선 | 30분 | ⭐ 쉬움 |
| Phase 3 | 워크플로우 작성 | 🟡 높음 | 2-3시간 | ⭐⭐ 중간 |
| Phase 4 | 모니터링 | 🟢 중간 | 1-2시간 | ⭐⭐ 중간 |
| Phase 5 | 테스트 | 🟢 중간 | 1-2시간 | ⭐⭐ 중간 |

**총 예상 소요시간**: 5.5-9.5시간

### 🔑 IAM 계정 생성 요약

**필요한 IAM 리소스**:

1. **IAM User**: `github-actions-deployer`
   - 용도: GitHub Actions가 AWS에 접근할 때 사용
   - 접근 타입: Programmatic access (CLI/SDK/API만)

2. **IAM Policy**: `GitHubActionsDeployPolicy`
   - 용도: 배포에 필요한 최소 권한만 부여
   - 파일: `docs/iam-github-actions-policy.json`

**생성 순서**:
```bash
1. IAM Policy 생성
   → docs/iam-github-actions-policy.json 내용으로

2. IAM User 생성
   → 이름: github-actions-deployer
   → 접근 타입: Programmatic access

3. Policy를 User에 연결
   → GitHubActionsDeployPolicy 연결

4. Access Key 발급
   → Access Key ID 저장
   → Secret Access Key 저장 (다시 볼 수 없음!)

5. GitHub Secrets 등록
   → 발급받은 키를 GitHub에 등록
```

### 📚 참고 문서

- [배포 계획 문서](./docs/deployment-plan.md)
- [배포 가이드](./docs/DEPLOYMENT_GUIDE.md)
- [IAM 정책 파일](./docs/iam-github-actions-policy.json)
- [시스템 아키텍처](./docs/SYSTEM_ARCHITECTURE_2025.md)

### ⚠️ 주의사항

1. **Access Key 보안**
   - Secret Access Key는 발급 즉시 저장 (다시 볼 수 없음)
   - GitHub Secrets에만 저장하고 코드에 하드코딩 금지
   - .env 파일도 Git에 커밋하지 않기

2. **권한 최소화**
   - IAM 정책은 최소 권한만 부여
   - 불필요한 권한은 제거
   - 정기적으로 권한 검토

3. **배포 전 테스트**
   - 로컬에서 빌드 성공 확인
   - Docker 이미지 크기 확인 (너무 크면 개선)
   - 환경 변수 누락 확인

4. **롤백 계획**
   - 배포 실패 시 이전 버전으로 복원 가능하도록
   - ECR 이미지 태그 관리 (sha, latest 동시 푸시)
   - 롤백 스크립트 준비

---

## 📅 2025-10-20: 인프라 이름 변경 및 크롤러 통합

### ✅ 완료된 작업

#### 1. 크롤러 v2 설정 최종 확인 및 활성화
- **파일**: `backend/crawler/crawler-v2/Dockerfile`
- **변경 사항**:
  - AUTO_CRAWL=true로 설정 (자동 크롤링 활성화)
  - CRAWL_INTERVAL_MINUTES=5 (5분마다 실행)
  - CRAWL_LIMIT_PER_SECTION=20 (섹션당 20개 기사)
- **파일**: `docker-compose.yml`
  - crawler-v2 서비스 추가 (port 4005)
  - api-crawler, puppeteer-crawler 비활성화
  - main-api가 crawler-v2에 의존하도록 변경
- **결과**: Unified Crawler v2만 사용하는 구조로 단순화

#### 2. 인프라 이름 변경 (dw → eks)
모든 인프라 리소스 이름을 "dw-FANS-*"에서 "eks-FANS-*"로 변경

**GitHub Actions** (`.github/workflows/deploy-backend.yml`):
- ECR 레포지토리: `dw-fans/*` → `eks-fans/*`
- 크롤러 이름: `crawler` → `crawler-v2`

**Terraform 파일** (`infra/terraform/`):
- `eks.tf`:
  - 클러스터: `dw-FANS-Cluster` → `eks-FANS-Cluster`
  - 노드 그룹: `dw-FANS-Node-Group` → `eks-FANS-Node-Group`
  - IAM 역할: `dw-FANS-Cluster-Role` → `eks-FANS-Cluster-Role`
  - EKS 버전: 1.28 → 1.30으로 업그레이드
- `network.tf`:
  - Public Subnet: `dw-FANS-Public-A/B` → `eks-FANS-Public-A/B`
  - Private Subnet: `dw-FANS-Private-A/B` → `eks-FANS-Private-A/B`
  - NAT Gateway: `dw-FANS-NAT-Gateway-A/B` → `eks-FANS-NAT-Gateway-A/B`
  - Route Table: `dw-FANS-*-RT` → `eks-FANS-*-RT`

**Kubernetes 매니페스트** (`infra/kubernetes/apps/`):
- `crawler-v2.yaml`: 신규 생성 (Unified Crawler v2 전용)
  - 이미지: `eks-fans/crawler-v2:latest`
  - Port: 4005
  - 환경변수: AUTO_CRAWL=true, CRAWL_INTERVAL_MINUTES=5, CRAWL_LIMIT_PER_SECTION=20
- `api-crawler.yaml` → `api-crawler.yaml.disabled` (사용 중지)

**문서 업데이트**:
- `infra/terraform/README.md`: 클러스터 이름 업데이트
- `infra/README.md`: 클러스터 이름 및 kubectl 명령어 업데이트

#### 3. HPA (Horizontal Pod Autoscaler) 자동 스케일링 설정
크롤러 및 AI 서비스에 CPU/Memory 기반 자동 스케일링 구성

**신규 파일 생성** (`infra/kubernetes/autoscaling/`):
- `crawler-v2-hpa.yaml`:
  - minReplicas: 1, maxReplicas: 3
  - CPU: 60%, Memory: 75% 기준
  - scaleDown 안정화: 5분
  - scaleUp 안정화: 1분

- `summarize-ai-hpa.yaml`:
  - minReplicas: 1, maxReplicas: 4
  - CPU: 70%, Memory: 80% 기준
  - scaleDown 안정화: 10분 (모델 로딩 고려)
  - scaleUp 안정화: 30초

- `bias-analysis-ai-hpa.yaml`:
  - minReplicas: 1, maxReplicas: 4
  - CPU: 70%, Memory: 80% 기준
  - scaleDown 안정화: 10분
  - scaleUp 안정화: 30초

**문서 업데이트** (`infra/README.md`):
- HPA 사용법 추가 (섹션 4)
- 수동 스케일링 명령어 추가
- 스케일링 설정 표 추가

#### 4. 프론트엔드 텍스트 줄바꿈 수정
- **파일**: `frontend/src/pages/NewsDetailPage.css`
- **변경 사항**: `.article-content-text p`에 `white-space: pre-line;` 추가
- **결과**: 기사 본문에서 문단 구분이 정상적으로 표시됨

### 📊 변경 사항 요약

| 작업 | 변경 파일 수 | 주요 변경 내용 |
|------|-------------|---------------|
| 인프라 이름 변경 | 8개 | dw → eks prefix 변경 (32개 위치) |
| 크롤러 통합 | 4개 | Unified Crawler v2만 사용 |
| HPA 설정 | 4개 | 자동 스케일링 3개 서비스 |
| 프론트엔드 수정 | 1개 | 텍스트 줄바꿈 |

### 🎯 기대 효과

1. **일관된 이름 규칙**
   - 모든 리소스가 "eks-" prefix 사용
   - EKS 기반임을 명확히 표시

2. **크롤러 단순화**
   - 3개 크롤러 → 1개 크롤러
   - 유지보수 용이성 향상
   - 리소스 사용량 감소

3. **자동 스케일링**
   - 부하에 따른 자동 확장/축소
   - 비용 최적화
   - 안정적인 서비스 제공

4. **사용자 경험 개선**
   - 기사 본문 가독성 향상

### 🔑 적용 방법

#### EKS 이름 변경 적용
```bash
cd infra/terraform
terraform plan  # 변경사항 확인
terraform apply # 인프라 업데이트 (약 15-20분)

# kubeconfig 업데이트
aws eks update-kubeconfig --name eks-FANS-Cluster --region ap-northeast-2
```

#### HPA 적용
```bash
cd infra/kubernetes
kubectl apply -f autoscaling/

# HPA 상태 확인
kubectl get hpa -n fans
```

#### 크롤러 v2 배포
```bash
# Docker 이미지 빌드 & 푸시
cd backend/crawler/crawler-v2
docker build -t crawler-v2 .
docker tag crawler-v2:latest 907123164281.dkr.ecr.ap-northeast-2.amazonaws.com/eks-fans/crawler-v2:latest
docker push 907123164281.dkr.ecr.ap-northeast-2.amazonaws.com/eks-fans/crawler-v2:latest

# Kubernetes 배포
kubectl apply -f infra/kubernetes/apps/crawler-v2.yaml

# 상태 확인
kubectl get pods -n fans | grep crawler-v2
kubectl logs -f deployment/crawler-v2 -n fans
```

### ⚠️ 주의사항

1. **Terraform 변경**
   - 기존 리소스 이름 변경은 리소스 재생성을 유발할 수 있음
   - `terraform plan`으로 반드시 확인 후 적용

2. **크롤러 전환**
   - 기존 api-crawler, puppeteer-crawler를 먼저 중지
   - crawler-v2 정상 동작 확인 후 기존 크롤러 삭제

3. **HPA 적용**
   - Metrics Server가 설치되어 있어야 함
   - 초기에는 metrics 수집에 1-2분 소요
