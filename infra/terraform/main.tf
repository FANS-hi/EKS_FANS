# FANS AWS Infrastructure - Terraform Configuration
# VPC: FANS_VPC_EKS (172.16.0.0/16)

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 5.0.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ============================================
# VPC 생성
# ============================================

# VPC
resource "aws_vpc" "main" {
  cidr_block           = "172.16.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "eks-FANS-VPC"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "eks-FANS-IGW"
    Environment = var.environment
    Project     = var.project_name
  }
}
