import { XRON } from '@xron/index'
import yaml from 'js-yaml'

export type FormatId =
  | 'json'
  | 'json-pretty'
  | 'toon'
  | 'tron'
  | 'xron-1'
  | 'xron-2'
  | 'xron-3'
  | 'xron-auto'
  | 'yaml'

export const ALL_FORMATS: FormatId[] = [
  'json',
  'json-pretty',
  'toon',
  'tron',
  'xron-1',
  'xron-2',
  'xron-3',
  'xron-auto',
  'yaml',
]

export const FORMAT_LABELS: Record<FormatId, string> = {
  json: 'JSON',
  'json-pretty': 'Pretty JSON',
  toon: 'TOON',
  tron: 'TRON',
  'xron-1': 'XRON L1',
  'xron-2': 'XRON L2',
  'xron-3': 'XRON L3',
  'xron-auto': 'XRON Auto',
  yaml: 'YAML',
}

export function formatData(data: unknown, formatId: FormatId): string {
  switch (formatId) {
    case 'json':
      return JSON.stringify(data)
    case 'json-pretty':
      return JSON.stringify(data, null, 2)
    case 'toon':
      return toToon(data)
    case 'tron':
      return toTron(data)
    case 'xron-1':
      return XRON.stringify(data, { level: 1 })
    case 'xron-2':
      return XRON.stringify(data, { level: 2 })
    case 'xron-3':
      return XRON.stringify(data, { level: 3 })
    case 'xron-auto':
      return XRON.stringify(data, { level: 'auto' })
    case 'yaml':
      return yaml.dump(data)
  }
}

// ─── TOON encoder ────────────────────────────────────────────────────────────
// TOON: Terse Object-Oriented Notation
//   - Arrays of uniform objects → header row + indented value rows
//   - Nested objects → indented key: value blocks
//   - No dictionary, no delta, no type compaction

function toToon(data: unknown): string {
  if (data === null || data === undefined) return 'null'
  if (typeof data !== 'object') return String(data)

  if (Array.isArray(data)) {
    if (data.length === 0) return '[]'
    // Check if uniform objects
    if (data.every(item => item !== null && typeof item === 'object' && !Array.isArray(item))) {
      const keys = Object.keys(data[0] as Record<string, unknown>)
      const allSameShape = data.every(item => {
        const k = Object.keys(item as Record<string, unknown>)
        return k.length === keys.length && k.every((kk, i) => kk === keys[i])
      })
      if (allSameShape && keys.length >= 2) {
        const lines: string[] = []
        lines.push(`[${data.length}]:`)
        lines.push(`  - ${keys.join(', ')}`)
        for (const item of data) {
          const obj = item as Record<string, unknown>
          const vals = keys.map(k => toonValue(obj[k]))
          lines.push(`  ${vals.join(', ')}`)
        }
        return lines.join('\n')
      }
    }
    // Non-uniform array — fall back to indented list
    return data.map(item => `- ${toonValue(item)}`).join('\n')
  }

  // Object — key: value pairs
  return toonObject(data as Record<string, unknown>, 0)
}

function toonObject(obj: Record<string, unknown>, depth: number): string {
  const indent = '  '.repeat(depth)
  const lines: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      lines.push(`${indent}${k}:`)
      lines.push(toonObject(v as Record<string, unknown>, depth + 1))
    } else {
      lines.push(`${indent}${k}: ${toonValue(v)}`)
    }
  }
  return lines.join('\n')
}

function toonValue(v: unknown): string {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'string') return v
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') return String(v)
  if (Array.isArray(v)) return `[${v.map(toonValue).join(', ')}]`
  if (typeof v === 'object') {
    const pairs = Object.entries(v as Record<string, unknown>).map(
      ([k, val]) => `${k}: ${toonValue(val)}`
    )
    return `{${pairs.join(', ')}}`
  }
  return String(v)
}

// ─── TRON encoder ────────────────────────────────────────────────────────────
// TRON: Terse Reduced Object Notation
//   - Class declarations for repeated object shapes (short names)
//   - Each data row prefixed with class name
//   - No dictionary, no delta, no type compaction

function toTron(data: unknown): string {
  if (data === null || data === undefined) return 'null'
  if (typeof data !== 'object') return String(data)

  if (Array.isArray(data)) {
    if (data.length === 0) return '[]'
    // Check if uniform objects
    if (data.every(item => item !== null && typeof item === 'object' && !Array.isArray(item))) {
      const keys = Object.keys(data[0] as Record<string, unknown>)
      const allSameShape = data.every(item => {
        const k = Object.keys(item as Record<string, unknown>)
        return k.length === keys.length && k.every((kk, i) => kk === keys[i])
      })
      if (allSameShape && keys.length >= 2) {
        const lines: string[] = []
        lines.push(`class A: ${keys.join(', ')}`)
        for (const item of data) {
          const obj = item as Record<string, unknown>
          const vals = keys.map(k => tronValue(obj[k]))
          lines.push(`A ${vals.join(', ')}`)
        }
        return lines.join('\n')
      }
    }
    // Non-uniform — fall back to JSON-like
    return data.map(item => tronValue(item)).join('\n')
  }

  // Single object — key: value pairs (TRON doesn't define a schema for single objects)
  const pairs = Object.entries(data as Record<string, unknown>).map(
    ([k, v]) => `${k}: ${tronValue(v)}`
  )
  return pairs.join('\n')
}

function tronValue(v: unknown): string {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'string') return v
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') return String(v)
  if (Array.isArray(v)) return `[${v.map(tronValue).join(', ')}]`
  if (typeof v === 'object') {
    const pairs = Object.entries(v as Record<string, unknown>).map(
      ([k, val]) => `${k}: ${tronValue(val)}`
    )
    return `{${pairs.join(', ')}}`
  }
  return String(v)
}
