'use server'

/**
 * Server Actions for Vijil API
 * These run on the server to protect API credentials
 */

import { env } from '@/env'
import { getVijilToken } from '@/lib/vijil-token'

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

export interface VijilDomeConfig {
  'input-guards'?: string[]
  'output-guards'?: string[]
  'input-early-exit'?: boolean
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
 *
 * @param agentEndpoint - The agent endpoint URL
 * @param appId - Optional app ID to determine authentication method
 */
export async function getLatestVijilEvaluation(
  agentEndpoint: string,
  appId?: string,
): Promise<VijilEvaluation | null> {
  const VIJIL_API_URL = env.VIJIL_API_URL

  // Get a fresh token (will auto-refresh if needed)
  const token = await getVijilToken(appId)

  if (!token) {
    console.warn('[VIJIL] No API token available')
    return null
  }

  try {
    const response = await fetch(`${VIJIL_API_URL}/v1/evaluations`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
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

/**
 * Generate PDF report for a completed evaluation
 * Server Action - runs on the server to protect API credentials
 * Uses Puppeteer (headless Chrome) to generate PDF from HTML
 *
 * @param evaluationId - The evaluation ID
 * @param appId - Optional app ID to determine authentication method
 */
export async function generateVijilReportPdf(
  evaluationId: string,
  appId?: string,
): Promise<string | null> {
  const VIJIL_API_URL = env.VIJIL_API_URL

  console.log(`[VIJIL] Generating PDF report for evaluation: ${evaluationId}`)

  // Get a fresh token (will auto-refresh if needed)
  const token = await getVijilToken(appId)

  if (!token) {
    console.warn('[VIJIL] No API token available')
    return null
  }

  try {
    // Step 1: Get HTML content
    const htmlContent = await getVijilReportHtml(
      evaluationId,
      token,
      VIJIL_API_URL,
    )

    if (!htmlContent) {
      return null
    }

    console.log('[VIJIL] Generating PDF using Puppeteer...')

    // Step 2: Generate PDF using Puppeteer
    const puppeteer = await import('puppeteer')
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    const page = await browser.newPage()
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' })

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in',
      },
      printBackground: true,
    })

    await browser.close()

    console.log('[VIJIL] PDF generated successfully, size:', pdfBuffer.length)

    // Convert to base64 for transfer to client
    const base64Pdf = Buffer.from(pdfBuffer).toString('base64')
    return base64Pdf
  } catch (error) {
    console.error('[VIJIL] Error generating PDF:', error)
    return null
  }
}

/**
 * Get HTML report content for a completed evaluation
 * Internal helper function
 */
async function getVijilReportHtml(
  evaluationId: string,
  token: string,
  VIJIL_API_URL: string,
): Promise<string | null> {
  console.log(`[VIJIL] Getting report HTML for evaluation: ${evaluationId}`)

  try {
    // Step 1: List available reports
    const listUrl = `${VIJIL_API_URL}/v1/evaluations/${evaluationId}/list-reports?status=CREATED`
    console.log(`[VIJIL] Listing reports: ${listUrl}`)

    const listResponse = await fetch(listUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!listResponse.ok) {
      const errorText = await listResponse.text()
      console.error(
        `[VIJIL] Failed to list reports: ${listResponse.status} ${listResponse.statusText}`,
        errorText,
      )
      return null
    }

    const listData = await listResponse.json()
    console.log('[VIJIL] List reports response:', listData)
    const reportIds = listData.report_ids

    if (!reportIds || reportIds.length === 0) {
      console.warn('[VIJIL] No reports available for this evaluation')
      return null
    }

    // Step 2: Get the latest report by ID
    const reportId = reportIds[0]
    const reportUrl = `${VIJIL_API_URL}/v1/evaluations/${evaluationId}/reports/${reportId}`
    console.log(`[VIJIL] Fetching report: ${reportUrl}`)

    const reportResponse = await fetch(reportUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!reportResponse.ok) {
      const errorText = await reportResponse.text()
      console.error(
        `[VIJIL] Failed to fetch report: ${reportResponse.status} ${reportResponse.statusText}`,
        errorText,
      )
      return null
    }

    const reportData = await reportResponse.json()
    console.log(
      '[VIJIL] Report data received, has content:',
      !!reportData.report_content,
    )

    return reportData.report_content || null
  } catch (error) {
    console.error('[VIJIL] Error fetching Vijil report:', error)
    return null
  }
}

/**
 * Get recommended Vijil Dome configuration for an evaluation
 * Server Action - runs on the server to protect API credentials
 *
 * @param evaluationId - The evaluation ID
 * @param latencyThreshold - Optional latency threshold in milliseconds
 * @param appId - Optional app ID to determine authentication method
 */
export async function getVijilDomeConfig(
  evaluationId: string,
  latencyThreshold?: number,
  appId?: string,
): Promise<VijilDomeConfig | null> {
  const VIJIL_API_URL = env.VIJIL_API_URL

  // Get a fresh token (will auto-refresh if needed)
  const token = await getVijilToken(appId)

  if (!token) {
    console.warn('[VIJIL] No API token available')
    return null
  }

  try {
    const payload: { evaluation_id: string; latency_threshold?: number } = {
      evaluation_id: evaluationId,
    }

    if (latencyThreshold !== undefined) {
      payload.latency_threshold = latencyThreshold
    }

    const response = await fetch(`${VIJIL_API_URL}/v1/recommend-dome-config`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })

    if (!response.ok) {
      console.error(
        'Failed to get Vijil Dome config:',
        response.status,
        response.statusText,
      )
      return null
    }

    const config: VijilDomeConfig = await response.json()
    return config
  } catch (error) {
    console.error('Error fetching Vijil Dome config:', error)
    return null
  }
}
