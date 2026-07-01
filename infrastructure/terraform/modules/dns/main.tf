/**
 * DNS module — Route53 hosted zone + records + ACM certificate.
 *
 * Creates:
 *   - A public hosted zone (optional; consumer can pass an existing zone_id).
 *   - ACM certificate covering the apex + api + www subdomains, DNS-validated.
 *   - Alias A/AAAA records for the CloudFront distribution.
 *   - Alias A/AAAA records for the ALB (for the api subdomain).
 */

terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

variable "name"                { type = string }
variable "hosted_zone_name"    { type = string }
variable "existing_zone_id"    { type = string, default = "" }
variable "cdn_domain"          { type = string, default = "" }
variable "cdn_zone_id"         { type = string, default = "" }
variable "alb_domain"          { type = string, default = "" }
variable "alb_zone_id"         { type = string, default = "" }
variable "create_apex_record"  { type = bool, default = true }
variable "create_www_record"   { type = bool, default = true }
variable "create_api_record"   { type = bool, default = true }
variable "tags"                { type = map(string), default = {} }

locals {
  common_tags        = merge(var.tags, { Project = "vrs", Module = "dns" })
  use_existing_zone  = var.existing_zone_id != ""
  zone_id            = local.use_existing_zone ? var.existing_zone_id : aws_route53_zone.this[0].zone_id
  apex               = trimsuffix(var.hosted_zone_name, ".")
  api_fqdn           = "api.${local.apex}"
  www_fqdn           = "www.${local.apex}"
  subject_alternative_names = compact([
    var.create_www_record ? local.www_fqdn : "",
    var.create_api_record ? local.api_fqdn : "",
  ])
}

resource "aws_route53_zone" "this" {
  count = local.use_existing_zone ? 0 : 1
  name  = var.hosted_zone_name
  tags  = local.common_tags
}

resource "aws_acm_certificate" "this" {
  domain_name               = local.apex
  subject_alternative_names = local.subject_alternative_names
  validation_method         = "DNS"
  tags                      = local.common_tags
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "acm_validation" {
  for_each = {
    for dvo in aws_acm_certificate.this.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id = local.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 60
  records = [each.value.record]
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "this" {
  certificate_arn         = aws_acm_certificate.this.arn
  validation_record_fqdns = [for r in aws_route53_record.acm_validation : r.fqdn]
}

# ─── Apex + www → CloudFront ────────────────────────────────────────

resource "aws_route53_record" "apex_a" {
  count   = var.create_apex_record && var.cdn_domain != "" ? 1 : 0
  zone_id = local.zone_id
  name    = local.apex
  type    = "A"
  alias {
    name                   = var.cdn_domain
    zone_id                = var.cdn_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "apex_aaaa" {
  count   = var.create_apex_record && var.cdn_domain != "" ? 1 : 0
  zone_id = local.zone_id
  name    = local.apex
  type    = "AAAA"
  alias {
    name                   = var.cdn_domain
    zone_id                = var.cdn_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "www" {
  count   = var.create_www_record && var.cdn_domain != "" ? 1 : 0
  zone_id = local.zone_id
  name    = local.www_fqdn
  type    = "A"
  alias {
    name                   = var.cdn_domain
    zone_id                = var.cdn_zone_id
    evaluate_target_health = false
  }
}

# ─── api → ALB ──────────────────────────────────────────────────────

resource "aws_route53_record" "api" {
  count   = var.create_api_record && var.alb_domain != "" ? 1 : 0
  zone_id = local.zone_id
  name    = local.api_fqdn
  type    = "A"
  alias {
    name                   = var.alb_domain
    zone_id                = var.alb_zone_id
    evaluate_target_health = true
  }
}

output "zone_id"            { value = local.zone_id }
output "certificate_arn"    { value = aws_acm_certificate_validation.this.certificate_arn }
output "apex_domain"        { value = local.apex }
output "api_domain"         { value = local.api_fqdn }
output "www_domain"         { value = local.www_fqdn }
