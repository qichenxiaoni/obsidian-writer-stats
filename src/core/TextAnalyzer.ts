import type { CountResult } from "src/domain/CountResult";

export class TextAnalyzer {
    analyze(text: string): CountResult {
        let chinese = 0;
        let englishChars = 0;
        let numbers = 0;
        let punctuation = 0;
        let spaces = 0;

        for (const char of text) {
            if (/\p{Script=Han}/u.test(char)) {
                chinese++;
                continue;
            }

            if (/[A-Za-z]/.test(char)) {
                englishChars++;
                continue;
            }

            if (/\p{N}/u.test(char)) {
                numbers++;
                continue;
            }

            if (/\p{P}/u.test(char)) {
                punctuation++;
                continue;
            }

            if (/\s/u.test(char)) {
                spaces++
            }
        }

        const englishWords = text.match(/[A-Za-z]+(?:['’._-][A-Za-z]+)*/g)?.length ?? 0;

        return {
            chinese,
            englishWords,
            englishChars,
            numbers,
            punctuation,
            spaces,
            total:
                chinese +
                englishChars +
                numbers +
                punctuation
        };
    }
}