import { Plugin, TFile} from "obsidian";
import type { StatsRepository } from "../persistence/StatsRepository";
import type { EditorEventController } from "./EditorEventController";

export class VaultEventController {
    private pending: Promise<void> = Promise.resolve();

    private stopped = false;

    constructor(
        private readonly plugin: Plugin,
        private readonly repository: StatsRepository,
        private readonly enditorEvents: EditorEventController
    ) {}

    start(): void {
        this.plugin.registerEvent(
            this.plugin.app.vault.on(
                "rename",
                (file, oldPath) => {
                    if (
                        this.stopped ||
                        !(file instanceof TFile) ||
                        file.extension !== 'md'
                    ){
                        return;
                    }

                    const newPath = file.path;

                    this.enqueue(
                        "重命名",
                        async () => {
                            // 旧路径的编辑先保存
                            await this.enditorEvents.flushFile(oldPath);

                            // 再迁移快照及历史记录
                            await this.repository.renameFile(
                                oldPath,
                                newPath
                            );
                        }
                    );
                }
            )
        );

        this.plugin.registerEvent (
            this.plugin.app.vault.on(
                "delete",
                file => {
                    if (
                        this.stopped ||
                        !(file instanceof TFile) ||
                        file.extension !== 'md'
                    ) {
                        return;
                    }

                    const path = file.path;

                    this.enqueue(
                        "删除",
                        async () => {
                            // 先保存剩余编辑及历史活动
                            await this.enditorEvents.flushFile(path);

                            // 只移除当前快照，历史活动仍按照原规则保留
                            await this.repository.removeSnapshot(path);
                        }
                    );
                }
            )
        );
    }

    stop(): Promise<void> {
        this.stopped = true;
        return this.pending;
    }

    private enqueue(
        name: string,
        action: () => Promise<void>
    ): void {
        const task = this.pending.then(action);

        this.pending = task.catch(error => {
            console.error(
                `[Writer Stats] 文件${name}统计处理失败`,
                error
            );
        });
    }
}