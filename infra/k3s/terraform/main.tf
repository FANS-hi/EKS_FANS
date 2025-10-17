terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# VPC 조회 (dongwon VPC 사용)
data "aws_vpc" "selected" {
  id = "vpc-0fa60f4833b7932ad"
}

# 서브넷 조회 (ap-northeast-2a)
data "aws_subnet" "selected" {
  id = "subnet-06fb42d0c77f415ff"
}

# 최신 Ubuntu 22.04 AMI 조회
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# 보안그룹
resource "aws_security_group" "k3s" {
  name        = "k3s-fans-sg"
  description = "Security group for K3s FANS cluster"
  vpc_id      = data.aws_vpc.selected.id

  # SSH
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "SSH access"
  }

  # HTTP
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP"
  }

  # HTTPS
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS"
  }

  # K3s API (kubectl 원격 접속용)
  ingress {
    from_port   = 6443
    to_port     = 6443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "K3s API server"
  }

  # 아웃바운드 모두 허용
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  tags = {
    Name        = "k3s-fans-sg"
    Environment = var.environment
    Project     = "FANS"
  }
}

# K3s 설치 스크립트 (templatefile 함수 사용)
locals {
  user_data = templatefile("${path.module}/user-data.sh", {
    docker_username = var.docker_username
  })
}

# Spot Instance Request
resource "aws_spot_instance_request" "k3s" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = data.aws_subnet.selected.id
  vpc_security_group_ids = [aws_security_group.k3s.id]
  key_name               = var.key_name

  # Spot 설정
  spot_type            = "persistent"
  wait_for_fulfillment = true
  spot_price           = var.spot_max_price

  # 루트 볼륨 (스토리지)
  root_block_device {
    volume_size           = var.root_volume_size
    volume_type           = "gp3"
    delete_on_termination = true
  }

  # User data (K3s 설치)
  user_data = local.user_data

  tags = {
    Name        = "k3s-fans-spot"
    Environment = var.environment
    Project     = "FANS"
    ManagedBy   = "Terraform"
  }
}

# Spot 인스턴스에 태그 추가 (spot request와 별개)
resource "aws_ec2_tag" "k3s_instance" {
  resource_id = aws_spot_instance_request.k3s.spot_instance_id
  key         = "Name"
  value       = "k3s-fans-node"
}

# Elastic IP
resource "aws_eip" "k3s" {
  domain = "vpc"

  tags = {
    Name        = "k3s-fans-eip"
    Environment = var.environment
    Project     = "FANS"
  }
}

# EIP를 Spot 인스턴스에 연결
resource "aws_eip_association" "k3s" {
  instance_id   = aws_spot_instance_request.k3s.spot_instance_id
  allocation_id = aws_eip.k3s.id

  depends_on = [aws_spot_instance_request.k3s]
}
