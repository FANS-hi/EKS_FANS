# EKS-FANS Application Load Balancer
# API 트래픽 라우팅
# Owner: EKS Team

# ============================================
# Application Load Balancer
# ============================================

resource "aws_lb" "main" {
  name               = "eks-FANS-ALB"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets = [
    aws_subnet.fans_public_a.id,
    aws_subnet.fans_public_b.id
  ]

  enable_deletion_protection       = false # 테스트용 (프로덕션은 true)
  enable_http2                     = true
  enable_cross_zone_load_balancing = true

  tags = {
    Name        = "eks-FANS-ALB"
    Environment = var.environment
    Project     = var.project_name
  }
}

# ============================================
# Target Groups
# ============================================

# Main API Target Group
resource "aws_lb_target_group" "main_api" {
  name        = "eks-FANS-Main-API-TG"
  port        = 30001  # Kubernetes NodePort (main-api-service)
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "instance" # EKS NodePort용

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }

  deregistration_delay = 30

  tags = {
    Name        = "eks-FANS-Main-API-TG"
    Environment = var.environment
    Project     = var.project_name
    Service     = "Main-API"
  }
}

# Summarize AI Target Group
resource "aws_lb_target_group" "summarize_ai" {
  name        = "eks-FANS-Summarize-AI-TG"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "instance"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }

  deregistration_delay = 30

  tags = {
    Name        = "eks-FANS-Summarize-AI-TG"
    Environment = var.environment
    Project     = var.project_name
    Service     = "Summarize-AI"
  }
}

# Bias AI Target Group
resource "aws_lb_target_group" "bias_ai" {
  name        = "eks-FANS-Bias-AI-TG"
  port        = 8002
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "instance"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }

  deregistration_delay = 30

  tags = {
    Name        = "eks-FANS-Bias-AI-TG"
    Environment = var.environment
    Project     = var.project_name
    Service     = "Bias-AI"
  }
}

# ============================================
# Listeners
# ============================================

# HTTP Listener
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.main_api.arn
  }

  tags = {
    Name        = "eks-FANS-ALB-HTTP-Listener"
    Environment = var.environment
    Project     = var.project_name
  }
}

# HTTPS Listener
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = "arn:aws:acm:ap-northeast-2:907123164281:certificate/7a03c760-faa6-417c-8f85-8a0c686f9839"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.main_api.arn
  }

  tags = {
    Name        = "eks-FANS-ALB-HTTPS-Listener"
    Environment = var.environment
    Project     = var.project_name
  }
}

# ============================================
# Listener Rules (경로 기반 라우팅)
# ============================================

# HTTPS Listener Rules
# Main API: /api/*
resource "aws_lb_listener_rule" "main_api_https" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.main_api.arn
  }

  condition {
    path_pattern {
      values = ["/api/*", "/health"]
    }
  }

  tags = {
    Name        = "eks-FANS-Main-API-HTTPS-Rule"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Summarize AI: /ai/summarize/*
resource "aws_lb_listener_rule" "summarize_ai_https" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 200

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.summarize_ai.arn
  }

  condition {
    path_pattern {
      values = ["/ai/summarize/*"]
    }
  }

  tags = {
    Name        = "eks-FANS-Summarize-AI-HTTPS-Rule"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Bias AI: /ai/bias/*
resource "aws_lb_listener_rule" "bias_ai_https" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 300

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.bias_ai.arn
  }

  condition {
    path_pattern {
      values = ["/ai/bias/*"]
    }
  }

  tags = {
    Name        = "eks-FANS-Bias-AI-HTTPS-Rule"
    Environment = var.environment
    Project     = var.project_name
  }
}

# HTTP Listener Rules (CloudFront에서 HTTP로 접근 시)
# Main API: /api/*
resource "aws_lb_listener_rule" "main_api_http" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.main_api.arn
  }

  condition {
    path_pattern {
      values = ["/api/*", "/health"]
    }
  }

  tags = {
    Name        = "eks-FANS-Main-API-HTTP-Rule"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Summarize AI: /ai/summarize/*
resource "aws_lb_listener_rule" "summarize_ai_http" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 200

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.summarize_ai.arn
  }

  condition {
    path_pattern {
      values = ["/ai/summarize/*"]
    }
  }

  tags = {
    Name        = "eks-FANS-Summarize-AI-HTTP-Rule"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Bias AI: /ai/bias/*
resource "aws_lb_listener_rule" "bias_ai_http" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 300

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.bias_ai.arn
  }

  condition {
    path_pattern {
      values = ["/ai/bias/*"]
    }
  }

  tags = {
    Name        = "eks-FANS-Bias-AI-HTTP-Rule"
    Environment = var.environment
    Project     = var.project_name
  }
}
