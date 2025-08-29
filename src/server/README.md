# DStack Verifier Server

A high-performance TEE attestation verification server built with **Elysia.js**, **BullMQ**, and **PostgreSQL**, designed specifically for the **Bun runtime**.

## 🏗️ Architecture Overview

### Core Technologies
- **Bun**: High-performance JavaScript runtime and package manager (Node.js not supported)
- **Elysia.js**: Fast, type-safe web framework with built-in Swagger documentation
- **PostgreSQL**: Primary data storage for task metadata and tracking
- **BullMQ + Redis**: High-performance job queue for verification processing
- **Cloudflare R2**: Object storage for verification results
- **Drizzle ORM**: Type-safe SQL toolkit with migrations

### Service Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client API    │    │  Queue Worker   │    │  Verification   │
│     (Elysia)    │────│    (BullMQ)     │────│    Service      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │      Redis      │    │  Cloudflare R2  │
│  (Task Data)    │    │   (Job Queue)   │    │   (Results)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🗄️ Database Schema

### Verification Tasks Table
```sql
CREATE TABLE verification_tasks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL DEFAULT 'verification',
  bull_job_id TEXT,
  
  -- Application identification
  app_id TEXT NOT NULL,
  app_name TEXT NOT NULL,
  verifier_type verifier_type NOT NULL,
  
  -- Task configuration and status
  payload TEXT NOT NULL, -- JSON: config, flags, metadata
  status verification_task_status NOT NULL DEFAULT 'pending',
  error_message TEXT,
  
  -- R2 storage references
  file_name TEXT,
  r2_key TEXT,
  r2_bucket TEXT,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP,
  finished_at TIMESTAMP
);
```

### Enums
```sql
CREATE TYPE verification_task_status AS ENUM (
  'pending', 'active', 'completed', 'failed'
);

CREATE TYPE verifier_type AS ENUM (
  'kms', 'gateway', 'redpill'
);
```

## 🚀 API Endpoints

### Health & Status
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed service health status

### Task Management
- `POST /api/v1/tasks` - Create single verification task
- `POST /api/v1/tasks/batch` - Create multiple tasks
- `GET /api/v1/tasks/:taskId` - Get task status
- `GET /api/v1/tasks` - List tasks with filtering
- `DELETE /api/v1/tasks/:taskId` - Cancel task
- `GET /api/v1/tasks/:taskId/result` - Get result storage info
- `GET /api/v1/tasks/stats/summary` - Task statistics

### Queue Management
- `GET /api/v1/queue/status` - Queue statistics
- `GET /api/v1/queue/jobs/:jobId` - Job details
- `POST /api/v1/queue/jobs/:jobId/retry` - Retry job
- `DELETE /api/v1/queue/jobs/:jobId` - Remove job
- `POST /api/v1/queue/pause` - Pause processing
- `POST /api/v1/queue/resume` - Resume processing
- `POST /api/v1/queue/clean` - Clean old jobs

## 📝 Task Creation Examples

### Single Task
```json
POST /api/v1/tasks
{
  "appId": "my-app-123",
  "appName": "My Application",
  "verifierType": "kms",
  "config": {
    "kms": {
      "contractAddress": "0x...",
      "metadata": {"version": "1.0"}
    }
  },
  "flags": {
    "hardware": true,
    "os": true,
    "sourceCode": true
  },
  "metadata": {
    "environment": "production"
  }
}
```

### Batch Creation
```json
POST /api/v1/tasks/batch
{
  "tasks": [
    {
      "appId": "app-1",
      "appName": "KMS Application",
      "verifierType": "kms"
    },
    {
      "appId": "app-2", 
      "appName": "Gateway Application",
      "verifierType": "gateway"
    }
  ]
}
```

## 🔄 Task Lifecycle

1. **Created**: Task stored in PostgreSQL with `pending` status
2. **Queued**: Added to BullMQ queue with task data
3. **Processing**: Worker picks up job, status → `active`
4. **Config Merge**: Task config merged with defaults
5. **Verification**: VerificationService processes with merged config
6. **Storage**: Results uploaded to R2, metadata in PostgreSQL
7. **Completed**: Status → `completed` with storage references

## 💾 Data Storage Strategy

### PostgreSQL (Task Metadata)
- Task configuration and parameters
- Processing status and timestamps  
- Error messages and retry information
- R2 storage references (fileName, r2Key, r2Bucket)
- Application identification and correlation

### Cloudflare R2 (Verification Results)
- Raw verification result data only
- Cost-effective long-term storage
- Globally distributed access
- Referenced by PostgreSQL metadata

### Redis (Queue Processing)
- BullMQ job queue management
- Worker coordination and load balancing
- Real-time job status and progress
- Retry logic and error handling

## ⚙️ Environment Variables

```bash
# Server Configuration
HOST=0.0.0.0
PORT=3000

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/dstack_verifier

# Redis Queue
REDIS_URL=redis://localhost:6379
QUEUE_NAME=verification-queue
QUEUE_CONCURRENCY=5
QUEUE_MAX_ATTEMPTS=3
QUEUE_BACKOFF_DELAY=2000

# Cloudflare R2 Storage
R2_ENDPOINT=https://account-id.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET=verification-results
```

## 🛠️ Development

