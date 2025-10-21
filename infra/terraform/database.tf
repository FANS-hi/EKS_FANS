# EKS-FANS Database & Cache
# RDS PostgreSQL + ElastiCache Redis
# Owner: EKS Team

# ============================================
# RDS Subnet Group
# ============================================

resource "aws_db_subnet_group" "main" {
  name = "eks-fans-db-subnet-group"
  subnet_ids = [
    aws_subnet.fans_private_a.id,
    aws_subnet.fans_private_b.id
  ]

  tags = {
    Name        = "eks-FANS-DB-Subnet-Group"
    Environment = var.environment
    Project     = var.project_name
  }
}

# ============================================
# RDS PostgreSQL
# ============================================

resource "aws_db_instance" "postgres" {
  identifier     = "eks-fans-postgres"
  engine         = "postgres"
  engine_version = "15.7"
  instance_class = "db.t3.micro" # 프리티어급

  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = "fans_db"
  username = "fans_admin"
  password = var.db_password # variables.tf에서 정의 필요

  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name

  multi_az                = false # 비용 절감 (프로덕션은 true)
  publicly_accessible     = false
  skip_final_snapshot     = true # 테스트용 (프로덕션은 false)
  backup_retention_period = 7

  tags = {
    Name        = "eks-FANS-PostgreSQL"
    Environment = var.environment
    Project     = var.project_name
  }
}

# ============================================
# ElastiCache Subnet Group
# ============================================

resource "aws_elasticache_subnet_group" "main" {
  name = "eks-fans-cache-subnet-group"
  subnet_ids = [
    aws_subnet.fans_private_a.id,
    aws_subnet.fans_private_b.id
  ]

  tags = {
    Name        = "eks-FANS-Cache-Subnet-Group"
    Environment = var.environment
    Project     = var.project_name
  }
}

# ============================================
# ElastiCache Redis
# ============================================

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "eks-fans-redis"
  description          = "eks-FANS Redis Cache"
  engine               = "redis"
  engine_version       = "7.0"
  node_type            = "cache.t3.micro"
  num_cache_clusters   = 1 # 단일 노드 (비용 절감)
  port                 = 6379

  subnet_group_name          = aws_elasticache_subnet_group.main.name
  security_group_ids         = [aws_security_group.elasticache.id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = false # 성능 (프로덕션은 true)

  automatic_failover_enabled = false # 단일 노드는 false

  tags = {
    Name        = "eks-FANS-Redis"
    Environment = var.environment
    Project     = var.project_name
  }
}
