# DStack Verifier Server - Docker Workflow Makefile
# This Makefile provides commands for managing the DStack Verifier Server
# using Docker Compose for both development and production environments.

.PHONY: help setup dev dev-build dev-logs dev-shell dev-down
.PHONY: prod prod-build prod-logs prod-shell prod-down
.PHONY: deps install

.PHONY: down clean clean-all clean-db logs status health test

# Configuration
DOCKER_COMPOSE := docker compose
DOCKER_COMPOSE_DEV := $(DOCKER_COMPOSE) -f compose.dev.yml
DOCKER_COMPOSE_PROD := $(DOCKER_COMPOSE) -f compose.yml

# Default target
help:
	@echo "DStack Verifier Server - Docker Management Commands"
	@echo "=================================================="
	@echo ""
	@echo "🚀 Quick Start:"
	@echo "  setup        - Complete setup (deps + env + build)"
	@echo "  dev          - Start development environment"
	@echo "  prod         - Start production environment"
	@echo ""
	@echo "🔧 Development:"
	@echo "  dev          - Start development with hot reload + Drizzle Studio"
	@echo "  dev-build    - Build development containers"
	@echo "  dev-logs     - View development logs (follow)"
	@echo "  dev-shell    - Open shell in development server container"
	@echo "  dev-down     - Stop development environment"
	@echo ""
	@echo "🚀 Production:"
	@echo "  prod         - Start production environment"
	@echo "  prod-build   - Build production containers"
	@echo "  prod-logs    - View production logs (follow)"
	@echo "  prod-shell   - Open shell in production server container"
	@echo "  prod-down    - Stop production environment"
	@echo ""
	@echo "📦 Dependencies:"
	@echo "  deps         - Install Bun dependencies"
	@echo "  install      - Install Bun dependencies (alias)"
	@echo ""

	@echo "🧹 Management:"
	@echo "  down         - Stop all containers"
	@echo "  clean        - Remove containers and images"
	@echo "  clean-all    - Remove everything including volumes"
	@echo "  clean-db     - Clear development database volume (⚠️  DESTROYS DEV DATA)"
	@echo "  logs         - View all logs"
	@echo "  status       - Show container status"
	@echo "  health       - Check service health"
	@echo "  test         - Run tests in container"

# Setup commands
setup: deps dev-build
	@echo "✅ DStack Verifier Server setup complete!"
	@echo "Run 'make dev' to start development environment"

# Development environment
dev:
	@echo "🚀 Starting development environment..."
	$(DOCKER_COMPOSE_DEV) up -d
	@echo ""
	@echo "✅ Development environment started!"
	@echo "🌐 Application: http://localhost:3000"
	@echo "📊 Drizzle Studio: http://localhost:4983"
	@echo "📝 Logs: make dev-logs"

dev-build:
	@echo "🔨 Building development containers..."
	$(DOCKER_COMPOSE_DEV) build --no-cache

dev-logs:
	@echo "📝 Viewing development logs..."
	$(DOCKER_COMPOSE_DEV) logs -f

dev-shell:
	@echo "🐚 Opening development shell..."
	$(DOCKER_COMPOSE_DEV) exec server /bin/sh

dev-down:
	@echo "⏹️  Stopping development environment..."
	$(DOCKER_COMPOSE_DEV) down

# Production environment
prod:
	@echo "🚀 Starting production environment..."
	$(DOCKER_COMPOSE_PROD) up -d
	@echo ""
	@echo "✅ Production environment started!"
	@echo "🌐 Application: http://localhost:3000"
	@echo "📝 Logs: make prod-logs"

prod-build:
	@echo "🔨 Building production containers..."
	$(DOCKER_COMPOSE_PROD) build --no-cache

prod-logs:
	@echo "📝 Viewing production logs..."
	$(DOCKER_COMPOSE_PROD) logs -f

prod-shell:
	@echo "🐚 Opening production shell..."
	$(DOCKER_COMPOSE_PROD) exec server /bin/sh

prod-down:
	@echo "⏹️  Stopping production environment..."
	$(DOCKER_COMPOSE_PROD) down

# Dependency management
deps:
	@echo "📦 Installing Bun dependencies in container..."
	$(DOCKER_COMPOSE_DEV) run --rm server bun install
	@echo "✅ Dependencies installed!"

