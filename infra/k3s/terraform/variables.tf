variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-northeast-2"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.xlarge"
}

variable "spot_max_price" {
  description = "Maximum Spot price per hour (leave empty for on-demand price)"
  type        = string
  default     = "" # 빈 값이면 on-demand 가격의 최대값 사용
}

variable "root_volume_size" {
  description = "Root volume size in GB"
  type        = number
  default     = 50
}

variable "key_name" {
  description = "SSH key pair name"
  type        = string
  # 실제 사용할 키 이름으로 변경 필요
}

variable "docker_username" {
  description = "Docker Hub username"
  type        = string
  default     = "hodduk"
}
