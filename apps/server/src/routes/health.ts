import {Elysia} from 'elysia'

import {getServices, type Services} from '../services'

// Pure data builders
const buildBasicHealthResponse = () => ({
  status: 'healthy' as const,
  timestamp: new Date().toISOString(),
  service: 'dstack-verifier' as const,
})

const buildDetailedHealthResponse = async (services: Services) => {
  try {
    const [queueHealth, latestTaskTime] = await Promise.all([
      services.queue.healthCheck(),
      services.verificationTask.getLatestCompletedTask(),
    ])

    const baseHealth = buildBasicHealthResponse()
    const servicesHealth = {
      queue: {
        status: 'healthy' as const,
        details: queueHealth,
      },
    }

    return {
      ...baseHealth,
      services: servicesHealth,
      latestCompletedReportTime: latestTaskTime
        ? latestTaskTime.toISOString()
        : null,
    }
  } catch (error) {
    const baseHealth = buildBasicHealthResponse()
    const servicesHealth = {
      queue: {
        status: 'unhealthy' as const,
        details: error instanceof Error ? error.message : 'Health check failed',
      },
    }

    return {
      ...baseHealth,
      services: servicesHealth,
      latestCompletedReportTime: null,
    }
  }
}

// Pure handler functions
const handleBasicHealth = async () => buildBasicHealthResponse()

const handleDetailedHealth = async () => {
  const services = getServices()
  return await buildDetailedHealthResponse(services)
}

// Route configuration
export const healthRoutes = new Elysia({tags: ['Health']})
  .get('/', handleBasicHealth, {
    detail: {summary: 'Basic health check'},
  })
  .get('/detailed', handleDetailedHealth, {
    detail: {summary: 'Detailed health check with service status'},
  })
