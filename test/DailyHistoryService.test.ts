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
    }
);