install: deps

# Container management
down:
	@echo "⏹️  Stopping all containers..."
	$(DOCKER_COMPOSE_PROD) down
	$(DOCKER_COMPOSE_DEV) down

clean:
	@echo "🧹 Cleaning up containers and images..."
	$(DOCKER_COMPOSE_PROD) down --remove-orphans
	$(DOCKER_COMPOSE_DEV) down --remove-orphans
	docker system prune -f

clean-all:
	@echo "🧹 Cleaning up everything (including volumes)..."
	$(DOCKER_COMPOSE_PROD) down -v --remove-orphans
	$(DOCKER_COMPOSE_DEV) down -v --remove-orphans
	docker system prune -af --volumes

clean-db:
	@echo "⚠️  WARNING: This will destroy all development database data!"
	@printf "Are you sure you want to clear the dev database volume? Type 'yes' to confirm: "
	@read confirm; \
	if [ "$$confirm" = "yes" ]; then \
		echo "🔄 Stopping development environment..."; \
		$(DOCKER_COMPOSE_DEV) down; \
		echo "🗑️  Removing development database volume..."; \
		docker volume rm dstack-verifier_postgres_data_dev 2>/dev/null || echo "Volume not found or already removed"; \
		echo "⏳ Starting development database service..."; \
		$(DOCKER_COMPOSE_DEV) up -d postgres redis; \
		sleep 10; \
		echo "🚀 Running database migrations in container..."; \
		$(DOCKER_COMPOSE_DEV) exec server bun run db:migrate; \
		echo "🚀 Starting full development environment..."; \
		$(DOCKER_COMPOSE_DEV) up -d; \
		echo "✅ Development database volume cleared and full environment started!"; \
		echo "🌐 Application: http://localhost:3000"; \
		echo "📊 Drizzle Studio: http://localhost:4983"; \
	else \
		echo "❌ Development database cleanup cancelled."; \
	fi

logs:
	@echo "📝 Viewing all service logs..."
	@if [ -n "$$(docker ps -q -f name=dstack-verifier-server)" ]; then \
		$(DOCKER_COMPOSE_PROD) logs -f; \
	elif [ -n "$$(docker ps -q -f name=dstack-verifier-server-dev)" ]; then \
		$(DOCKER_COMPOSE_DEV) logs -f; \
	else \
		echo "❌ No DStack Verifier Server containers running"; \
	fi

status:
	@echo "📊 Container Status"
	@echo "=================="
	@echo "🚀 Production:"
	@$(DOCKER_COMPOSE_PROD) ps || echo "No production containers"
	@echo ""
	@echo "🔧 Development:"
	@$(DOCKER_COMPOSE_DEV) ps || echo "No development containers"

health:
	@echo "🏥 Service Health Check"
	@echo "======================"
	@echo -n "📱 App: "
	@curl -s -f http://localhost:3000/health >/dev/null 2>&1 && echo "✅ Healthy" || echo "❌ Unhealthy"
	@echo -n "🗄️  Database: "
	@docker exec dstack-verifier-postgres pg_isready -U postgres >/dev/null 2>&1 && echo "✅ Healthy" || \
	 docker exec dstack-verifier-postgres-dev pg_isready -U postgres >/dev/null 2>&1 && echo "✅ Healthy" || \
	 echo "❌ Unhealthy"
	@echo -n "📦 Redis: "
	@docker exec dstack-verifier-redis redis-cli --no-auth-warning -a redis_password ping >/dev/null 2>&1 && echo "✅ Healthy" || \
	 docker exec dstack-verifier-redis-dev redis-cli --no-auth-warning -a dev_password ping >/dev/null 2>&1 && echo "✅ Healthy" || \
	 echo "❌ Unhealthy"

test:
	@echo "🧪 Running tests..."
	@if [ -n "$$(docker ps -q -f name=dstack-verifier-server)" ]; then \
		$(DOCKER_COMPOSE_PROD) exec server bun run test; \
	elif [ -n "$$(docker ps -q -f name=dstack-verifier-server-dev)" ]; then \
		$(DOCKER_COMPOSE_DEV) exec server bun run test; \
	else \
		echo "❌ No DStack Verifier Server containers running. Start with 'make dev' or 'make prod'"; \
		exit 1; \
	fi