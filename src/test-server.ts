/**
 * HTTP REST API server for DStack Verifier backend service
 *
 * This server provides endpoints for executing verification operations
 * with configurable parameters and verification flags.
 */

import type { ServerConfig } from './config'
import { DEFAULT_SERVER_CONFIG } from './config'
import type { ApiErrorResponse } from './types'
import { VerificationRequestSchema } from './types/api'
import { VerificationService } from './verificationService'

/**
 * DStack Verifier API Server
 */
export class DStackVerifierServer {
  private server: Bun.Server | undefined
  private verificationService: VerificationService

  constructor(private config: ServerConfig = DEFAULT_SERVER_CONFIG) {
    this.verificationService = new VerificationService()
  }

  /**
   * Start the HTTP server
   */
  async start(): Promise<void> {
    const { port, host } = this.config

    this.server = Bun.serve({
      port,
      hostname: host,
      fetch: this.handleRequest.bind(this),
    })

    console.log(
      `[SERVER] DStack Verifier API server started at http://${host}:${port}`,
    )
  }

  /**
   * Stop the HTTP server
   */
  async stop(): Promise<void> {
    if (this.server) {
      this.server.stop()
      console.log('[SERVER] DStack Verifier API server stopped')
    }
  }

  /**
   * Handle incoming HTTP requests
   */
  private async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return this.createCorsResponse(new Response(null, { status: 204 }))
    }

    try {
      // Route requests
      switch (url.pathname) {
        case '/':
          return this.handleRoot()
        case '/health':
          return this.handleHealth()
        case '/verify':
          if (request.method === 'POST') {
            return await this.handleVerify(request)
          }
          return this.createErrorResponse('Method not allowed', 405)
        default:
          return this.createErrorResponse('Not found', 404)
      }
    } catch (error) {
      console.error('[SERVER] Request handling error:', error)
      return this.createErrorResponse(
        'Internal server error',
        500,
        error instanceof Error ? error.message : 'Unknown error',
      )
    }
  }

  /**
   * Handle root endpoint
   */
  private handleRoot(): Response {
    const info = {
      service: 'DStack Verifier API',
      version: '1.0.0',
      endpoints: {
        'GET /': 'Service information',
        'GET /health': 'Health check',
        'POST /verify': 'Execute verification',
      },
    }

    return this.createJsonResponse(info)
  }

  /**
   * Handle health check endpoint
   */
  private handleHealth(): Response {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }

    return this.createJsonResponse(health)
  }

  /**
   * Handle verification endpoint
   */
  private async handleVerify(request: Request): Promise<Response> {
    let body: any

    try {
      body = await request.json()
    } catch (error) {
      return this.createErrorResponse(
        'Invalid JSON',
        400,
        'Request body must be valid JSON',
      )
    }

    // Validate request body
    const validationResult = VerificationRequestSchema.safeParse(body)
    if (!validationResult.success) {
      return this.createErrorResponse(
        'Validation error',
        400,
        validationResult.error.issues
          .map((e: any) => `${e.path.join('.')}: ${e.message}`)
          .join(', '),
      )
    }

    const verificationRequest = validationResult.data

    try {
      // Create app config from request
      const appConfig = {
        contractAddress: verificationRequest.app
          .contractAddress as `0x${string}`,
        ...('model' in verificationRequest.app
          ? { model: verificationRequest.app.model }
          : { domain: verificationRequest.app.domain }),
        metadata: verificationRequest.app.metadata,
      }

      // Execute verification with app config and flags
      const response = await this.verificationService.verify(
        appConfig,
        verificationRequest.flags,
      )

      return this.createJsonResponse(response)
    } catch (error) {
      console.error('[SERVER] Verification error:', error)
      return this.createErrorResponse(
        'Verification failed',
        500,
        error instanceof Error ? error.message : 'Unknown verification error',
      )
    }
  }

  /**
   * Create a JSON response with CORS headers
   */
  private createJsonResponse(data: any, status: number = 200): Response {
    const response = new Response(JSON.stringify(data, null, 2), {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    return this.createCorsResponse(response)
  }

  /**
   * Create an error response
   */
  private createErrorResponse(
    error: string,
    statusCode: number,
    message?: string,
  ): Response {
    const errorResponse: ApiErrorResponse = {
      error,
      message: message || error,
      statusCode,
    }

    return this.createJsonResponse(errorResponse, statusCode)
  }

  /**
   * Add CORS headers to response
   */
  private createCorsResponse(response: Response): Response {
    const newResponse = new Response(response.body, response)

    newResponse.headers.set('Access-Control-Allow-Origin', '*')
    newResponse.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, OPTIONS',
    )
    newResponse.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization',
    )

    return newResponse
  }
}

/**
 * Create and start a new server instance
 */
export async function startServer(
  config?: ServerConfig,
): Promise<DStackVerifierServer> {
  const server = new DStackVerifierServer(config)
  await server.start()
  return server
}

/**
 * Main server entry point (if run directly)
 */
if (import.meta.main) {
  const server = await startServer()

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('[SERVER] Received SIGINT, shutting down gracefully...')
    await server.stop()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    console.log('[SERVER] Received SIGTERM, shutting down gracefully...')
    await server.stop()
    process.exit(0)
  })
}
