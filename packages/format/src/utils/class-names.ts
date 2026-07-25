/**
 * Sequential class name generator: A, B, C, ..., Z, A0, B0, ..., Z0, A1, ...
 */

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function generateClassName(index: number): string {
  if (index < 26) {
    return LETTERS[index];
  }
  const suffix = Math.floor((index - 26) / 26);
  const letter = LETTERS[(index - 26) % 26];
  return `${letter}${suffix}`;
}

export class ClassNameGenerator {
  private index = 0;

  // generateClassName is injective over an increasing index (A..Z, then
  // A0..Z0, A1..Z1, ...), so names cannot repeat and no dedup set is needed.
  next(): string {
    return generateClassName(this.index++);
  }
}
