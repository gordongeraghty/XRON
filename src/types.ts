/**
 * XRON: Extensible Reduced Object Notation
 * Core type definitions
 */

/** Compression level */
export type XronLevel = 1 | 2 | 3;

/**
 * Level or 'auto'.
 * When 'auto', XRON analyses the data characteristics and picks the level that
 * gives the best token reduction without wasting overhead on compression
 * layers that won't activate (e.g. dictionary on data with no repetition).
 */
export type XronLevelOrAuto = XronLevel | 'auto';

/** Supported BPE tokenizer profiles */
export type TokenizerProfile = 'o200k_base' | 'cl100k_base' | 'claude';

/** Serialization options */
export interface XronOptions {
  /**
   * Compression level.
   * - `1` — Human-readable: schema extraction + positional streaming (~55–65% reduction)
   * - `2` — Compact: adds dictionary encoding + type compaction (~65–75% reduction)
   * - `3` — Maximum: adds delta + repeat encoding (~70–80% reduction)
   * - `'auto'` — Adaptive: analyses data and picks the optimal level automatically.
   *              Uses `minCompressSize` to skip compression for tiny payloads.
   * Default: `2`
   */
  level?: XronLevelOrAuto;
  /** Tokenizer profile for Level 3 optimization. Default: 'o200k_base' */
  tokenizer?: TokenizerProfile;
  /** Indentation width for Level 1 nested objects. Default: 2 */
  indent?: number;
  /** Maximum dictionary entries for Level 2+. Default: 256 */
  maxDictSize?: number;
  /** Minimum occurrences to enable delta encoding. Default: 3 */
  deltaThreshold?: number;
  /** Minimum string length for dictionary inclusion. Default: 2 */
  minDictValueLength?: number;
  /** Minimum frequency for dictionary inclusion. Default: 2 */
  minDictFrequency?: number;
  /**
   * Minimum JSON byte size before XRON compression is attempted.
   * Payloads below this threshold are returned as plain JSON (level 'auto')
   * or as XRON L1 (fixed levels), because the header overhead exceeds the savings.
   *
   * Only applies when `level` is `'auto'`. Ignored for fixed levels 1–3.
   * Default: `0` (always compress).
   *
   * Recommended: `150` for typical LLM prompt assembly use cases.
   */
  minCompressSize?: number;
}

/** Analysis result showing compression metrics */
export interface XronAnalysis {
  /** Estimated token count for JSON.stringify output */
  inputTokens: number;
  /** Estimated token count for XRON output */
  outputTokens: number;
  /** Percentage reduction (0-100) */
  reduction: number;
  /** Number of schemas extracted */
  schemas: number;
  /** Number of dictionary entries */
  dictEntries: number;
  /** Number of columns with delta encoding applied */
  deltaColumns: number;
  /** Per-level breakdown */
  breakdown: {
    level1Tokens: number;
    level2Tokens: number;
    level3Tokens: number;
  };
}

/** Internal schema definition */
export interface SchemaDefinition {
  /** Short schema name (A, B, C, ... Z, A0, B0, ...) */
  name: string;
  /** Full schema name for Level 1 (e.g., 'User', 'Address') */
  fullName: string;
  /** Ordered list of property keys */
  fields: string[];
  /** Signature for matching: sorted keys joined by comma */
  signature: string;
  /** Number of instances found */
  frequency: number;
  /** Nested schema references (field index → schema name) */
  nestedSchemas: Map<number, string>;
  /** Field type hints (field index → detected type) for lossless round-tripping */
  fieldTypes: Map<number, 'boolean' | 'number' | 'string' | 'null' | 'mixed'>;
}

/** Internal dictionary entry */
export interface DictionaryEntry {
  /** Original string value */
  value: string;
  /** Dictionary index (0-based) */
  index: number;
  /** Number of occurrences in data */
  frequency: number;
  /** Estimated token savings per occurrence */
  savings: number;
}

/** Delta encoding metadata for a column */
export interface DeltaColumnInfo {
  /** Column index in the schema */
  columnIndex: number;
  /** Type of delta: 'numeric' | 'temporal' */
  type: 'numeric' | 'temporal';
  /** Whether all deltas are constant */
  isConstant: boolean;
  /** The constant delta value (if isConstant) */
  constantDelta: number | null;
}

/** Token types for the XRON lexer */
export enum TokenType {
  // Headers
  VersionHeader = 'VERSION_HEADER',
  SchemaHeader = 'SCHEMA_HEADER',
  DictHeader = 'DICT_HEADER',
  CardinalityHeader = 'CARDINALITY_HEADER',

  // Values
  String = 'STRING',
  QuotedString = 'QUOTED_STRING',
  Number = 'NUMBER',
  Boolean = 'BOOLEAN',
  Null = 'NULL',
  DictRef = 'DICT_REF',
  Delta = 'DELTA',
  Repeat = 'REPEAT',
  SameAsPrev = 'SAME_AS_PREV',

  // Structure
  Comma = 'COMMA',
  Colon = 'COLON',
  Newline = 'NEWLINE',
  Indent = 'INDENT',
  OpenParen = 'OPEN_PAREN',
  CloseParen = 'CLOSE_PAREN',
  OpenBracket = 'OPEN_BRACKET',
  CloseBracket = 'CLOSE_BRACKET',

  // Special
  SchemaRef = 'SCHEMA_REF',
  EOF = 'EOF',
  Comment = 'COMMENT',
}

/** Lexer token */
export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

/** Internal representation of parsed XRON structure */
export interface XronDocument {
  version: XronLevel;
  schemas: Map<string, SchemaDefinition>;
  dictionary: string[];
  data: any;
}

/** Default options */
export const DEFAULT_OPTIONS: Required<XronOptions> = {
  level: 2,
  tokenizer: 'o200k_base',
  indent: 2,
  maxDictSize: 256,
  deltaThreshold: 3,
  minDictValueLength: 2,
  minDictFrequency: 2,
  minCompressSize: 0,
};
