import type { PluginData } from "../domain/PluginData";
import type { PluginDataStore } from "./PluginDataStore";

/**
 * 对同一个数据存储实例，串行执行完整的：
 * 读取 → 修改 → 保存。
 *
 * 修改器必须同步执行，不能包含 await。
 */

export class PluginDataMutationQueue {
    private static readonly queues = new WeakMap<
        PluginDataStore,
        PluginDataMutationQueue
    >();

    static forStore(
        store: PluginDataStore
    ): PluginDataMutationQueue {
        let queue = this.queues.get(store);

        if (!queue) {
            queue = new PluginDataMutationQueue(store);
            this.queues.set(store,queue);
        }

        return queue;
    }

    private pending: Promise<void> = Promise.resolve();

    private constructor(
        private readonly store: PluginDataStore
    ){}

    run(
        mutate: (data: PluginData) => void | boolean
    ): Promise<void> {
        const task = this.pending.then(async () => {
            const data = await this.store.load();

            const changed = mutate(data);

            // 返回 false 表示数据没有变化
            if (changed !== false) {
                await this.store.save(data);
            }
        });

        // 一次写入失败不能堵塞后续队列
        this.pending = task.then(
            () => undefined,
            () => undefined
        );

        // 调用方仍能收到本次操作的错误
        return task;
    }
}