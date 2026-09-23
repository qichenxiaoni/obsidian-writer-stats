import { App, Modal} from "obsidian";
import type { DailyStatsService } from "../core/DailyStatsService";
import type { DailyFileActivity } from "../domain/DailyFileActivity";
import { getLocalDateKey } from "../utils/DateService";

export class StatisticsModal extends Modal {
    constructor(
        app: App,
        private readonly statsService: DailyStatsService,
        private readonly date: string = getLocalDateKey()
    ) {
        super(app);
    }

    onOpen(): void {
        this.titleEl.setText("今日写作");

        this.containerEl.addClass(
            "writer-stats-modal"
        );

        void this.render()
            .catch(error => {
                console.error(
                    "[Writer Stats] Failed to render statistics modal",
                    error
                );

                this.contentEl.empty();

                this.contentEl.createDiv({
                    cls: "writer-stats-modal__empty",
                    text: "统计数据加载失败"
                });
            });
    }

    onClose(): void {
        this.contentEl.empty();
    }

    private async render(): Promise<void> {
        const [
            summary,
            activities
        ] = await Promise.all([
            this.statsService.getSummary(
                this.date
            ),

            this.statsService.getActivities(
                this.date
            )
        ]);

        const {
            contentEl
        } = this;

        contentEl.empty();

        // 日期
        contentEl.createDiv({
            cls: "writer-stats-modal__date",
            text: this.formatDate(
                this.date
            )
        });

        // Summary

        const summaryGrid = contentEl.createDiv({
            cls: "writer-stats-modal__summary"
        });

        this.createMetric(
            summaryGrid,
            "新增",
            `+${summary.added.total}`
        );

        this.createMetric(
            summaryGrid,
            "删除",
            summary.deleted.total > 0
                ? `-${summary.deleted.total}`
                : "0"
        );

        this.createMetric(
            summaryGrid,
            "净增长",
            this.formatSigned(
                summary.net.total
            )
        );

        this.createMetric(
            summaryGrid,
            "活跃文件",
            String(summary.activeFiles)
        );

        // File activities

        const section = contentEl.createDiv({
            cls: "writer-stats-modal__section"
        });

        section.createEl(
            "h3",
            {
                text: "今日文件"
            }
        );

        if (activities.length === 0) {
            section.createDiv({
                cls: "writer-stats-modal__empty",
                text: "今天还没有记录到写作活动"
            });

            return;
        }

        const list = section.createDiv({
            cls: "writer-stats-modal__files"
        });

        for (
            const activity
            of activities
        ) {
            this.createActivityRow(
                list,
                activity
            );
        }
    }

    private createMetric(
        container: HTMLElement,
        label: string,
        value: string
    ): void {
        const card = 
            container.createDiv({
                cls: "writer-stats-modal__mertic"
            });
        
        // 先显示指标名称
        card.createDiv({
            cls: "writer-stats-modal__metric-label",
            text: label
        });

        // 再显示指标数值
        card.createDiv({
            cls: "writer-stats-modal__metric-value",
            text: value
        });
    }

    private createActivityRow(
        container: HTMLElement,
        activity: DailyFileActivity
    ): void {
        const row =
            container.createDiv({
                cls: "writer-stats-modal__file"
            });
        
        const main = 
            row.createDiv({
                cls: "writer-stats-modal__file-main"
            });

        main.createDiv({
            cls: "writer-stats-modal__file-name",
            text: activity.filePath
        });

        const stats = 
            row.createDiv({
                cls: "writer-stats-modal__file-stats"
            });
        
        this.createSmallStat(
            stats,
            "新增",
            `+${activity.added.total}`
        );

        this.createSmallStat(
            stats,
            "删除",
            activity.deleted.total > 0
                ? `-${activity.deleted.total}`
                : "0"
        );

        this.createSmallStat(
            stats,
            "净增",
            this.formatSigned(
                activity.net.total
            )
        );
    }

    private createSmallStat(
        container: HTMLElement,
        label: string,
        value: string
    ): void {
        const item = container.createDiv({
            cls: "writer-stats-modal__file-stat"
        });

        item.createSpan({
            cls: "writer-stats-modal__file-stat-label",
            text: label
        });

        item.createSpan({
            cls: "writer-stats-modal__file-stat-value",
            text: value
        });
    }

    private formatSigned(
        value: number
    ): string {
        if (value > 0) {
            return `+${value}`;
        }

        return String(value)
    }

    private formatDate(
        date: string
    ): string {
        const [
            year,
            month,
            day
        ] = date.split("-");

        return (
            `${year}年` + 
            `${Number(month)}月` + 
            `${Number(day)}日`
        );
    }
}