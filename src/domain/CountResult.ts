export interface CountResult {
    chinese: number;
    englishWords: number;
    englishChars: number;
    numbers: number;
    punctuation: number;
    spaces: number;
    total: number;
}

export const EMPTY_COUNT_RESULT: CountResult = {
    chinese: 0,
    englishWords: 0,
    englishChars: 0,
    numbers: 0,
    punctuation: 0,
    spaces: 0,
    total: 0
};