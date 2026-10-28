import {
    App,
    TFolder
} from "obsidian";

import {
    createBackupText,
    parseBackupText,
    type WriterStatsBackup
} from "../core/PluginBackupCodec";

import type {
    BackupGuardedDataStore
} from "../persistence/BackupGuardedDataStore";

const FOLDER = "Writer Stats Backups";

export class BackupVaultService {
    constructor(
        private readonly app: App,

        private readonly store: BackupGuardedDataStore
    ) { }

    // 列出备份目录下的JSON文件，文件名倒序排序

    listPaths(): string[] {
        return this.app.vault.getFiles()
            .filter(
                file => file.path.startsWith(`${FOLDER}/`) &&
                    file.extension === "json"
            )
            .map(file => file.path)
            .sort(
                (a, b) => b.localeCompare(a)
            );
    }

    // 读取并验证制定备份文件

    async inspect(
        path: string
    ): Promise<WriterStatsBackup> {
        if (
            !path.startsWith(`${FOLDER}/`) ||
            !path.endsWith(".json")
        ) {
            throw new Error(
                "只能选择 Writer Stats Backups " +
                "内的 JSON 文件"
            );
        }

        const file = this.app.vault.getFileByPath(path);

        if (!file) {
            throw new Error(
                "备份文件不存在"
            );
        }

        const content = await this.app.vault.read(file);

        return parseBackupText(content);
    }

    // 手动创建备份

    async createBackup(
        kind:
            "manual" | "before-restore" = "manual"
    ): Promise<string> {
        return this.writeBackup(
            await this.store.load(),
            kind
        );
    }

    // 将 PluginData 保存为 JSON，已存在文件不会被覆盖

    private async writeBackup(
        data: WriterStatsBackup["data"],
        kind: string
    ): Promise<string> {
        const existing = this.app.vault.getAbstractFileByPath(FOLDER);

        if (
            existing &&
            !(existing instanceof TFolder)
        ) {
            throw new Error(
                "备份目录名称被同名文件占用"
            );
        }

        if (!existing) {
            await this.app.vault.createFolder(FOLDER);
        }

        const text = createBackupText(data);

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

        const base = `${FOLDER}/writer-stats-${kind}-${timestamp}`;

        for (
            let i = 1;
            i <= 1000;
            i++
        ) {
            const suffix = i === 1 ? "" : `-${i}`;

            const path = `${base}${suffix}.json`;

            if (
                await this.app.vault.adapter.exists(path)
            ) {
                continue;
            }

            await this.app.vault.create(
                path,
                text
            );

            return path;
        }

        throw new Error(
            "没有可用备份文件名"
        );
    }

    // 从经过校验的文件恢复数据，返回恢复前自动备份的文件路径

    async restore(
        path: string
    ): Promise<string> {
        // 任何覆盖操作前先验证目标备份

        const backup = await this.inspect(path);

        let safetyPath = "";

        await this.store.restore(
            backup.data,

            async current => {
                safetyPath =
                    await this.writeBackup(
                        current,
                        "before-restore"
                    );
            }
        );

        return safetyPath;
    }
}