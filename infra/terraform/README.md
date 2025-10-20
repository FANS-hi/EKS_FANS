# FANS AWS Infrastructure - Terraform

## 📋 개요

이 Terraform 코드는 VPC `FANS_VPC_EKS` (`172.16.0.0/16`)를 활용하여 FANS 프로젝트의 AWS 인프라를 구축합니다.

### 📂 파일 구조

```
terraform/
├── main.tf              # Provider 설정 및 기존 리소스 Import
├── network.tf           # Network 계층 (Subnet, NAT, Route Table)
├── security.tf          # Security 계층 (Security Groups)
├── variables.tf         # 변수 정의
├── outputs.tf           # 출력 값
├── .gitignore          # Git 제외 파일
└── README.md           # 이 문서
```

### 생성되는 리소스

| 파일 | 리소스 | 개수 |
|------|--------|------|
| `network.tf` | Subnets | 4개 |
| | NAT Gateways | 2개 |
| | Route Tables | 3개 |
| | Elastic IPs | 2개 |
| `security.tf` | Security Groups | 5개 |
| **총계** | | **16개** |

### 재사용 리소스

- **VPC**: `FANS_VPC_EKS` (172.16.0.0/16)
- **Internet Gateway**: VPC의 IGW 재사용

---

## 🚀 사용 방법

### 1. 사전 준비

```bash
# Terraform 설치 확인
terraform version
# Required: >= 1.0

# AWS CLI 설정 확인
aws configure list

# AWS 자격증명 확인
aws sts get-caller-identity

# 프로젝트 디렉토리로 이동
cd /Users/hodduk/Documents/git/FANS/terraform
```

### 2. 초기화

```bash
# Terraform 초기화 (Provider 다운로드)
terraform init

# 출력 예시:
# Initializing the backend...
# Initializing provider plugins...
# - Finding hashicorp/aws versions matching "~> 5.0"...
# Terraform has been successfully initialized!
```

### 3. 계획 확인 (Dry Run)

```bash
# 생성될 리소스 미리 확인
terraform plan

# 상세 출력으로 확인
terraform plan -out=tfplan

# 출력 예시:
# Plan: 16 to add, 0 to change, 0 to destroy.
```

### 4. 변수 확인 (선택사항)

기본값 사용 시 생략 가능. 커스터마이징이 필요하면:

```bash
# terraform.tfvars 파일 생성
cat > terraform.tfvars <<EOF
aws_region      = "ap-northeast-2"
existing_vpc_id = "vpc-0fa60f4833b7932ad"
environment     = "production"
project_name    = "FANS"
EOF
```

### 5. 인프라 생성 🚀

```bash
# 실제 리소스 생성
terraform apply

# 또는 plan 파일 사용
terraform apply tfplan

# 확인 메시지에서 'yes' 입력
# Enter a value: yes
```

⏱️ **예상 소요 시간**: 약 3-5분 (NAT Gateway 생성 시간)

### 6. 생성 결과 확인

```bash
# 모든 Output 확인
terraform output

# 특정 값만 확인
terraform output nat_gateway_a_public_ip
terraform output alb_security_group_id

# JSON 형식으로 확인
terraform output -json

# Infrastructure Summary 확인
terraform output infrastructure_summary
```

---

## 📐 네트워크 아키텍처

### CIDR 구성

```
VPC: 172.16.0.0/16 (FANS_VPC_EKS)
Total: 65,536 IP addresses

┌─────────────────────────────────────────────────────────┐
│                FANS 서비스 영역                          │
├─────────────────────────────────────────────────────────┤
│ Public Subnets (Multi-AZ)                               │
│   - Public-A:  172.16.0.0/24  (256 IP) - AZ-2a         │
│   - Public-B:  172.16.1.0/24  (256 IP) - AZ-2c         │
│                                                         │
│ Private Subnets (Multi-AZ, EKS용)                       │
│   - Private-A: 172.16.16.0/20 (4,096 IP) - AZ-2a       │
│   - Private-B: 172.16.32.0/20 (4,096 IP) - AZ-2c       │
└─────────────────────────────────────────────────────────┘

할당된 IP: 8,704개
여유 IP: 56,832개

Note: Private Subnet이 큰 이유는 EKS Pod마다 VPC IP 할당되기 때문
```

### 트래픽 흐름

```
Internet
    ↓
[Internet Gateway] ← 기존 재사용
    ↓
[ALB in Public Subnet]
    ↓
[ECS/EKS in Private Subnet]
    ↓
┌─────────────┬──────────────────┐
│             │                  │
[RDS]    [ElastiCache]    [NAT Gateway]
                               ↓
                          Internet
                     (API 호출용)
```

