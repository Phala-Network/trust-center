# DStack Verifier Server

A high-performance TEE attestation verification server built with **Bun**, **Elysia.js**, and **PostgreSQL**.

## 🚀 Quick Start

```bash
# Development
make dev

# Production
make prod

# View logs
make dev-logs
```

## 🏗️ Architecture

### Core Stack

- **Runtime**: Bun (high-performance JavaScript runtime)
- **Framework**: Elysia.js (fast, type-safe web framework)
- **Database**: PostgreSQL with Drizzle ORM
- **Queue**: BullMQ with Redis
- **Storage**: S3-compatible storage (R2/S3)
- **UI**: Drizzle Gateway for database management

### Service Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Server    │    │  Queue Worker   │    │  Verification   │
│    (Elysia)     │────│    (BullMQ)     │────│    Service      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │      Redis      │    │   S3 Storage    │
│  (Task Data)    │    │   (Job Queue)   │    │   (Results)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📋 API Endpoints

### Health & Status

- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed service status

### Task Management

- `POST /api/v1/tasks` - Create verification task
- `GET /api/v1/tasks/:id` - Get task status
- `GET /api/v1/tasks` - List tasks with filtering
- `DELETE /api/v1/tasks/:id` - Cancel task

### Queue Management

- `GET /api/v1/queue/status` - Queue statistics
- `POST /api/v1/queue/pause` - Pause processing
- `POST /api/v1/queue/resume` - Resume processing

## 🗄️ Database Schema

### Verification Tasks

```typescript
interface VerificationTask {
  id: string
  jobName: string
  bullJobId?: string

  // Application identification
  appId: string
  appName: string
  appConfigType: 'redpill' | 'phala_cloud'

  // Configuration
  contractAddress: string
  modelOrDomain: string
  appMetadata?: object
  verificationFlags: object

  // Status and results
  status: 'pending' | 'active' | 'completed' | 'failed'
  errorMessage?: string

  // Storage references
  s3Filename?: string
  s3Key?: string
  s3Bucket?: string

  // Timestamps
  createdAt: Date
  startedAt?: Date
  finishedAt?: Date
}
```

## 🔄 Task Lifecycle

1. **Created** → Task stored in PostgreSQL (`pending`)
2. **Queued** → Added to BullMQ queue
3. **Processing** → Worker picks up job (`active`)
4. **Verification** → VerificationService processes
5. **Storage** → Results uploaded to S3
6. **Completed** → Status updated (`completed`)

## 💾 Data Storage

### PostgreSQL

- Task metadata and configuration
- Processing status and timestamps
- S3 storage references

### S3-Compatible Storage

- Raw verification results
- Cost-effective long-term storage
- Referenced by PostgreSQL metadata

### Redis

- BullMQ job queue
- Worker coordination
- Real-time job status

## ⚙️ Configuration

### Environment Variables

```bash
# Server
HOST=0.0.0.0
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/dstack_verifier

# Redis Queue
REDIS_URL=redis://localhost:6379
QUEUE_NAME=verification-queue
QUEUE_CONCURRENCY=5

# S3 Storage
S3_ENDPOINT=https://your-bucket.s3.amazonaws.com
S3_ACCESS_KEY_ID=your_access_key
S3_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET=verification-results
```

## 🛠️ Development

### Prerequisites

- Bun runtime
- PostgreSQL 17+
- Redis 7+
- S3-compatible storage

### Commands

```bash
# Dependencies
bun install

# Database
bun run db:migrate
bun run db:studio

# Development
bun run server:dev

# Production
bun run server

# Testing
bun test
```

### Docker Development

```bash
# Start all services
make dev

# View logs
make dev-logs

# Database management
make db-studio

# Health check
make health
```

## 🏭 Service Architecture

### Service Factory Pattern

```typescript
// Service initialization
const services = createServices()

// Individual services
const queueService = createQueueService(config, verification, taskService, s3)
const taskService = createVerificationTaskService(databaseUrl)
const s3Service = createS3Service(s3Config)
```

### Default Configuration

```typescript
const DEFAULT_VERIFICATION_FLAGS = {
  hardware: true,
  os: true,
  sourceCode: true,
  teeControlledKey: true,
  certificateKey: true,
  dnsCAA: false,
  ctLog: false,
}
```

## 🔍 Monitoring

### Health Checks

- Basic service uptime
- Database connectivity
- Redis queue status
- S3 storage access

### Queue Monitoring

```bash
# Queue statistics
curl http://localhost:3000/api/v1/queue/status

# Task statistics
curl http://localhost:3000/api/v1/tasks/stats/summary
```

## 🚀 Production

### Docker Deployment

```bash
# Production build
make prod-build

# Start production
make prod

# View logs
make prod-logs
```

### Performance Tuning

- Adjust `QUEUE_CONCURRENCY` based on CPU cores
- Configure database connection pooling
- Set Redis memory policies
- Optimize S3 upload strategies

## 🧪 Testing

```bash
# Unit tests
bun test

# Integration tests
bun test:integration

# Database tests
bun test:db

# Queue tests
bun test:queue
```

## 📊 API Documentation

Interactive OpenAPI documentation available at:

- **Development**: http://localhost:3000/openapi
- **Production**: https://your-domain.com/openapi

## 🔧 Troubleshooting

### Common Issues

**Database Connection**

```bash
# Check PostgreSQL
pg_isready -h localhost -p 5432

# Verify connection string
echo $DATABASE_URL
```

**Queue Not Processing**

```bash
# Check Redis
redis-cli ping

# Monitor queue
curl http://localhost:3000/api/v1/queue/status
```

**S3 Upload Failures**

```bash
# Verify credentials
bun run test:s3

# Check permissions
curl -H "Authorization: Bearer $S3_TOKEN" $S3_ENDPOINT
```

## 📚 Resources

- [Bun Documentation](https://bun.sh/docs)
- [Elysia.js Guide](https://elysiajs.com)
- [BullMQ Documentation](https://docs.bullmq.io)
- [Drizzle ORM](https://orm.drizzle.team)
- [Drizzle Gateway](https://github.com/drizzle-team/gateway)

## ✨ Features

- ✅ **High Performance** - Bun runtime with native speed
- ✅ **Type Safety** - Full TypeScript with Drizzle ORM
- ✅ **Scalable Queue** - BullMQ with Redis
- ✅ **Clean Architecture** - Dependency injection pattern
- ✅ **Production Ready** - Health checks and monitoring
- ✅ **API Documentation** - Auto-generated OpenAPI
- ✅ **Docker Support** - Complete containerization
- ✅ **Database UI** - Drizzle Gateway integration
