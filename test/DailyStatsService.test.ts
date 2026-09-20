import { DailyStatsService } from "../src/core/DailyStatsService";
import type { CountResult } from "../src/domain/CountResult";
import { MemoryStatsRepository } from "../src/persistence/MemoryStatsRepository";

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

describe("DailyStatsService", () => {
    test("没有 activity 时返回空的每日统计", async () => {
        const repository = new MemoryStatsRepository();

        const service = new DailyStatsService(repository);
        
        const summary = await service.getSummary(
            "2026-09-20"
        );

        expect(summary.date).toBe("2026-09-20");
        expect(summary.added.total).toBe(0);
        expect(summary.deleted.total).toBe(0);
        expect(summary.net.total).toBe(0);
        expect(summary.activeFiles).toBe(0);
    });

    test("可以聚合多个文件的每日写作数据", async () => {
        const repository = new MemoryStatsRepository();
        
        await repository.saveActivity({
            date: "2026-09-20",
            filePath: "A.md",
            start: makeCount(100),
            added: makeCount(30),
            deleted: makeCount(5),
            net: makeCount(25)
        });

        await repository.saveActivity({
            date: "2026-09-20",
            filePath: "B.md",
            start: makeCount(200),
            added: makeCount(50),
            deleted: makeCount(10),
            net: makeCount(40)
        });

        const service = new DailyStatsService(repository);
        const summary = await service.getSummary(
            "2026-09-20"
        );

        expect(summary.added.total).toBe(80);
        expect(summary.deleted.total).toBe(15);
        expect(summary.net.total).toBe(65);
        expect(summary.activeFiles).toBe(2);
    });

    test("不会把其他日期的数据聚合进来" , async () => {
        const repository = new MemoryStatsRepository();

        await repository.saveActivity({
            date: "2026-09-20",
            filePath: "A.md",
            start: makeCount(100),
            added: makeCount(20),
            deleted: makeCount(0),
            net: makeCount(20)
        });

        await repository.saveActivity({
            date: "2026-09-21",
            filePath: "B.md",
            start: makeCount(100),
            added: makeCount(100),
            deleted: makeCount(0),
            net: makeCount(100)
        });

        const service = new DailyStatsService(repository);
        const summary = await service.getSummary(
            "2026-09-20"
        );

        expect(summary.added.total).toBe(20);
        expect(summary.net.total).toBe(20);
        expect(summary.activeFiles).toBe(1);
    });

    test("零变化 activity 不会计入 activeFiles", async () => {
        const repository = new MemoryStatsRepository();

        await repository.saveActivity({
            date: "2026-09-20",
            filePath: "A.md",
            start: makeCount(0),
            added: makeCount(0),
            deleted: makeCount(0),
            net: makeCount(0)
        });

        await repository.saveActivity({
            date: "2026-09-20",
            filePath: "B.md",
            start: makeCount(110),
            added: makeCount(20),
            deleted: makeCount(0),
            net: makeCount(20)
        });

        const service = new DailyStatsService(repository);
        const summary = await service.getSummary(
            "2026-09-20"
        );

        expect(summary.added.total).toBe(20);
        expect(summary.activeFiles).toBe(1);
    });

    test("同时存在新增和删除时能够正确聚合", async () => {
        const repository =new MemoryStatsRepository();

        await repository.saveActivity({
            date: "2026-09-20",
            filePath: "A.md",
            start: makeCount(100),
            added: makeCount(60),
            deleted: makeCount(20),
            net: makeCount(40)
        });

        await repository.saveActivity({
            date: "2026-09-20",
            filePath: "B.md",
            start: makeCount(200),
            added: makeCount(40),
            deleted: makeCount(10),
            net: makeCount(30)
        });

        const service = new DailyStatsService(repository);
        const summary = await service.getSummary(
            "2026-09-20"
        );

        expect(summary.added.total).toBe(100);
        expect(summary.deleted.total).toBe(30);
        expect(summary.net.total).toBe(70);
        expect(summary.activeFiles).toBe(2)
    });
});