import {
    DailyHistoryService
} from "../src/core/DailyHistoryService";

import {
    MemoryStatsRepository
} from "../src/persistence/MemoryStatsRepository";

import type {
    CountResult
} from "../src/domain/CountResult";

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

describe(
    "DailyHistoryService",
    () => {
        test(
            "按日期聚合多个文件的写作活动",
            async () => {
                const repository =
                    new MemoryStatsRepository();
                   
                await repository.saveActivity({
                    date: "2026-09-28",
                    filePath: "A.md",
                    start: makeCount(0),
                    added: makeCount(10),
                    deleted: makeCount(2),
                    net: makeCount(8)
                });

                await repository.saveActivity({
                    date: "2026-09-28",
                    filePath: "B.md",
                    start: makeCount(0),
                    added: makeCount(20),
                    deleted: makeCount(5),
                    net: makeCount(15)
                });

                await repository.saveActivity({
                    date: "2026-09-29",
                    filePath: "C.md",
                    start: makeCount(0),
                    added: makeCount(15),
                    deleted: makeCount(0),
                    net: makeCount(15)
                });

                const service =
                    new DailyHistoryService(
                        repository
                    );

                const result =
                    await service.getHistory(
                        "2026-09-28",
                        "2026-09-29"
                    );

                expect(result)
                    .toEqual([
                        {
                            date: "2026-09-28",
                            added: 30,
                            deleted: 7,
                            net: 23,
                            activeFiles: 2
                        },

                        {
                            date:"2026-09-29",
                            added: 15,
                            deleted: 0,
                            net: 15,
                            activeFiles: 1
                        }
                    ]);
            }
        );

        test(
            "没有写作活动的日期会补充为零",
            async () => {
                const repository =
                    new MemoryStatsRepository();

                await repository.saveActivity({
                    date: "2026-09-28",
                    filePath: "A.md",
                    start: makeCount(0),
                    added: makeCount(10),
                    deleted: makeCount(0),
                    net: makeCount(10)
                });

                await repository.saveActivity({
                    date: "2026-09-30",
                    filePath: "B.md",
                    start: makeCount(0),
                    added: makeCount(20),
                    deleted: makeCount(5),
                    net: makeCount(15)
                });

                const service =
                    new DailyHistoryService(
                        repository
                    );

                const result =
                    await service.getHistory(
                        "2026-09-28",
                        "2026-09-30"
                    );

                expect(result)
                    .toEqual([
                        {
                            date: "2026-09-28",
                            added: 10,
                            deleted: 0,
                            net: 10,
                            activeFiles: 1
                        },

                        {
                            date: "2026-09-29",
                            added: 0,
                            deleted: 0,
                            net: 0,
                            activeFiles: 0
                        },
                        {
                            date: "2026-09-30",
                            added: 20,
                            deleted: 5,
                            net: 15,
                            activeFiles: 1
                        }
                    ]);
            }
        );

        test (
            "正确统计日期范围内的活跃天数",
            async () => {
                const repository =
                    new MemoryStatsRepository();

                await repository.saveActivity({
                    date: "2026-09-28",
                    filePath: "A.md",
                    start: makeCount(0),
                    added: makeCount(10),
                    deleted: makeCount(0),
                    net: makeCount(10)
                });

                await repository.saveActivity({
                    date: "2026-09-30",
                    filePath: "B.md",
                    start: makeCount(20),
                    added: makeCount(0),
                    deleted: makeCount(5),
                    net: makeCount(-5)
                });

                const service =
                    new DailyHistoryService(
                        repository
                    );

                const activeDays =
                    await service.getActiveDays(
                        "2026-09-28",
                        "2026-09-30"
                    );

                expect(activeDays)
                    .toBe(2)
            }
        );
    }
);