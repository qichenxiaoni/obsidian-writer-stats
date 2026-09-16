import type { CountResult } from "../domain/CountResult";

export interface CountDelta {
  added: CountResult;
  deleted: CountResult;
  net: CountResult;
}

function createEmptyCount(): CountResult {
  return {
    chinese: 0,
    englishWords: 0,
    englishChars: 0,
    numbers: 0,
    punctuation: 0,
    spaces: 0,
    total: 0
  };
}

export function diffCounts(
  previous: CountResult,
  current: CountResult
): CountDelta {
  const added = createEmptyCount();
  const deleted = createEmptyCount();
  const net = createEmptyCount();

  const keys: Array<keyof CountResult> = [
    "chinese",
    "englishWords",
    "englishChars",
    "numbers",
    "punctuation",
    "spaces",
    "total"
  ];

  for (const key of keys) {
    const delta = current[key] - previous[key];

    net[key] = delta;

    if (delta > 0) {
      added[key] = delta;
    } else if (delta < 0) {
      deleted[key] = Math.abs(delta);
    }
  }

  return {
    added,
    deleted,
    net
  };
}