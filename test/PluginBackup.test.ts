
import {
    createBackupText,
    parseBackupText,
    validateBackupData
} from "../src/core/PluginBackupCodec";

import {
    createEmptyPluginData
} from "../src/domain/PluginData";

import {
    MemoryPluginDataStore
} from "../src/persistence/MemoryPluginDataStore";

import {
    BackupGuardedDataStore
} from "../src/persistence/BackupGuardedDataStore";

import type {
    PluginDataStore
} from "../src/persistence/PluginDataStore";

const count = (total: number) => ({
    chinese: total,
    englishWords: 0,
    englishChars: 0,
    numbers: 0,
    punctuation: 0,
    spaces: 0,
    total
});

function sample() {
    const data = createEmptyPluginData();

    data.settings.dailyGoal = 1500;

    data.fileSnapshots["笔记/A.md"] = {
        path: "笔记/A.md",
        modifiedAt: 1760000000000,
        counts: count(120)
    };

    data.dailyActivities[
        "2026-10-08:笔记/A.md"
    ] = {
        date: "2026-10-08",
        filePath: "笔记/A.md",
        start: count(100),
        added: count(30),
        deleted: count(10),
        net: count(20)
    };

    return data;
}

describe("Writer Stats backup", () => {

    test(
        "备份往返保留全部插件数据",
        () => {
            const input = sample();

            const parsed = parseBackupText(
                createBackupText(
                    input,
                    "2026-10-25T12:00:00.000Z"
                )
            );

            expect(parsed.createdAt).toBe(
                "2026-10-25T12:00:00.000Z"
            );

            expect(parsed.data).toEqual(input);
        }
    );

    test(
        "拒绝无法解析的 JSON",
        () => {
            expect(() =>
                parseBackupText("{")
            ).toThrow();
        }
    );

    test(
        "拒绝不受支持的数据版本",
        () => {
            const raw = JSON.parse(
                createBackupText(sample())
            );

            raw.data.schemaVersion = 999;

            expect(() =>
                parseBackupText(
                    JSON.stringify(raw)
                )
            ).toThrow(/版本/);
        }
    );

    test(
        "拒绝缺少历史活动对象的数据",
        () => {
            const raw = sample() as unknown as
                Record<string, unknown>;

            delete raw.dailyActivities;

            expect(() =>
                validateBackupData(raw)
            ).toThrow();
        }
    );

    test(
        "拒绝非法新增计数",
        () => {
            const raw = sample();

            raw.dailyActivities[
                "2026-10-08:笔记/A.md"
            ].added.total = -2;

            expect(() =>
                validateBackupData(raw)
            ).toThrow(/无效历史活动/);
        }
    );

    test(
        "拒绝日期与活动键不匹配",
        () => {
            const raw = sample();

            raw.dailyActivities[
                "2026-10-08:笔记/A.md"
            ].date = "2026-10-09";

            expect(() =>
                validateBackupData(raw)
            ).toThrow();
        }
    );

    test(
        "允许合法的负净增长",
        () => {
            const raw = sample();

            raw.dailyActivities[
                "2026-10-08:笔记/A.md"
            ].net = count(-5);

            expect(() =>
                validateBackupData(raw)
            ).not.toThrow();
        }
    );

    test(
        "恢复前保存安全备份且成功后冻结写入",
        async () => {
            const memory =
                new MemoryPluginDataStore();

            const gate =
                new BackupGuardedDataStore(memory);

            const original = sample();

            await gate.save(original);

            const replacement =
                createEmptyPluginData();

            let safety: unknown;

            await gate.restore(
                replacement,
                async current => {
                    safety = structuredClone(current);

                    expect(
                        await memory.load()
                    ).toEqual(original);
                }
            );

            expect(safety).toEqual(original);

            expect(await gate.load()).toEqual(
                replacement
            );

            await expect(
                gate.save(original)
            ).rejects.toThrow(/禁止写入/);
        }
    );

    test(
        "安全备份失败时不覆盖数据",
        async () => {
            const memory =
                new MemoryPluginDataStore(
                    sample()
                );

            const gate =
                new BackupGuardedDataStore(memory);

            await expect(
                gate.restore(
                    createEmptyPluginData(),
                    async () => {
                        throw new Error("磁盘已满");
                    }
                )
            ).rejects.toThrow(/磁盘已满/);

            expect(
                await gate.load()
            ).toEqual(sample());

            await expect(
                gate.save(sample())
            ).resolves.toBeUndefined();
        }
    );

    test(
        "恢复写入失败时尝试回滚",
        async () => {
            const memory =
                new MemoryPluginDataStore(
                    sample()
                );

            let saves = 0;

            const store: PluginDataStore = {
                load: () => memory.load(),

                save: async data => {
                    saves++;

                    if (saves === 1) {
                        throw new Error(
                            "写入失败"
                        );
                    }

                    await memory.save(data);
                }
            };

            const gate =
                new BackupGuardedDataStore(store);

            await expect(
                gate.restore(
                    createEmptyPluginData(),
                    async () => {}
                )
            ).rejects.toThrow("写入失败");

            expect(
                await gate.load()
            ).toEqual(sample());

            await expect(
                gate.save(sample())
            ).resolves.toBeUndefined();
        }
    );

    test(
        "恢复前等待已排队写入完成",
        async () => {
            const memory =
                new MemoryPluginDataStore();

            const gate =
                new BackupGuardedDataStore(memory);

            const write =
                gate.save(sample());

            let observed: unknown;

            await gate.restore(
                createEmptyPluginData(),
                async data => {
                    observed =
                        structuredClone(data);
                }
            );

            await write;

            expect(observed).toEqual(
                sample()
            );
        }
    );

    test("合法文件快照应通过严格校验",async () => {
        const data = sample();

        expect(
            data.fileSnapshots["笔记/A.md"].counts
        ).toEqual({
            chinese: 120,
            englishWords: 0,
            englishChars: 0,
            numbers: 0,
            punctuation: 0,
            spaces: 0,
            total: 120
        });

        expect(() => {
            validateBackupData(data);
        }).not.toThrow();
    });
});
