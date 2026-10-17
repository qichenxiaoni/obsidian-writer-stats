import {
    FileRankingService,
    sortFileRanking
} from "../src/core/FileRankingService";

import { MemoryStatsRepository } from "../src/persistence/MemoryStatsRepository";

import { JsonStatsRepository } from "../src/persistence/JsonStatsRepository";

import { MemoryPluginDataStore } from "../src/persistence/MemoryPluginDataStore";

import type { CountResult } from "../src/domain/CountResult";

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

function setup() {
    const repository = new MemoryStatsRepository();
    const service = new FileRankingService(repository);

    const save = async (
        date: string,
        filePath: string,
        added: number,
        deleted: number
    ): Promise<void> => {
        await repository.saveActivity({
            date,
            filePath,
            start: count(0),
            added: count(added),
            deleted: count(deleted),
            net: count(added - deleted)
        });
    };

    return { repository, service, save };
}

describe("FileRankingService", () => {

    test("同文件跨日聚合且按不同日期计算活跃天数", async () => {
        const { service, save } = setup();

        await save("2026-10-01", "notes/A.md", 10, 2);
        await save("2026-10-02", "notes/A.md", 20, 3);
        await save("2026-10-02", "notes/B.md", 5, 1);

        const result = await service.getRanking(
            "2026-10-01",
            "2026-10-12"
        );

        expect(result.totalFiles).toBe(2);

        expect(
            result.files.find(
                file => file.filePath === "notes/A.md"
            )
        ).toEqual({
            filePath: "notes/A.md",
            added: 30,
            deleted: 5,
            net: 25,
            activeDays: 2
        });
    });

    test("包含起止日期并排除范围外记录", async () => {
        const { service, save } = setup();

        await save("2026-09-30", "outside.md", 100, 0);
        await save("2026-10-01", "first.md", 2, 0);
        await save("2026-10-12", "last.md", 3, 0);
        await save("2026-10-13", "future.md", 500, 0);

        const result = await service.getRanking(
            "2026-10-01",
            "2026-10-12"
        );

        expect(result.totalFiles).toBe(2);

        expect(
            result.files.reduce(
                (n, file) => n + file.added,
                0
            )
        ).toBe(5);
    });

    test("纯删除也算活跃文件，净增长可以为负", async () => {
        const { service, save } = setup();

        await save("2026-10-10", "remove.md", 0, 8);

        const result = await service.getRanking(
            "2026-10-01",
            "2026-10-12"
        );

        expect(result.files).toEqual([{
            filePath: "remove.md",
            added: 0,
            deleted: 8,
            net: -8,
            activeDays: 1
        }]);
    });

    test("零活动不会进入排行", async () => {
        const { service, save } = setup();

        await save("2026-10-05", "nothing.md", 0, 0);

        const result = await service.getRanking(
            "2026-10-01",
            "2026-10-12"
        );

        expect(result.totalFiles).toBe(0);
    });

    test("空月份返回空结果", async () => {
        const { service } = setup();

        const result = await service.getRanking(
            "2026-09-01",
            "2026-09-30"
        );

        expect(result.files).toEqual([]);
        expect(result.totalFiles).toBe(0);
    });

    test("不允许开始日期晚于结束日期", async () => {
        const { service } = setup();

        await expect(
            service.getRanking(
                "2026-10-12",
                "2026-10-01"
            )
        ).rejects.toThrow(RangeError);
    });

    test("重命名后使用新路径合并统计", async () => {
        const { repository, service, save } = setup();

        await save("2026-10-01", "Old.md", 20, 3);
        await repository.renameFile("Old.md", "New.md");
        await save("2026-10-02", "New.md", 10, 0);

        const result = await service.getRanking(
            "2026-10-01",
            "2026-10-12"
        );

        expect(result.totalFiles).toBe(1);

        expect(result.files[0]).toEqual({
            filePath: "New.md",
            added: 30,
            deleted: 3,
            net: 27,
            activeDays: 2
        });
    });

    test("三种排序不修改输入数组", async () => {
        const files = [
            {
                filePath: "A.md",
                added: 20,
                deleted: 4,
                net: 16,
                activeDays: 2
            },
            {
                filePath: "B.md",
                added: 50,
                deleted: 48,
                net: 2,
                activeDays: 2
            },
            {
                filePath: "C.md",
                added: 10,
                deleted: 0,
                net: 10,
                activeDays: 1
            }
        ];

        expect(
            sortFileRanking(files,"added").map(f => f.filePath)
        ).toEqual(["B.md","A.md","C.md"]);

        expect(
            sortFileRanking(files,"net").map(f => f.filePath)
        ).toEqual(["A.md","C.md","B.md"]);

        expect(
            sortFileRanking(files,"deleted").map(f => f.filePath)
        ).toEqual(["B.md","A.md","C.md"]);

        expect(files[0].filePath).toBe("A.md");
    });

    test("完全并列时按路径稳定排序",async () => {
        const files = [
            {
                filePath: "b.md",
                added: 10,
                deleted: 0,
                net: 10,
                activeDays: 1
            },
            {
                filePath: "a.md",
                added: 10,
                deleted: 0,
                net: 10,
                activeDays: 1
            }
        ];

        expect(
            sortFileRanking(files,"added").map(f => f.filePath)
        ).toEqual(["a.md","b.md"]);
    });

    test("全负净增长按照数值从高到低排序", () => {
        const files = [
            {
                filePath: "A.md",
                added: 0,
                deleted: 10,
                net: -10,
                activeDays: 1
            },
            {
                filePath: "B.md",
                added: 0,
                deleted: 2,
                net: -2,
                activeDays: 1
            }
        ];

        expect(
            sortFileRanking(files,"net").map(f => f.filePath)
        ).toEqual(["B.md","A.md"]);
    });

    test("全新 JSON 仓库无持久化数据时返回空排行",async () => {
        const repo = new JsonStatsRepository(new MemoryPluginDataStore());

        const result = await new FileRankingService(repo).getRanking(
            "2026-10-01",
            "2026-10-12"
        );

        expect(result.totalFiles).toBe(0);
    });
});