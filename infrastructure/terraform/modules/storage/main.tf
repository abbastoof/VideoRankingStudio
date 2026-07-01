/**
 * Storage module — four S3 buckets with per-bucket lifecycle rules.
 *
 *   uploads   — raw user uploads. IA after 30d, delete on account deletion.
 *   generated — AI-generated intermediates. TTL 90d.
 *   exports   — final rendered videos. 30-day expiry on download links.
 *   public    — CDN-served assets. Public read via CloudFront OAC.
 */

terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

variable "name"                { type = string }
variable "public_bucket_domain" { type = string, default = "" }
variable "tags"                { type = map(string), default = {} }

locals {
  common_tags = merge(var.tags, { Project = "vrs", Module = "storage" })
  buckets = {
    uploads   = { public = false, expiration_days = 0,   ia_days = 30 }
    generated = { public = false, expiration_days = 90,  ia_days = 30 }
    exports   = { public = false, expiration_days = 30,  ia_days = 0  }
    public    = { public = true,  expiration_days = 0,   ia_days = 0  }
  }
}

resource "aws_s3_bucket" "this" {
  for_each = local.buckets

  bucket = "${var.name}-${each.key}"
  tags   = merge(local.common_tags, { Bucket = each.key })
}

resource "aws_s3_bucket_versioning" "this" {
  for_each = aws_s3_bucket.this
  bucket   = each.value.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  for_each = aws_s3_bucket.this
  bucket   = each.value.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "private" {
  for_each = { for k, v in local.buckets : k => v if !v.public }

  bucket                  = aws_s3_bucket.this[each.key].id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "public" {
  for_each = { for k, v in local.buckets : k => v if v.public }

  bucket                  = aws_s3_bucket.this[each.key].id
  block_public_acls       = true
  block_public_policy     = false
  ignore_public_acls      = true
  restrict_public_buckets = false
}

resource "aws_s3_bucket_cors_configuration" "uploads" {
  bucket = aws_s3_bucket.this["uploads"].id

  cors_rule {
    allowed_methods = ["GET", "PUT", "POST", "HEAD"]
    allowed_origins = ["*"]
    allowed_headers = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "this" {
  for_each = aws_s3_bucket.this

  bucket = each.value.id

  dynamic "rule" {
    for_each = local.buckets[each.key].ia_days > 0 ? [1] : []
    content {
      id     = "transition-to-ia"
      status = "Enabled"

      transition {
        days          = local.buckets[each.key].ia_days
        storage_class = "STANDARD_IA"
      }
    }
  }

  dynamic "rule" {
    for_each = local.buckets[each.key].expiration_days > 0 ? [1] : []
    content {
      id     = "expire-old-objects"
      status = "Enabled"

      expiration { days = local.buckets[each.key].expiration_days }
      noncurrent_version_expiration { noncurrent_days = 7 }
    }
  }

  rule {
    id     = "abort-incomplete-multipart"
    status = "Enabled"
    abort_incomplete_multipart_upload { days_after_initiation = 3 }
  }
}

output "bucket_names" { value = { for k, b in aws_s3_bucket.this : k => b.id } }
output "bucket_arns"  { value = { for k, b in aws_s3_bucket.this : k => b.arn } }
