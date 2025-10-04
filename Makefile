# DStack Verifier Server - Simplified Makefile
.PHONY: help build dev prod logs shell down clean status health

IMAGE_NAME := dstack-verifier-server
PLATFORM := linux/amd64

help:
	@echo "DStack Verifier Server"
	@echo "====================="
	@echo ""
	@echo "Commands:"
	@echo "  build   - Build Docker image (linux/amd64)"
	@echo "  dev     - Start development environment"
	@echo "  prod    - Start production environment"
	@echo "  logs    - View container logs"
	@echo "  shell   - Open shell in container"
	@echo "  down    - Stop containers"
	@echo "  clean   - Remove containers and volumes"
	@echo "  status  - Show container status"
	@echo "  health  - Check service health"

build:
	@echo "🔨 Building Docker image for $(PLATFORM)..."
	@docker buildx build --platform $(PLATFORM) -t $(IMAGE_NAME):latest --load .
	@echo "✅ Image built: $(IMAGE_NAME):latest"

dev:
	@echo "🚀 Starting development..."
	@docker compose -f compose.dev.yml up -d
	@echo "✅ Running at http://localhost:3000"

prod:
	@echo "🚀 Starting production..."
	@docker compose -f compose.yml up -d
	@echo "✅ Running at http://localhost:3000"

logs:
	@docker compose -f compose.yml logs -f 2>/dev/null || docker compose -f compose.dev.yml logs -f

shell:
	@docker compose -f compose.yml exec server sh 2>/dev/null || docker compose -f compose.dev.yml exec server sh

down:
	@docker compose -f compose.yml down 2>/dev/null || true
	@docker compose -f compose.dev.yml down 2>/dev/null || true

clean:
	@docker compose -f compose.yml down -v 2>/dev/null || true
	@docker compose -f compose.dev.yml down -v 2>/dev/null || true

status:
	@echo "Production:"
	@docker compose -f compose.yml ps 2>/dev/null || echo "  Not running"
	@echo "Development:"
	@docker compose -f compose.dev.yml ps 2>/dev/null || echo "  Not running"

health:
	@curl -sf http://localhost:3000/health && echo "✅ Healthy" || echo "❌ Unhealthy"
