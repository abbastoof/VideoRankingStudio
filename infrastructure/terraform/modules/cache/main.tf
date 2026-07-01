/**
 * Cache module — ElastiCache Redis 7 cluster (single-node in dev,
 * replicated in prod). Encryption at-rest + in-transit.
 */

terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

variable "name"              { type = string }
variable "subnet_ids"        { type = list(string) }
variable "security_group_id" { type = string }
variable "node_type"         { type = string, default = "cache.t4g.small" }
variable "num_cache_clusters" { type = number, default = 1 }
variable "tags"              { type = map(string), default = {} }

locals {
  common_tags = merge(var.tags, { Project = "vrs", Module = "cache" })
}

resource "aws_elasticache_subnet_group" "this" {
  name       = "${var.name}-redis"
  subnet_ids = var.subnet_ids
  tags       = local.common_tags
}

resource "aws_elasticache_replication_group" "this" {
  replication_group_id       = "${var.name}-redis"
  description                = "VRS Redis for ${var.name}"
  engine                     = "redis"
  engine_version             = "7.1"
  node_type                  = var.node_type
  num_cache_clusters         = var.num_cache_clusters
  port                       = 6379
  parameter_group_name       = "default.redis7"
  subnet_group_name          = aws_elasticache_subnet_group.this.name
  security_group_ids         = [var.security_group_id]
  automatic_failover_enabled = var.num_cache_clusters > 1
  multi_az_enabled           = var.num_cache_clusters > 1
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  apply_immediately          = true
  snapshot_retention_limit   = 7
  tags                       = local.common_tags
}

output "primary_endpoint" { value = aws_elasticache_replication_group.this.primary_endpoint_address }
output "reader_endpoint"  { value = aws_elasticache_replication_group.this.reader_endpoint_address }
output "port"             { value = aws_elasticache_replication_group.this.port }
