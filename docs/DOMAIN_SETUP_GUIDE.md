# 커스텀 도메인 연결 가이드

## 목차
1. [사전 요구사항](#사전-요구사항)
2. [도메인 구매 및 설정](#도메인-구매-및-설정)
3. [ACM 인증서 발급](#acm-인증서-발급)
4. [Terraform 설정 변경](#terraform-설정-변경)
5. [DNS 설정](#dns-설정)
6. [배포 및 확인](#배포-및-확인)

---

## 사전 요구사항

- 도메인 구매 (예: `www.fans.ai.kr`)
- AWS CLI 설정 완료
- Terraform 설치 완료
- 기존 인프라가 배포되어 있어야 함

---

## 도메인 구매 및 설정

### Option 1: Route 53에서 도메인 구매 (추천)

```bash
# Route 53에서 도메인 구매
# AWS 콘솔 → Route 53 → 도메인 등록 → 도메인 검색 및 구매

# 구매 완료 후 호스팅 영역 자동 생성됨
aws route53 list-hosted-zones --query "HostedZones[?Name=='fans.ai.kr.'].Id" --output text
```

### Option 2: 외부에서 구매한 도메인 사용

```bash
# Route 53 호스팅 영역 생성
aws route53 create-hosted-zone \
  --name fans.ai.kr \
  --caller-reference $(date +%s) \
  --hosted-zone-config Comment="FANS Project Domain"

# Name Server 정보 확인
aws route53 list-resource-record-sets \
  --hosted-zone-id [ZONE-ID] \
  --query "ResourceRecordSets[?Type=='NS'].ResourceRecords[*].Value" \
  --output table

# 결과:
# ns-123.awsdns-12.com
# ns-456.awsdns-45.net
# ns-789.awsdns-78.org
# ns-012.awsdns-01.co.uk

# ✅ 위의 Name Server를 도메인 등록 업체에 등록
```

**외부 도메인 등록 업체별 설정**:

<details>
<summary>GoDaddy</summary>

1. GoDaddy 로그인
2. 내 도메인 → 도메인 선택
3. DNS → Name Server → Custom 선택
4. AWS Route 53 Name Server 4개 입력
5. 저장 (전파 시간: 최대 48시간, 보통 1-2시간)
</details>

<details>
<summary>Namecheap</summary>

1. Namecheap 로그인
2. Domain List → Manage
3. Name Servers → Custom DNS
4. AWS Route 53 Name Server 4개 입력
5. Save (전파 시간: 최대 48시간)
</details>

<details>
<summary>Gabia (가비아)</summary>

1. 가비아 로그인
2. My가비아 → 서비스 관리
3. 도메인 관리 → 네임서버 설정
4. 호스팅 네임서버 → 다른 네임서버 사용
5. AWS Route 53 Name Server 4개 입력
6. 확인 (전파 시간: 최대 24시간)
</details>

---

## ACM 인증서 발급

### 1. ACM 인증서 요청

**중요**: CloudFront를 위한 인증서는 **us-east-1 리전**에서 발급해야 합니다!

```bash
# ACM 인증서 요청 (us-east-1 리전)
aws acm request-certificate \
  --region us-east-1 \
  --domain-name www.fans.ai.kr \
  --subject-alternative-names "*.fans.ai.kr" \
  --validation-method DNS \
  --tags Key=Project,Value=FANS Key=Environment,Value=production

# 인증서 ARN 저장
CERT_ARN=$(aws acm list-certificates \
  --region us-east-1 \
  --query "CertificateSummaryList[?DomainName=='www.fans.ai.kr'].CertificateArn" \
  --output text)

echo $CERT_ARN
# 결과 예시: arn:aws:acm:us-east-1:907123164281:certificate/xxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### 2. DNS 검증 레코드 추가

```bash
# 검증 레코드 확인
aws acm describe-certificate \
  --region us-east-1 \
  --certificate-arn $CERT_ARN \
  --query 'Certificate.DomainValidationOptions[*].[DomainName,ResourceRecord]' \
  --output table

# 결과 예시:
# --------------------------------
# |   _abc123.fans.ai.kr        |
# |   CNAME                      |
# |   _xyz456.acm-validations... |
# --------------------------------

# Route 53에 자동으로 검증 레코드 추가
aws acm describe-certificate \
  --region us-east-1 \
  --certificate-arn $CERT_ARN \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord' \
  --output json > validation-record.json

# Hosted Zone ID 확인
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones \
  --query "HostedZones[?Name=='fans.ai.kr.'].Id" \
  --output text | cut -d'/' -f3)

# DNS 레코드 생성 (자동)
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "'$(cat validation-record.json | jq -r .Name)'",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{
          "Value": "'$(cat validation-record.json | jq -r .Value)'"
        }]
      }
    }]
  }'
