output "instance_id" {
  description = "Spot instance ID"
  value       = aws_spot_instance_request.k3s.spot_instance_id
}

output "instance_private_ip" {
  description = "Private IP address"
  value       = aws_spot_instance_request.k3s.private_ip
}

output "instance_public_ip" {
  description = "Elastic IP address"
  value       = aws_eip.k3s.public_ip
}

output "security_group_id" {
  description = "Security group ID"
  value       = aws_security_group.k3s.id
}

output "ssh_command" {
  description = "SSH connection command"
  value       = "ssh -i ~/.ssh/${var.key_name}.pem ubuntu@${aws_eip.k3s.public_ip}"
}

output "k3s_api_endpoint" {
  description = "K3s API server endpoint"
  value       = "https://${aws_eip.k3s.public_ip}:6443"
}

output "kubeconfig_command" {
  description = "Command to get kubeconfig"
  value       = "ssh -i ~/.ssh/${var.key_name}.pem ubuntu@${aws_eip.k3s.public_ip} 'sudo cat /etc/rancher/k3s/k3s.yaml'"
}
