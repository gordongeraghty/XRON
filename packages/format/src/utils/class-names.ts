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
  private usedNames = new Set<string>();

  next(): string {
    let name: string;
    do {
      name = generateClassName(this.index++);
    } while (this.usedNames.has(name));
    this.usedNames.add(name);
    return name;
  }

  reset(): void {
    this.index = 0;
    this.usedNames.clear();
  }
}