### Prerequisites
- **Bun**: Required runtime and package manager
- PostgreSQL 17+ with `gen_random_uuid()` support
- Redis 7+ for queue management
- Cloudflare R2 account and bucket

### Quick Start
```bash
# Install dependencies
bun install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Database setup
bun run db:migrate
bun run db:seed # Optional

# Development server
bun run dev

# Production server  
bun run start
```

### Database Operations
```bash
# Generate migration
bun run db:generate

# Apply migrations
bun run db:migrate

# Database studio (development)
bun run db:studio

# Reset database
bun run db:reset
```

## 🏭 Service Architecture Details

### Service Factory Pattern
All services use dependency injection through factory functions:

```typescript
// Service initialization
const services = createServices()

// Individual service access
const queueService = createQueueService(config, verification, taskService, r2)
const taskService = createVerificationTaskService(databaseUrl)
const r2Service = createR2Service(r2Config)
```

### Queue Processing
- **Config Merging**: Task configs merged with sensible defaults
- **Result Storage**: Only verification results uploaded to R2
- **Error Handling**: Comprehensive retry logic with exponential backoff
- **Status Tracking**: Real-time status updates in PostgreSQL

### Default Configuration
```typescript
const DEFAULT_CONFIG = {
  kms: {
    contractAddress: '0x0000000000000000000000000000000000000000',
  },
  gateway: {
    contractAddress: '0x0000000000000000000000000000000000000000',
    rpcEndpoint: 'http://localhost:8545',
  },
  redpill: {
    contractAddress: '0x0000000000000000000000000000000000000000',
    model: 'default',
  },
}

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

## 🔍 Monitoring & Health Checks

### Health Endpoints
- **Basic**: Service uptime and version
- **Detailed**: Database, Redis, and queue status

### Queue Monitoring
```bash
# Queue statistics
curl http://localhost:3000/api/v1/queue/status

# Job details
curl http://localhost:3000/api/v1/queue/jobs/{jobId}

# Clean completed jobs
curl -X POST http://localhost:3000/api/v1/queue/clean
```

### Task Statistics
```bash
# Overall statistics
curl http://localhost:3000/api/v1/tasks/stats/summary

# Filtered task list
curl "http://localhost:3000/api/v1/tasks?status=completed&limit=10"
```

## 🚀 Production Deployment

### Docker Setup
```bash
# Build and run with Docker Compose
make build
make up

# Development environment
make dev

# View logs
make logs

# Health check
make health
```

### Performance Tuning
- **Queue Concurrency**: Adjust `QUEUE_CONCURRENCY` based on CPU cores
- **Database Connections**: Configure connection pooling
- **Redis Memory**: Set appropriate `maxmemory` policy
- **R2 Upload**: Consider async upload for large results

### Security Considerations
- Environment variable management
- Database connection encryption
- CORS configuration for API access
- Rate limiting on public endpoints

## 🧪 Testing

### Unit Tests
```bash
# Run all tests
bun test

# Watch mode
bun test --watch

# Coverage report
bun test --coverage
```

### Integration Tests
```bash
# API endpoint tests
bun test:integration

# Database tests
bun test:db

# Queue processing tests
bun test:queue
```

## 📊 API Documentation

Interactive API documentation is available at:
- **Development**: http://localhost:3000/swagger
- **Production**: https://your-domain.com/swagger

The documentation includes:
- Complete endpoint specifications
- Request/response schemas
- Interactive testing interface
- Authentication requirements

## 🔧 Troubleshooting

### Common Issues

**Database Connection Errors**
```bash
# Check PostgreSQL status
pg_isready -h localhost -p 5432

# Verify DATABASE_URL format
echo $DATABASE_URL
```

**Queue Not Processing**
```bash
# Check Redis connection
redis-cli ping

# Monitor queue status
curl http://localhost:3000/api/v1/queue/status
```

**R2 Upload Failures**
```bash
# Verify R2 credentials
bun run test:r2

# Check bucket permissions
curl -H "Authorization: Bearer $R2_TOKEN" $R2_ENDPOINT
```

### Logging

Structured logging is available for:
- HTTP requests and responses
- Queue job processing
- Database operations
- Error conditions

Log levels: `error`, `warn`, `info`, `debug`

## 📚 Additional Resources

- [Bun Documentation](https://bun.sh/docs) - Runtime and package manager
- [Elysia.js Guide](https://elysiajs.com) - Web framework
- [BullMQ Documentation](https://docs.bullmq.io) - Queue management
- [Drizzle ORM](https://orm.drizzle.team) - Database toolkit
- [Cloudflare R2 API](https://developers.cloudflare.com/r2) - Object storage

## 🎯 Key Features

✅ **High Performance** - Bun runtime with native performance  
✅ **Type Safety** - Full TypeScript with Drizzle ORM schemas  
✅ **Scalable Queue** - BullMQ with Redis for job processing  
✅ **Clean Architecture** - Separation of concerns with dependency injection  
✅ **Production Ready** - Health checks, error handling, monitoring  
✅ **API Documentation** - Auto-generated Swagger interface  
✅ **Docker Support** - Complete containerization with docker-compose  
✅ **Modern Stack** - Latest versions of all dependencies  

The DStack Verifier Server provides enterprise-grade TEE attestation verification with a focus on performance, reliability, and developer experience.