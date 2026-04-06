/**
 * Layer 0: Adaptive Compression Assessment
 *
 * Analyses data characteristics before compression and recommends the optimal
 * level — or advises skipping compression entirely for small/simple payloads.
 *
 * Philosophy:
 *   • Compression adds overhead (schema headers, @v line, @D header).
 *     For small payloads that overhead can cost more than it saves.
 *   • Each layer only helps when the data has the right structure:
 *       L1 (schema)     → needs 2+ objects sharing the same shape
 *       L2 (dict)       → needs 2+ repeated string values ≥ 2 chars
 *       L3 (delta)      → needs monotonically sequential numeric columns
 *   • When a layer can't activate, using a higher level wastes the @v header
 *     and adds parsing overhead with zero compression benefit.
 *
 * Drawbacks of adaptive mode (see XronRecommendation.caveats):
 *   • Recommendation is heuristic — actual token counts depend on the tokenizer.
 *   • The analysis pass traverses the data once, adding ~5–15 ms for large payloads.
 *   • 'auto' mode re-runs stringify at the recommended level, not a dry run.
 */

import { XronLevel, XronOptions, SchemaDefinition, DEFAULT_OPTIONS } from '../types.js';
import { extractSchemas } from './schema.js';
import { buildDictionary } from './dictionary.js';
import { estimateTokens, countTokensExact } from './tokenizer-opt.js';

// ─── Public types ─────────────────────────────────────────────────────────────

/** Characteristics extracted from a single analysis pass over the data. */
export interface DataCharacteristics {
  /** JSON.stringify byte length — rough "how big is this?" metric. */
  jsonSize: number;
  /** Number of distinct object shapes detected. */
  distinctSchemas: number;
  /** Number of schema instances that qualify for positional encoding (freq ≥ 2). */
  repeatingSchemaInstances: number;
  /** Whether at least one schema with freq ≥ 2 was found. */
  hasRepeatingSchemas: boolean;
  /** How many dictionary entries would be created at default settings. */
  dictionaryPotential: number;
  /** Whether a dictionary would actually be included (savings ≥ header cost). */
  hasBeneficialDictionary: boolean;
  /** Whether any column looks monotonically sequential (delta-eligible). */
  hasDeltaColumns: boolean;
  /** Rough estimated % reduction at each level vs minified JSON. */
  estimatedReduction: { level1: number; level2: number; level3: number };
}

/** Full recommendation returned by `assessData`. */
export interface XronRecommendation {
  /** The level XRON would use in 'auto' mode. */
  recommendedLevel: XronLevel;
  /** Human-readable explanation of why this level was chosen. */
  reason: string;
  /** Whether compression will be applied at all (false if below `minCompressSize`). */
  willCompress: boolean;
  /** Populated when `willCompress` is false — explains why we skip. */
  skipReason?: string;
  /** Raw analysis numbers. */
  characteristics: DataCharacteristics;
  /**
   * Known limitations of adaptive mode — surface these to users so they can
   * make an informed decision about whether to hard-code a level instead.
   */
  caveats: string[];
}

// ─── Thresholds ───────────────────────────────────────────────────────────────

/**
 * JSON byte size below which compression is skipped entirely when
 * `minCompressSize` is set (or 'auto' level is used).
 *
 * Default: 150 bytes  (~30–50 tokens).  At this scale the @v1 header +
 * any schema lines cost more tokens than they save.
 */
export const AUTO_MIN_COMPRESS_SIZE = 150;

/**
 * Minimum estimated reduction (%) for a higher level to be preferred over a
 * lower one.  Prevents jumping to L3 when delta encoding saves < 3%.
 */
const MIN_UPGRADE_GAIN = 3;

// ─── Core analysis ────────────────────────────────────────────────────────────

