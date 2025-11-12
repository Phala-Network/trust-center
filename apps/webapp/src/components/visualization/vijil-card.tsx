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
  const score = evaluation.score ?? 0
  const scoreLevel = getScoreLevel(score)
  const webLink = getVijilWebLink(evaluation.id)

  return (
    <div className="w-full rounded-lg border border-border bg-card p-3">
      <div className="flex h-full flex-col justify-start space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-medium text-foreground text-sm">
            Trustworthy AI Agent
          </h4>
          <img src="/vijil.svg" alt="Vijil" className="h-4 w-auto" />
        </div>

        {/* Intro */}
        <p className="text-muted-foreground text-xs">
          Vijil tests the agent for reliability, security, and safety to produce
          the Vijil Trust Score™. Vijil evaluates the behavior and code of the
          AI agent. Based on the evaluation results, Vijil produces a custom
          guardrail configuration of Vijil Dome, a perimeter defense mechanism,
          that can block or rewrite input and output policy violations.
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
              Vijil Trust Score™: {score}/100
            </p>
            <p className="text-muted-foreground text-xs">
              {scoreLevel === 'good'
                ? 'Higher score indicates greater reliability, security, and safety.'
                : 'Score below 90 - review recommended risk mitigation methods.'}
            </p>
          </div>
        </div>

        {/* Links */}
        <div className="flex flex-col items-start gap-1">
          <a
            href="https://evaluate.vijil.ai/evaluations/045f833b-d6d9-4047-b49d-7ae9507cd5c5"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary text-xs underline hover:opacity-80"
          >
            Download Vijil Trust Report™
          </a>
          <a
            href="https://docs.vijil.ai/dome/intro.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary text-xs underline hover:opacity-80"
          >
            View Vijil Dome guardrails
          </a>
          <a
            href="https://www.vijil.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary text-xs underline hover:opacity-80"
          >
            Learn more
          </a>
        </div>
      </div>
    </div>
  )
}
