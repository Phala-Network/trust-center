'use server'

/**
 * Server Actions for Vijil API
 * These run on the server to protect API credentials
 */

import { env } from '@/env'

export interface VijilEvaluation {
  id: string
  name: string
  status: 'CREATED' | 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
  score?: number
  url: string
  model_name: string
  completed_test_count?: number
  total_test_count?: number
  created_at: string
  updated_at: string
}

interface VijilEvaluationsResponse {
  results: VijilEvaluation[]
  total: number
}

/**
 * Check if an app ID is whitelisted for Vijil integration
 */
export async function isVijilEnabled(appId: string): Promise<boolean> {
  const whitelist = env.VIJIL_AGENT_WHITELIST.split(',').filter(Boolean)
  return whitelist.includes(appId)
}

/**
 * Get the latest completed evaluation for an agent endpoint
 * Server Action - runs on the server to protect API credentials
 */
export async function getLatestVijilEvaluation(
  agentEndpoint: string,
): Promise<VijilEvaluation | null> {
  const VIJIL_API_URL = env.VIJIL_API_URL
  const VIJIL_API_TOKEN = env.VIJIL_API_TOKEN

  if (!VIJIL_API_TOKEN) {
    console.warn('VIJIL_API_TOKEN not configured')
    return null
  }

  try {
    const response = await fetch(`${VIJIL_API_URL}/v1/evaluations`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${VIJIL_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Always fetch fresh data for server actions
    })

    if (!response.ok) {
      console.error(
        'Failed to fetch Vijil evaluations:',
        response.status,
        response.statusText,
      )
      return null
    }

    const data: VijilEvaluationsResponse = await response.json()

    // Filter evaluations matching the agent endpoint
    const agentEvaluations = (data.results || []).filter(
      (evaluation) => evaluation.url === agentEndpoint,
    )

    // Filter for completed evaluations
    const completedEvaluations = agentEvaluations.filter(
      (e) => e.status === 'COMPLETED',
    )

    if (completedEvaluations.length === 0) {
      return null
    }

    // Sort by updated_at (most recent first)
    completedEvaluations.sort((a, b) => {
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })

    return completedEvaluations[0]
  } catch (error) {
    console.error('Error fetching Vijil evaluations:', error)
    return null
  }
}
