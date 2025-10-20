# EKS-FANS EKS Cluster
# Kubernetes 클러스터 및 노드 그룹

# ============================================
# IAM Role for EKS Cluster
# ============================================

resource "aws_iam_role" "eks_cluster" {
  name = "eks-FANS-Cluster-Role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "eks.amazonaws.com"
      }
    }]
  })

  tags = {
    Name        = "eks-FANS-Cluster-Role"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_cluster.name
}

# ============================================
# EKS Cluster
# ============================================

resource "aws_eks_cluster" "main" {
  name     = "eks-FANS-Cluster"
  role_arn = aws_iam_role.eks_cluster.arn
  version  = "1.30" # EKS 버전

  vpc_config {
    subnet_ids = [
      aws_subnet.fans_private_a.id,
      aws_subnet.fans_private_b.id,
      aws_subnet.fans_public_a.id,
      aws_subnet.fans_public_b.id
    ]
    endpoint_private_access = true
    endpoint_public_access  = true
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_policy
  ]

  tags = {
    Name        = "eks-FANS-Cluster"
    Environment = var.environment
    Project     = var.project_name
  }
}

# ============================================
# IAM Role for EKS Node Group
# ============================================

resource "aws_iam_role" "eks_nodes" {
  name = "eks-FANS-Node-Role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })

  tags = {
    Name        = "eks-FANS-Node-Role"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_iam_role_policy_attachment" "eks_worker_node_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.eks_nodes.name
}

resource "aws_iam_role_policy_attachment" "eks_cni_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.eks_nodes.name
}

resource "aws_iam_role_policy_attachment" "eks_container_registry_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  role       = aws_iam_role.eks_nodes.name
}

# ============================================
# EKS Node Group
# ============================================

resource "aws_eks_node_group" "main" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "eks-FANS-Node-Group"
  node_role_arn   = aws_iam_role.eks_nodes.arn
  subnet_ids = [
    aws_subnet.fans_private_a.id
  ]

  instance_types = ["t3.large"] # 메모리 여유 확보 (8GB RAM)

  scaling_config {
    desired_size = 1
    max_size     = 2
    min_size     = 1
  }

  update_config {
    max_unavailable = 1
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_worker_node_policy,
    aws_iam_role_policy_attachment.eks_cni_policy,
    aws_iam_role_policy_attachment.eks_container_registry_policy,
  ]

  tags = {
    Name        = "eks-FANS-Node-Group"
    Environment = var.environment
    Project     = var.project_name
  }
}

# ============================================
# OIDC Provider for EKS (Service Account 용)
# ============================================

data "tls_certificate" "eks" {
  url = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

resource "aws_iam_openid_connect_provider" "eks" {
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.eks.certificates[0].sha1_fingerprint]
  url             = aws_eks_cluster.main.identity[0].oidc[0].issuer

  tags = {
    Name        = "eks-FANS-OIDC"
    Environment = var.environment
    Project     = var.project_name
  }
}
