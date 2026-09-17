import type { CountResult } from "src/domain/CountResult";

export function createEmptyCount(): CountResult {
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

export function addCounts(
    a: CountResult,
    b: CountResult
): CountResult {
    return {
        chinese: a.chinese + b.chinese,
        englishWords: a.englishWords + b.englishWords,
        englishChars: a.englishChars + b.englishChars,
        numbers: a.numbers + b.numbers,
        punctuation: a.punctuation + b.punctuation,
        spaces: a.spaces + b.spaces,
        total: a.total + b.total
    };
}