// Stub for tiktoken — optional peer dependency not available in the browser build.
// The parent library wraps tiktoken usage in try/catch so this stub causes
// it to fall back to its heuristic estimator at runtime.

export interface Encoding {
  encode(text: string): Uint32Array
  free(): void
}

export function encoding_for_model(_model: string): Encoding {
  throw new Error('tiktoken not available in browser')
}

export function get_encoding(_name: string): Encoding {
  throw new Error('tiktoken not available in browser')
}
