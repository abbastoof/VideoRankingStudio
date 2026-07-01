/**
 * Dev environment. Small footprint, single-AZ where possible, delete-safe.
 */

terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
  backend "s3" {}
}

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Environment = "dev"
      Project     = "vrs"
      ManagedBy   = "terraform"
    }
  }
}

variable "region"           { type = string, default = "us-east-1" }
variable "name_prefix"      { type = string, default = "vrs-dev" }
variable "hosted_zone_name" { type = string, default = "" }

locals {
  azs = ["${var.region}a", "${var.region}b"]
}

module "network" {
  source = "../../modules/network"

  name       = var.name_prefix
  azs        = local.azs
  single_nat = true
}

module "database" {
  source = "../../modules/database"

  name                = var.name_prefix
  vpc_id              = module.network.vpc_id
  subnet_ids          = module.network.private_subnet_ids
  security_group_id   = module.network.data_security_group
  min_capacity        = 0.5
  max_capacity        = 2
  deletion_protection = false
}

module "cache" {
  source = "../../modules/cache"

  name              = var.name_prefix
  subnet_ids        = module.network.private_subnet_ids
  security_group_id = module.network.data_security_group
  node_type         = "cache.t4g.small"
  num_cache_clusters = 1
}

module "storage" {
  source = "../../modules/storage"
  name   = var.name_prefix
}

resource "aws_ecs_cluster" "this" {
  name = var.name_prefix

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

output "vpc_id"           { value = module.network.vpc_id }
output "db_endpoint"      { value = module.database.endpoint, sensitive = true }
output "redis_endpoint"   { value = module.cache.primary_endpoint }
output "bucket_names"     { value = module.storage.bucket_names }
output "ecs_cluster_name" { value = aws_ecs_cluster.this.name }
