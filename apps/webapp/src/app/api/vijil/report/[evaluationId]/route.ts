import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { env } from '@/env'
import { getVijilToken } from '@/lib/vijil-token'

/**
 * API route to generate and stream Vijil PDF report
 * This avoids the Next.js Server Action payload size limit
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ evaluationId: string }> },
) {
  const { evaluationId } = await params

  if (!evaluationId) {
    return NextResponse.json(
      { error: 'Evaluation ID is required' },
      { status: 400 },
    )
  }

  const VIJIL_API_URL = env.VIJIL_API_URL

  console.log(`[VIJIL API] Generating PDF report for evaluation: ${evaluationId}`)

  try {
    // Get a fresh token
    const token = await getVijilToken()

    if (!token) {
      console.warn('[VIJIL API] No API token available')
      return NextResponse.json(
        { error: 'API token not available' },
        { status: 500 },
      )
    }

    // Step 1: Get HTML content
    const htmlContent = await getVijilReportHtml(
      evaluationId,
      token,
      VIJIL_API_URL,
    )

    if (!htmlContent) {
      return NextResponse.json(
        {
          error:
            'Report not available. The report may not be generated yet. Please try again later.',
        },
        { status: 404 },
      )
    }

    console.log('[VIJIL API] Generating PDF using Puppeteer...')

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

    console.log('[VIJIL API] PDF generated successfully, size:', pdfBuffer.length)

    // Return PDF as a stream
    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="vijil-trust-report-${evaluationId}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('[VIJIL API] Error generating PDF:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate PDF report',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

/**
 * Get HTML report content for a completed evaluation
 */
async function getVijilReportHtml(
  evaluationId: string,
  token: string,
  VIJIL_API_URL: string,
): Promise<string | null> {
  console.log(`[VIJIL API] Getting report HTML for evaluation: ${evaluationId}`)

  try {
    // Step 1: List available reports
    const listUrl = `${VIJIL_API_URL}/v1/evaluations/${evaluationId}/list-reports?status=CREATED`
    console.log(`[VIJIL API] Listing reports: ${listUrl}`)

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
        `[VIJIL API] Failed to list reports: ${listResponse.status} ${listResponse.statusText}`,
        errorText,
      )
      return null
    }

    const listData = await listResponse.json()
    console.log('[VIJIL API] List reports response:', listData)
    const reportIds = listData.report_ids

    if (!reportIds || reportIds.length === 0) {
      console.warn('[VIJIL API] No reports available for this evaluation')
      return null
    }

    // Step 2: Get the latest report by ID
    const reportId = reportIds[0]
    const reportUrl = `${VIJIL_API_URL}/v1/evaluations/${evaluationId}/reports/${reportId}`
    console.log(`[VIJIL API] Fetching report: ${reportUrl}`)

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
        `[VIJIL API] Failed to fetch report: ${reportResponse.status} ${reportResponse.statusText}`,
        errorText,
      )
      return null
    }

    const reportData = await reportResponse.json()
    console.log(
      '[VIJIL API] Report data received, has content:',
      !!reportData.report_content,
    )

    return reportData.report_content || null
  } catch (error) {
    console.error('[VIJIL API] Error fetching Vijil report:', error)
    return null
  }
}
