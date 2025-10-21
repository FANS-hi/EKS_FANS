# EKS-FANS ECR (Elastic Container Registry)
# Docker 이미지 저장소
# Owner: EKS Team

# Main API
resource "aws_ecr_repository" "main_api" {
  name                 = "eks-fans/main-api"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name        = "eks-FANS-ECR-Main-API"
    Environment = var.environment
    Project     = var.project_name
    Service     = "Main-API"
  }
}

# Summarize AI
resource "aws_ecr_repository" "summarize_ai" {
  name                 = "eks-fans/summarize-ai"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name        = "eks-FANS-ECR-Summarize-AI"
    Environment = var.environment
    Project     = var.project_name
    Service     = "Summarize-AI"
  }
}

# Bias Analysis AI
resource "aws_ecr_repository" "bias_ai" {
  name                 = "eks-fans/bias-analysis-ai"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name        = "eks-FANS-ECR-Bias-AI"
    Environment = var.environment
    Project     = var.project_name
    Service     = "Bias-AI"
  }
}

# API Crawler
resource "aws_ecr_repository" "api_crawler" {
  name                 = "eks-fans/api-crawler"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name        = "eks-FANS-ECR-API-Crawler"
    Environment = var.environment
    Project     = var.project_name
    Service     = "API-Crawler"
  }
}

# Puppeteer Crawler
resource "aws_ecr_repository" "puppeteer_crawler" {
  name                 = "eks-fans/puppeteer-crawler"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name        = "eks-FANS-ECR-Puppeteer-Crawler"
    Environment = var.environment
    Project     = var.project_name
    Service     = "Puppeteer-Crawler"
  }
}

# Lifecycle Policy (오래된 이미지 자동 삭제 - 비용 절감)
resource "aws_ecr_lifecycle_policy" "cleanup" {
  for_each = {
    main_api          = aws_ecr_repository.main_api.name
    summarize_ai      = aws_ecr_repository.summarize_ai.name
    bias_ai           = aws_ecr_repository.bias_ai.name
    api_crawler       = aws_ecr_repository.api_crawler.name
    puppeteer_crawler = aws_ecr_repository.puppeteer_crawler.name
  }

  repository = each.value

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 5 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 5
      }
      action = {
        type = "expire"
      }
    }]
  })
}