```

### 3. 인증서 발급 확인

```bash
# 인증서 상태 확인 (5-10분 소요)
aws acm describe-certificate \
  --region us-east-1 \
  --certificate-arn $CERT_ARN \
  --query 'Certificate.Status' \
  --output text

# 결과가 'ISSUED'가 될 때까지 대기
while true; do
  STATUS=$(aws acm describe-certificate --region us-east-1 --certificate-arn $CERT_ARN --query 'Certificate.Status' --output text)
  echo "Certificate Status: $STATUS"
  [ "$STATUS" = "ISSUED" ] && break
  sleep 30
done

echo "✅ Certificate issued successfully!"
```

---

## Terraform 설정 변경

### 1. frontend.tf 수정

**파일 경로**: `/Users/hodduk/Documents/git/AWS_FANS/infra/terraform/frontend.tf`

**수정할 부분**:

#### Line 86-89: CloudFront 기본 설정에 aliases 추가
```terraform
resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "dw-FANS Frontend Distribution"
  default_root_object = "index.html"
  price_class         = "PriceClass_200"

  # ✅ 추가: 커스텀 도메인
  aliases             = ["www.fans.ai.kr"]  # 여기에 도메인 입력
```

#### Line 176-179: viewer_certificate 블록 교체
```terraform
  # 기존 코드 (삭제)
  viewer_certificate {
    cloudfront_default_certificate = true
  }

  # 새로운 코드 (추가)
  viewer_certificate {
    acm_certificate_arn      = "arn:aws:acm:us-east-1:907123164281:certificate/xxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # ✅ 여기에 인증서 ARN 입력
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
```

**완전한 예시** (www.fans.ai.kr 사용 시):
```terraform
resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "dw-FANS Frontend Distribution"
  default_root_object = "index.html"
  price_class         = "PriceClass_200"
  aliases             = ["www.fans.ai.kr"]  # ← 수정

  # ... (중간 생략) ...

  # Viewer Certificate (커스텀 도메인)
  viewer_certificate {
    acm_certificate_arn      = "arn:aws:acm:us-east-1:907123164281:certificate/12345678-1234-1234-1234-123456789012"  # ← 수정
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = {
    Name        = "dw-FANS-CloudFront"
    Environment = var.environment
    Project     = var.project_name
    Purpose     = "Frontend CDN"
  }
}
```

### 2. outputs.tf에 도메인 출력 추가 (선택사항)

**파일 경로**: `/Users/hodduk/Documents/git/AWS_FANS/infra/terraform/outputs.tf`

```terraform
# 기존 출력에 추가
output "custom_domain_url" {
  description = "Custom domain URL"
  value       = "https://www.fans.ai.kr"  # ← 여기에 도메인 입력
}
```

---

## DNS 설정

### Route 53에 A 레코드 추가

```bash
# CloudFront Distribution Domain 확인
CF_DOMAIN=$(terraform output -raw cloudfront_domain_name)
echo $CF_DOMAIN
# 결과 예시: d1234567890abc.cloudfront.net

# Hosted Zone ID 확인
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones \
  --query "HostedZones[?Name=='fans.ai.kr.'].Id" \
  --output text | cut -d'/' -f3)

