# FANS Terraform Variables

variable "aws_region" {
  description = "AWS Region"
  type        = string
  default     = "ap-northeast-2" # 서울 리전
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "FANS"
}

variable "environment" {
  description = "Environment (dev, staging, production)"
  type        = string
  default     = "production"
}

variable "db_password" {
  description = "RDS PostgreSQL master password"
  type        = string
  sensitive   = true
  default     = "CHANGE_ME_PLEASE_12345!" # 나중에 terraform apply 시 -var로 오버라이드
}
