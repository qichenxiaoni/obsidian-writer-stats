
import {
    WritingTimeAnalysisService
} from "../src/core/WritingTimeAnalysisService";

import {
    MemoryStatsRepository
} from "../src/persistence/MemoryStatsRepository";

import {
    ActivityTracker
} from "../src/core/ActivityTracker";

import {
    createBackupText,
    parseBackupText
} from "../src/core/PluginBackupCodec";

import {
    createEmptyPluginData
} from "../src/domain/PluginData";

import type {
    CountResult
} from "../src/domain/CountResult";

function count(total: number): CountResult {
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

function time(
    activeMs: number,
    hour: number
) {
    const hourlyMs =
        Array(24).fill(0) as number[];

    hourlyMs[hour] = activeMs;

    return {
        activeMs,
        hourlyMs
    };
}

describe("WritingTimeAnalysisService", () => {
    test(
        "已有历史记录没有时长字段时不得倒推",
        async () => {
            const repository =
                new MemoryStatsRepository();

            await repository.saveActivity({
                date: "2026-10-27",
                filePath: "old.md",
                start: count(0),
                added: count(99),
                deleted: count(0),
                net: count(99)
            });

            const result =
                await new WritingTimeAnalysisService(
                    repository
                ).getSummary(
                    "2026-10-27",
                    "2026-10-28"
                );

            expect(result.activeMs).toBe(0);

            expect(result.daily).toEqual([
                {
                    date: "2026-10-27",
                    activeMs: 0
                },
                {
                    date: "2026-10-28",
                    activeMs: 0
                }
            ]);

            expect(
                result.charactersPerHour
            ).toBeNull();
        }
    );

    test(
        "按小时/按日/按文件汇总，效率只在样本足够时计算",
        async () => {
            const repository =
                new MemoryStatsRepository();

            for (
                const [
                    date,
                    path,
                    added,
                    ms,
                    hour
                ] of [
                    [
                        "2026-10-28",
                        "Folder/A.md",
                        40,
                        30_000,
                        9
                    ],
                    [
                        "2026-10-28",
                        "B.md",
                        10,
                        30_000,
                        10
                    ],
                    [
                        "2026-10-29",
                        "Folder/A.md",
                        50,
                        60_000,
                        10
                    ]
                ] as const
            ) {
                await repository.saveActivity({
                    date,
                    filePath: path,
                    start: count(0),
                    added: count(added),
                    deleted: count(0),
                    net: count(added),
                    time: time(ms, hour)
                });
            }

            const result =
                await new WritingTimeAnalysisService(
                    repository
                ).getSummary(
                    "2026-10-28",
                    "2026-10-30"
                );

            expect(result.activeMs).toBe(
                120_000
            );

            expect(result.activeDays).toBe(2);

            expect(result.hourlyMs[9]).toBe(
                30_000
            );

            expect(result.hourlyMs[10]).toBe(
                90_000
            );

            expect(
                result.charactersPerHour
            ).toBe(3000);

            expect(result.files[0]).toEqual({
                path: "Folder/A.md",
                activeMs: 90_000
            });

            expect(result.daily[2]).toEqual({
                date: "2026-10-30",
                activeMs: 0
            });
        }
    );

    test(
        "已有 ActivityTracker 保存时将时长累加，不影响原字数统计",
        async () => {
            const repository =
                new MemoryStatsRepository();

            const tracker =
                new ActivityTracker(repository);

            await tracker.ensureBaseline(
                "A.md",
                1,
                count(100)
            );

            await tracker.track(
                "2026-10-30",
                "A.md",
                2,
                count(120),
                time(40_000, 9)
            );

            await tracker.track(
                "2026-10-30",
                "A.md",
                3,
                count(125),
                time(30_000, 10)
            );

            const activity =
                await repository.getActivity(
                    "2026-10-30",
                    "A.md"
                );

            expect(
                activity?.added.total
            ).toBe(25);

            expect(
                activity?.time?.activeMs
            ).toBe(70_000);

            expect(
                activity?.time?.hourlyMs[9]
            ).toBe(40_000);

            expect(
                activity?.time?.hourlyMs[10]
            ).toBe(30_000);
        }
    );

    test(
        "旧备份继续可解析，新时长字段通过校验",
        () => {
            const data = createEmptyPluginData();

            data.dailyActivities[
                "2026-10-30:A.md"
            ] = {
                date: "2026-10-30",
                filePath: "A.md",
                start: count(1),
                added: count(10),
                deleted: count(0),
                net: count(10)
            };

            expect(
                parseBackupText(
                    createBackupText(data)
                ).data.dailyActivities[
                    "2026-10-30:A.md"
                ].time
            ).toBeUndefined();

            data.dailyActivities[
                "2026-10-30:A.md"
            ].time = time(1234, 9);

            expect(
                parseBackupText(
                    createBackupText(data)
                ).data.dailyActivities[
                    "2026-10-30:A.md"
                ].time?.activeMs
            ).toBe(1234);

            data.dailyActivities[
                "2026-10-30:A.md"
            ].time = time(-1234, 9);

            expect(
                () => createBackupText(data)
            ).toThrow(/无效历史活动/);
        }
    );
});
