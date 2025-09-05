# DStack Verifier Server - Docker Workflow Makefile
# This Makefile provides commands for managing the DStack Verifier Server
# using Docker Compose for both development and production environments.

.PHONY: help setup dev prod build buildx logs shell down deps install clean clean-all clean-db status health test

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
	@echo "🔧 Commands:"
	@echo "  build        - Build containers using docker compose (platform from compose files)"
	@echo "  buildx       - Build containers using docker buildx for linux/amd64 platform"
	@echo "  logs         - View logs (auto-detect environment)"
	@echo "  shell        - Open shell (auto-detect environment)"
	@echo "  down         - Stop all containers"
	@echo ""
	@echo "📦 Dependencies:"
	@echo "  deps         - Install Bun dependencies"
	@echo "  install      - Install Bun dependencies (alias)"
	@echo ""
	@echo "🧹 Management:"
	@echo "  clean        - Remove containers and images"
	@echo "  clean-all    - Remove everything including volumes"
	@echo "  clean-db     - Clear development database volume (⚠️  DESTROYS DEV DATA)"
	@echo "  status       - Show container status"
	@echo "  health       - Check service health"
	@echo "  test         - Run tests in container"

# Setup commands
setup: deps build
	@echo "✅ DStack Verifier Server setup complete!"
	@echo "Run 'make dev' to start development environment"

# Environment commands
dev:
	@echo "🚀 Starting development environment..."
	$(DOCKER_COMPOSE_DEV) up -d
	@echo ""
	@echo "✅ Development environment started!"
	@echo "🌐 Application: http://localhost:3000"
	@echo "📝 Logs: make logs"

prod:
	@echo "🚀 Starting production environment..."
	$(DOCKER_COMPOSE_PROD) up -d
	@echo ""
	@echo "✅ Production environment started!"
	@echo "🌐 Application: http://localhost:3000"
	@echo "📝 Logs: make logs"

# Generic commands (work with both dev and prod)
build:
	@echo "🔨 Building containers with buildx for linux/amd64 platform..."
	@if [ -n "$$(docker ps -q -f name=dstack-verifier-server)" ]; then \
		$(DOCKER_COMPOSE_PROD) build; \
	elif [ -n "$$(docker ps -q -f name=dstack-verifier-server-dev)" ]; then \
		$(DOCKER_COMPOSE_DEV) build; \
	else \
		echo "❌ No containers running. Use 'make dev' or 'make prod' first"; \
		exit 1; \
	fi

buildx:
	@echo "🔨 Building containers with docker buildx for linux/amd64 platform..."
	@echo "Building for production environment..."
	docker buildx build --platform linux/amd64 -f Dockerfile -t dstack-verifier-server .
	@echo "Building for development environment..."
	docker buildx build --platform linux/amd64 -f Dockerfile -t dstack-verifier-server-dev .
	@echo "✅ Build completed for both environments!"

logs:
	@echo "📝 Viewing logs..."
	@if [ -n "$$(docker ps -q -f name=dstack-verifier-server)" ]; then \
		$(DOCKER_COMPOSE_PROD) logs -f; \
	elif [ -n "$$(docker ps -q -f name=dstack-verifier-server-dev)" ]; then \
		$(DOCKER_COMPOSE_DEV) logs -f; \
	else \
		echo "❌ No DStack Verifier Server containers running"; \
	fi

shell:
	@echo "🐚 Opening shell..."
	@if [ -n "$$(docker ps -q -f name=dstack-verifier-server)" ]; then \
		$(DOCKER_COMPOSE_PROD) exec server /bin/sh; \
	elif [ -n "$$(docker ps -q -f name=dstack-verifier-server-dev)" ]; then \
		$(DOCKER_COMPOSE_DEV) exec server /bin/sh; \
	else \
		echo "❌ No DStack Verifier Server containers running"; \
		exit 1; \
	fi

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
	else \
		echo "❌ Development database cleanup cancelled."; \
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
	@(docker exec dstack-verifier-postgres pg_isready -U postgres >/dev/null 2>&1 || \
	  docker exec dstack-verifier-postgres-dev pg_isready -U postgres >/dev/null 2>&1) && echo "✅ Healthy" || echo "❌ Unhealthy"
	@echo -n "📦 Redis: "
	@(docker exec dstack-verifier-redis redis-cli --no-auth-warning -a redis_password ping >/dev/null 2>&1 || \
	  docker exec dstack-verifier-redis-dev redis-cli --no-auth-warning -a dev_password ping >/dev/null 2>&1) && echo "✅ Healthy" || echo "❌ Unhealthy"

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