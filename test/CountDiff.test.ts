import { diffCounts } from "../src/core/CountDiff";
import type { CountResult } from "../src/domain/CountResult";

function makeCount (
    overrides: Partial<CountResult> = {}
): CountResult {
    return {
        chinese: 0,
        englishWords: 0,
        englishChars: 0,
        numbers: 0,
        punctuation: 0,
        spaces: 0,
        total: 0,
        ...overrides
    };
}

describe("CountDiff", () => {
    test("新增内容被记录到 added 和 net", () => {
        const previous = makeCount({
            chinese: 100,
            total: 100
        });

        const current = makeCount({
            chinese: 120,
            total: 120
        });

        const result = diffCounts(previous, current);

        expect(result.added.chinese).toBe(20);
        expect(result.deleted.chinese).toBe(0);
        expect(result.net.chinese).toBe(20);

        expect(result.added.total).toBe(20);
        expect(result.net.total).toBe(20);
    });

    test("删除内容被记录到 deleted 和负 net", () => {
        const previous = makeCount({
            chinese: 120,
            total: 120
        });

        const current = makeCount({
            chinese: 80,
            total: 80
        });

        const result = diffCounts(previous, current);

        expect(result.added.chinese).toBe(0);
        expect(result.deleted.chinese).toBe(40);
        expect(result.net.chinese).toBe(-40);

        expect(result.deleted.total).toBe(40);
        expect(result.net.total).toBe(-40);
    });

    test("没有变化时全部为 0", () => {
        const previous = makeCount({
            chinese: 100,
            englishWords: 5,
            total: 120
        });

        const current = makeCount({
            chinese: 100,
            englishWords: 5,
            total: 120
        });

        const result = diffCounts(previous,current);

        expect(result.added.total).toBe(0);
        expect(result.deleted.total).toBe(0);
        expect(result.net.total).toBe(0);
    });

    test("不同统计维度可以同时增加和减少", () => {
        const previous = makeCount({
            chinese: 100,
            englishWords: 10,
            englishChars: 40,
            total: 150
        });

        const current = makeCount({
            chinese: 120,
            englishWords: 7,
            englishChars: 30,
            total: 160
        });

        const result = diffCounts(previous,current);

        expect(result.added.chinese).toBe(20);

        expect(result.deleted.englishWords).toBe(3);
        expect(result.deleted.englishChars).toBe(10);

        expect(result.net.chinese).toBe(20);
        expect(result.net.englishWords).toBe(-3);
        expect(result.net.englishChars).toBe(-10);
    });
});