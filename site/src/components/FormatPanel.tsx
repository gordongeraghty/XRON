import { useState, useMemo } from 'react'
import { FormatId, FORMAT_LABELS } from '../utils/formatters'
import { tokenizeText } from '../utils/tokenizer'

interface FormatPanelProps {
  formatId: FormatId
  content: string
  tokenCount: number
  baselineTokens: number
  isBaseline: boolean
  highlightTokens: boolean
  error?: string
}

const NUM_COLORS = 8

function renderHighlighted(content: string): React.ReactNode {
  const segments = tokenizeText(content)
  return segments.map((seg, i) => (
    <span key={i} className={`token-highlight-${i % NUM_COLORS}`}>
      {seg.text}
    </span>
  ))
}

function renderLines(content: string, highlight: boolean): React.ReactNode[] {
  const lines = content.split('\n')
  if (!highlight) {
    return lines.map((line, idx) => (
      <div key={idx} className="line-numbered">
        <span className="line-num">{idx + 1}</span>
        <span className="line-content">{line}</span>
      </div>
    ))
  }

  // For highlighted mode, tokenize the full content, then reconstruct per-line
  const segments = tokenizeText(content)
  // Build a flat list of chars-with-color, then split by newline
  const allSpans: React.ReactNode[] = []
  let key = 0
  for (const seg of segments) {
    const parts = seg.text.split('\n')
    for (let pi = 0; pi < parts.length; pi++) {
      if (pi > 0) {
        allSpans.push(<span key={`nl-${key++}`} data-nl="true" />)
      }
      if (parts[pi].length > 0) {
        allSpans.push(
          <span key={`tok-${key++}`} className={`token-highlight-${seg.tokenIndex % NUM_COLORS}`}>
            {parts[pi]}
          </span>
        )
      }
    }
  }

  // Group spans by line
  const lineGroups: React.ReactNode[][] = [[]]
  for (const span of allSpans) {
    if ((span as React.ReactElement).props?.['data-nl'] === 'true') {
      lineGroups.push([])
    } else {
      lineGroups[lineGroups.length - 1].push(span)
    }
  }

  return lineGroups.map((group, idx) => (
    <div key={idx} className="line-numbered">
      <span className="line-num">{idx + 1}</span>
      <span className="line-content">{group}</span>
    </div>
  ))
}

export default function FormatPanel({
  formatId,
  content,
  tokenCount,
  baselineTokens,
  isBaseline,
  highlightTokens,
  error,
}: FormatPanelProps) {
  const [copied, setCopied] = useState(false)

  const pctDiff = useMemo(() => {
    if (isBaseline || baselineTokens === 0) return null
    const diff = ((tokenCount - baselineTokens) / baselineTokens) * 100
    return diff
  }, [tokenCount, baselineTokens, isBaseline])

  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const lines = useMemo(() => renderLines(content, highlightTokens && !error), [content, highlightTokens, error])

  return (
    <div className="flex flex-col min-w-[260px] w-[320px] flex-shrink-0 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
      {/* Panel header */}
      <div className="px-4 pt-4 pb-2 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-0.5">
            {FORMAT_LABELS[formatId]}
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
            {tokenCount.toLocaleString()}
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">tokens</span>
          </div>
          <div className="text-sm mt-0.5 h-5">
            {isBaseline ? (
              <span className="text-violet-500 dark:text-violet-400 font-medium">(Baseline)</span>
            ) : pctDiff !== null ? (
              <span className={pctDiff < 0 ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-red-500 dark:text-red-400 font-medium'}>
                {pctDiff > 0 ? '+' : ''}{pctDiff.toFixed(1)}%
              </span>
            ) : null}
          </div>
        </div>
        <button
          onClick={handleCopy}
          title="Copy to clipboard"
          className="mt-1 p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-xs"
        >
          {copied ? (
            <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto overflow-x-auto font-mono p-3 bg-gray-50 dark:bg-gray-950 max-h-[420px]">
        {error ? (
          <div className="text-red-500 text-xs p-2 bg-red-50 dark:bg-red-950/30 rounded border border-red-200 dark:border-red-800">
            Error: {error}
          </div>
        ) : (
          <div>{lines}</div>
        )}
      </div>
    </div>
  )
}
