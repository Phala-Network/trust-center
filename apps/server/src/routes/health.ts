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
    const latestTaskTime =
      await services.verificationTask.getLatestCompletedTask()

    const baseHealth = buildBasicHealthResponse()

    return {
      ...baseHealth,
      latestCompletedReportTime: latestTaskTime
        ? latestTaskTime.toISOString()
        : null,
    }
  } catch (error) {
    const baseHealth = buildBasicHealthResponse()

    return {
      ...baseHealth,
      latestCompletedReportTime: null,
    }
  }
}

// Pure handler functions
const handleBasicHealth = async () => buildBasicHealthResponse()

const handleDetailedHealth = async () => {
  try {
    const services = getServices()
    return await buildDetailedHealthResponse(services)
  } catch (error) {
    // Public endpoint: keep internal error text in the logs only.
    console.error('[HEALTH] Error getting services:', error)
    const baseHealth = buildBasicHealthResponse()
    return {
      ...baseHealth,
      latestCompletedReportTime: null,
    }
  }
}

// Route configuration
export const healthRoutes = new Elysia({tags: ['Health']})
  .get('/', handleBasicHealth, {
    detail: {summary: 'Basic health check'},
  })
  .get('/detailed', handleDetailedHealth, {
    detail: {summary: 'Detailed health check with service status'},
  })
