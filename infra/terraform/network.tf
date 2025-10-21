# EKS-FANS Network Resources
# Subnets, NAT Gateways, Route Tables

# ============================================
# Subnets (4개)
# ============================================

# Public Subnet A (AZ-2a)
resource "aws_subnet" "fans_public_a" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "172.16.0.0/24"  # 256 IP addresses
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true

  tags = {
    Name        = "eks-FANS-Public-A"
    Environment = var.environment
    Project     = var.project_name
    Type        = "Public"
    AZ          = "${var.aws_region}a"
  }
}

# Public Subnet B (AZ-2c)
resource "aws_subnet" "fans_public_b" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "172.16.1.0/24"  # 256 IP addresses
  availability_zone       = "${var.aws_region}c"
  map_public_ip_on_launch = true

  tags = {
    Name        = "eks-FANS-Public-B"
    Environment = var.environment
    Project     = var.project_name
    Type        = "Public"
    AZ          = "${var.aws_region}c"
  }
}

# Private Subnet A (AZ-2a)
resource "aws_subnet" "fans_private_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "172.16.16.0/20"  # 4,096 IP addresses (EKS Pod IP용)
  availability_zone = "${var.aws_region}a"

  tags = {
    Name        = "eks-FANS-Private-A"
    Environment = var.environment
    Project     = var.project_name
    Type        = "Private"
    AZ          = "${var.aws_region}a"
  }
}

# Private Subnet B (AZ-2c)
resource "aws_subnet" "fans_private_b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "172.16.32.0/20"  # 4,096 IP addresses (EKS Pod IP용)
  availability_zone = "${var.aws_region}c"

  tags = {
    Name        = "eks-FANS-Private-B"
    Environment = var.environment
    Project     = var.project_name
    Type        = "Private"
    AZ          = "${var.aws_region}c"
  }
}

# ============================================
# Elastic IPs for NAT Gateways
# ============================================

resource "aws_eip" "nat_a" {
  domain = "vpc"

  tags = {
    Name        = "eks-FANS-NAT-EIP-A"
    Environment = var.environment
    Project     = var.project_name
    Purpose     = "NAT Gateway A"
  }
}

resource "aws_eip" "nat_b" {
  domain = "vpc"

  tags = {
    Name        = "eks-FANS-NAT-EIP-B"
    Environment = var.environment
    Project     = var.project_name
    Purpose     = "NAT Gateway B"
  }
}

# ============================================
# NAT Gateways (Multi-AZ for High Availability)
# ============================================

resource "aws_nat_gateway" "nat_a" {
  allocation_id = aws_eip.nat_a.id
  subnet_id     = aws_subnet.fans_public_a.id

  tags = {
    Name        = "eks-FANS-NAT-Gateway-A"
    Environment = var.environment
    Project     = var.project_name
    AZ          = "${var.aws_region}a"
  }

  depends_on = [aws_internet_gateway.main]
}

resource "aws_nat_gateway" "nat_b" {
  allocation_id = aws_eip.nat_b.id
  subnet_id     = aws_subnet.fans_public_b.id

  tags = {
    Name        = "eks-FANS-NAT-Gateway-B"
    Environment = var.environment
    Project     = var.project_name
    AZ          = "${var.aws_region}c"
  }

  depends_on = [aws_internet_gateway.main]
}

# ============================================
# Route Tables
# ============================================

# Public Route Table (IGW 연결)
# - Public Subnet A, B에서 사용
# - 인터넷 트래픽을 Internet Gateway로 라우팅
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name        = "eks-FANS-Public-RT"
    Environment = var.environment
    Project     = var.project_name
    Type        = "Public"
  }
}

# Private Route Table A (NAT-A 연결)
# - Private Subnet A에서 사용
# - 아웃바운드 트래픽을 NAT Gateway A로 라우팅
resource "aws_route_table" "private_a" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.nat_a.id
  }

  tags = {
    Name        = "eks-FANS-Private-A-RT"
    Environment = var.environment
    Project     = var.project_name
    Type        = "Private"
    AZ          = "${var.aws_region}a"
  }
}

# Private Route Table B (NAT-B 연결)
# - Private Subnet B에서 사용
# - 아웃바운드 트래픽을 NAT Gateway B로 라우팅
resource "aws_route_table" "private_b" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.nat_b.id
  }

  tags = {
    Name        = "eks-FANS-Private-B-RT"
    Environment = var.environment
    Project     = var.project_name
    Type        = "Private"
    AZ          = "${var.aws_region}c"
  }
}

# ============================================
# Route Table Associations
# ============================================

resource "aws_route_table_association" "public_a" {
  subnet_id      = aws_subnet.fans_public_a.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_b" {
  subnet_id      = aws_subnet.fans_public_b.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private_a" {
  subnet_id      = aws_subnet.fans_private_a.id
  route_table_id = aws_route_table.private_a.id
}

resource "aws_route_table_association" "private_b" {
  subnet_id      = aws_subnet.fans_private_b.id
  route_table_id = aws_route_table.private_b.id
}
