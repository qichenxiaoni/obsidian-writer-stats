import {
    App,
    Modal,
    Notice
} from "obsidian";

import type {
    BackupVaultService
} from "./BackupVaultService";

export class WriterStatsBackupModal extends Modal {
    private busy = false;

    constructor(
        app: App,

        private readonly service: BackupVaultService
    ) {
        super(app);
    }

    onOpen():void {
        this.containerEl.addClass(
            "writer-stats-backup-modal"
        );

        this.titleEl.setText(
            "Writer Stats 备份与恢复"
        );

        this.render();
    }

    onClose(): void {
        this.contentEl.empty();
    }

    private render(): void {
        const root = this.contentEl;

        root.empty();

        root.createEl("p",{
            text:
                "备份包含目标设置、文件快照和历史活动，" +
                "不包含 Markdown 正文。"
        });

        // 创建手动备份

        const backupButton = root.createEl(
            "button",
            {
                text: "创建完整 JSON 备份"
            }
        );

        backupButton.disabled = this.busy;

        backupButton.addEventListener(
            "click",
            () => {
                if (this.busy) {
                    return;
                }

                this.busy = true;
                backupButton.disabled = true;

                void (async () => {
                    try{
                        const path = await this.service.createBackup();

                        new Notice(`备份已保存： ${path}`, 7000);

                        this.render();
                    } catch (error) {
                        console.error(
                            "[Writer Stats] 备份失败",
                            error
                        );

                        new Notice(
                            "备份失败，请查看控制台"
                        );
                    } finally {
                        this.busy = false;
                        backupButton.disabled = false;
                    }
                })();
            }
        );

        root.createEl("h3",{
            text: "从备份恢复"
        });

        root.createEl("p", {
            text:
                "恢复会覆盖当前插件统计数据。" +
                "确认后将自动创建恢复前安全备份；" +
                "成功后必须立即重新加载插件。"
        });

        const paths = this.service.listPaths();

        if (paths.length === 0) {
            root.createEl("p",{
                text:
                    "没有备份文件，你也可以先将有效备份 JSON" +
                    "放入 Writer Stats Backups 文件夹"
            });

            return;
        }

        // 选择现有备份

        const select = root.createEl(
            "select"
        );

        for (const path of paths) {
            select.createEl("option",{
                value: path,
                text:
                    path.split("/").pop() ??
                    path
            });
        }

        const preview = root.createEl(
            "button",
            {
                text: "检查选中备份"
            }
        );

        preview.addEventListener(
            "click",
            () => {
                if (this.busy) {
                    return;
                }

                const selected = select.value;

                this.busy = true;
                preview.disabled = true;

                void (async () => {
                    try {
                        const backup = await this.service.inspect(selected);

                        if (
                            !this.contentEl.isConnected
                        ) {
                            return;
                        }

                        this.renderConfirmation(
                            selected,
                            backup.createdAt,
                            Object.keys(
                                backup.data.fileSnapshots
                            ).length,
                            Object.keys(
                                backup.data.dailyActivities
                            ).length,
                            backup.data.settings.dailyGoal
                        );
                    }catch (error) {
                        console.error(
                            "[Writer Stats] 备份检查失败",
                            error
                        );

                        new Notice(
                            "备份校验失败，已拒绝恢复"
                        );
                    } finally {
                        this.busy = false;
                        preview.disabled = false;
                    }
                })();
            }
        );
    }

    // 恢复前二次确认

    private renderConfirmation(
        path: string,
        at: string,
        snapshots: number,
        activities: number,
        goal: number
    ): void {
        const root = this.contentEl;

        root.empty();

        root.createEl("h3",{
            text: "确认覆盖当前统计数据"
        });

        root.createEl("p",{
            text: `文件：${path}`
        });

        root.createEl("p",{
            text:
                `备份时间：${at}；` +
                `文件快照 ${snapshots}；` +
                `历史活动 ${activities}；` +
                `每日目标 ${goal}`
        });

        root.createEl("p",{
            text:
                "恢复前请停止编辑笔记。" +
                "输入“恢复”以确认；" +
                "操作成功后立即重新加载 Writer Stats 插件"
        });

        const input = root.createEl(
            "input",
            {
                type: "text",
                placeholder: "输入：恢复"
            }
        );

        const confirm = root.createEl(
            "button",
            {
                text: "请确认恢复并创建安全备份"
            }
        );

        confirm.disabled = true;
        
        input.addEventListener(
            "input",
            () => {
                confirm.disabled =
                    input.value !== "恢复" ||
                    this.busy;
            }
        );

        confirm.addEventListener(
            "click",
            () => {
                if (
                    this.busy ||
                    input.value !== "恢复"
                ) {
                    return;
                }

                this.busy = true;
                confirm.disabled = true;

                void (async () => {
                    try {
                        const safetyPath = await this.service.restore(path);

                        this.close();

                        new Notice(
                            "恢复成功！ 恢复前备份：" +
                            `${safetyPath}。` +
                            "请立即重新加载插件。",
                            15000
                        );
                    }catch (error) {
                        console.error(
                            "[Writer Stats] 恢复失败",
                            error
                        );

                        new Notice(
                            "恢复未成功：请查看控制台及" +
                            "Writer Stats Backups 中的安全备份",
                            10000
                        );

                        this.close();
                    }finally {
                        this.busy = false;
                    }
                })();
            }
        );

        const cancel = root.createEl(
            "button",
            {
                text: "取消"
            }
        );

        cancel.addEventListener(
            "click",
            () => this.render()
        );
    }
}