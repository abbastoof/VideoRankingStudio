.PHONY: help install dev build lint test typecheck clean infra-up infra-down infra-reset db-migrate db-seed db-studio docker-build docker-push

SHELL := /bin/bash

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-25s\033[0m %s\n", $$1, $$2}'

install: ## Install all dependencies (Node + Python)
	pnpm install
	cd apps/workers && uv sync || pip install -e .

dev: ## Run all apps in development mode
	pnpm dev

build: ## Build all apps and packages
	pnpm build

lint: ## Lint all packages
	pnpm lint

lint-fix: ## Lint and auto-fix issues
	pnpm lint:fix

test: ## Run all unit + integration tests
	pnpm test

test-e2e: ## Run end-to-end tests (Playwright)
	pnpm test:e2e

typecheck: ## Run TypeScript type checking
	pnpm typecheck

format: ## Format all files with Prettier
	pnpm format

clean: ## Remove all build artifacts and dependencies
	pnpm clean
	find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
	find . -name ".pytest_cache" -type d -exec rm -rf {} + 2>/dev/null || true

infra-up: ## Start local infrastructure (postgres, redis, minio, rabbitmq, mailhog)
	docker compose up -d

infra-down: ## Stop local infrastructure (preserve data)
	docker compose down

infra-reset: ## Stop infrastructure AND wipe all volumes
	docker compose down -v
	docker compose up -d

infra-logs: ## Tail logs from all infrastructure services
	docker compose logs -f

db-migrate: ## Run Prisma migrations in dev mode
	pnpm db:migrate

db-migrate-deploy: ## Apply pending migrations to a deployed environment
	pnpm db:migrate:deploy

db-seed: ## Seed the database with development data
	pnpm db:seed

db-studio: ## Open Prisma Studio
	pnpm db:studio

db-reset: ## Drop, recreate, and reseed the database
	pnpm db:reset

docker-build: ## Build all production Docker images
	docker build -t vrs-api:latest -f infrastructure/docker/api.Dockerfile .
	docker build -t vrs-web:latest -f infrastructure/docker/web.Dockerfile .
	docker build -t vrs-workers:latest -f infrastructure/docker/workers.Dockerfile .

setup: ## First-time setup: install deps, start infra, migrate, seed
	cp -n .env.example .env || true
	$(MAKE) install
	$(MAKE) infra-up
	@echo "Waiting for postgres to be ready..."
	@sleep 5
	$(MAKE) db-migrate
	$(MAKE) db-seed
	@echo ""
	@echo "✅ Setup complete. Run 'make dev' to start the application."
