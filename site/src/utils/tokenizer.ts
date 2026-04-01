import { encode, decode } from 'gpt-tokenizer'

export function countTokens(text: string): number {
  try {
    return encode(text).length
  } catch {
    return 0
  }
}

export interface TokenSegment {
  text: string
  tokenIndex: number
}

export function tokenizeText(text: string): TokenSegment[] {
  try {
    const tokenIds = encode(text)
    const segments: TokenSegment[] = []

    for (let i = 0; i < tokenIds.length; i++) {
      const tokenText = decode([tokenIds[i]])
      segments.push({ text: tokenText, tokenIndex: i })
    }

    return segments
  } catch {
    // Fallback: return entire text as one segment
    return [{ text, tokenIndex: 0 }]
  }
}
