'use client'

import { AlertCircle, CheckCircle2 } from 'lucide-react'
import type React from 'react'

import type { VijilEvaluation } from '@/app/actions/vijil'
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
}

export const VijilCard: React.FC<VijilCardProps> = ({ evaluation }) => {
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
                    href="https://www.vijil.ai"
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
          <a
            href="https://evaluate.vijil.ai/evaluations"
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-600 text-xs underline hover:text-green-700"
          >
            Replay Trustworthiness Evaluation
          </a>
          <a
            href={webLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-600 text-xs underline hover:text-green-700"
          >
            Download Vijil Trust Report™
          </a>
          <a
            href="https://docs.vijil.ai/dome/intro.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-600 text-xs underline hover:text-green-700"
          >
            View Vijil Dome Guardrails
          </a>
        </div>
      </div>
    </div>
  )
}