# CloudFront Distribution ID 확인
CF_DIST_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Comment=='dw-FANS Frontend Distribution'].Id" \
  --output text)

# A 레코드 추가 (www.fans.ai.kr)
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "www.fans.ai.kr",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "'$CF_DOMAIN'",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }'
```

**참고**: CloudFront의 HostedZoneId는 항상 `Z2FDTNDATAQYW2`입니다 (고정값).

---

## 배포 및 확인

### 1. Terraform Apply

```bash
cd /Users/hodduk/Documents/git/AWS_FANS/infra/terraform

# 변경사항 확인
terraform plan

# 주요 변경사항:
# ~ aws_cloudfront_distribution.frontend
#   + aliases = ["www.fans.ai.kr"]
#   ~ viewer_certificate {
#       + acm_certificate_arn = "arn:aws:acm:us-east-1:..."
#       - cloudfront_default_certificate = true
#     }

# 배포 (약 5-10분 소요)
terraform apply

# 'yes' 입력하여 확인
```

### 2. 프론트엔드 환경 변수 수정 (필요 시)

**파일 경로**: `/Users/hodduk/Documents/git/AWS_FANS/frontend/.env`

**.env 파일 내용** (그대로 유지):
```bash
REACT_APP_API_URL=
REACT_APP_API_BASE=
REACT_APP_AI_SERVICE_URL=
```

**중요**: 값을 비워두어야 합니다! (상대 경로 사용)

### 3. 백엔드 CORS 설정 업데이트

**파일 경로**: `/Users/hodduk/Documents/git/AWS_FANS/infra/kubernetes/apps/main-api.yaml`

**수정할 부분** (Line 75-78):
```yaml
        - name: CORS_ALLOWED_ORIGINS
          value: "https://www.fans.ai.kr,https://dl8va6yrt5vtj.cloudfront.net"  # ← 도메인 추가
        - name: FRONTEND_URL
          value: "https://www.fans.ai.kr"  # ← 메인 도메인으로 변경
```

**변경사항 적용**:
```bash
cd /Users/hodduk/Documents/git/AWS_FANS/infra/kubernetes

# Deployment 업데이트
kubectl apply -f apps/main-api.yaml

# Pod 재시작
kubectl rollout restart deployment/main-api -n fans

# 재시작 확인
kubectl rollout status deployment/main-api -n fans
```

### 4. DNS 전파 확인

```bash
# DNS 전파 확인 (1-5분 소요)
dig www.fans.ai.kr

# 또는
nslookup www.fans.ai.kr

# 결과에 CloudFront IP가 나타나면 성공
# 예시:
# www.fans.ai.kr.  300  IN  A  13.224.XXX.XXX
# www.fans.ai.kr.  300  IN  A  13.224.YYY.YYY
```

### 5. HTTPS 접속 테스트

```bash
# CloudFront를 통한 접속 테스트
curl -s "https://www.fans.ai.kr" | grep -o "<title>.*</title>"

# 결과 예시:
# <title>FANS - Financial & Analytics News Service</title>

# API 엔드포인트 테스트
curl -s "https://www.fans.ai.kr/api/health" | jq

# 결과 예시:
# {
#   "status": "OK",
#   "timestamp": "2025-10-14T06:30:00.000Z"
# }
```

### 6. SSL 인증서 확인

```bash
# SSL 인증서 확인
openssl s_client -connect www.fans.ai.kr:443 -servername www.fans.ai.kr < /dev/null 2>/dev/null | openssl x509 -noout -text | grep -A 2 "Subject:"

# 결과 예시:
# Subject: CN=www.fans.ai.kr
# Subject Alternative Name:
#   DNS:www.fans.ai.kr, DNS:*.fans.ai.kr
```

### 7. 브라우저 테스트

1. 브라우저에서 `https://www.fans.ai.kr` 접속
2. 주소창에 자물쇠 아이콘 확인 (HTTPS 정상 작동)
3. 개발자 도구 (F12) → Network 탭
4. 뉴스 피드가 정상적으로 로드되는지 확인
5. Mixed Content 오류가 없는지 확인

