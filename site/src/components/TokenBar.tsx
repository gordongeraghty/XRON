import { FormatId, FORMAT_LABELS } from '../utils/formatters'

interface TokenBarProps {
  counts: Record<FormatId, number>
  charCounts: Record<FormatId, number>
  activeFormats: FormatId[]
  baselineFormat: FormatId
}

const BAR_COLORS: Record<FormatId, string> = {
  'json':        'bg-slate-400 dark:bg-slate-500',
  'json-pretty': 'bg-blue-400 dark:bg-blue-500',
  'xron-1':      'bg-violet-400 dark:bg-violet-500',
  'xron-2':      'bg-purple-500 dark:bg-purple-400',
  'xron-3':      'bg-fuchsia-500 dark:bg-fuchsia-400',
  'xron-auto':   'bg-indigo-500 dark:bg-indigo-400',
  'yaml':        'bg-amber-400 dark:bg-amber-500',
}

export default function TokenBar({ counts, charCounts, activeFormats, baselineFormat }: TokenBarProps) {
  const maxTokens = Math.max(...activeFormats.map(f => counts[f] ?? 0), 1)
  const maxChars = Math.max(...activeFormats.map(f => charCounts[f] ?? 0), 1)

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-sm space-y-6">
      {/* Token count section */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">
          Token Count Comparison
        </div>
        <div className="flex flex-col gap-3">
          {activeFormats.map(fmt => {
            const count = counts[fmt] ?? 0
            const pct = maxTokens > 0 ? (count / maxTokens) * 100 : 0
            const isBaseline = fmt === baselineFormat
            return (
              <div key={fmt} className="flex items-center gap-3">
                <div className="w-20 text-xs text-right text-gray-500 dark:text-gray-400 font-mono shrink-0">
                  {FORMAT_LABELS[fmt]}
                </div>
                <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${BAR_COLORS[fmt]}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="w-24 text-xs text-right font-mono tabular-nums text-gray-700 dark:text-gray-300 shrink-0">
                  {count.toLocaleString()}
                  {isBaseline && <span className="ml-1 text-violet-500 text-[10px]">●</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Char count section */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">
          Character Count Comparison
        </div>
        <div className="flex flex-col gap-3">
          {activeFormats.map(fmt => {
            const count = charCounts[fmt] ?? 0
            const pct = maxChars > 0 ? (count / maxChars) * 100 : 0
            const isBaseline = fmt === baselineFormat
            return (
              <div key={fmt} className="flex items-center gap-3">
                <div className="w-20 text-xs text-right text-gray-500 dark:text-gray-400 font-mono shrink-0">
                  {FORMAT_LABELS[fmt]}
                </div>
                <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 opacity-70 ${BAR_COLORS[fmt]}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="w-24 text-xs text-right font-mono tabular-nums text-gray-700 dark:text-gray-300 shrink-0">
                  {count.toLocaleString()} ch
                  {isBaseline && <span className="ml-1 text-violet-500 text-[10px]">●</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
