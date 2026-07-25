import { useState, useMemo, useCallback, useRef } from 'react'
import { XRON } from 'xron-format'
import { PRESETS } from '../data/presets'
import DatasetSelector from '../components/DatasetSelector'
import FormatPanel from '../components/FormatPanel'
import TokenBar from '../components/TokenBar'
import { ALL_FORMATS, FORMAT_LABELS, FormatId, formatData, verifyRoundTrip } from '../utils/formatters'
import { countTokens } from '../utils/tokenizer'

type TabId = 'presets' | 'custom'

type FormatResult = {
  content: string
  tokens: number
  error?: string
  /** Set when decoding this format's own output failed to reproduce the input. */
  roundTrip?: string
}

const DEFAULT_ACTIVE: FormatId[] = ['json', 'toon', 'tron', 'xron-2', 'xron-3', 'xron-auto']

export default function Playground() {
  const [tab, setTab] = useState<TabId>('presets')
  const [presetId, setPresetId] = useState(PRESETS[0].id)
  const [customJson, setCustomJson] = useState('{\n  "hello": "world"\n}')
  const [customError, setCustomError] = useState<string | null>(null)
  const [activeFormats, setActiveFormats] = useState<FormatId[]>(DEFAULT_ACTIVE)
  const [baseline, setBaseline] = useState<FormatId>('json')
  const [highlightTokens, setHighlightTokens] = useState(false)

  const data = useMemo(() => {
    if (tab === 'presets') {
      const preset = PRESETS.find(p => p.id === presetId)
      return preset ? preset.data() : null
    } else {
      try {
        return JSON.parse(customJson)
      } catch {
        return null
      }
    }
  }, [tab, presetId, customJson])

  const handleCustomChange = useCallback((val: string) => {
    setCustomJson(val)
    try {
      JSON.parse(val)
      setCustomError(null)
    } catch (e: unknown) {
      setCustomError(e instanceof Error ? e.message : 'Invalid JSON')
    }
  }, [])

  const formatResults = useMemo(() => {
    if (!data) return {} as Record<FormatId, FormatResult>
    const results: Partial<Record<FormatId, FormatResult>> = {}
    for (const fmt of ALL_FORMATS) {
      try {
        const content = formatData(data, fmt)
        // Encode then decode: a format that claims losslessness has to prove it
        // here, on the page people use to evaluate it.
        results[fmt] = {
          content,
          tokens: countTokens(content),
          roundTrip: verifyRoundTrip(data, fmt, content) ?? undefined,
        }
      } catch (e: unknown) {
        results[fmt] = {
          content: '',
          tokens: 0,
          error: e instanceof Error ? e.message : 'Unknown error',
        }
      }
    }
    return results as Record<FormatId, FormatResult>
  }, [data])

  const tokenCounts = useMemo(() => {
    const counts: Partial<Record<FormatId, number>> = {}
    for (const fmt of ALL_FORMATS) {
      counts[fmt] = formatResults[fmt]?.tokens ?? 0
    }
    return counts as Record<FormatId, number>
  }, [formatResults])

  const charCounts = useMemo(() => {
    const counts: Partial<Record<FormatId, number>> = {}
    for (const fmt of ALL_FORMATS) {
      counts[fmt] = formatResults[fmt]?.content.length ?? 0
    }
    return counts as Record<FormatId, number>
  }, [formatResults])

  const recommendation = useMemo(() => {
    if (!data) return null
    try {
      return XRON.recommend(data)
    } catch {
      return null
    }
  }, [data])

  // Detect whether auto mode fell back to raw JSON (Never-Worse Guarantee)
  const autoUsedJson = useMemo(() => {
    const autoContent = formatResults['xron-auto']?.content ?? ''
    const jsonContent = formatResults['json']?.content ?? ''
    return autoContent.length > 0 && autoContent === jsonContent
  }, [formatResults])

  const [showCaveats, setShowCaveats] = useState(false)
  const [showWhySmaller, setShowWhySmaller] = useState(false)
  const [copiedXron, setCopiedXron] = useState(false)
  const [sharedStats, setSharedStats] = useState(false)

  const baselineTokens = tokenCounts[baseline] ?? 0

  const toggleFormat = (fmt: FormatId) => {
    setActiveFormats(prev =>
      prev.includes(fmt) ? prev.filter(f => f !== fmt) : [...prev, fmt]
    )
  }

  const handleCopyXron = () => {
    const xronContent = formatResults['xron-auto']?.content ?? formatResults['xron-3']?.content ?? ''
    if (!xronContent) return
    navigator.clipboard.writeText(xronContent).then(() => {
      setCopiedXron(true)
      setTimeout(() => setCopiedXron(false), 1500)
    })
  }

  const handleShareStats = () => {
    const jsonTokens = tokenCounts['json'] ?? 0
    const xronTokens = tokenCounts['xron-auto'] ?? tokenCounts['xron-3'] ?? 0
    if (jsonTokens === 0) return
    const pct = Math.round(((jsonTokens - xronTokens) / jsonTokens) * 100)
    const text = `I compressed my JSON by ${pct}% using XRON! https://github.com/gordongeraghty/XRON`
    navigator.clipboard.writeText(text).then(() => {
      setSharedStats(true)
      setTimeout(() => setSharedStats(false), 2000)
    })
  }

  return (
    <main className="max-w-screen-xl mx-auto px-4 py-8">
      {/* Page title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Playground</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Compare token usage across different formats using GPT-4o tokenization (o200k_base).
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
        {(['presets', 'custom'] as TabId[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-violet-500 text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {t === 'presets' ? 'Presets' : 'Custom Data'}
          </button>
        ))}
      </div>

      {/* Input section */}
      <div className="mb-6">
        {tab === 'presets' ? (
          <DatasetSelector selectedId={presetId} onChange={setPresetId} />
        ) : (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
              Paste JSON
            </label>
            <textarea
              value={customJson}
              onChange={e => handleCustomChange(e.target.value)}
              rows={8}
              spellCheck={false}
              className={`w-full font-mono text-sm px-3 py-2 rounded-lg border bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 resize-y ${
                customError
                  ? 'border-red-400 focus:ring-red-400'
                  : 'border-emerald-400 focus:ring-emerald-400'
              }`}
            />
            {customError && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">{customError}</p>
            )}
            {!customError && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">Valid JSON</p>
            )}
          </div>
        )}
      </div>

      {/* Recommendation panel */}
      {recommendation && (
        <div className="mb-6 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 p-4 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-lg leading-none select-none">💡</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-indigo-800 dark:text-indigo-200 mb-0.5">
                {autoUsedJson ? (
                  <>
                    Recommendation: Raw JSON
                    <span className="ml-2 text-xs font-normal text-[#ff6600]">(Auto-mode selected raw JSON — payload too small for XRON compression overhead)</span>
                  </>
                ) : (
                  <>
                    Recommendation: Level {recommendation.recommendedLevel}
                    {!recommendation.willCompress && (
                      <span className="ml-2 text-xs font-normal text-indigo-500 dark:text-indigo-400">(compression skipped — payload too small)</span>
                    )}
                  </>
                )}
              </p>
              <p className="text-indigo-700 dark:text-indigo-300 mb-1">{recommendation.reason}</p>
              <p className="text-xs text-indigo-500 dark:text-indigo-400">
                Characteristics:{' '}
                {recommendation.characteristics.distinctSchemas} schema{recommendation.characteristics.distinctSchemas !== 1 ? 's' : ''} ·{' '}
                {recommendation.characteristics.dictionaryPotential} dictionary entr{recommendation.characteristics.dictionaryPotential !== 1 ? 'ies' : 'y'} ·{' '}
                {recommendation.characteristics.hasDeltaColumns ? 'delta columns detected' : 'no delta columns'} ·{' '}
                {recommendation.characteristics.jsonSize.toLocaleString()} chars
              </p>
              {recommendation.caveats.length > 0 && (
                <div className="mt-2">
                  <button
                    onClick={() => setShowCaveats(v => !v)}
                    className="text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-200 underline underline-offset-2 transition-colors"
                  >
                    {showCaveats ? 'Hide caveats' : `Show caveats (${recommendation.caveats.length})`}
                  </button>
                  {showCaveats && (
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {recommendation.caveats.map((c: string, i: number) => (
                        <li key={i} className="text-xs text-indigo-600 dark:text-indigo-400 flex gap-1.5">
                          <span className="select-none shrink-0">⚠</span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <div className="mt-2">
                <button
                  onClick={() => setShowWhySmaller(v => !v)}
                  className="text-xs text-[#ff6600] hover:text-[#cc5200] underline underline-offset-2 transition-colors"
                >
                  {showWhySmaller ? 'Hide explanation' : 'Why is this smaller?'}
                </button>
                {showWhySmaller && (
                  <div className="mt-1.5 text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg p-3 space-y-1">
                    <p><strong>XRON</strong> is strictly lossless — it preserves exact data types (BigInt, Date, null) through round-trip serialisation. This requires schema headers (@S, @D, @N) that add overhead on small payloads.</p>
                    <p><strong>TOON/TRON</strong> use lighter notation but lack dictionary encoding, delta compression, and type-aware encoding — so they fall behind on larger datasets.</p>
                    <p><strong>Auto mode</strong> guarantees "never worse than JSON": if no XRON level beats raw JSON, it returns JSON directly.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Format toggles + controls row */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        {/* Format buttons */}
        <div className="flex flex-wrap gap-1.5">
          {ALL_FORMATS.map(fmt => (
            <button
              key={fmt}
              onClick={() => toggleFormat(fmt)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                activeFormats.includes(fmt)
                  ? 'bg-violet-600 border-violet-600 text-white shadow-sm'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400'
              }`}
            >
              {FORMAT_LABELS[fmt]}
            </button>
          ))}
        </div>

        {/* Right-side controls */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Baseline selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Baseline:</span>
            <select
              value={baseline}
              onChange={e => setBaseline(e.target.value as FormatId)}
              className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {ALL_FORMATS.map(fmt => (
                <option key={fmt} value={fmt}>{FORMAT_LABELS[fmt]}</option>
              ))}
            </select>
          </div>

          {/* Highlight tokens toggle */}
          <button
            onClick={() => setHighlightTokens(h => !h)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              highlightTokens
                ? 'bg-amber-500/20 border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-amber-400'
            }`}
          >
            <span className={`w-2 h-2 rounded-full inline-block ${highlightTokens ? 'bg-amber-500' : 'bg-gray-400'}`} />
            Highlight Tokens
          </button>
        </div>
      </div>

      {/* Format panels */}
      {activeFormats.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-600 text-sm">
          Select at least one format above to compare.
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 mb-8">
          {activeFormats.map(fmt => (
            <FormatPanel
              key={fmt}
              formatId={fmt}
              content={formatResults[fmt]?.content ?? ''}
              tokenCount={formatResults[fmt]?.tokens ?? 0}
              baselineTokens={baselineTokens}
              isBaseline={fmt === baseline}
              highlightTokens={highlightTokens}
              error={formatResults[fmt]?.error}
              roundTripError={formatResults[fmt]?.roundTrip}
              labelOverride={fmt === 'xron-auto' && autoUsedJson ? 'XRON Auto (JSON Fallback)' : undefined}
            />
          ))}
        </div>
      )}

      {/* XRON action buttons */}
      {activeFormats.length > 0 && data && (
        <div className="flex gap-3 mb-6">
          <button
            onClick={handleCopyXron}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-[#ff6600] text-[#ff6600] hover:bg-[#ff6600] hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {copiedXron ? 'Copied!' : 'Copy XRON'}
          </button>
          <button
            onClick={handleShareStats}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-[#ff6600] hover:text-[#ff6600] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            {sharedStats ? 'Copied to clipboard!' : 'Share Stats'}
          </button>
        </div>
      )}

      {/* Token bar chart */}
      {activeFormats.length > 0 && (
        <TokenBar
          counts={tokenCounts}
          charCounts={charCounts}
          activeFormats={activeFormats}
          baselineFormat={baseline}
        />
      )}
    </main>
  )
}
