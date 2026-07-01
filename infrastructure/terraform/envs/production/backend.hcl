bucket         = "vrs-terraform-state-prod"
key            = "envs/production/terraform.tfstate"
region         = "us-east-1"
dynamodb_table = "vrs-terraform-locks"
encrypt        = true