---

## 🔒 Security Groups 상세

### 계층별 격리 (Zero Trust)

```
Internet
    ↓
┌──────────────────────────────────┐
│ SG-1: ALB-SG                     │
│ IN:  443, 80 ← 0.0.0.0/0        │
│ OUT: 3000, 8000-8002 → Web-SG   │
└──────────────────────────────────┘
    ↓
┌──────────────────────────────────┐
│ SG-2: Web-SG                     │
│ IN:  3000, 8000-8002 ← ALB-SG   │
│ OUT: 5432 → RDS-SG              │
│      6379 → Cache-SG            │
└──────────────────────────────────┘
    ↓
┌──────────────────────────────────┐
│ SG-4: RDS-SG                     │
│ IN:  5432 ← Web-SG, Crawler-SG  │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ SG-3: Crawler-SG                 │
│ IN:  없음 (완전 격리)             │
│ OUT: 5432 → RDS-SG              │
│      443 → Internet             │
└──────────────────────────────────┘
```

### Security Group 매트릭스

| From / To | ALB | Web | Crawler | RDS | Cache |
|-----------|-----|-----|---------|-----|-------|
| **Internet** | ✅ 443,80 | ❌ | ❌ | ❌ | ❌ |
| **ALB** | - | ✅ 3000,8000-8002 | ❌ | ❌ | ❌ |
| **Web** | ❌ | - | ❌ | ✅ 5432 | ✅ 6379 |
| **Crawler** | ❌ | ❌ | - | ✅ 5432 | ❌ |
| **RDS** | ❌ | ❌ | ❌ | - | ❌ |
| **Cache** | ❌ | ❌ | ❌ | ❌ | - |

---

## 💰 예상 비용 (월)

### 신규 생성 리소스

| 리소스 | 개수 | 시간당 | 월 비용 (730h) |
|--------|------|--------|---------------|
| NAT Gateway | 2 | $0.045 | ~$65 |
| Elastic IP (NAT 할당) | 2 | $0 | $0 |
| 데이터 전송 (1TB 가정) | - | - | ~$10 |
| **소계** | | | **~$75/월** |

### 기존 리소스 (비용 없음)

- VPC: $0
- Internet Gateway: $0
- Subnets: $0
- Route Tables: $0
- Security Groups: $0

### 💡 비용 절감 팁

1. **개발 시**: NAT Gateway 1개만 사용 (Single-AZ)
2. **프로덕션**: NAT Gateway 2개 사용 (Multi-AZ)
3. **테스트 후 삭제**: `terraform destroy`로 즉시 삭제

---

## 🔧 관리 명령어

### 리소스 상태 확인

```bash
# 전체 상태 확인
terraform show

# 간략하게 리소스 목록만
terraform state list

# 특정 리소스 상세 정보
terraform state show aws_nat_gateway.nat_a
terraform state show aws_security_group.web
```

### 리소스 수정

```bash
# 1. 파일 수정 (network.tf, security.tf 등)
vim network.tf

# 2. 변경 사항 확인
terraform plan

# 3. 적용
terraform apply
```

### 특정 리소스만 적용

```bash
# 예: Security Group만 업데이트
terraform apply -target=aws_security_group.web

# 예: NAT Gateway A만 재생성
terraform apply -target=aws_nat_gateway.nat_a
```

### 리소스 삭제

```bash
# 전체 삭제 (주의!)
terraform destroy

# 특정 리소스만 삭제
terraform destroy -target=aws_nat_gateway.nat_b

# 삭제 전 확인
terraform plan -destroy
```

⚠️ **주의**: `terraform destroy`는 **모든** 생성된 리소스를 삭제합니다!

### State 관리

```bash
# State 백업
cp terraform.tfstate terraform.tfstate.backup

# State 검증
terraform validate

# State 포맷팅
terraform fmt
```

---

## 🐛 트러블슈팅

### 1. VPC ID 오류
```
Error: No VPC found matching criteria
```
**원인**: VPC ID가 잘못되었거나 접근 권한 없음

**해결**:
```bash
# VPC ID 확인
aws ec2 describe-vpcs --filters "Name=tag:Name,Values=FANS_VPC_EKS"

# variables.tf에서 existing_vpc_id 수정
```