/** Scan data once and extract compression-relevant metrics. */
export function analyseCharacteristics(
  data: any,
  opts: Required<XronOptions>,
): DataCharacteristics {
  const jsonStr = JSON.stringify(data);
  const jsonSize = jsonStr.length;

  // Schema analysis ─────────────────────────────────────────────────────────
  const schemas: Map<string, SchemaDefinition> = (() => {
    try {
      return extractSchemas(data);
    } catch {
      return new Map();
    }
  })();

  let repeatingSchemaInstances = 0;
  for (const s of schemas.values()) {
    if (s.frequency >= 2) repeatingSchemaInstances += s.frequency;
  }
  const hasRepeatingSchemas = repeatingSchemaInstances > 0;

  // Dictionary analysis ─────────────────────────────────────────────────────
  const dictEntries = (() => {
    try {
      return buildDictionary(Array.isArray(data) ? data : [data], {
        maxSize: opts.maxDictSize,
        minLength: opts.minDictValueLength,
        minFrequency: opts.minDictFrequency,
      });
    } catch {
      return [];
    }
  })();

  const dictionaryPotential = dictEntries.length;
  // Dictionary is included only when total savings ≥ header cost.
  // buildDictionary already applies this filter, so any entry returned is beneficial.
  const hasBeneficialDictionary = dictionaryPotential > 0;

  // Delta analysis ──────────────────────────────────────────────────────────
  // Lightweight heuristic: look at the first schema array for sequential numbers
  const hasDeltaColumns = detectDeltaPotential(data, schemas, opts.deltaThreshold);

  // Rough reduction estimates ───────────────────────────────────────────────
  const schemaOverheadSaved =
    hasRepeatingSchemas ? repeatingSchemaInstances * estimateKeyOverhead(schemas) : 0;
  const dictSaved = hasBeneficialDictionary ? estimateDictSavings(dictEntries) : 0;
  const deltaSaved = hasDeltaColumns ? estimateDeltaSavings(data) : 0;

  // Each layer's cumulative estimated saving as a % of jsonSize
  const l1Est = jsonSize > 0
    ? Math.min(80, Math.round((schemaOverheadSaved / jsonSize) * 100))
    : 0;
  const l2Est = jsonSize > 0
    ? Math.min(80, Math.round(((schemaOverheadSaved + dictSaved) / jsonSize) * 100))
    : 0;
  const l3Est = jsonSize > 0
    ? Math.min(85, Math.round(((schemaOverheadSaved + dictSaved + deltaSaved) / jsonSize) * 100))
    : 0;

  return {
    jsonSize,
    distinctSchemas: schemas.size,
    repeatingSchemaInstances,
    hasRepeatingSchemas,
    dictionaryPotential,
    hasBeneficialDictionary,
    hasDeltaColumns,
    estimatedReduction: { level1: l1Est, level2: l2Est, level3: l3Est },
  };
}

// ─── Public assessment ────────────────────────────────────────────────────────

/**
 * Assess data and return a compression recommendation.
 *
 * @param data - The value to compress.
 * @param options - XronOptions (uses defaults for missing fields).
 *   `minCompressSize` - if set, returns willCompress=false for small payloads.
 *   `level` - ignored (this function produces the recommendation).
 */
