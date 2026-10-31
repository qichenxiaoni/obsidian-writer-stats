
import {
    buildFolderStats,
    parentFolderPath,
    sortFolderStats
} from "../src/core/FolderStatsService";

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
    const repository =
        new MemoryStatsRepository();

    const service =
        new FileRankingService(repository);

    const save = async (
        date: string,
        path: string,
        added: number,
        deleted: number
    ) => repository.saveActivity({
        date,
        filePath: path,
        start: count(0),
        added: count(added),
        deleted: count(deleted),
        net: count(added - deleted)
    });

    const getRanking = () =>
        service.getRanking(
            "2026-10-01",
            "2026-10-31"
        );

    return {
        repository,
        save,
        getRanking
    };
}

describe("FolderStatsService", () => {

    test("根目录总计不重复计算子文件夹", async () => {
        const { save, getRanking } = fixture();

        await save("2026-10-01", "Root.md", 5, 0);
        await save("2026-10-01", "Notes/A.md", 10, 2);
        await save(
            "2026-10-02",
            "Notes/Projects/B.md",
            20,
            4
        );
        await save(
            "2026-10-03",
            "Journal/C.md",
            7,
            1
        );

        const result =
            buildFolderStats(await getRanking());

        expect(result).toMatchObject({
            added: 42,
            deleted: 7,
            net: 35,
            fileCount: 4,
            directFileCount: 1
        });

        expect(result.folders).toEqual(
            expect.arrayContaining([
                {
                    path: "Notes",
                    name: "Notes",
                    added: 30,
                    deleted: 6,
                    net: 24,
                    fileCount: 2
                },
                {
                    path: "Journal",
                    name: "Journal",
                    added: 7,
                    deleted: 1,
                    net: 6,
                    fileCount: 1
                }
            ])
        );

        expect(result.folders).toHaveLength(2);
    });

    test("子文件夹递归汇总且直属文件不重复", async () => {
        const { save, getRanking } = fixture();

        await save(
            "2026-10-01",
            "Notes/A.md",
            10,
            1
        );

        await save(
            "2026-10-01",
            "Notes/Projects/B.md",
            5,
            2
        );

        await save(
            "2026-10-02",
            "Notes/Projects/Deep/C.md",
            6,
            0
        );

        await save(
            "2026-10-03",
            "Other/D.md",
            100,
            0
        );

        const ranking = await getRanking();

        expect(
            buildFolderStats(ranking, "Notes")
        ).toMatchObject({
            added: 21,
            deleted: 3,
            net: 18,
            fileCount: 3,
            directFileCount: 1
        });

        expect(
            buildFolderStats(
                ranking,
                "Notes"
            ).folders
        ).toEqual([
            {
                path: "Notes/Projects",
                name: "Projects",
                added: 11,
                deleted: 2,
                net: 9,
                fileCount: 2
            }
        ]);

        expect(
            buildFolderStats(
                ranking,
                "Notes/Projects"
            )
        ).toMatchObject({
            fileCount: 2,
            directFileCount: 1
        });
    });

    test("严格区分 Notes 与 Notes2", async () => {
        const { save, getRanking } = fixture();

        await save(
            "2026-10-01",
            "Notes/A.md",
            2,
            0
        );

        await save(
            "2026-10-01",
            "Notes2/B.md",
            99,
            0
        );

        const result = buildFolderStats(
            await getRanking(),
            "Notes"
        );

        expect(result.added).toBe(2);
        expect(result.fileCount).toBe(1);
    });

    test("纯删除计入活动，零变化不计入", async () => {
        const { save, getRanking } = fixture();

        await save(
            "2026-10-01",
            "Archive/Deleted.md",
            0,
            9
        );

        await save(
            "2026-10-02",
            "Archive/NoChange.md",
            0,
            0
        );

        const result =
            buildFolderStats(await getRanking());

        expect(result.fileCount).toBe(1);

        expect(result.folders).toEqual([
            {
                path: "Archive",
                name: "Archive",
                added: 0,
                deleted: 9,
                net: -9,
                fileCount: 1
            }
        ]);
    });

    test("一个文件多日活动只算一个活跃文件", async () => {
        const { save, getRanking } = fixture();

        await save(
            "2026-10-01",
            "Notes/A.md",
            3,
            0
        );

        await save(
            "2026-10-02",
            "Notes/A.md",
            7,
            1
        );

        const result =
            buildFolderStats(await getRanking());

        expect(result.fileCount).toBe(1);

        expect(result.folders[0]).toMatchObject({
            added: 10,
            deleted: 1,
            fileCount: 1
        });
    });

    test("文件重命名后按新路径归类", async () => {
        const {
            repository,
            save,
            getRanking
        } = fixture();

        await save(
            "2026-10-01",
            "Old/A.md",
            7,
            0
        );

        await repository.renameFile(
            "Old/A.md",
            "New/A.md"
        );

        const result =
            buildFolderStats(await getRanking());

        expect(
            result.folders.map(
                folder => folder.path
            )
        ).toEqual(["New"]);
    });

    test("历史空月份返回零值", async () => {
        const { getRanking } = fixture();

        const result =
            buildFolderStats(await getRanking());

        expect(result).toMatchObject({
            added: 0,
            deleted: 0,
            net: 0,
            fileCount: 0,
            directFileCount: 0,
            folders: []
        });
    });

    test("排序稳定且负净增长正确", () => {
        const rows = [
            {
                path: "B",
                name: "B",
                added: 0,
                deleted: 20,
                net: -20,
                fileCount: 1
            },
            {
                path: "A",
                name: "A",
                added: 0,
                deleted: 2,
                net: -2,
                fileCount: 1
            },
            {
                path: "C",
                name: "C",
                added: 8,
                deleted: 0,
                net: 8,
                fileCount: 1
            }
        ];

        expect(
            sortFolderStats(
                rows,
                "net"
            ).map(r => r.path)
        ).toEqual(["C", "A", "B"]);

        expect(
            sortFolderStats(
                rows,
                "deleted"
            ).map(r => r.path)
        ).toEqual(["B", "A", "C"]);

        expect(
            sortFolderStats(
                rows,
                "added"
            ).map(r => r.path)
        ).toEqual(["C", "A", "B"]);

        expect(rows[0].path).toBe("B");
    });

    test("返回上级直到根目录", () => {
        expect(
            parentFolderPath(
                "Notes/Projects/Deep"
            )
        ).toBe("Notes/Projects");

        expect(
            parentFolderPath("Notes")
        ).toBe("");

        expect(
            parentFolderPath("")
        ).toBe("");
    });
});
