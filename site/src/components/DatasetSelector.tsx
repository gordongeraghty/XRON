import { PRESETS, Preset } from '../data/presets'

interface DatasetSelectorProps {
  selectedId: string
  onChange: (id: string) => void
}

export default function DatasetSelector({ selectedId, onChange }: DatasetSelectorProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
        Dataset (Select One)
      </label>
      <select
        value={selectedId}
        onChange={e => onChange(e.target.value)}
        className="w-full max-w-lg px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 cursor-pointer"
      >
        {PRESETS.map((p: Preset) => (
          <option key={p.id} value={p.id}>
            {p.name} — {p.description}
          </option>
        ))}
      </select>
    </div>
  )
}
