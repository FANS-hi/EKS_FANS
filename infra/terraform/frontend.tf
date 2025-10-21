# EKS-FANS Frontend Infrastructure
# S3 (React 빌드 파일) + CloudFront (CDN)
# Owner: EKS Team

# ============================================
# S3 Bucket for React Build Files
# ============================================

resource "aws_s3_bucket" "frontend" {
  bucket = "eks-fans-frontend-${var.environment}"

  tags = {
    Name        = "eks-FANS-Frontend-Bucket"
    Environment = var.environment
    Project     = var.project_name
    Purpose     = "React Build Files"
  }
}

# S3 Bucket Public Access Block (보안)
resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 Bucket Versioning (롤백 가능)
resource "aws_s3_bucket_versioning" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  versioning_configuration {
    status = "Enabled"
  }
}

# S3 Bucket Website Configuration
resource "aws_s3_bucket_website_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html" # React Router용
  }
}

# ============================================
# CloudFront Origin Access Identity
# ============================================

resource "aws_cloudfront_origin_access_identity" "frontend" {
  comment = "eks-FANS Frontend OAI"
}

# S3 Bucket Policy (CloudFront만 접근 허용)
resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontAccess"
        Effect = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.frontend.iam_arn
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend.arn}/*"
      }
    ]
  })
}

# ============================================
# CloudFront Distribution
# ============================================

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "eks-FANS Frontend Distribution"
  default_root_object = "index.html"
  price_class         = "PriceClass_200" # 아시아, 북미, 유럽
  aliases             = ["www.fans.ai.kr"]

  # S3 Origin (프론트엔드)
  origin {
    domain_name = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id   = "S3-eks-fans-frontend"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.frontend.cloudfront_access_identity_path
    }
  }

  # ALB Origin (백엔드 API)
  origin {
    domain_name = aws_lb.main.dns_name
    origin_id   = "ALB-Main-API"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # API Cache Behavior (/api/* -> ALB)
  ordered_cache_behavior {
    path_pattern     = "/api/*"
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "ALB-Main-API"

    forwarded_values {
      query_string = true
      headers      = ["Origin", "Authorization", "Accept", "Content-Type"]
      cookies {
        forward = "all"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0 # API는 캐시 안 함
    max_ttl                = 0
    compress               = true
  }

  # Default Cache Behavior (프론트엔드)
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-eks-fans-frontend"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600  # 1시간
    max_ttl                = 86400 # 24시간
    compress               = true
  }

  # Custom Error Response (React Router용)
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  # Geo Restriction (선택사항)
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # Viewer Certificate (커스텀 도메인용 ACM 인증서)
  viewer_certificate {
    acm_certificate_arn      = "arn:aws:acm:us-east-1:907123164281:certificate/25f9eea8-706a-4f28-88c6-ebe4e936b293"
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = {
    Name        = "eks-FANS-CloudFront"
    Environment = var.environment
    Project     = var.project_name
    Purpose     = "Frontend CDN"
  }
}
