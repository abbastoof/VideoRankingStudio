bucket         = "vrs-terraform-state-dev"
key            = "envs/dev/terraform.tfstate"
region         = "us-east-1"
dynamodb_table = "vrs-terraform-locks"
encrypt        = true
