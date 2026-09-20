import { JsonStatsRepository } from "../src/persistence/JsonStatsRepository";
import { MemoryPluginDataStore } from "../src/persistence/MemoryPluginDataStore";
import type { CountResult } from "../src/domain/CountResult";
import { createEmptyPluginData } from "../src/domain/PluginData";
import type { PluginData } from
    "../src/domain/PluginData";
import type { PluginDataStore } from
    "../src/persistence/PluginDataStore";

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

// 专门用于验证底层 save调用了几次
class CountingStore implements PluginDataStore {
    saveCount = 0;

    private data = createEmptyPluginData();

    async load(): Promise<PluginData> {
        return structuredClone(this.data);
    }

    async save(
        data: PluginData
    ): Promise<void> {
        this.saveCount++;
        this.data = structuredClone(data);
    }
}

describe("JsonStatsRepository", () => {
    test("可以持久化和读取 snapshot", async () => {
        const store = new MemoryPluginDataStore();

        const repository = new JsonStatsRepository(store);

        await repository.saveSnapshot({
            path: "A.md",
            modifiedAt: 1000,
            counts: makeCount(100)
        });

        const snapshot = await repository.getSnapshot("A.md");

        expect(snapshot?.counts.total).toBe(100);
    });

    test("可以持久化和读取 activity", async () => {
        const store = new MemoryPluginDataStore();
        const repository = new JsonStatsRepository(store);

        await repository.saveActivity({
            date: "2026-09-19",
            filePath: "A.md",
            start: makeCount(100),
            added: makeCount(20),
            deleted: makeCount(5),
            net: makeCount(15)
        });

        const activity = await repository.getActivity("2026-09-19", "A.md");

        expect(activity?.added.total).toBe(20);
        expect(activity?.net.total).toBe(15);
    });

    test("新 repository 实例仍能读到同一 store 中的数据", async () => {
        const store = new MemoryPluginDataStore();
        const first = new JsonStatsRepository(store);

        await first.saveSnapshot({
            path: "A.md",
            modifiedAt: 1000,
            counts: makeCount(88)
        });

        const second = new JsonStatsRepository(store);
        const snapshot = await second.getSnapshot("A.md");

        expect(snapshot?.counts.total).toBe(88);
    });

    test("renameFile 会更新 snapshot 和 activity", async () => {
        const store = new MemoryPluginDataStore();
        const repository = new JsonStatsRepository(store);

        await repository.saveSnapshot({
            path: "Old.md",
            modifiedAt: 1000,
            counts: makeCount(100)
        });

        await repository.saveActivity({
            date: "2026-09-19",
            filePath: "Old.md",
            start: makeCount(100),
            added: makeCount(20),
            deleted: makeCount(0),
            net: makeCount(20)
        });

        await repository.renameFile("Old.md", "New.md");

        expect(await repository.getSnapshot("Old.md")).toBeUndefined();
        expect(await repository.getSnapshot("New.md")).toBeDefined();
        expect(await repository.getActivity("2026-09-19", "New.md")).toBeDefined();
    });

    test(
        "removeSnapshot 只删除 snapshot，并保留历史 activity",
        async () => {
            const store =
                new MemoryPluginDataStore();

            const repository =
                new JsonStatsRepository(store);

            await repository.saveSnapshot({
                path: "A.md",
                modifiedAt: 1000,
                counts: makeCount(100)
            });

            await repository.saveActivity({
                date: "2026-09-19",
                filePath: "A.md",
                start: makeCount(100),
                added: makeCount(20),
                deleted: makeCount(0),
                net: makeCount(20)
            });

            await repository.removeSnapshot(
                "A.md"
            );

            const snapshot =
                await repository.getSnapshot(
                    "A.md"
                );

            const activity =
                await repository.getActivity(
                    "2026-09-19",
                    "A.md"
                );

            expect(snapshot)
                .toBeUndefined();

            expect(activity)
                .toBeDefined();

            expect(activity?.added.total)
                .toBe(20);

            expect(activity?.net.total)
                .toBe(20);
        }
    );

    test("saveTrackingResult 同时保存 snapshot 和 activity", async () => {
        const store = new MemoryPluginDataStore();
        const repository = new JsonStatsRepository(store);

        await repository.saveTrackingResult(
            {
                path: "A.md",
                modifiedAt: 2000,
                counts: makeCount(120)
            },
            {
                date: "2026-09-19",
                filePath: "A.md",
                start: makeCount(100),
                added: makeCount(20),
                deleted: makeCount(0),
                net: makeCount(20)
            }
        );

        const snapshot = await repository.getSnapshot("A.md");
        const activity = await repository.getActivity("2026-09-19", "A.md");

        expect(snapshot?.counts.total).toBe(120);
        expect(activity?.added.total).toBe(20);
    })

    test("saveTrackingResult 只执行一次底层 svae", async () => {
        const store = new CountingStore();
        const repository = new JsonStatsRepository(store);

        await repository.saveTrackingResult(
            {
                path: "A.md",
                modifiedAt: 2000,
                counts: makeCount(120)
            },
            {
                date: "2026-09-19",
                filePath: "A.md",
                start: makeCount(100),
                added: makeCount(20),
                deleted: makeCount(0),
                net: makeCount(20)
            }
        );

        expect(store.saveCount).toBe(1);
    });
});