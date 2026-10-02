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
                            date: "2026-09-29",
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

        test(
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

        test(
            "写作中断后重新开始时，只统计当前连续写作天数",
            async () => {
                const repository =
                    new MemoryStatsRepository();

                // 09-27写作日
                await repository.saveActivity({
                    date: "2026-09-27",
                    filePath: "A.md",
                    start: makeCount(0),
                    added: makeCount(10),
                    deleted: makeCount(0),
                    net: makeCount(10)
                });

                // 09-28 写作日
                await repository.saveActivity({
                    date: "2026-09-28",
                    filePath: "B.md",
                    start: makeCount(0),
                    added: makeCount(20),
                    deleted: makeCount(0),
                    net: makeCount(20)
                });

                // 09-29 没有任何 Activity， DailyHistoryService 会自动补成 0，因此连续写作在这里中断

                // 09-30 写作日
                await repository.saveActivity({
                    date: "2026-09-30",
                    filePath: "C.md",
                    start: makeCount(0),
                    added: makeCount(5),
                    deleted: makeCount(0),
                    net: makeCount(5)
                });

                const service =
                    new DailyHistoryService(
                        repository
                    );

                const streak =
                    await service.getWritingStreak(
                        "2026-09-27",
                        "2026-09-30"
                    );

                expect(streak)
                    .toBe(1)
            }
        );

        test(
            "最后一天没有写作时，当前连续写作天数为 0",
            async () => {
                const repository =
                    new MemoryStatsRepository();

                // 09-27
                await repository.saveActivity({
                    date: "2026-09-27",
                    filePath: "A.md",
                    start: makeCount(0),
                    added: makeCount(10),
                    deleted: makeCount(0),
                    net: makeCount(10)
                });

                // 09-28
                await repository.saveActivity({
                    date: "2026-09-28",
                    filePath: "B.md",
                    start: makeCount(0),
                    added: makeCount(20),
                    deleted: makeCount(0),
                    net: makeCount(20)
                });

                /*
                * 09-29 没有 activity。
                *
                * getHistory() 会自动补成：
                *
                * added: 0
                * deleted: 0
                * net: 0
                * activeFiles: 0
                */

                const service =
                    new DailyHistoryService(
                        repository
                    );

                const streak =
                    await service.getWritingStreak(
                        "2026-09-27",
                        "2026-09-29"
                    );

                expect(streak)
                    .toBe(0);
            }
        );

        test(
            "连续多天写作时正确累计连续写作天数",
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

                const service =
                    new DailyHistoryService(
                        repository
                    );

                const streak =
                    await service.getWritingStreak(
                        "2026-09-27",
                        "2026-09-29"
                    );

                expect(streak)
                    .toBe(3);
            }
        );

        test(
            "正确生成日期范围的历史摘要",
            async () => {
                const repository =
                    new MemoryStatsRepository();

                // 09-27
                await repository.saveActivity({
                    date: "2026-09-27",
                    filePath: "A.md",
                    start: makeCount(0),
                    added: makeCount(10),
                    deleted: makeCount(2),
                    net: makeCount(8)
                });

                // 09-28
                await repository.saveActivity({
                    date: "2026-09-28",
                    filePath: "B.md",
                    start: makeCount(0),
                    added: makeCount(20),
                    deleted: makeCount(5),
                    net: makeCount(15)
                });

                // 09-29 无 activity, getHistory() 应该补成 0

                const service =
                    new DailyHistoryService(
                        repository
                    );

                const summary =
                    await service.getSummary(
                        "2026-09-27",
                        "2026-09-29"
                    );

                expect(summary.startDate)
                    .toBe("2026-09-27");

                expect(summary.endDate)
                    .toBe("2026-09-29");

                expect(summary.activeDays)
                    .toBe(2);

                expect(summary.writingStreak)
                    .toBe(0);

                expect(summary.added)
                    .toBe(30);

                expect(summary.deleted)
                    .toBe(7);

                expect(summary.net)
                    .toBe(23);

                expect(summary.days)
                    .toHaveLength(3);
            }
        );

        test(
            "可以生成最近 7 天的历史摘要",
            async () => {
                const repository =
                    new MemoryStatsRepository();

                await repository.saveActivity({
                    date: "2026-09-24",
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
                    deleted: makeCount(0),
                    net: makeCount(20)
                });

                const service =
                    new DailyHistoryService(
                        repository
                    );

                const summary =
                    await service.getRecentSummary(
                        "2026-09-30",
                        7
                    );

                expect(summary.startDate)
                    .toBe("2026-09-24");

                expect(summary.endDate)
                    .toBe("2026-09-30");

                expect(summary.totalDays)
                    .toBe(7);

                expect(summary.added)
                    .toBe(30);

                expect(summary.days)
                    .toHaveLength(7);
            }
        );

        test(
            "正确统计日期范围内的最长连续写作天数",
            async () => {
                const repository =
                    new MemoryStatsRepository();

                // 连续两天
                await repository.saveActivity({
                    date: "2026-09-24",
                    filePath: "A.md",
                    start: makeCount(0),
                    added: makeCount(10),
                    deleted: makeCount(0),
                    net: makeCount(10)
                });

                await repository.saveActivity({
                    date: "2026-09-25",
                    filePath: "B.md",
                    start: makeCount(0),
                    added: makeCount(20),
                    deleted: makeCount(0),
                    net: makeCount(20)
                });

                // 中断一天

                // 连续三天
                await repository.saveActivity({
                    date: "2026-09-27",
                    filePath: "C.md",
                    start: makeCount(0),
                    added: makeCount(5),
                    deleted: makeCount(0),
                    net: makeCount(5)
                });

                await repository.saveActivity({
                    date: "2026-09-28",
                    filePath: "D.md",
                    start: makeCount(0),
                    added: makeCount(15),
                    deleted: makeCount(0),
                    net: makeCount(15)
                });

                await repository.saveActivity({
                    date: "2026-09-29",
                    filePath: "E.md",
                    start: makeCount(0),
                    added: makeCount(25),
                    deleted: makeCount(0),
                    net: makeCount(25)
                });

                const service = 
                    new DailyHistoryService(
                        repository
                    );

                const summary =
                    await service.getSummary(
                        "2026-09-24",
                        "2026-09-30"
                    );

                expect(
                    summary.writingStreak
                ).toBe(0);

                expect(
                    summary.longesWritingStreak
                ).toBe(3);
            }
        );

        test(
            "只有删除操作的日期不会延续最长连续写作",
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
                    added: makeCount(0),
                    deleted: makeCount(5),
                    net: makeCount(-5)
                });

                await repository.saveActivity({
                    date: "2026-09-29",
                    filePath: "C.md",
                    start: makeCount(0),
                    added: makeCount(20),
                    deleted: makeCount(0),
                    net: makeCount(20)
                });

                const service = 
                    new DailyHistoryService(
                        repository
                    );

                const summary =
                    await service.getSummary(
                        "2026-09-27",
                        "2026-09-29"
                    );

                expect(
                    summary.activeDays
                ).toBe(3);

                expect(
                    summary.longesWritingStreak
                ).toBe(1);
            }
        );
    }
);