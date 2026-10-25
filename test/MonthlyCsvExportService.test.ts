
import {
    MonthlyCsvExportService,
    escapeCsvField
} from "../src/core/MonthlyCsvExportService";

import {
    MemoryStatsRepository
} from "../src/persistence/MemoryStatsRepository";

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

function fixture() {
    const repository =
        new MemoryStatsRepository();

    const service =
        new MonthlyCsvExportService(repository);

    async function save(
        date: string,
        filePath: string,
        added: number,
        deleted: number
    ): Promise<void> {
        await repository.saveActivity({
            date,
            filePath,
            start: count(0),
            added: count(added),
            deleted: count(deleted),
            net: count(added - deleted)
        });
    }

    return {
        repository,
        service,
        save
    };
}

/** 提取 CSV 的普通行，用于测试无换行的记录。 */
function rows(csv: string): string[] {
    return csv
        .replace(/^\uFEFF/, "")
        .trimEnd()
        .split("\r\n");
}

describe("MonthlyCsvExportService", () => {

    test("当前月只统计到今天，并补齐零值日期", async () => {
        const { service, save } = fixture();

        await save("2026-10-02", "A.md", 12, 2);
        await save("2026-10-06", "A.md", 500, 0);

        const result = await service.buildMonthlyCsv(
            "2026-10",
            "2026-10-04"
        );

        expect(result.startDate).toBe("2026-10-01");
        expect(result.endDate).toBe("2026-10-04");

        expect(rows(result.dailyCsv)).toEqual([
            "日期,新增,删除,净增长,活跃文件数",
            "2026-10-01,0,0,0,0",
            "2026-10-02,12,2,10,1",
            "2026-10-03,0,0,0,0",
            "2026-10-04,0,0,0,0"
        ]);

        expect(rows(result.fileCsv)).toEqual([
            "日期,文件路径,新增,删除,净增长",
            "2026-10-02,A.md,12,2,10"
        ]);
    });

    test("历史月份包含完整日期，闰年正确", async () => {
        const { service, save } = fixture();

        await save("2024-02-29", "日记.md", 9, 0);

        const result = await service.buildMonthlyCsv(
            "2024-02",
            "2026-10-24"
        );

        // 29天 + 1行表头
        expect(rows(result.dailyCsv)).toHaveLength(30);

        expect(
            rows(result.dailyCsv)[29]
        ).toBe("2024-02-29,9,0,9,1");
    });

    test("多文件正确聚合每日数据", async () => {
        const { service, save } = fixture();

        await save("2026-09-20", "A.md", 20, 3);
        await save("2026-09-20", "B.md", 4, 10);

        const result = await service.buildMonthlyCsv(
            "2026-09",
            "2026-10-24"
        );

        expect(
            rows(result.dailyCsv)[20]
        ).toBe("2026-09-20,24,13,11,2");

        expect(rows(result.fileCsv)).toContain(
            "2026-09-20,A.md,20,3,17"
        );

        expect(rows(result.fileCsv)).toContain(
            "2026-09-20,B.md,4,10,-6"
        );
    });

    test("文件路径包含逗号、引号及换行时正确转义", async () => {
        const { service, save } = fixture();

        await save(
            "2026-09-01",
            '笔记/甲,"乙"\n三.md',
            10,
            1
        );

        const result = await service.buildMonthlyCsv(
            "2026-09",
            "2026-10-24"
        );

        expect(result.fileCsv).toContain(
            '"笔记/甲,""乙""\n三.md"'
        );

        expect(
            result.fileCsv.startsWith("\uFEFF")
        ).toBe(true);
    });

    test("防止文件名被电子表格当作公式", () => {
        expect(
            escapeCsvField("=HYPERLINK(1)")
        ).toBe("'=HYPERLINK(1)");

        expect(
            escapeCsvField("+cmd")
        ).toBe("'+cmd");

        expect(
            escapeCsvField("\t-12")
        ).toBe("'\t-12");

        expect(
            escapeCsvField(25)
        ).toBe("25");
    });

    test("只有删除时保留负净增长", async () => {
        const { service, save } = fixture();

        await save(
            "2026-09-10",
            "已删除.md",
            0,
            8
        );

        const result = await service.buildMonthlyCsv(
            "2026-09",
            "2026-10-24"
        );

        expect(rows(result.fileCsv)).toContain(
            "2026-09-10,已删除.md,0,8,-8"
        );
    });

    test("空月份也能生成两份有效 CSV", async () => {
        const { service } = fixture();

        const result = await service.buildMonthlyCsv(
            "2026-08",
            "2026-10-24"
        );

        expect(rows(result.dailyCsv)).toHaveLength(32);

        expect(rows(result.fileCsv)).toEqual([
            "日期,文件路径,新增,删除,净增长"
        ]);
    });

    test("每次导出只查询一次仓库", async () => {
        const { repository, service, save } = fixture();

        await save(
            "2026-09-02",
            "A.md",
            3,
            1
        );

        const spy = jest.spyOn(
            repository,
            "getActivitiesBetween"
        );

        await service.buildMonthlyCsv(
            "2026-09",
            "2026-10-24"
        );

        expect(spy).toHaveBeenCalledTimes(1);

        expect(spy).toHaveBeenCalledWith(
            "2026-09-01",
            "2026-09-30"
        );
    });

    test("拒绝未来月份和非法月份", async () => {
        const { service } = fixture();

        await expect(
            service.buildMonthlyCsv(
                "2026-11",
                "2026-10-24"
            )
        ).rejects.toThrow();

        await expect(
            service.buildMonthlyCsv(
                "2026-13",
                "2026-10-24"
            )
        ).rejects.toThrow();
    });
});
