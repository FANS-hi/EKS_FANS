# EKS-FANS Security Groups
# Zero Trust 원칙 기반 설계
# Owner: EKS Team
# Circular dependency 해결: SG 생성과 Rule 추가를 분리

# ============================================
# Step 1: Security Groups 생성 (규칙 없이)
# ============================================

# SG-1: ALB Security Group
resource "aws_security_group" "alb" {
  name        = "eks-FANS-ALB-SG"
  description = "Security group for Application Load Balancer - Internet facing"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name        = "eks-FANS-ALB-SG"
    Environment = var.environment
    Project     = var.project_name
    Layer       = "Load Balancer"
  }
}

# SG-2: Web Services Security Group
resource "aws_security_group" "web" {
  name        = "eks-FANS-Web-SG"
  description = "Security group for Main API and AI services - ALB access only"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name        = "eks-FANS-Web-SG"
    Environment = var.environment
    Project     = var.project_name
    Layer       = "Application"
    Services    = "Main-API, Summarize-AI, Bias-AI"
  }
}

# SG-3: Internal Crawler Security Group
resource "aws_security_group" "crawler" {
  name        = "eks-FANS-Crawler-SG"
  description = "Security group for internal crawlers - No inbound access"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name        = "eks-FANS-Crawler-SG"
    Environment = var.environment
    Project     = var.project_name
    Layer       = "Background Jobs"
    Services    = "RSS-Crawler, API-Crawler"
  }
}

# SG-4: RDS Security Group
resource "aws_security_group" "rds" {
  name        = "eks-FANS-RDS-SG"
  description = "Security group for RDS PostgreSQL - Application access only"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name        = "eks-FANS-RDS-SG"
    Environment = var.environment
    Project     = var.project_name
    Layer       = "Database"
    Service     = "PostgreSQL"
  }
}

# SG-5: ElastiCache Security Group
resource "aws_security_group" "elasticache" {
  name        = "eks-FANS-ElastiCache-SG"
  description = "Security group for ElastiCache Redis - Web services only"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name        = "eks-FANS-ElastiCache-SG"
    Environment = var.environment
    Project     = var.project_name
    Layer       = "Cache"
    Service     = "Redis"
  }
}

# ============================================
# Step 2: Security Group Rules 추가
# ============================================

# --- ALB Security Group Rules ---

# ALB: 인바운드 - HTTPS from Internet
resource "aws_security_group_rule" "alb_ingress_https" {
  type              = "ingress"
  description       = "HTTPS from Internet"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.alb.id
}

# ALB: 인바운드 - HTTP from Internet
resource "aws_security_group_rule" "alb_ingress_http" {
  type              = "ingress"
  description       = "HTTP from Internet (redirect to HTTPS)"
  from_port         = 80
  to_port           = 80
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.alb.id
}

# ALB: 아웃바운드 - To Main API
resource "aws_security_group_rule" "alb_egress_main_api" {
  type                     = "egress"
  description              = "To Main API"
  from_port                = 3000
  to_port                  = 3000
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.web.id
  security_group_id        = aws_security_group.alb.id
}

# ALB: 아웃바운드 - To AI Services
resource "aws_security_group_rule" "alb_egress_ai_services" {
  type                     = "egress"
  description              = "To AI Services (Summarize: 8000, Bias: 8002)"
  from_port                = 8000
  to_port                  = 8002
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.web.id
  security_group_id        = aws_security_group.alb.id
}

# --- Web Services Security Group Rules ---

# Web: 인바운드 - Main API from ALB
resource "aws_security_group_rule" "web_ingress_main_api" {
  type                     = "ingress"
  description              = "Main API from ALB"
  from_port                = 3000
  to_port                  = 3000
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.alb.id
  security_group_id        = aws_security_group.web.id
}

# Web: 인바운드 - AI Services from ALB
resource "aws_security_group_rule" "web_ingress_ai_services" {
  type                     = "ingress"
  description              = "AI Services from ALB"
  from_port                = 8000
  to_port                  = 8002
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.alb.id
  security_group_id        = aws_security_group.web.id
}

# Web: 아웃바운드 - To RDS
resource "aws_security_group_rule" "web_egress_rds" {
  type                     = "egress"
  description              = "To RDS PostgreSQL"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.rds.id
  security_group_id        = aws_security_group.web.id
}

# Web: 아웃바운드 - To ElastiCache
resource "aws_security_group_rule" "web_egress_elasticache" {
  type                     = "egress"
  description              = "To ElastiCache Redis"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.elasticache.id
  security_group_id        = aws_security_group.web.id
}

# Web: 아웃바운드 - To Internet (External APIs)
resource "aws_security_group_rule" "web_egress_internet" {
  type              = "egress"
  description       = "To Internet (External services)"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.web.id
}

# --- Crawler Security Group Rules ---

# Crawler: 아웃바운드 - To RDS
resource "aws_security_group_rule" "crawler_egress_rds" {
  type                     = "egress"
  description              = "To RDS PostgreSQL (save crawled data)"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.rds.id
  security_group_id        = aws_security_group.crawler.id
}

# Crawler: 아웃바운드 - To Internet HTTPS
resource "aws_security_group_rule" "crawler_egress_internet_https" {
  type              = "egress"
  description       = "To Internet (Naver News API, RSS feeds)"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.crawler.id
}

# Crawler: 아웃바운드 - To Internet HTTP
resource "aws_security_group_rule" "crawler_egress_internet_http" {
  type              = "egress"
  description       = "To Internet HTTP (some RSS feeds)"
  from_port         = 80
  to_port           = 80
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.crawler.id
}

# --- RDS Security Group Rules ---

# RDS: 인바운드 - From Web Services
resource "aws_security_group_rule" "rds_ingress_web" {
  type                     = "ingress"
  description              = "PostgreSQL from Web Services"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.web.id
  security_group_id        = aws_security_group.rds.id
}

# RDS: 인바운드 - From Crawlers
resource "aws_security_group_rule" "rds_ingress_crawler" {
  type                     = "ingress"
  description              = "PostgreSQL from Crawlers"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.crawler.id
  security_group_id        = aws_security_group.rds.id
}

# RDS: 인바운드 - From EKS Cluster
resource "aws_security_group_rule" "rds_ingress_eks" {
  type                     = "ingress"
  description              = "PostgreSQL from EKS Cluster"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_eks_cluster.main.vpc_config[0].cluster_security_group_id
  security_group_id        = aws_security_group.rds.id
}

# --- ElastiCache Security Group Rules ---

# ElastiCache: 인바운드 - From Web Services
resource "aws_security_group_rule" "elasticache_ingress_web" {
  type                     = "ingress"
  description              = "Redis from Web Services only"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.web.id
  security_group_id        = aws_security_group.elasticache.id
}

# ElastiCache: 인바운드 - From EKS Cluster
resource "aws_security_group_rule" "elasticache_ingress_eks" {
  type                     = "ingress"
  description              = "Redis from EKS Cluster"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  source_security_group_id = aws_eks_cluster.main.vpc_config[0].cluster_security_group_id
  security_group_id        = aws_security_group.elasticache.id
}
