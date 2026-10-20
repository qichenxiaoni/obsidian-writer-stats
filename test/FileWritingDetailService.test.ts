import {
    FileWritingDetailService
} from "../src/core/FileWritingDetailService";

import {
    FileRankingService
} from "../src/core/FileRankingService";

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
    const repository = new MemoryStatsRepository();

    const detailService = new FileWritingDetailService(repository);

    const rankingService = new FileRankingService(repository);

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
        detailService,
        rankingService,
        save
    };
}

describe("FileWritingDetailService", () => {
    test("当前月逐日补零且正确汇总", async () => {
        const {detailService,save} = fixture();

        await save("2026-10-08","note/A.md",230,18);
        await save("2026-10-12","note/A.md",0,11);
        await save("2026-10-08","B.md",500,0);

        const result = await detailService.getDetail(
            "note/A.md",
            "2026-10-01",
            "2026-10-17"
        );

        expect(result.days).toHaveLength(17);

        expect(result.days[0]).toEqual({
            date: "2026-10-01",
            added: 0,
            deleted: 0,
            net: 0,
            active: false
        });

        expect(result.days[7]).toMatchObject({
            date: "2026-10-08",
            added: 230,
            deleted: 18
        });

        expect(result.added).toBe(230);
        expect(result.deleted).toBe(29);
        expect(result.net).toBe(201);

        expect(result.bestWritingDay).toEqual({
            date: "2026-10-08",
            added: 230
        });
    });

    test("闰年二月正确包含29日",async () => {
        const {detailService,save} = fixture();

        await save("2024-02-29","A.md",18,0);

        const result = await detailService.getDetail(
            "A.md",
            "2024-02-01",
            "2024-02-29"
        );

        expect(result.days).toHaveLength(29);
        expect(result.days[28].added).toBe(18);
    });

    test("不混入目标月份以外的数据",async () => {
        const {detailService,save} = fixture();

        await save("2026-08-31","A.md",100,0);
        await save("2026-09-01","A.md",12,0);
        await save("2026-09-30","A.md",5,0);
        await save("2026-10-01","A.md",500,0);

        const result = await detailService.getDetail(
            "A.md",
            "2026-09-01",
            "2026-09-30"
        );

        expect(result.added).toBe(17);
        expect(result.days).toHaveLength(30);
    });

    test("只有删除仍计入活跃天数",async () => {
        const {detailService,save} = fixture();

        await save("2026-10-03","A.md",0,9);

        const result = await detailService.getDetail(
            "A.md",
            "2026-10-01",
            "2026-10-05"
        );

        expect(result.added).toBe(0);
        expect(result.deleted).toBe(9);
        expect(result.net).toBe(-9);
        expect(result.activeDays).toBe(1);
        expect(result.bestWritingDay).toBeNull();
        expect(result.isEmpty).toBe(false);
    });

    test("并列最佳新增量选择较晚日期",async () => {
        const {detailService,save} = fixture();

        await save("2026-10-02","A.md",50,0);
        await save("2026-10-07","A.md",50,0);

        const result = await detailService.getDetail(
            "A.md",
            "2026-10-02",
            "2026-10-07"
        );

        expect(result.bestWritingDay).toEqual({
            date: "2026-10-07",
            added: 50
        });
    });

    test("无记录文件返回空状态",async () => {
        const {detailService} = fixture();

        const result = await detailService.getDetail(
            "deleted.md",
            "2026-10-01",
            "2026-10-31"
        );

        expect(result.days).toHaveLength(31);
        expect(result.added).toBe(0);
        expect(result.activeDays).toBe(0);
        expect(result.bestWritingDay).toBeNull();
        expect(result.isEmpty).toBe(true);
    });

    test("文件重命名后按新路径查询",async () => {
        const {
            repository,
            detailService,
            save
        } = fixture();

        await save("2026-10-02","Old.md",15,3);

        await repository.renameFile(
            "Old.md",
            "New.md"
        );

        const result = await detailService.getDetail(
            "New.md",
            "2026-10-01",
            "2026-10-10"
        );

        expect(result.added).toBe(15);
        expect(result.deleted).toBe(3);
    });

    test("详情数字与排行榜数字一致",async () => {
        const {
            detailService,
            rankingService,
            save
        } = fixture();

        await save("2026-10-08","A.md",230,18);
        await save("2026-10-12","A.md",0,11);

        const [detail,ranking] = await Promise.all([
            detailService.getDetail(
                "A.md",
                "2026-10-01",
                "2026-10-17"
            ),
            rankingService.getRanking(
                "2026-10-01",
                "2026-10-17"
            )
        ]);

        const row = ranking.files.find(
            file => file.filePath === "A.md"
        );

        expect(row).toMatchObject({
            added: detail.added,
            deleted: detail.deleted,
            net: detail.net,
            activeDays: detail.activeDays
        });
    });

    test("拒绝非法日期范围和空路径",async () => {
        const {detailService} = fixture();

        await expect(
            detailService.getDetail(
                "A.md",
                "2026-10-12",
                "2026-10-01"
            )
        ).rejects.toThrow();

        await expect(
            detailService.getDetail(
                "A.md",
                "2026-02-30",
                "2026-03-02"
            )
        ).rejects.toThrow();

        await expect(
            detailService.getDetail(
                "A.md",
                "2024-01-01",
                "2026-01-01"
            )
        ).rejects.toThrow();

        await expect(
            detailService.getDetail(
                " ",
                "2026-10-01",
                "2026-10-02"
            )
        ).rejects.toThrow();
    });
});