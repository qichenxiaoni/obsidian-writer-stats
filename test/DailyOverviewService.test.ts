import {
    DailyOverviewService
} from "../src/core/DailyOverviewService";

import {
    DailyStatsService
} from "../src/core/DailyStatsService";

import {
    GoalService
} from "../src/core/GoalService";

import {
    PluginSettingsService
} from "../src/core/PluginSettingsService";

import {
    MemoryStatsRepository
} from "../src/persistence/MemoryStatsRepository";

import {
    createEmptyPluginData
} from "../src/domain/PluginData";

import type{
    PluginDataStore
} from "../src/persistence/PluginDataStore";

import type {
    PluginData
} from "../src/domain/PluginData";

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

class TestPluginDataStore 
    implements PluginDataStore
{
    private data:
        PluginData = 
            createEmptyPluginData();

    async load():
        Promise<PluginData> {
            return structuredClone(
                this.data
            );
        }

    async save(
        data: PluginData
    ): Promise<void> {
        this.data =
            structuredClone(data);
    }
}

describe(
    "DailyOverviewService",
    () => {
        test(
            "使用每日新增量计算目标进度",
            async () => {
                const repository = 
                    new MemoryStatsRepository();

                await repository.saveActivity({
                    date: "2026-09-27",
                    filePath: "A.md",

                    start: makeCount(100),
                    added: makeCount(600),
                    deleted: makeCount(200),
                    net: makeCount(400)
                });

                const store = 
                    new TestPluginDataStore();

                const settingsService = 
                    new PluginSettingsService(
                        store
                    );

                await settingsService
                    .setDailyGoal(1000);

                const overviewService =
                    new DailyOverviewService(
                        new DailyStatsService(
                            repository
                        ),
                        settingsService,
                        new GoalService()
                    );

                const result =
                    await overviewService
                        .getOverview(
                            "2026-09-27"
                        );

                expect(
                    result.summary.added.total
                ).toBe(600);

                expect(
                    result.summary.net.total
                ).toBe(400);

                // 关键： 按 added 计算，而不是 net
                expect(
                    result.goal.current
                ).toBe(600);

                expect(
                    result.goal.percentage
                ).toBe(60);
            }
        );

        test(
            "使用用户设置的 dailyGoal",
            async () => {
                const repository =
                    new MemoryStatsRepository();

                await repository.saveActivity({
                    date: "2026-09-27",
                    filePath: "A.md",

                    start: makeCount(0),
                    added: makeCount(750),
                    deleted: makeCount(0),
                    net: makeCount(750)
                });

                const store =
                    new TestPluginDataStore();

                const settingsService =
                    new PluginSettingsService(
                        store
                    );

                await settingsService
                    .setDailyGoal(1500);

                const overviewService =
                    new DailyOverviewService(
                        new DailyStatsService(
                            repository
                        ),
                        settingsService,
                        new GoalService()
                    );

                const result =
                    await overviewService
                        .getOverview(
                            "2026-09-27"
                        );

                expect(
                    result.goal.goal
                ).toBe(1500);

                expect(
                    result.goal.percentage
                ).toBe(50);

                expect(
                    result.goal.remaining
                ).toBe(750);
            }
        );
    }
);