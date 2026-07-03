/**
 * CDN module — CloudFront in front of the public S3 bucket + the ALB.
 *
 * Two origins:
 *   - `s3` — the vrs-public bucket, private, accessed via Origin Access Control.
 *   - `alb` — the application load balancer for the API + web app.
 *
 * Two cache behaviors keyed off path pattern:
 *   - `/assets/*` → S3 with a long TTL
 *   - everything else → ALB with a short TTL, cookies + auth headers forwarded.
 */

terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

variable "name"              { type = string }
variable "public_bucket_id"  { type = string }
variable "public_bucket_arn" { type = string }
variable "alb_domain"        { type = string }
variable "acm_cert_arn"      { type = string, default = "" }
variable "aliases"           { type = list(string), default = [] }
variable "tags"              { type = map(string), default = {} }

locals {
  common_tags = merge(var.tags, { Project = "vrs", Module = "cdn" })
  use_default_cert = var.acm_cert_arn == ""
}

resource "aws_cloudfront_origin_access_control" "s3" {
  name                              = "${var.name}-s3-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "this" {
  enabled             = true
  is_ipv6_enabled     = true
  price_class         = "PriceClass_100"
  comment             = "${var.name} CDN"
  default_root_object = ""
  aliases             = var.aliases
  tags                = local.common_tags

  origin {
    origin_id                = "s3-public"
    domain_name              = "${var.public_bucket_id}.s3.amazonaws.com"
    origin_access_control_id = aws_cloudfront_origin_access_control.s3.id
    s3_origin_config {
      origin_access_identity = ""
    }
  }

  origin {
    origin_id   = "alb-app"
    domain_name = var.alb_domain
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
      origin_read_timeout    = 60
      origin_keepalive_timeout = 30
    }
  }

  default_cache_behavior {
    target_origin_id       = "alb-app"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Origin", "Referer", "Host", "CloudFront-Forwarded-Proto"]
      cookies { forward = "all" }
    }
    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 0
  }

  ordered_cache_behavior {
    path_pattern           = "/assets/*"
    target_origin_id       = "s3-public"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
    min_ttl     = 3600
    default_ttl = 86400
    max_ttl     = 31536000
  }

  ordered_cache_behavior {
    path_pattern           = "/_next/static/*"
    target_origin_id       = "alb-app"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
    min_ttl     = 3600
    default_ttl = 86400
    max_ttl     = 31536000
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
      locations        = []
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = local.use_default_cert
    acm_certificate_arn            = local.use_default_cert ? null : var.acm_cert_arn
    ssl_support_method             = local.use_default_cert ? null : "sni-only"
    minimum_protocol_version       = local.use_default_cert ? "TLSv1" : "TLSv1.2_2021"
  }

  # Access logging is off by default. Attach a logs bucket via a stack
  # override in envs/production if desired — an empty `bucket = ""` here
  # fails CloudFront's API validation ("bucket must be a fully qualified
  # S3 bucket domain") on create, so the block is omitted entirely.
}

# ─── S3 bucket policy allowing only the CloudFront distribution to read ──

resource "aws_s3_bucket_policy" "public" {
  bucket = var.public_bucket_id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowCloudFrontServicePrincipal"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = ["s3:GetObject"]
      Resource  = "${var.public_bucket_arn}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.this.arn
        }
      }
    }]
  })
}

output "distribution_id"       { value = aws_cloudfront_distribution.this.id }
output "distribution_domain"   { value = aws_cloudfront_distribution.this.domain_name }
output "distribution_arn"      { value = aws_cloudfront_distribution.this.arn }
output "distribution_zone_id"  { value = aws_cloudfront_distribution.this.hosted_zone_id }