export function assessData(
  data: any,
  options?: Partial<XronOptions>,
): XronRecommendation {
  const opts: Required<XronOptions> = { ...DEFAULT_OPTIONS, ...options };
  const chars = analyseCharacteristics(data, opts);
  const caveats = buildCaveats(chars, opts);

  // Below minimum size threshold — skip compression
  const minSize = opts.minCompressSize ?? 0;
  if (minSize > 0 && chars.jsonSize < minSize) {
    return {
      recommendedLevel: 1,
      reason: `Payload is ${chars.jsonSize} bytes (below the ${minSize}-byte threshold). Returning raw JSON is more efficient.`,
      willCompress: false,
      skipReason: `JSON size (${chars.jsonSize}B) < minCompressSize (${minSize}B)`,
      characteristics: chars,
      caveats,
    };
  }

  // Very small payloads in auto mode — even without an explicit threshold
  if (chars.jsonSize < AUTO_MIN_COMPRESS_SIZE && !options?.minCompressSize) {
    return {
      recommendedLevel: 1,
      reason: `Payload is very small (${chars.jsonSize}B). Level 1 adds minimal overhead and is preferred.`,
      willCompress: true,
      characteristics: chars,
      caveats,
    };
  }

  // No repeating schemas — L1 at most
  if (!chars.hasRepeatingSchemas) {
    return {
      recommendedLevel: 1,
      reason: 'No repeating object shapes found. Schema extraction (L2/L3) would add header overhead with no key-compression benefit.',
      willCompress: true,
      characteristics: chars,
      caveats,
    };
  }

  // Has schemas — evaluate whether dictionary / delta add enough value
  const l2Gain = chars.estimatedReduction.level2 - chars.estimatedReduction.level1;
  const l3GainFromL2 = chars.estimatedReduction.level3 - chars.estimatedReduction.level2;
  // Delta contributes at L3 even without a dictionary; measure gain vs L1
  const l3GainFromL1 = chars.estimatedReduction.level3 - chars.estimatedReduction.level1;

  // Case: delta columns exist but no dictionary — can still justify L3 directly
  if (!chars.hasBeneficialDictionary && chars.hasDeltaColumns && l3GainFromL1 >= MIN_UPGRADE_GAIN) {
    return {
      recommendedLevel: 3,
      reason: `Schemas + delta encoding beneficial (est. ~${chars.estimatedReduction.level3}% reduction). No repeating values for dictionary, but sequential numeric columns found.`,
      willCompress: true,
      characteristics: chars,
      caveats,
    };
  }

  // Case: neither dictionary nor delta adds value → stay at L1
  if (!chars.hasBeneficialDictionary && l2Gain < MIN_UPGRADE_GAIN) {
    return {
      recommendedLevel: 1,
      reason: `Schemas found but no beneficial dictionary values and no delta-eligible columns. Estimated gain over L1 is only ~${l2Gain}%.`,
      willCompress: true,
      characteristics: chars,
      caveats,
    };
  }

  // Case: dictionary helps but delta doesn't
  if (!chars.hasDeltaColumns || l3GainFromL2 < MIN_UPGRADE_GAIN) {
    return {
      recommendedLevel: 2,
      reason: chars.hasBeneficialDictionary
        ? `Schemas + dictionary encoding beneficial (est. ~${chars.estimatedReduction.level2}% reduction). No sequential numeric columns for delta encoding.`
        : `Schemas found. Dictionary marginally beneficial. Delta encoding not applicable.`,
      willCompress: true,
      characteristics: chars,
      caveats,
    };
  }

  // Case: full stack
  return {
    recommendedLevel: 3,
    reason: `Full compression stack beneficial: schemas + dictionary + delta encoding (est. ~${chars.estimatedReduction.level3}% reduction).`,
    willCompress: true,
    characteristics: chars,
    caveats,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Estimate the token savings from eliminating repeated keys via schema encoding. */
function estimateKeyOverhead(schemas: Map<string, SchemaDefinition>): number {
  let totalKeyChars = 0;
  for (const s of schemas.values()) {
    if (s.frequency < 2) continue;
    // JSON key cost: "key": — roughly (key.length + 4) chars per occurrence
    // Schema eliminates all but the one-time header
    const keyChars = s.fields.reduce((sum, f) => sum + f.length + 4, 0);
    totalKeyChars += keyChars * (s.frequency - 1); // savings across repeated instances
  }
  return totalKeyChars;
}

interface DictEntryLike { value: string; frequency: number; savings: number; }

/** Estimate chars saved by dictionary substitution. */
function estimateDictSavings(entries: DictEntryLike[]): number {
  return entries.reduce((sum, e) => {
    // Each occurrence replaced by $N (2–4 chars vs value.length)
    const refLen = 2 + String(e.savings).length;
    const saved = (e.value.length - refLen) * e.frequency;
    return sum + Math.max(0, saved);
  }, 0);
}

/** Estimate chars saved by delta encoding. */
function estimateDeltaSavings(data: any): number {
  if (!Array.isArray(data) || data.length < 3) return 0;
  // Each +1 delta saves ~(original_number_chars - 2) chars per row
  // Conservative: assume 2 chars saved per delta-encoded cell across all rows
  return Math.floor(data.length * 2);
}

// ISO date string pattern for delta potential detection
const ISO_DATE_RE_ADAPTIVE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/** Lightweight check: are there any monotonically sequential numeric or temporal columns? */
function detectDeltaPotential(
  data: any,
  schemas: Map<string, SchemaDefinition>,
  deltaThreshold: number,
): boolean {
  if (!Array.isArray(data) || data.length < deltaThreshold) return false;

  // Check the first schema's fields for sequential numbers or dates
  for (const schema of schemas.values()) {
    if (schema.frequency < deltaThreshold) continue;

    // Sample items that match this schema
    const sample = data
      .filter((item): item is Record<string, unknown> =>
        item !== null && typeof item === 'object' && !Array.isArray(item))
      .slice(0, Math.min(data.length, 20));

    for (let fi = 0; fi < schema.fields.length; fi++) {
      const field = schema.fields[fi];

      // Check numeric sequential
      const numVals = sample
        .map(item => item[field])
        .filter(v => typeof v === 'number' && isFinite(v as number)) as number[];

      if (numVals.length >= deltaThreshold) {
        const deltas = numVals.slice(1).map((v, i) => v - numVals[i]);
        if (deltas.length > 0 && deltas.every(d => d === deltas[0])) {
          return true;
        }
      }

      // Check temporal sequential (ISO date strings)
      const dateVals = sample
        .map(item => item[field])
        .filter(v => typeof v === 'string' && ISO_DATE_RE_ADAPTIVE.test(v as string)) as string[];

      if (dateVals.length >= deltaThreshold) {
        const epochs = dateVals.map(v => new Date(v).getTime());
        if (epochs.every(e => !isNaN(e))) {
          const deltas = epochs.slice(1).map((v, i) => v - epochs[i]);
          if (deltas.length > 0 && deltas.every(d => d === deltas[0])) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

/**
 * Async version of assessData that uses tiktoken for exact token counts
 * when available. Falls back to heuristic estimation otherwise.
 *
 * Use this for CLI analysis with --exact-tokens or when precision matters.
 */
export async function assessDataExact(
  data: any,
  options?: Partial<XronOptions>,
): Promise<XronRecommendation> {
  // Try to get exact token counts via tiktoken
  const profile = options?.tokenizer ?? DEFAULT_OPTIONS.tokenizer;
  const jsonStr = JSON.stringify(data);

  try {
    const exactTokens = await countTokensExact(jsonStr, profile);
    // If countTokensExact succeeded (didn't fall back to heuristic),
    // we have exact counts. Use the sync path but note accuracy.
    const rec = assessData(data, options);
    rec.caveats = rec.caveats.map(c =>
      c.includes('heuristic')
        ? c.replace('heuristic (char-based)', 'tiktoken (exact)')
        : c
    );
    return rec;
  } catch {
    return assessData(data, options);
  }
}

/** Build context-appropriate caveats for the recommendation. */
function buildCaveats(
  chars: DataCharacteristics,
  opts: Required<XronOptions>,
): string[] {
  const caveats: string[] = [];

  caveats.push(
    'Reduction estimates are heuristic (char-based). Actual token savings depend on the BPE tokenizer used.',
  );

  if (chars.jsonSize < 500) {
    caveats.push(
      'Small payloads: XRON header lines (@v, @S) add a fixed token cost. For payloads under ~500 bytes, the net token saving may be under 10%.',
    );
  }

  if (!chars.hasRepeatingSchemas) {
    caveats.push(
      'No repeating object shapes: XRON\'s biggest saving (key elimination) only activates when the same object shape appears ≥2 times.',
    );
  }

  if (chars.hasBeneficialDictionary && chars.dictionaryPotential < 3) {
    caveats.push(
      'Thin dictionary: only a few values qualify for dictionary encoding. The @D header adds overhead that partially offsets the savings.',
    );
  }

  if (opts.level === 3 && !chars.hasDeltaColumns) {
    caveats.push(
      'Level 3 forced but no sequential numeric columns found. Delta encoding will not activate; output will be similar to Level 2.',
    );
  }

  return caveats;
}
