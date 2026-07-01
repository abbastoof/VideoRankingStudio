/**
 * Production CDN + DNS wiring. Consumed by the same `terraform apply` cycle
 * as the rest of envs/production/main.tf.
 *
 * Provide `hosted_zone_name` (e.g. "videorankingstudio.com") via tfvars.
 */

module "cdn" {
  source = "../../modules/cdn"

  name              = var.name_prefix
  public_bucket_id  = module.storage.bucket_names["public"]
  public_bucket_arn = module.storage.bucket_arns["public"]
  alb_domain        = aws_lb.alb.dns_name
  acm_cert_arn      = module.dns.certificate_arn
  aliases           = [module.dns.apex_domain, module.dns.www_domain]
}

module "dns" {
  source = "../../modules/dns"

  name             = var.name_prefix
  hosted_zone_name = var.hosted_zone_name
  cdn_domain       = module.cdn.distribution_domain
  cdn_zone_id      = module.cdn.distribution_zone_id
  alb_domain       = aws_lb.alb.dns_name
  alb_zone_id      = aws_lb.alb.zone_id
}

output "cdn_domain"      { value = module.cdn.distribution_domain }
output "cert_arn"        { value = module.dns.certificate_arn }
output "api_domain"      { value = module.dns.api_domain }
output "apex_domain"     { value = module.dns.apex_domain }
