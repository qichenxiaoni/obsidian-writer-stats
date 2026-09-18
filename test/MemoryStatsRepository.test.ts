import { MemoryStatsRepository } from
    "../src/persistence/MemoryStatsRepository";

import type { CountResult } from
    "../src/domain/CountResult";

function makeCount(
    total: number
): CountResult {
    return {
        chinese: total,
        englishWords: 0,
        englishChars: 0,
        numbers: 0,
        punctuation: 0,
        spaces: 0,
        total
    };
}

describe("MemoryStatsRepository", () => {
    test("可以保存和读取 snapshot", async () => {
        const repository =
            new MemoryStatsRepository();

        await repository.saveSnapshot({
            path: "A.md",
            modifiedAt: 1000,
            counts: makeCount(100)
        });

        const snapshot =
            await repository.getSnapshot("A.md");

        expect(snapshot?.counts.total)
            .toBe(100);
    });

    test("可以保存和读取 daily activity", async () => {
        const repository =
            new MemoryStatsRepository();

        await repository.saveActivity({
            date: "2026-09-17",
            filePath: "A.md",

            start: makeCount(100),
            added: makeCount(20),
            deleted: makeCount(5),
            net: makeCount(15)
        });

        const activity =
            await repository.getActivity(
                "2026-09-17",
                "A.md"
            );

        expect(activity?.added.total)
            .toBe(20);

        expect(activity?.net.total)
            .toBe(15);
    });

    test("可以获取某一天全部 activity", async () => {
        const repository =
            new MemoryStatsRepository();

        await repository.saveActivity({
            date: "2026-09-17",
            filePath: "A.md",
            start: makeCount(100),
            added: makeCount(20),
            deleted: makeCount(0),
            net: makeCount(20)
        });

        await repository.saveActivity({
            date: "2026-09-17",
            filePath: "B.md",
            start: makeCount(50),
            added: makeCount(10),
            deleted: makeCount(0),
            net: makeCount(10)
        });

        await repository.saveActivity({
            date: "2026-09-18",
            filePath: "C.md",
            start: makeCount(80),
            added: makeCount(5),
            deleted: makeCount(0),
            net: makeCount(5)
        });

        const activities =
            await repository.getActivitiesForDate(
                "2026-09-17"
            );

        expect(activities).toHaveLength(2);
    });

    test("renameFile 会更新 snapshot 和 activity", async () => {
        const repository =
            new MemoryStatsRepository();

        await repository.saveSnapshot({
            path: "Old.md",
            modifiedAt: 1000,
            counts: makeCount(100)
        });

        await repository.saveActivity({
            date: "2026-09-17",
            filePath: "Old.md",
            start: makeCount(100),
            added: makeCount(20),
            deleted: makeCount(0),
            net: makeCount(20)
        });

        await repository.renameFile(
            "Old.md",
            "New.md"
        );

        expect(
            await repository.getSnapshot("Old.md")
        ).toBeUndefined();

        expect(
            await repository.getSnapshot("New.md")
        ).toBeDefined();

        expect(
            await repository.getActivity(
                "2026-09-17",
                "New.md"
            )
        ).toBeDefined();
    });

    test("deleteFile 会删除相关数据", async () => {
        const repository =
            new MemoryStatsRepository();

        await repository.saveSnapshot({
            path: "A.md",
            modifiedAt: 1000,
            counts: makeCount(100)
        });

        await repository.saveActivity({
            date: "2026-09-17",
            filePath: "A.md",
            start: makeCount(100),
            added: makeCount(20),
            deleted: makeCount(0),
            net: makeCount(20)
        });

        await repository.deleteFile("A.md");

        expect(
            await repository.getSnapshot("A.md")
        ).toBeUndefined();

        expect(
            await repository.getActivity(
                "2026-09-17",
                "A.md"
            )
        ).toBeUndefined();
    });
});