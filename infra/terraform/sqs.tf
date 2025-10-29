# SQS 큐 - AI 작업 처리용
# 크롤러에서 AI 요청을 큐에 넣고, Worker가 순차 처리

# AI 요약 큐
resource "aws_sqs_queue" "fans_ai_summarize" {
  name                       = "fans-ai-summarize-queue"
  delay_seconds              = 0
  max_message_size           = 262144  # 256KB
  message_retention_seconds  = 86400   # 24시간
  visibility_timeout_seconds = 60      # 처리 타임아웃 60초
  receive_wait_time_seconds  = 20      # Long Polling

  # 재시도 정책 - 3번 실패 시 DLQ로 이동
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.fans_ai_summarize_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name        = "fans-ai-summarize-queue"
    Project     = "FANS"
    Environment = "production"
  }
}

# AI 요약 Dead Letter Queue (실패한 작업)
resource "aws_sqs_queue" "fans_ai_summarize_dlq" {
  name                       = "fans-ai-summarize-dlq"
  message_retention_seconds  = 1209600  # 14일

  tags = {
    Name        = "fans-ai-summarize-dlq"
    Project     = "FANS"
    Environment = "production"
  }
}

# AI 편향 분석 큐
resource "aws_sqs_queue" "fans_ai_bias" {
  name                       = "fans-ai-bias-queue"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 86400
  visibility_timeout_seconds = 60
  receive_wait_time_seconds  = 20

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.fans_ai_bias_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name        = "fans-ai-bias-queue"
    Project     = "FANS"
    Environment = "production"
  }
}

# AI 편향 분석 Dead Letter Queue
resource "aws_sqs_queue" "fans_ai_bias_dlq" {
  name                       = "fans-ai-bias-dlq"
  message_retention_seconds  = 1209600

  tags = {
    Name        = "fans-ai-bias-dlq"
    Project     = "FANS"
    Environment = "production"
  }
}

# IAM 정책 - EKS Pod가 SQS 사용 가능하도록
resource "aws_iam_policy" "sqs_access" {
  name        = "fans-sqs-access-policy"
  description = "Allow FANS services to access SQS queues"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:GetQueueUrl"
        ]
        Resource = [
          aws_sqs_queue.fans_ai_summarize.arn,
          aws_sqs_queue.fans_ai_summarize_dlq.arn,
          aws_sqs_queue.fans_ai_bias.arn,
          aws_sqs_queue.fans_ai_bias_dlq.arn
        ]
      }
    ]
  })

  tags = {
    Name    = "fans-sqs-access-policy"
    Project = "FANS"
  }
}

# EKS 노드 Role에 정책 연결
resource "aws_iam_role_policy_attachment" "eks_node_sqs_access" {
  policy_arn = aws_iam_policy.sqs_access.arn
  role       = aws_iam_role.eks_node_role.name
}

# Outputs - 다른 서비스에서 참조
output "sqs_summarize_queue_url" {
  description = "AI Summarize Queue URL"
  value       = aws_sqs_queue.fans_ai_summarize.url
}

output "sqs_bias_queue_url" {
  description = "AI Bias Analysis Queue URL"
  value       = aws_sqs_queue.fans_ai_bias.url
}

output "sqs_summarize_queue_arn" {
  value = aws_sqs_queue.fans_ai_summarize.arn
}

output "sqs_bias_queue_arn" {
  value = aws_sqs_queue.fans_ai_bias.arn
}
