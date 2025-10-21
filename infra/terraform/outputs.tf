# FANS Terraform Outputs

# ============================================
# VPC & Network
# ============================================

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "vpc_cidr" {
  description = "VPC CIDR Block"
  value       = aws_vpc.main.cidr_block
}

# ============================================
# Subnets
# ============================================

output "public_subnet_a_id" {
  description = "Public Subnet A ID"
  value       = aws_subnet.fans_public_a.id
}

output "public_subnet_b_id" {
  description = "Public Subnet B ID"
  value       = aws_subnet.fans_public_b.id
}

output "private_subnet_a_id" {
  description = "Private Subnet A ID"
  value       = aws_subnet.fans_private_a.id
}

output "private_subnet_b_id" {
  description = "Private Subnet B ID"
  value       = aws_subnet.fans_private_b.id
}

# ============================================
# NAT Gateways
# ============================================

output "nat_gateway_a_id" {
  description = "NAT Gateway A ID"
  value       = aws_nat_gateway.nat_a.id
}

output "nat_gateway_b_id" {
  description = "NAT Gateway B ID"
  value       = aws_nat_gateway.nat_b.id
}

output "nat_gateway_a_public_ip" {
  description = "NAT Gateway A Public IP"
  value       = aws_eip.nat_a.public_ip
}

output "nat_gateway_b_public_ip" {
  description = "NAT Gateway B Public IP"
  value       = aws_eip.nat_b.public_ip
}

# ============================================
# Security Groups
# ============================================

output "alb_security_group_id" {
  description = "ALB Security Group ID"
  value       = aws_security_group.alb.id
}

output "web_security_group_id" {
  description = "Web Services Security Group ID"
  value       = aws_security_group.web.id
}

output "crawler_security_group_id" {
  description = "Crawler Security Group ID"
  value       = aws_security_group.crawler.id
}

output "rds_security_group_id" {
  description = "RDS Security Group ID"
  value       = aws_security_group.rds.id
}

output "elasticache_security_group_id" {
  description = "ElastiCache Security Group ID"
  value       = aws_security_group.elasticache.id
}

# ============================================
# Summary
# ============================================

# ============================================
# EKS Cluster
# ============================================

output "eks_cluster_endpoint" {
  description = "EKS Cluster Endpoint"
  value       = aws_eks_cluster.main.endpoint
}

output "eks_cluster_name" {
  description = "EKS Cluster Name"
  value       = aws_eks_cluster.main.name
}

# ============================================
# ECR Repositories
# ============================================

output "ecr_repositories" {
  description = "ECR Repository URLs"
  value = {
    main_api          = aws_ecr_repository.main_api.repository_url
    summarize_ai      = aws_ecr_repository.summarize_ai.repository_url
    bias_ai           = aws_ecr_repository.bias_ai.repository_url
    api_crawler       = aws_ecr_repository.api_crawler.repository_url
    puppeteer_crawler = aws_ecr_repository.puppeteer_crawler.repository_url
  }
}

# ============================================
# ALB
# ============================================

output "alb_dns_name" {
  description = "ALB DNS Name (사용할 URL)"
  value       = aws_lb.main.dns_name
}

output "alb_arn" {
  description = "ALB ARN"
  value       = aws_lb.main.arn
}

# ============================================
# Database & Cache
# ============================================

output "rds_endpoint" {
  description = "RDS PostgreSQL Endpoint"
  value       = aws_db_instance.postgres.endpoint
}

output "redis_endpoint" {
  description = "ElastiCache Redis Endpoint"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

# ============================================
# Frontend
# ============================================

output "cloudfront_domain_name" {
  description = "CloudFront Distribution Domain (프론트엔드 URL)"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "s3_bucket_name" {
  description = "S3 Bucket Name (프론트엔드 업로드용)"
  value       = aws_s3_bucket.frontend.bucket
}

# ============================================
# Summary
# ============================================

output "infrastructure_summary" {
  description = "Infrastructure Summary"
  value = {
    vpc_id            = aws_vpc.main.id
    vpc_cidr          = aws_vpc.main.cidr_block
    public_subnets    = [aws_subnet.fans_public_a.id, aws_subnet.fans_public_b.id]
    private_subnets   = [aws_subnet.fans_private_a.id, aws_subnet.fans_private_b.id]
    nat_gateway_count = 2
    security_groups   = 5
    eks_cluster       = aws_eks_cluster.main.name
    alb_url           = "http://${aws_lb.main.dns_name}"
    cloudfront_url    = "https://${aws_cloudfront_distribution.frontend.domain_name}"
  }
}

# ============================================
# 중요: 환경변수 설정용
# ============================================

output "env_variables_for_react" {
  description = "React .env 파일에 사용할 환경변수"
  value       = <<-EOT

  === React Frontend .env ===
  REACT_APP_API_URL=http://${aws_lb.main.dns_name}

  EOT
}

output "connection_info" {
  description = "접속 정보"
  value       = <<-EOT

  ========================================
  EKS-FANS 인프라 배포 완료!
  ========================================

  [프론트엔드 URL]
  https://${aws_cloudfront_distribution.frontend.domain_name}

  [백엔드 API URL]
  http://${aws_lb.main.dns_name}

  [EKS 클러스터 연결]
  aws eks update-kubeconfig --region ap-northeast-2 --name ${aws_eks_cluster.main.name}

  [ECR 로그인]
  aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin ${aws_ecr_repository.main_api.repository_url}

  [S3 프론트엔드 배포]
  aws s3 sync ./frontend/build s3://${aws_s3_bucket.frontend.bucket}
  aws cloudfront create-invalidation --distribution-id ${aws_cloudfront_distribution.frontend.id} --paths "/*"

  ========================================
  EOT
}
