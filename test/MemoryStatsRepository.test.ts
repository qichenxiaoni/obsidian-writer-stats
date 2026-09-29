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

    test(
        "removeSnapshot 只删除 snapshot，并保留历史 activity",
        async () => {
            const repository =
                new MemoryStatsRepository();

            await repository.saveSnapshot({
                path: "A.md",
                modifiedAt: 1000,
                counts: makeCount(100)
            });

            await repository.saveActivity({
                date: "2026-09-20",
                filePath: "A.md",
                start: makeCount(100),
                added: makeCount(20),
                deleted: makeCount(0),
                net: makeCount(20)
            });

            await repository.removeSnapshot(
                "A.md"
            );

            const snapshot =
                await repository.getSnapshot(
                    "A.md"
                );

            const activity =
                await repository.getActivity(
                    "2026-09-20",
                    "A.md"
                );

            expect(snapshot)
                .toBeUndefined();

            expect(activity)
                .toBeDefined();

            expect(activity?.added.total)
                .toBe(20);

            expect(activity?.net.total)
                .toBe(20);
        }
    );

    test(
        "getActivitiesBetween 返回日期范围内的 activity，并包含起止日期",
        async () => {
            const repository =
                new MemoryStatsRepository();

            await repository.saveActivity({
                date: "2026-09-27",
                filePath: "A.md",
                start: makeCount(0),
                added: makeCount(10),
                deleted: makeCount(0),
                net: makeCount(10)
            });

            await repository.saveActivity({
                date: "2026-09-28",
                filePath: "B.md",
                start: makeCount(0),
                added: makeCount(20),
                deleted: makeCount(0),
                net: makeCount(20)
            });

            await repository.saveActivity({
                date: "2026-09-29",
                filePath: "C.md",
                start: makeCount(0),
                added: makeCount(30),
                deleted: makeCount(0),
                net: makeCount(30)
            });

            await repository.saveActivity({
                date: "2026-09-30",
                filePath: "D.md",
                start: makeCount(0),
                added: makeCount(40),
                deleted: makeCount(0),
                net: makeCount(40)
            });

            const result =
                await repository
                    .getActivitiesBetween(
                        "2026-09-28",
                        "2026-09-29"
                    );

            expect(result)
                .toHaveLength(2);

            expect(
                result
                    .map(activity =>
                        activity.filePath
                    )
                    .sort()
            ).toEqual([
                "B.md",
                "C.md"
            ]);
        }
    );
});