### 2. CIDR 블록 충돌
```
Error: InvalidSubnet.Conflict: The CIDR '172.16.0.0/24' conflicts with another subnet
```
**원인**: 같은 CIDR을 사용하는 Subnet이 이미 존재

**해결**:
```bash
# 기존 Subnet 확인
aws ec2 describe-subnets --filters "Name=vpc-id,Values=<VPC-ID>"

# network.tf에서 CIDR 블록 수정
# 예: 172.16.0.0/24 → 172.16.2.0/24
```

### 3. NAT Gateway 생성 타임아웃
```
Error: timeout while creating NAT Gateway
```
**원인**: 네트워크 지연 또는 AWS 서비스 이슈

**해결**:
```bash
# 재시도
terraform apply

# 또는 타임아웃 증가
terraform apply -timeout=10m
```

### 4. Security Group 순환 참조
```
Error: Cycle: aws_security_group.alb, aws_security_group.web
```
**원인**: Security Group이 서로 참조

**해결**: 현재 코드는 이미 해결됨 (egress만 참조)

### 5. 권한 부족
```
Error: UnauthorizedOperation: You are not authorized to perform this operation
```
**원인**: AWS IAM 권한 부족

**해결**:
```bash
# 필요한 권한 확인
# - ec2:CreateSubnet
# - ec2:CreateNatGateway
# - ec2:CreateSecurityGroup
# - ec2:AllocateAddress
# 등...

# IAM 정책 추가 필요
```

### 6. State Lock 오류
```
Error: Error acquiring the state lock
```
**원인**: 다른 terraform 프로세스가 실행 중

**해결**:
```bash
# Lock 강제 해제 (주의!)
terraform force-unlock <LOCK_ID>
```

---

## 📚 팀 협업 가이드

### Git 브랜치 전략

```bash
# Feature 브랜치 생성
git checkout -b feature/add-vpc-endpoints

# 작업 후 커밋
git add terraform/
git commit -m "feat: Add VPC endpoints for S3 and ECR"

# PR 생성 전 plan 확인
terraform plan > plan.txt
git add plan.txt
git commit -m "docs: Add terraform plan output"
```

### 코드 리뷰 체크리스트

- [ ] `terraform fmt` 실행했는지 확인
- [ ] `terraform validate` 통과했는지 확인
- [ ] Security Group 규칙이 최소 권한 원칙을 따르는지
- [ ] 태그가 일관되게 적용되었는지
- [ ] CIDR 블록이 충돌하지 않는지
- [ ] 주석이 충분한지

### 환경별 관리

```bash
# 개발 환경
terraform workspace new dev
terraform workspace select dev
terraform apply -var-file=dev.tfvars

# 프로덕션 환경
terraform workspace new prod
terraform workspace select prod
terraform apply -var-file=prod.tfvars
```

### State 파일 공유 (S3 Backend)

**나중에 추가 권장**:
```hcl
# main.tf에 추가
terraform {
  backend "s3" {
    bucket = "fans-terraform-state"
    key    = "production/terraform.tfstate"
    region = "ap-northeast-2"
  }
}
```

---

## 🔄 다음 단계

이 인프라 위에 다음 리소스들을 배포:

### Phase 1: Database & Cache
```bash
# RDS PostgreSQL
# - Private Subnet A (Primary)
# - Private Subnet B (Standby)
# - Multi-AZ 구성

# ElastiCache Redis
# - Private Subnet A
```

### Phase 2: Application
```bash
# ECS Fargate / EKS
# - Main API (Port 3000)
# - Summarize AI (Port 8000)
# - Bias Analysis AI (Port 8002)
# - API Crawler (Port 4003)
```

### Phase 3: Load Balancer
```bash
# Application Load Balancer
# - Public Subnet A, B
# - Target Groups for each service
```

### Phase 4: Frontend
```bash
# S3 + CloudFront
# - React SPA 정적 호스팅
```

---

## 📖 참고 자료

### Terraform
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [Terraform Best Practices](https://www.terraform-best-practices.com/)

### AWS
- [AWS VPC 설계 가이드](https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html)
- [Security Groups 모범 사례](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_SecurityGroups.html)
- [NAT Gateway](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html)

### FANS 프로젝트
- [AWS 배포 계획](../docs/AWS_DEPLOYMENT_PLAN.md)
- [시스템 아키텍처](../docs/SYSTEM_ARCHITECTURE_GUIDE.md)

---

## 📝 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|-----------|
| 2025-01-15 | 1.0 | 초기 버전 생성 |

---

**작성일**: 2025-01-15
**작성자**: Claude Code
**팀**: FANS
