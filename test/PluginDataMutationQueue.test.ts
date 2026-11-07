import { JsonStatsRepository } from "../src/persistence/JsonStatsRepository";
import { MemoryPluginDataStore } from "../src/persistence/MemoryPluginDataStore";
import { BackupGuardedDataStore } from "../src/persistence/BackupGuardedDataStore";
import { PluginSettingsService } from "../src/core/PluginSettingsService";
import type { PluginDataStore } from "../src/persistence/PluginDataStore";

const zero = {
    chinese: 0,
    englishWords: 0,
    englishChars: 0,
    numbers: 0,
    punctuation: 0,
    spaces: 0,
    total: 0
};

describe("PluginDataMutationQueue", () => {
    test("并发写入不会覆盖其他快照或设置", async () => {
        const store = new BackupGuardedDataStore(new MemoryPluginDataStore());
        const repository = new JsonStatsRepository(store);
        const settings = new PluginSettingsService(store);

        await Promise.all([
            repository.saveSnapshot({
                path: "A.md",
                modifiedAt: 1,
                counts: zero
            }),

            repository.saveSnapshot({
                path: "B.md",
                modifiedAt: 2,
                counts: zero
            }),

            settings.setDailyGoal(1500)
        ]);

        const result = await store.load();

        expect(
            Object.keys(
                result.fileSnapshots
            ).sort()
        ).toEqual([
            "A.md",
            "B.md"
        ]);

        expect(
            result.settings.dailyGoal
        ).toBe(1500);
    });

    test("一次保存失败不会阻塞后续操作", async () => {
        const memory = new MemoryPluginDataStore();

        let failOnce = true;

        const store: PluginDataStore = {
            load: () => memory.load(),

            save: async data => {
                if (failOnce) {
                    failOnce = false;

                    throw new Error(
                        "模拟磁盘失败"
                    );
                }

                await memory.save(data);
            }
        };

        const repository = new JsonStatsRepository(store);

        await expect(
            repository.saveSnapshot({
                path: "A.md",
                modifiedAt: 1,
                counts: zero
            })
        ).rejects.toThrow(
            "模拟磁盘失败"
        );

        await expect(
            repository.saveSnapshot({
                path: "B.md",
                modifiedAt: 2,
                counts: zero
            })
        ).resolves.toBeUndefined();

        expect(
            (await store.load()).fileSnapshots["B.md"]
        ).toBeDefined();
    });
});