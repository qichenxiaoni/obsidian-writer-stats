import type {
    PluginData
} from "../domain/PluginData";

import type {
    PluginDataStore
} from "./PluginDataStore";

type Mode =
    "active" |
    "restoring" |
    "frozen";

/**
 * 带恢复保护的数据存储。
 *
 * 注意：
 * 该类只负责底层写入队列和恢复保护，
 * 不改变现有 StatsRepository 的公开接口。
 */

export class BackupGuardedDataStore
    implements PluginDataStore {
    private mode: Mode = "active";

    private pending: Promise<void> = Promise.resolve();

    constructor(
        private readonly inner: PluginDataStore
    ) { }

    load(): Promise<PluginData> {
        return this.inner.load();
    }

    // 正常保存，已排队保存依次执行
    save(
        data: PluginData
    ): Promise<void> {
        if (this.mode !== "active") {
            return Promise.reject(
                new Error(
                    "备份恢复期间禁止写入；" +
                    "请重新加载插件"
                )
            );
        }

        const task = this.pending.then(
            () => this.inner.save(data)
        );

        // 不让一次失败堵塞后续保存队列
        this.pending = task.then(
            () => undefined,
            () => undefined
        );

        return task;
    }

    /**
    * 安全恢复。
    *
    * 1. 冻结新的普通写入
    * 2. 等待已排队写入完成
    * 3. 读取原始数据
    * 4. 调用回调创建恢复前备份
    * 5. 替换数据并读回校验
    * 6. 成功后维持冻结，等待插件重新加载
    */

    async restore(
        target: PluginData,

        saveSafetyCopy:
            (current: PluginData) => Promise<void>
    ): Promise<void> {
        if (this.mode !== "active") {
            throw new Error(
                "正在恢复或等待插件重新加载"
            );
        }

        this.mode = "restoring";

        await this.pending;

        let original: PluginData;

        try {
            original = await this.inner.load();

            // 必须先完成安全备份
            await saveSafetyCopy(original);
        } catch (error) {
            this.mode = "active";
            throw error;
        }

        try {
            await this.inner.save(target);

            const loaded = await this.inner.load();

            if (
                JSON.stringify(loaded) !== JSON.stringify(target)
            ) {
                throw new Error(
                    "恢复后的数据校验失败"
                );
            }

            // 防止旧编辑任务继续覆盖恢复结果
            this.mode = "frozen";
        } catch (error) {
            // 恢复失败时尝试回滚
            try {
                await this.inner.save(original);

                this.mode = "active";
            } catch (rollbackError) {
                // 回滚失败时维持冻结
                this.mode = "frozen";

                throw new Error(
                    "恢复与回滚均失败！" +
                    "请勿继续写入并使用安全备份人工恢复: " +
                    String(rollbackError)
                );
            }

            throw error;
        }
    }
}