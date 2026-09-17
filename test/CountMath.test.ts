import {
    addCounts,
    createEmptyCount
} from "../src/core/CountMath";

describe("CountMath" , () => {
    test("createEmptyCount 返回全 0", () => {
        const result = createEmptyCount();

        expect(result).toEqual({
            chinese: 0,
            englishWords: 0,
            englishChars: 0,
            numbers: 0,
            punctuation: 0,
            spaces: 0,
            total: 0
        });
    });

    test("addCounts 正确累加两个 CountResult", () => {
        const a = {
            chinese: 10,
            englishWords: 2,
            englishChars: 8,
            numbers: 1,
            punctuation: 2,
            spaces: 3,
            total: 21
        };

        const b = {
            chinese: 5,
            englishWords: 1,
            englishChars: 4,
            numbers: 2,
            punctuation: 1,
            spaces: 2,
            total: 12
        };

        const result = addCounts(a,b);

        expect(result.chinese).toBe(15);
        expect(result.englishWords).toBe(3);
        expect(result.englishChars).toBe(12);
        expect(result.numbers).toBe(3);
        expect(result.punctuation).toBe(3);
        expect(result.spaces).toBe(5);
        expect(result.total).toBe(33);
    });
});