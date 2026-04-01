import { XRON } from '@xron/index'
import yaml from 'js-yaml'

export type FormatId = 'json' | 'json-pretty' | 'xron-1' | 'xron-2' | 'xron-3' | 'xron-auto' | 'yaml'

export const ALL_FORMATS: FormatId[] = [
  'json',
  'json-pretty',
  'xron-1',
  'xron-2',
  'xron-3',
  'xron-auto',
  'yaml',
]

export const FORMAT_LABELS: Record<FormatId, string> = {
  'json': 'JSON',
  'json-pretty': 'Pretty JSON',
  'xron-1': 'XRON L1',
  'xron-2': 'XRON L2',
  'xron-3': 'XRON L3',
  'xron-auto': 'XRON Auto',
  'yaml': 'YAML',
}

export function formatData(data: unknown, formatId: FormatId): string {
  switch (formatId) {
    case 'json':
      return JSON.stringify(data)
    case 'json-pretty':
      return JSON.stringify(data, null, 2)
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
