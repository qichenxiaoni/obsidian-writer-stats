import {
    type Editor,
    MarkdownView,
    type Plugin,
    type TFile
} from "obsidian";

import { ActivityTracker } from "../core/ActivityTracker";
import { TextAnalyzer } from "../core/TextAnalyzer";
import { WritingTimeClock } from "../core/WritingTimeClock";
import { getLocalDateKey } from "../utils/DateService";

const EDIT_DEBOUNCE_MS = 500;

interface PendingEdit {
    path: string;
    date: string;
    text: string;
    at: number;
}

export class EditorEventController {
    private readonly pending = new Map<
        string,
        {
            change: PendingEdit;
            timer: ReturnType<typeof setTimeout>;
        }
    >();

    private readonly writingClock = new WritingTimeClock();

    private processing: Promise<void> = Promise.resolve();
    private stopped = false;
    private stopping: Promise<void> | null = null;

    constructor(
        private readonly plugin: Plugin,
        private readonly analyzer: TextAnalyzer,
        private readonly tracker: ActivityTracker,
        private readonly onActivityUpdated?:
            (date: string) => Promise<void> | void
    ) { }

    start(): void {
        this.initializeOpenMarkdownFiles();

        this.plugin.registerEvent(
            this.plugin.app.workspace.on("file-open", file => {
                if (this.stopped) return;

                // 文件切换会中断连续编辑时长计算。
                this.writingClock.breakSession();

                // 提交切换前尚在防抖窗口中的编辑。
                void this.flushAll().catch(error => {
                    console.error(
                        "[Writer Stats] 文件切换时保存失败",
                        error
                    );
                });

                if (file) {
                    this.queueBaseline(file);
                }
            })
        );

        this.plugin.registerEvent(
            this.plugin.app.workspace.on(
                "editor-change",
                (editor, info) => {
                    if (this.stopped || !info.file) {
                        return;
                    }

                    this.scheduleEditorChange(
                        editor,
                        info.file
                    );
                }
            )
        );

        // 窗口失焦时提前提交未完成的防抖任务。
        this.plugin.registerDomEvent(
            window,
            "blur",
            () => {
                if (this.stopped) return;

                this.writingClock.breakSession();

                void this.flushAll().catch(error => {
                    console.error(
                        "[Writer Stats] 窗口失焦时保存失败",
                        error
                    );
                });
            }
        );
    }

    /**
     * 提交全部待处理编辑。
     * 不清除已累计但尚未使用的计时增量。
     */
    flushAll(): Promise<void> {
        return this.flushMatching(() => true);
    }

    /**
     * 供文件重命名、删除流程调用。
     * 确保指定路径的待处理编辑先完成。
     */
    flushFile(path: string): Promise<void> {
        return this.flushMatching(
            change => change.path === path
        );
    }

    /**
     * 停止接收编辑事件，并提交剩余任务。
     *
     * 返回 Promise 供调用方监控。
     * 不代表 Obsidian 必定等待异步卸载完成。
     */
    stop(): Promise<void> {
        if (this.stopping) {
            return this.stopping;
        }

        this.stopped = true;

        this.stopping = this.flushAll().then(() => {
            this.writingClock.reset();
        });

        return this.stopping;
    }

    private initializeOpenMarkdownFiles(): void {
        const leaves =
            this.plugin.app.workspace.getLeavesOfType(
                "markdown"
            );

        for (const leaf of leaves) {
            const view = leaf.view;

            if (
                view instanceof MarkdownView &&
                view.file
            ) {
                this.queueBaseline(view.file);
            }
        }
    }

    private queueBaseline(file: TFile): void {
        void this.enqueueTask(async () => {
            if (this.stopped) return;

            const content =
                await this.plugin.app.vault.cachedRead(
                    file
                );

            const counts =
                this.analyzer.analyze(content);

            await this.tracker.ensureBaseline(
                file.path,
                file.stat.mtime,
                counts
            );
        }).catch(() => undefined);
    }

    private scheduleEditorChange(
        editor: Editor,
        file: TFile
    ): void {
        const at = new Date();
        const date = getLocalDateKey(at);
        const path = file.path;

        this.writingClock.record(
            path,
            date,
            at.getHours(),
            at.getTime()
        );

        // 当场捕获正文，避免防抖期间 Editor 被复用。
        const change: PendingEdit = {
            path,
            date,
            text: editor.getValue(),
            at: at.getTime()
        };

        // 同一个文件的不同日期必须分别保存。
        const key = JSON.stringify([
            date,
            path
        ]);

        const old = this.pending.get(key);

        if (old) {
            clearTimeout(old.timer);
        }

        const timer = setTimeout(() => {
            const entry = this.pending.get(key);

            if (
                !entry ||
                entry.change !== change
            ) {
                return;
            }

            this.pending.delete(key);

            void this.enqueueTask(
                () => this.processEditorChange(change)
            ).catch(() => undefined);
        }, EDIT_DEBOUNCE_MS);

        this.pending.set(key, {
            change,
            timer
        });
    }

    private flushMatching(
        matches: (change: PendingEdit) => boolean
    ): Promise<void> {
        const edits = Array.from(
            this.pending.entries()
        )
            .filter(
                ([, item]) => matches(item.change)
            )
            .sort(
                (a, b) =>
                    a[1].change.at -
                    b[1].change.at
            );

        const tasks: Promise<void>[] = [];

        for (const [key, item] of edits) {
            clearTimeout(item.timer);
            this.pending.delete(key);

            tasks.push(
                this.enqueueTask(
                    () => this.processEditorChange(
                        item.change
                    )
                )
            );
        }

        // 包括此前已经启动、尚未完成的任务。
        return Promise.all([
            ...tasks,
            this.processing
        ]).then(() => undefined);
    }

    private enqueueTask(
        task: () => Promise<void>
    ): Promise<void> {
        const running =
            this.processing.then(task);

        // 一次任务失败不能堵塞后续事件。
        this.processing = running.catch(error => {
            console.error(
                "[Writer Stats] 编辑事件处理失败",
                error
            );
        });

        return running;
    }

    private async processEditorChange(
        change: PendingEdit
    ): Promise<void> {
        const counts =
            this.analyzer.analyze(change.text);

        const time = this.writingClock.take(
            change.path,
            change.date
        );

        try {
            await this.tracker.track(
                change.date,
                change.path,
                change.at,
                counts,
                time
            );
        } catch (error) {
            // 数据写入失败，恢复本次取出的计时增量。
            this.writingClock.restore(
                change.path,
                change.date,
                time
            );

            throw error;
        }

        // 界面刷新失败不应导致已落盘数据重复计算。
        try {
            await this.onActivityUpdated?.(
                change.date
            );
        } catch (error) {
            console.error(
                "[Writer Stats] 统计界面刷新失败",
                error
            );
        }
    }
}
