# DStack Verifier API Usage Guide

## Server Modes

### Script Mode (Default)

Run verification examples with default configuration:

```bash
bun run index.ts
```

### Server Mode

Start the HTTP REST API server:

```bash
bun run index.ts --server
```

The server will start on `http://localhost:3000` by default. Use environment variables to customize:

```bash
PORT=8080 HOST=0.0.0.0 bun run index.ts --server
```

## API Endpoints

### GET /

Returns service information and available endpoints.

### GET /health

Returns server health status and uptime.

### POST /verify

Execute verification operations with configurable parameters and flags.

#### Request Format

```json
{
  "verifierType": "kms" | "gateway" | "redpill",
  "config": {
    "kms": {
      "contractAddress": "0x...",
      "metadata": {
        "osVersion": "0.5.3",
        "gitRevision": "abc123..."
      }
    },
    "gateway": {
      "contractAddress": "0x...",
      "rpcEndpoint": "https://...",
      "metadata": { ... }
    },
    "redpill": {
      "contractAddress": "0x...",
      "model": "phala/model-name",
      "metadata": { ... }
    }
  },
  "flags": {
    "hardware": true,
    "os": true,
    "sourceCode": true,
    "teeControlledKey": true,
    "certificateKey": true,
    "dnsCAA": true,     // Can be slow due to DNS queries
    "ctLog": false      // Skip slow CT log queries (default: false)
  }
}
```

#### Response Format

```json
{
  "dataObjects": [...],  // Generated DataObjects from verification
  "metadata": {
    "totalTimeMs": 2340,
    "stepTimes": {
      "hardware": 1200,
      "os": 1140
    },
    "executedSteps": ["hardware", "os"],
    "skippedSteps": ["dnsCAA", "ctLog"],
    "startedAt": "2024-01-01T00:00:00.000Z",
    "completedAt": "2024-01-01T00:00:02.340Z"
  },
  "errors": [],
  "success": true
}
```

## Configuration

### Environment Variables

- `PORT`: Server port (default: 3000)
- `HOST`: Server host (default: localhost)
- `KMS_CONTRACT_ADDRESS`: Default KMS contract address
- `GATEWAY_RPC_ENDPOINT`: Default Gateway RPC endpoint
- `REDPILL_MODEL`: Default Redpill model

### Verification Flags

Control which verification steps to execute:

- `hardware`: TEE quote verification (usually fast)
- `os`: Operating system measurement verification (moderate)
- `sourceCode`: Compose hash verification (fast)
- `teeControlledKey`: TEE-controlled key verification (fast)
- `certificateKey`: Certificate key matching (fast)
- `dnsCAA`: DNS CAA record verification (can be slow due to DNS queries)
- `ctLog`: Certificate Transparency log verification (can be very slow due to crt.sh queries)

### Preset Flag Configurations

Use these presets for common scenarios:

**Default verification flags:**

```json
{
  "hardware": true,
  "os": true,
  "sourceCode": true,
  "teeControlledKey": true,
  "certificateKey": true,
  "dnsCAA": true,
  "ctLog": false // Default: false (avoid slow CT log queries)
}
```

**All verification steps (thorough but potentially slow):**

```json
{
  "hardware": true,
  "os": true,
  "sourceCode": true,
  "teeControlledKey": true,
  "certificateKey": true,
  "dnsCAA": true,
  "ctLog": true // Enable slow CT log verification
}
```

**Fast verification (skip potentially slow operations):**

```json
{
  "hardware": true,
  "os": true,
  "sourceCode": true,
  "teeControlledKey": true,
  "certificateKey": true,
  "dnsCAA": false,
  "ctLog": false
}
```

**Hardware-only verification:**

```json
{
  "hardware": true,
  "os": false,
  "sourceCode": false,
  "teeControlledKey": false,
  "certificateKey": false,
  "dnsCAA": false,
  "ctLog": false
}
```

## Example Usage

### KMS Verification (Fast Mode)

```bash
curl -X POST http://localhost:3000/verify \
  -H "Content-Type: application/json" \
  -d '{
    "verifierType": "kms",
    "flags": {
      "hardware": true,
      "os": true,
      "sourceCode": true,
      "teeControlledKey": false,
      "certificateKey": false,
      "dnsCAA": false,
      "ctLog": false
    }
  }'
```

### Gateway Verification with Custom Config

```bash
curl -X POST http://localhost:3000/verify \
  -H "Content-Type: application/json" \
  -d '{
    "verifierType": "gateway",
    "config": {
      "gateway": {
        "rpcEndpoint": "https://custom-gateway.example.com:9204/"
      }
    },
    "flags": {
      "hardware": true,
      "os": true,
      "sourceCode": true,
      "teeControlledKey": true,
      "certificateKey": true,
      "dnsCAA": true,
      "ctLog": false
    }
  }'
```

## Error Handling

The API returns appropriate HTTP status codes and error messages:

- `400`: Bad request (invalid JSON, validation errors)
- `500`: Internal server error (verification failures, configuration issues)
- `404`: Endpoint not found
- `405`: Method not allowed

Error responses include details:

```json
{
  "error": "Validation error",
  "message": "verifierType: Invalid option",
  "statusCode": 400
}
```
