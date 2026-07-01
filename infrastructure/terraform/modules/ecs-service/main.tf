/**
 * Generic ECS Fargate service. One task family, one target group, one
 * autoscaling policy. Environments call this three times: api / web / workers.
 */

terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

variable "name"                { type = string }
variable "cluster_id"          { type = string }
variable "image"               { type = string }
variable "container_port"      { type = number }
variable "cpu"                 { type = number, default = 512 }
variable "memory"              { type = number, default = 1024 }
variable "desired_count"       { type = number, default = 2 }
variable "min_capacity"        { type = number, default = 2 }
variable "max_capacity"        { type = number, default = 10 }
variable "subnet_ids"          { type = list(string) }
variable "security_group_ids"  { type = list(string) }
variable "target_group_arn"    { type = string, default = "" }
variable "environment"         { type = map(string), default = {} }
variable "secret_arns"         { type = map(string), default = {} }
variable "command"             { type = list(string), default = [] }
variable "health_check_path"   { type = string, default = "/health" }
variable "task_role_arn"       { type = string }
variable "execution_role_arn"  { type = string }
variable "log_retention_days"  { type = number, default = 30 }
variable "tags"                { type = map(string), default = {} }

locals {
  common_tags = merge(var.tags, { Project = "vrs", Service = var.name })
}

resource "aws_cloudwatch_log_group" "this" {
  name              = "/vrs/${var.name}"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_ecs_task_definition" "this" {
  family                   = var.name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  task_role_arn            = var.task_role_arn
  execution_role_arn       = var.execution_role_arn

  container_definitions = jsonencode([{
    name         = var.name
    image        = var.image
    essential    = true
    command      = length(var.command) > 0 ? var.command : null
    portMappings = var.container_port > 0 ? [{ containerPort = var.container_port, protocol = "tcp" }] : []
    environment  = [for k, v in var.environment : { name = k, value = v }]
    secrets      = [for k, arn in var.secret_arns : { name = k, valueFrom = arn }]
    healthCheck = var.container_port > 0 ? {
      command     = ["CMD-SHELL", "curl -fsS http://127.0.0.1:${var.container_port}${var.health_check_path} || exit 1"]
      interval    = 15
      timeout     = 5
      retries     = 3
      startPeriod = 30
    } : null
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.this.name
        awslogs-region        = data.aws_region.current.name
        awslogs-stream-prefix = "ecs"
      }
    }
    stopTimeout = 30
  }])

  tags = local.common_tags
}

data "aws_region" "current" {}

resource "aws_ecs_service" "this" {
  name             = var.name
  cluster          = var.cluster_id
  task_definition  = aws_ecs_task_definition.this.arn
  desired_count    = var.desired_count
  launch_type      = "FARGATE"
  platform_version = "1.4.0"
  propagate_tags   = "SERVICE"

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = var.security_group_ids
    assign_public_ip = false
  }

  dynamic "load_balancer" {
    for_each = var.target_group_arn != "" ? [1] : []
    content {
      target_group_arn = var.target_group_arn
      container_name   = var.name
      container_port   = var.container_port
    }
  }

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  enable_execute_command             = true
  wait_for_steady_state              = false

  lifecycle {
    ignore_changes = [desired_count, task_definition]
  }

  tags = local.common_tags
}

resource "aws_appautoscaling_target" "this" {
  service_namespace  = "ecs"
  resource_id        = "service/${var.cluster_id}/${aws_ecs_service.this.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  min_capacity       = var.min_capacity
  max_capacity       = var.max_capacity
}

resource "aws_appautoscaling_policy" "cpu" {
  name               = "${var.name}-cpu"
  policy_type        = "TargetTrackingScaling"
  service_namespace  = aws_appautoscaling_target.this.service_namespace
  resource_id        = aws_appautoscaling_target.this.resource_id
  scalable_dimension = aws_appautoscaling_target.this.scalable_dimension

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 60.0
    scale_in_cooldown  = 120
    scale_out_cooldown = 60
  }
}

output "service_name" { value = aws_ecs_service.this.name }
output "task_family"  { value = aws_ecs_task_definition.this.family }
