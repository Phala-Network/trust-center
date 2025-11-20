'use client'

import { AlertCircle, CheckCircle2, Copy, Download, Eye } from 'lucide-react'
import type React from 'react'
import { useState } from 'react'

import {
  getVijilDomeConfig,
  type VijilDomeConfig,
  type VijilEvaluation,
} from '@/app/actions/vijil'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

// Utility functions
const getVijilWebLink = (evaluationId: string): string => {
  return `https://evaluate.vijil.ai/evaluations/${evaluationId}`
}

const getScoreLevel = (score: number): 'good' | 'warning' => {
  return score > 90 ? 'good' : 'warning'
}

interface VijilCardProps {
  evaluation: VijilEvaluation
  appId?: string
}

export const VijilCard: React.FC<VijilCardProps> = ({ evaluation, appId }) => {
  const [isLoadingReport, setIsLoadingReport] = useState(false)
  const [isLoadingDome, setIsLoadingDome] = useState(false)
  const [domeConfig, setDomeConfig] = useState<VijilDomeConfig | null>(null)
  const [isDomeDialogOpen, setIsDomeDialogOpen] = useState(false)
  const [copiedDome, setCopiedDome] = useState(false)

  console.log('[VijilCard Component] Rendering with evaluation:', {
    id: evaluation.id,
    score: evaluation.score,
    rawScore: evaluation.score,
    calculatedScore: Math.ceil((evaluation.score ?? 0) * 100),
  })

  // Convert score from 0-1 to 0-100 and round up
  const score = Math.ceil((evaluation.score ?? 0) * 100)
  const scoreLevel = getScoreLevel(score)
  const webLink = getVijilWebLink(evaluation.id)

  console.log('[VijilCard Component] Display values:', {
    score,
    scoreLevel,
    webLink,
  })

  const handleDownloadReport = () => {
    setIsLoadingReport(true)
    try {
      // Construct the static file URL (customize path as needed)
      const fileUrl = `/evaluations/${evaluation.id}.pdf`
      // Create a temporary link to trigger download
      const a = document.createElement('a')
      a.href = fileUrl
      a.download = `vijil-trust-report-${evaluation.id}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      console.log('[VijilCard] Static PDF download triggered:', fileUrl)
    } catch (error) {
      console.error('[VijilCard] Error downloading static PDF:', error)
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      alert(
        `Error downloading report: ${errorMessage}\n\nPlease check the console for details.`,
      )
    } finally {
      setIsLoadingReport(false)
    }
  }

  const handleViewDomeConfig = async () => {
    setIsLoadingDome(true)
    try {
      const config = await getVijilDomeConfig(evaluation.id, undefined, appId)
      if (config) {
        setDomeConfig(config)
        setIsDomeDialogOpen(true)
      } else {
        console.error('Failed to get Dome config')
        alert('Failed to load Dome configuration. Please try again.')
      }
    } catch (error) {
      console.error('Error loading Dome config:', error)
      alert('Error loading Dome configuration. Please try again.')
    } finally {
      setIsLoadingDome(false)
    }
  }

  const handleCopyDomeConfig = () => {
    if (domeConfig) {
      const jsonStr = JSON.stringify(domeConfig, null, 2)
      navigator.clipboard.writeText(jsonStr)
      setCopiedDome(true)
      setTimeout(() => setCopiedDome(false), 2000)
    }
  }

  return (
    <div className="w-full rounded-lg border border-border bg-card p-3">
      <div className="flex h-full flex-col justify-start space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-medium text-foreground text-sm">
            Trustworthy AI Agent
          </h4>
          <img src="/logos/vijil.jpeg" alt="Vijil" className="h-8 w-auto" />
        </div>

        {/* Intro */}
        <p className="text-muted-foreground text-xs">
          Vijil tests the agent for reliability, security, and safety to produce
          the Vijil Trust Score™. For a detailed explanation of the test results
          and recommended risk mitigation methods, see the Vijil Trust Report™.
          Vijil tests the behavior and code of the AI agent. Based on the
          evaluation results, Vijil produces a custom guardrail configuration of
          Vijil Dome, a perimeter defense mechanism, that can block or rewrite
          input and output policy violations.
        </p>

        {/* Score Display */}
        <div className="flex items-center gap-2 py-1">
          {scoreLevel === 'good' ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <AlertCircle className="h-5 w-5 text-yellow-500" />
          )}
          <div>
            <p className="font-semibold text-sm">
              Vijil Trust Score™: {score} / 100
            </p>
            <p className="text-muted-foreground text-xs">
              {scoreLevel === 'good' ? (
                <>
                  Higher score indicates greater reliability, security, and
                  safety.{' '}
                  <a
                    href="https://docs.vijil.ai/components/index.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600 underline hover:text-green-700"
                  >
                    Learn more
                  </a>
                  .
                </>
              ) : (
                'Score below 90 - review recommended risk mitigation methods.'
              )}
            </p>
          </div>
        </div>

        {/* Links */}
        <div className="flex flex-col items-start gap-1">
          <button
            type="button"
            onClick={handleDownloadReport}
            disabled={isLoadingReport}
            className="flex items-center gap-1 text-green-600 text-xs underline hover:text-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoadingReport
              ? 'Generating PDF...'
              : 'Download Vijil Trust Report™'}
          </button>
          <button
            type="button"
            onClick={handleViewDomeConfig}
            disabled={isLoadingDome}
            className="flex items-center gap-1 text-green-600 text-xs underline hover:text-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoadingDome ? 'Loading...' : 'View Vijil Dome Guardrails'}
          </button>
        </div>
      </div>

      {/* Dome Config Dialog */}
      <Dialog open={isDomeDialogOpen} onOpenChange={setIsDomeDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vijil Dome Guardrails Configuration</DialogTitle>
            <DialogDescription>
              Recommended guardrail configuration for this evaluation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md bg-muted p-4">
              <pre className="overflow-x-auto text-xs">
                {domeConfig ? JSON.stringify(domeConfig, null, 2) : ''}
              </pre>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCopyDomeConfig}
                className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-white text-sm hover:bg-green-700"
              >
                <Copy className="h-4 w-4" />
                {copiedDome ? 'Copied!' : 'Copy to Clipboard'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
