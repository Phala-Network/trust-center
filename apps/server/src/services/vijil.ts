/**
 * Vijil API Service
 *
 * Provides integration with Vijil Evaluate platform for agent security evaluation.
 * This service queries existing evaluations for whitelisted agents.
 */

export interface VijilConfig {
  apiUrl: string
  apiToken?: string
  agentWhitelist: string[] // App IDs that are known agents
  agentModelName: string
}

export interface VijilEvaluation {
  id: string
  name?: string
  status: string // Can be: PENDING, RUNNING, COMPLETED, ERROR, PAUSED, CANCELED
  created_at: number // Unix timestamp
  completed_at?: number | null
  agent_configuration_id?: string | null
  report_url?: string
  url?: string // Agent endpoint URL
  model?: string // Model name
  hub?: string // Hub type (e.g., "custom")
  score?: number | string // Evaluation score
  tags?: string[]
  completed_test_count?: number
  total_test_count?: number
}

export interface VijilEvaluationResponse {
  results: VijilEvaluation[]
  count: number
  current_page: number
  page_size: number
}

export class VijilService {
  private config: VijilConfig

  constructor(config: VijilConfig) {
    this.config = config
  }

  /**
   * Check if an app ID is whitelisted as an agent
   */
  isWhitelistedAgent(appId: string): boolean {
    return this.config.agentWhitelist.includes(appId)
  }

  /**
   * Construct agent endpoint URL from app ID and domain
   * Format: https://{app-id}-8000.{domain}/v1
   */
  constructAgentEndpoint(appId: string, domain: string): string {
    // Extract base domain from full domain (e.g., "myapp.phala.network" -> "phala.network")
    const parts = domain.split('.')
    const baseDomain = parts.length >= 2 ? parts.slice(-2).join('.') : domain
    return `https://${appId}-8000.${baseDomain}/v1`
  }

  /**
   * Query Vijil for existing evaluations by agent endpoint
   * Filters all evaluations to find ones matching the specific endpoint
   */
  async getEvaluationsByEndpoint(
    agentEndpoint: string,
  ): Promise<VijilEvaluation[]> {
    if (!this.config.apiToken) {
      console.log('[VIJIL] No API token configured, skipping evaluation query')
      return []
    }

    try {
      const url = new URL('/v1/evaluations', this.config.apiUrl)

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        console.error(
          `[VIJIL] Failed to query evaluations: ${response.status} ${response.statusText}`,
        )
        return []
      }

      const data = (await response.json()) as VijilEvaluationResponse

      // Filter evaluations by the specific agent endpoint and only return completed ones
      const filtered = (data.results || []).filter((evaluation) =>
        evaluation.url === agentEndpoint && evaluation.status === 'COMPLETED'
      )

      console.log(`[VIJIL] Found ${filtered.length} completed evaluations for endpoint: ${agentEndpoint}`)
      return filtered
    } catch (error) {
      console.error('[VIJIL] Error querying evaluations:', error)
      return []
    }
  }

  /**
   * Get a specific evaluation by ID
   */
  async getEvaluationById(evaluationId: string): Promise<VijilEvaluation | null> {
    if (!this.config.apiToken) {
      console.log('[VIJIL] No API token configured, skipping evaluation query')
      return null
    }

    try {
      const url = new URL(`/v1/evaluations/${evaluationId}`, this.config.apiUrl)

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        console.error(
          `[VIJIL] Failed to get evaluation ${evaluationId}: ${response.status} ${response.statusText}`,
        )
        return null
      }

      const data = (await response.json()) as VijilEvaluation
      return data
    } catch (error) {
      console.error(`[VIJIL] Error getting evaluation ${evaluationId}:`, error)
      return null
    }
  }

  /**
   * Generate Vijil web UI link for an evaluation
   */
  getEvaluationWebLink(evaluationId: string): string {
    // Assuming Vijil has a web UI at a standard URL pattern
    // Adjust this based on actual Vijil web UI structure
    return `https://evaluate.vijil.ai/evaluations/${evaluationId}`
  }

  /**
   * Get agent evaluation info for a given app
   * Returns evaluation data if the app is whitelisted and has evaluations
   */
  async getAgentEvaluationInfo(
    appId: string,
    domain: string,
  ): Promise<{
    isAgent: boolean
    evaluations: VijilEvaluation[]
    agentEndpoint?: string
  }> {
    const isAgent = this.isWhitelistedAgent(appId)

    if (!isAgent) {
      return {
        isAgent: false,
        evaluations: [],
      }
    }

    const agentEndpoint = this.constructAgentEndpoint(appId, domain)
    console.log(`[VIJIL] App ${appId} is whitelisted as agent, endpoint: ${agentEndpoint}`)

    const evaluations = await this.getEvaluationsByEndpoint(agentEndpoint)

    return {
      isAgent: true,
      evaluations,
      agentEndpoint,
    }
  }
}

/**
 * Create Vijil service from environment config
 */
export const createVijilService = (config: {
  apiUrl: string
  apiToken?: string
  whitelistString?: string
  agentModelName: string
}): VijilService => {
  const agentWhitelist = config.whitelistString
    ? config.whitelistString.split(',').map((id) => id.trim()).filter(Boolean)
    : []

  return new VijilService({
    apiUrl: config.apiUrl,
    apiToken: config.apiToken,
    agentWhitelist,
    agentModelName: config.agentModelName,
  })
}
