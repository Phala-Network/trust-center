import { env } from './env'
import { createApp } from './app'
import { closeServices, createServices, getServices } from './services'

export async function startServer() {
  console.log('[SERVER] Starting DStack Verifier Server...')

  try {
    const services = createServices()

    // Start database monitor to watch for new pending tasks
    services.dbMonitor.start()

    const app = createApp()

    const port = env.PORT
    const host = env.HOST

    app.listen(port)

    console.log(`[SERVER] Server running on http://${host}:${port}`)
    console.log('[SERVER] Health check available at /health')
    console.log('[SERVER] API documentation available at /openapi')

    // Graceful shutdown handling
    const shutdown = async (signal: string) => {
      console.log(
        `\n[SERVER] Received ${signal}. Starting graceful shutdown...`,
      )

      try {
        // Stop database monitor
        services.dbMonitor.stop()

        await closeServices()
        console.log('[SERVER] All services closed successfully')
        process.exit(0)
      } catch (error) {
        console.error('[SERVER] Error during shutdown:', error)
        process.exit(1)
      }
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))
  } catch (error) {
    console.error('[SERVER] Failed to start server:', error)
    process.exit(1)
  }
}

// Start the server if this file is run directly
if (import.meta.main) {
  startServer()
}
