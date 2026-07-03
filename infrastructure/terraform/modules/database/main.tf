/**
 * Database module — Aurora Serverless v2 (Postgres 15).
 *
 * Serverless v2 auto-scales between min/max ACUs on demand; we tune the
 * ceiling per env. Backups + performance insights are always on in prod.
 */

terraform {
  required_version = ">= 1.6"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 5.0" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
}

variable "name"                { type = string }
variable "vpc_id"              { type = string }
variable "subnet_ids"          { type = list(string) }
variable "security_group_id"   { type = string }
variable "db_name"             { type = string, default = "vrs" }
variable "master_username"     { type = string, default = "vrs_admin" }
variable "min_capacity"        { type = number, default = 0.5 }
variable "max_capacity"        { type = number, default = 4 }
variable "backup_retention_days" { type = number, default = 7 }
variable "deletion_protection" { type = bool, default = true }
variable "tags"                { type = map(string), default = {} }

locals {
  common_tags = merge(var.tags, { Project = "vrs", Module = "database" })
}

resource "random_password" "master" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "db" {
  name = "${var.name}/db-master"
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id = aws_secretsmanager_secret.db.id
  secret_string = jsonencode({
    username = var.master_username
    password = random_password.master.result
    dbname   = var.db_name
  })
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.name}-db"
  subnet_ids = var.subnet_ids
  tags       = local.common_tags
}

resource "aws_rds_cluster_parameter_group" "this" {
  name        = "${var.name}-pg15"
  family      = "aurora-postgresql15"
  description = "Custom cluster params for ${var.name}"

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }
  parameter {
    name  = "pg_stat_statements.track"
    value = "ALL"
  }
  tags = local.common_tags
}

resource "aws_rds_cluster" "this" {
  cluster_identifier              = "${var.name}-postgres"
  engine                          = "aurora-postgresql"
  engine_version                  = "15.4"
  engine_mode                     = "provisioned"
  database_name                   = var.db_name
  master_username                 = var.master_username
  master_password                 = random_password.master.result
  db_subnet_group_name            = aws_db_subnet_group.this.name
  vpc_security_group_ids          = [var.security_group_id]
  db_cluster_parameter_group_name = aws_rds_cluster_parameter_group.this.name
  storage_encrypted               = true
  backup_retention_period         = var.backup_retention_days
  preferred_backup_window         = "03:00-04:00"
  copy_tags_to_snapshot           = true
  deletion_protection             = var.deletion_protection
  skip_final_snapshot             = false
  final_snapshot_identifier       = "${var.name}-final-${formatdate("YYYYMMDDhhmm", timestamp())}"

  serverlessv2_scaling_configuration {
    min_capacity = var.min_capacity
    max_capacity = var.max_capacity
  }

  enabled_cloudwatch_logs_exports = ["postgresql"]
  tags                            = local.common_tags

  lifecycle {
    ignore_changes = [final_snapshot_identifier, master_password]
  }
}

resource "aws_iam_role" "rds_monitoring" {
  name = "${var.name}-rds-monitoring"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "monitoring.rds.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

resource "aws_rds_cluster_instance" "writer" {
  identifier         = "${var.name}-writer"
  cluster_identifier = aws_rds_cluster.this.id
  instance_class     = "db.serverless"
  engine             = aws_rds_cluster.this.engine
  engine_version     = aws_rds_cluster.this.engine_version

  performance_insights_enabled = true
  # RDS enhanced monitoring at any non-zero interval requires an IAM role
  # with the AWS-managed AmazonRDSEnhancedMonitoringRole policy. Setting
  # monitoring_interval without supplying monitoring_role_arn fails apply
  # with InvalidParameterCombination — the observed dev-deploy blocker.
  monitoring_interval = 30
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn
  tags                = local.common_tags
}

output "endpoint"          { value = aws_rds_cluster.this.endpoint }
output "reader_endpoint"   { value = aws_rds_cluster.this.reader_endpoint }
output "port"              { value = aws_rds_cluster.this.port }
output "secret_arn"        { value = aws_secretsmanager_secret.db.arn }
output "database_name"     { value = var.db_name }
