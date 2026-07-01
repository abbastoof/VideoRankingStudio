/**
 * Production environment. Multi-AZ, replicated data tier, deletion protection.
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
      Environment = "production"
      Project     = "vrs"
      ManagedBy   = "terraform"
    }
  }
}

variable "region"           { type = string, default = "us-east-1" }
variable "name_prefix"      { type = string, default = "vrs-prod" }
variable "hosted_zone_name" { type = string }
variable "acm_cert_arn"     { type = string }

locals {
  azs = ["${var.region}a", "${var.region}b", "${var.region}c"]
}

module "network" {
  source = "../../modules/network"

  name       = var.name_prefix
  azs        = local.azs
  single_nat = false
}

module "database" {
  source = "../../modules/database"

  name                  = var.name_prefix
  vpc_id                = module.network.vpc_id
  subnet_ids            = module.network.private_subnet_ids
  security_group_id     = module.network.data_security_group
  min_capacity          = 1
  max_capacity          = 16
  backup_retention_days = 35
  deletion_protection   = true
}

module "cache" {
  source = "../../modules/cache"

  name              = var.name_prefix
  subnet_ids        = module.network.private_subnet_ids
  security_group_id = module.network.data_security_group
  node_type         = "cache.r7g.large"
  num_cache_clusters = 3
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

resource "aws_lb" "alb" {
  name               = "${var.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  subnets            = module.network.public_subnet_ids
  security_groups    = [module.network.alb_security_group]
  idle_timeout       = 120

  drop_invalid_header_fields = true
  enable_deletion_protection = true
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.alb.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_cert_arn

  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      status_code  = "404"
      message_body = "Not found"
    }
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.alb.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

output "vpc_id"           { value = module.network.vpc_id }
output "alb_dns"          { value = aws_lb.alb.dns_name }
output "ecs_cluster_name" { value = aws_ecs_cluster.this.name }
output "bucket_names"     { value = module.storage.bucket_names }