---

## 요약: 변경해야 할 파일 및 라인

| 파일 경로 | 수정 위치 | 변경 내용 |
|-----------|----------|-----------|
| **frontend.tf** | Line 89 | `aliases = ["www.fans.ai.kr"]` 추가 |
| **frontend.tf** | Line 176-179 | `viewer_certificate` 블록을 ACM 인증서 사용으로 변경 |
| **main-api.yaml** | Line 75 | `CORS_ALLOWED_ORIGINS`에 커스텀 도메인 추가 |
| **main-api.yaml** | Line 77 | `FRONTEND_URL`을 커스텀 도메인으로 변경 |
| **.env** (frontend) | All lines | **변경 없음** (값을 비워둠) |

---

## 트러블슈팅

### 1. "This distribution is not configured to serve <domain>"

**증상**: CloudFront에서 403 Forbidden 오류

**원인**: CloudFront Distribution의 `aliases`에 도메인이 없음

**해결**:
```bash
cd infra/terraform
grep -n "aliases" frontend.tf

# 없다면 추가:
# aliases = ["www.fans.ai.kr"]

terraform apply
```

### 2. SSL 인증서 오류

**증상**: "NET::ERR_CERT_COMMON_NAME_INVALID"

**원인**:
1. ACM 인증서가 us-east-1이 아닌 다른 리전에 생성됨
2. 인증서의 도메인과 접속 도메인이 불일치

**해결**:
```bash
# 1. 인증서 리전 확인
aws acm list-certificates --region us-east-1

# 2. 인증서 도메인 확인
aws acm describe-certificate \
  --region us-east-1 \
  --certificate-arn [ARN] \
  --query 'Certificate.[DomainName,SubjectAlternativeNames]'

# 3. 필요시 새 인증서 발급 (us-east-1에서)
aws acm request-certificate \
  --region us-east-1 \
  --domain-name www.fans.ai.kr \
  --subject-alternative-names "*.fans.ai.kr" \
  --validation-method DNS
```

### 3. DNS가 전파되지 않음

**증상**: `nslookup`으로 도메인 조회 시 응답 없음

**원인**: DNS 전파 시간 필요

**해결**:
```bash
# 1. Name Server가 올바른지 확인
dig fans.ai.kr NS

# 2. Route 53 레코드 확인
aws route53 list-resource-record-sets \
  --hosted-zone-id [ZONE-ID] \
  --query "ResourceRecordSets[?Name=='www.fans.ai.kr.']"

# 3. 최대 48시간 대기 (보통 1-2시간)
```

### 4. CORS 오류 발생

**증상**: 브라우저 콘솔에 CORS 오류

**원인**: 백엔드 CORS 설정에 새 도메인이 없음

**해결**:
```bash
# main-api.yaml 수정
cd infra/kubernetes/apps
vi main-api.yaml

# CORS_ALLOWED_ORIGINS에 도메인 추가
# value: "https://www.fans.ai.kr,..."

kubectl apply -f main-api.yaml
kubectl rollout restart deployment/main-api -n fans
```

---

## 비용

### 추가 비용 항목

| 항목 | 월 예상 비용 (USD) |
|------|-------------------|
| Route 53 Hosted Zone | $0.50 |
| Route 53 쿼리 (100만 건) | $0.40 |
| ACM 인증서 | **무료** |
| CloudFront (도메인 사용) | 변동 없음 |
| **총 추가 비용** | **~$1/월** |

---

## 참고 자료

- [AWS ACM 인증서 발급 가이드](https://docs.aws.amazon.com/acm/latest/userguide/gs-acm-request-public.html)
- [CloudFront에 커스텀 도메인 설정](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/CNAMEs.html)
- [Route 53 레코드 생성](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-creating.html)

---

**마지막 업데이트**: 2025-10-14
**작성자**: DW (DongWon)
**프로젝트**: FANS (Financial & Analytics News Service)
