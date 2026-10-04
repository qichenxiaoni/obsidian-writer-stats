import { App, Modal, TFile } from "obsidian";
import type { DailyStatsService } from "../core/DailyStatsService";
import type { DailyFileActivity } from "../domain/DailyFileActivity";
import { getLocalDateKey } from "../utils/DateService";
import type { DailyOverviewService } from "../core/DailyOverviewService";
import type { GoalProgress } from "../domain/GoalProgress";
import type { DailyHistoryService } from "../core/DailyHistoryService";
import type { DailyHistorySummary } from "../domain/DailyHistorySummary";

export class StatisticsModal extends Modal {
    constructor(
        app: App,
        private readonly statsService: DailyStatsService,
        private readonly overviewService: DailyOverviewService,
        private readonly historyService: DailyHistoryService,
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
        const activeFile =
            this.app.workspace.getActiveFile();

        const [
            overview,
            activities,
            currentActivity
        ] = await Promise.all([
            this.overviewService.getOverview(
                this.date
            ),

            this.statsService.getActivities(
                this.date
            ),

            activeFile
                ? this.statsService.getFileActivity(
                    this.date,
                    activeFile.path
                )
                : Promise.resolve(undefined)
        ]);

        const {
            summary,
            goal
        } = overview;

        const {
            contentEl
        } = this;

        contentEl.empty();

        // 日期
        contentEl.createDiv({
            cls:
                "writer-stats-modal__date",

            text:
                this.formatDate(this.date)
        });


        // =========================
        // 今日摘要
        // =========================

        const summaryGrid =
            contentEl.createDiv({
                cls:
                    "writer-stats-modal__summary"
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
            String(
                summary.activeFiles
            )
        );

        this.createGoalSection(
            contentEl,
            goal
        );

        await this.renderHistorySection(
            contentEl
        );


        // =========================
        // 当前文件
        // =========================

        if (activeFile) {
            const currentSection =
                contentEl.createDiv({
                    cls:
                        "writer-stats-modal__section"
                });

            currentSection.createEl(
                "h3",
                {
                    text: "当前文件"
                }
            );

            if (currentActivity) {
                const currentList =
                    currentSection.createDiv({
                        cls:
                            "writer-stats-modal__files"
                    });

                this.createActivityRow(
                    currentList,
                    currentActivity,
                    true
                );
            } else {
                currentSection.createDiv({
                    cls:
                        "writer-stats-modal__empty writer-stats-modal__empty--compact",

                    text:
                        "当前文件今天暂无写作活动"
                });
            }
        }


        // =========================
        // 今日文件
        // =========================

        const section =
            contentEl.createDiv({
                cls:
                    "writer-stats-modal__section"
            });

        section.createEl(
            "h3",
            {
                text: "今日文件"
            }
        );

        if (
            activities.length === 0
        ) {
            section.createDiv({
                cls:
                    "writer-stats-modal__empty",

                text:
                    "今天还没有记录到写作活动"
            });

            return;
        }

        const list =
            section.createDiv({
                cls:
                    "writer-stats-modal__files"
            });

        for (
            const activity
            of activities
        ) {
            this.createActivityRow(
                list,
                activity,
                false
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
        activity: DailyFileActivity,
        isCurrentFile: boolean
    ): void {
        const row =
            container.createDiv({
                cls: "writer-stats-modal__file"
            });

        if (isCurrentFile) {
            row.addClass(
                "writer-stats-modal__file--current"
            );
        }

        const main =
            row.createDiv({
                cls: "writer-stats-modal__file-main"
            });

        const file =
            this.app.vault
                .getAbstractFileByPath(
                    activity.filePath
                );

        if (file instanceof TFile) {
            const name =
                main.createEl(
                    "button",
                    {
                        cls:
                            "writer-stats-modal__file-name writer-stats-modal__file-link",
                        text: activity.filePath
                    }
                );

            name.addEventListener(
                "click",
                () => {
                    void this.openFile(file);
                }
            );
        } else {
            const nameRow =
                main.createDiv({
                    cls:
                        "writer-stats-modal__file-name-row"
                });

            nameRow.createSpan({
                cls:
                    "writer-stats-modal__file-name",
                text: activity.filePath
            });

            nameRow.createSpan({
                cls:
                    "writer-stats-modal__file-missing",
                text: "已删除"
            });
        }

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

    private async openFile(
        file: TFile
    ): Promise<void> {
        await this.app.workspace
            .getLeaf(false)
            .openFile(file)

        this.close();
    }

    private createGoalSection(
        container: HTMLElement,
        goal: GoalProgress
    ): void {
        const section =
            container.createDiv({
                cls:
                    "writer-stats-modal__goal"
            });

        const header =
            section.createDiv({
                cls:
                    "writer-stats-modal__goal-header"
            });

        header.createSpan({
            cls:
                "writer-stats-modal__goal-title",
            text:
                "今日目标"
        });

        header.createSpan({
            cls:
                "writer-stats-modal__goal-percentage",
            text:
                `${goal.percentage}%`
        });

        const numbers =
            section.createDiv({
                cls:
                    "writer-stats-modal__goal-numbers"
            });

        numbers.createSpan({
            text:
                `${goal.current} / ${goal.goal}`
        });

        // 进度条
        const track =
            section.createDiv({
                cls:
                    "writer-stats-modal__goal-track"
            });

        const bar =
            track.createDiv({
                cls:
                    "writer-stats-modal__goal-bar"
            });

        // 视觉宽度最高100%，但 percentage 本身就可以继续超过100
        const visualPercentage =
            Math.min(
                goal.percentage,
                100
            );

        bar.style.width =
            `${visualPercentage}%`;

        const footer =
            section.createDiv({
                cls:
                    "writer-stats-modal__goal-footer"
            });

        footer.setText(
            goal.completed
                ? `今日目标已完成 · ${goal.percentage}%`
                : `还差 ${goal.remaining}`
        );
    }

    private async renderHistorySection(
        container: HTMLElement
    ): Promise<void> {
        const section =
            container.createDiv({
                cls:
                    "writer-stats-modal__history"
            });

        const header =
            section.createDiv({
                cls:
                    "writer-stats-modal__history-header"
            });

        header.createEl(
            "h3",
            {
                text: "历史摘要"
            }
        );

        const rangeSelector =
            header.createDiv({
                cls:
                    "writer-stats-modal__history-range"
            });

        const content =
            section.createDiv({
                cls:
                    "writer-stats-modal__history-content"
            });


        const buttons =
            new Map<
                number,
                HTMLButtonElement
            >();


        /*
         * 统一负责按钮的视觉状态。
         *
         * 不把选中状态依赖在 :focus 上。
         */
        const setActiveRange =
            (
                activeDays: number
            ): void => {
                for (
                    const [
                        days,
                        button
                    ] of buttons
                ) {
                    const isActive =
                        days === activeDays;

                    button.classList.toggle(
                        "is-active",
                        isActive
                    );

                    button.setAttribute(
                        "aria-pressed",
                        String(isActive)
                    );
                }
            };


        const renderRange =
            async (
                days: number
            ): Promise<void> => {
                /*
                 * 点击后立即更新按钮状态，
                 * 不需要等数据查询完成。
                 */
                setActiveRange(
                    days
                );

                content.empty();

                content.createDiv({
                    cls:
                        "writer-stats-modal__history-loading",
                    text:
                        "正在统计…"
                });

                const summary =
                    await this.historyService
                        .getRecentSummary(
                            this.date,
                            days
                        );

                content.empty();

                this.renderHistorySummary(
                    content,
                    summary
                );
            };


        /*
         * 7 天按钮
         */
        const sevenDaysButton =
            rangeSelector.createEl(
                "button",
                {
                    cls:
                        "writer-stats-modal__history-range-button",
                    text:
                        "7 天"
                }
            );

        sevenDaysButton.setAttribute(
            "type",
            "button"
        );

        buttons.set(
            7,
            sevenDaysButton
        );

        sevenDaysButton.addEventListener(
            "click",
            () => {
                void renderRange(
                    7
                );
            }
        );


        /*
         * 30 天按钮
         */
        const thirtyDaysButton =
            rangeSelector.createEl(
                "button",
                {
                    cls:
                        "writer-stats-modal__history-range-button",
                    text:
                        "30 天"
                }
            );

        thirtyDaysButton.setAttribute(
            "type",
            "button"
        );

        buttons.set(
            30,
            thirtyDaysButton
        );

        thirtyDaysButton.addEventListener(
            "click",
            () => {
                void renderRange(
                    30
                );
            }
        );


        /*
         * 默认状态必须明确设为 7 天。
         *
         * 这里同时完成：
         *
         * 1. 7 天按钮显示选中状态
         * 2. aria-pressed = true
         * 3. 查询最近 7 天数据
         */
        await renderRange(
            7
        );

        await this.renderYearHeatmap(
            section
        );
    }

    private renderHistorySummary(
        container: HTMLElement,
        summary: DailyHistorySummary
    ): void {
        container.createDiv({
            cls:
                "writer-stats-modal__history-dates",

            text:
                `${summary.startDate} ~ ${summary.endDate}`
        });

        const grid =
            container.createDiv({
                cls:
                    "writer-stats-modal__history-grid"
            });

        this.createHistoryMetric(
            grid,
            "新增",
            this.formatHistorySigned(
                summary.added
            )
        );

        this.createHistoryMetric(
            grid,
            "删除",
            String(
                summary.deleted
            )
        );

        this.createHistoryMetric(
            grid,
            "净增长",
            this.formatHistorySigned(
                summary.net
            )
        );

        this.createHistoryMetric(
            grid,
            "活跃天数",
            `${summary.activeDays} / ${summary.totalDays}`
        );

        this.createHistoryMetric(
            grid,
            "连续写作",
            `${summary.writingStreak} 天`
        );

        this.createHistoryMetric(
            grid,
            "最长连续",
            `${summary.longesWritingStreak} 天`
        );

        this.renderHistoryTrend(
            container,
            summary
        );

        const bestDay =
            container.createDiv({
                cls:
                    "writer-stats-modal__best-day"
            });

        bestDay.createDiv({
            cls:
                "writer-stats-modal__best-day-label",
            text:
                "最佳写作日"
        });

        if (
            summary.bestWritingDay
        ) {
            bestDay.createDiv({
                cls:
                    "writer-stats-modal__best-day-value",

                text:
                    `${summary.bestWritingDay.date} · +${summary.bestWritingDay.added}`
            });
        } else {
            bestDay.createDiv({
                cls:
                    "writer-stats-modal__best-day-value is-empty",

                text:
                    "暂无写作记录"
            });
        }
    }

    private createHistoryMetric(
        container: HTMLElement,
        label: string,
        value: string
    ): void {
        const metric =
            container.createDiv({
                cls:
                    "writer-stats-modal__history-metric"
            });

        metric.createDiv({
            cls:
                "writer-stats-modal__history-metric-label",
            text: label
        });

        metric.createDiv({
            cls:
                "writer-stats-modal__histroy-metric-value",

            text: value
        });
    }

    private formatHistorySigned(
        value: number
    ): string {
        if (value > 0) {
            return `+${value}`;
        }

        return String(value);
    }

    private renderHistoryTrend(
        container: HTMLElement,
        summary: DailyHistorySummary
    ): void {
        const section =
            container.createDiv({
                cls:
                    "writer-stats-modal__trend"
            });

        section.createDiv({
            cls:
                "writer-stats-modal__trend-title",
            text:
                "每日新增趋势"
        });


        const maxAdded =
            Math.max(
                0,
                ...summary.days.map(
                    day => day.added
                )
            );


        /*
         * =========================
         * Plot
         * =========================
         */

        const plot =
            section.createDiv({
                cls:
                    "writer-stats-modal__trend-plot"
            });

        plot.style.setProperty(
            "--writer-stats-trend-columns",
            String(
                summary.days.length
            )
        );


        for (const day of summary.days) {
            const item =
                plot.createDiv({
                    cls:
                        "writer-stats-modal__trend-item"
                });

            const bar =
                item.createDiv({
                    cls:
                        "writer-stats-modal__trend-bar"
                });


            const height =
                this.getTrendBarHeight(
                    day.added,
                    maxAdded,
                    summary.days.length
                );

            bar.style.height =
                `${height}%`;


            if (day.added <= 0) {
                bar.classList.add(
                    "is-empty"
                );
            }


            /*
             * 最佳写作日额外标记。
             */
            if (
                summary.bestWritingDay?.date ===
                day.date
            ) {
                bar.classList.add(
                    "is-best"
                );
            }


            item.setAttribute(
                "title",
                [
                    day.date,
                    `新增：${this.formatHistorySigned(day.added)}`,
                    `删除：${day.deleted}`,
                    `净增长：${this.formatHistorySigned(day.net)}`
                ].join("\n")
            );
        }


        /*
         * =========================
         * X Axis
         * =========================
         *
         * 日期标签单独绘制。
         * 不再和柱子共用 item。
         */

        const axis =
            section.createDiv({
                cls:
                    "writer-stats-modal__trend-axis"
            });

        axis.style.setProperty(
            "--writer-stats-trend-columns",
            String(
                summary.days.length
            )
        );


        for (
            let index = 0;
            index < summary.days.length;
            index++
        ) {
            const day =
                summary.days[index];

            const label =
                axis.createDiv({
                    cls:
                        "writer-stats-modal__trend-axis-label"
                });


            if (
                this.shouldShowTrendLabel(
                    index,
                    summary.days.length
                )
            ) {
                label.setText(
                    this.formatTrendDate(
                        day.date
                    )
                );
            }


            if (index === 0) {
                label.classList.add(
                    "is-first"
                );
            }

            if (
                index ===
                summary.days.length - 1
            ) {
                label.classList.add(
                    "is-last"
                );
            }
        }
    }

    private getTrendBarHeight(
        value: number,
        maxValue: number,
        totalDays: number
    ): number {
        if (
            value <= 0 ||
            maxValue <= 0
        ) {
            return 0;
        }

        const ratio =
            value / maxValue;

        if (totalDays <= 7) {
            return Math.max(
                ratio * 100,
                8
            );
        }

        return Math.max(
            Math.sqrt(ratio) * 100,
            5
        );
    }

    private shouldShowTrendLabel(
        index: number,
        total: number
    ): boolean {
        // 7day：全部显示
        if (total <= 7) {
            return true;
        }

        // 30day:显示第一天、每五天、最后一天
        return (
            index === 0 ||
            index === total - 1 ||
            index % 5 === 0
        );
    }

    private formatTrendDate(
        date: string
    ): string {
        const parts =
            date.split("-");

        if (parts.length !== 3) {
            return date;
        }

        return (
            `${parts[1]}/${parts[2]}`
        );
    }

    private async renderYearHeatmap(
        container: HTMLElement
    ): Promise<void> {
        const summary =
            await this.historyService
                .getRecentSummary(
                    this.date,
                    365
                );

        const section =
            container.createDiv({
                cls:
                    "writer-stats-modal__heatmap"
            });

        // Header

        const header =
            section.createDiv({
                cls:
                    "writer-stats-modal__heatmap-header"
            });

        header.createDiv({
            cls:
                "writer-stats-modal__heatmap-title",
            text:
                "最近一年"
        });

        header.createDiv({
            cls:
                "writer-stats-modal__heatmap-summary",

            text:
                `${summary.activeDays} 个活跃日 · +${summary.added}`
        });

        const firstWeekday =
            this.getHeatmapWeekday(
                summary.days[0]?.date
            );

        const weekCount =
            Math.ceil(
                (
                    firstWeekday +
                    summary.days.length
                ) / 7
            );

        const monthsRow =
            section.createDiv({
                cls:
                    "writer-stats-modal__heatmap-months"
            });

        monthsRow.style.setProperty(
            "--writer-stats-heatmap-weeks",
            String(
                weekCount
            )
        );

        /*
 * =========================
 * Month labels
 * =========================
 *
 * 每个月份标签横跨该月份实际占用的 week columns，
 * 而不是只占一个几像素宽的 column。
 */

        type HeatmapMonth = {
            label: string;
            startColumn: number;
        };


        const months: HeatmapMonth[] =
            [];

        let previousMonthKey = "";


        for (
            let index = 0;
            index < summary.days.length;
            index++
        ) {
            const day =
                summary.days[index];

            const monthKey =
                day.date.slice(
                    0,
                    7
                );

            if (
                monthKey ===
                previousMonthKey
            ) {
                continue;
            }

            previousMonthKey =
                monthKey;


            const startColumn =
                Math.floor(
                    (
                        firstWeekday +
                        index
                    ) / 7
                ) + 1;


            months.push({
                label:
                    `${Number(
                        day.date.slice(
                            5,
                            7
                        )
                    )}月`,

                startColumn
            });
        }


        for (
            let index = 0;
            index < months.length;
            index++
        ) {
            const month =
                months[index];

            /*
             * 当前月份一直延伸到：
             *
             * 下个月开始的 column
             *
             * 如果已经是最后一个月，
             * 则一直延伸到 Heatmap 最后一列。
             */
            const nextStartColumn =
                index <
                    months.length - 1
                    ? months[
                        index + 1
                    ].startColumn
                    : weekCount + 1;


            const span =
                Math.max(
                    1,
                    nextStartColumn -
                    month.startColumn
                );


            const label =
                monthsRow.createDiv({
                    cls:
                        "writer-stats-modal__heatmap-month",

                    text:
                        month.label
                });


            label.style.gridColumn =
                `${month.startColumn} / span ${span}`;
        }

        const body =
            section.createDiv({
                cls:
                    "writer-stats-modal__heatmap-body"
            });

        const weekdays =
            body.createDiv({
                cls:
                    "writer-stats-modal__heatmap-weekdays"
            });

        [
            "日",
            "一",
            "二",
            "三",
            "四",
            "五",
            "六"
        ].forEach(
            label => {
                weekdays.createDiv({
                    cls:
                        "writer-stats-modal__heatmap-weekday",
                    text:
                        label
                });
            }
        );


        const grid =
            body.createDiv({
                cls:
                    "writer-stats-modal__heatmap-grid"
            });

        grid.style.setProperty(
            "--writer-stats-heatmap-week",
            String(
                weekCount
            )
        );

        const maxAdded =
            Math.max(
                0,
                ...summary.days.map(
                    day =>
                        day.added
                )
            );

        for (
            let index = 0;
            index < summary.days.length;
            index++
        ) {
            const day =
                summary.days[index];

            const absolutePosition =
                firstWeekday +
                index;

            const column =
                Math.floor(
                    absolutePosition / 7
                ) + 1;

            const row =
                (
                    absolutePosition %
                    7
                ) + 1;

            const cell =
                grid.createDiv({
                    cls:
                        "writer-stats-modal__heatmap-cell"
                });

            cell.style.gridColumn =
                String(
                    column
                );

            cell.style.gridRow =
                String(
                    row
                );

            const level =
                this.getHeatmapLevel(
                    day.added,
                    maxAdded
                );

            cell.classList.add(
                `level-${level}`
            );

            cell.setAttribute(
                "title",
                [
                    day.date,
                    `新增：${this.formatHistorySigned(day.added)}`,
                    `删除：${day.deleted}`,
                    `净增长：${this.formatHistorySigned(day.net)}`
                ].join("\n")
            );
        }

        const legend =
            section.createDiv({
                cls:
                    "writer-stats-modal__heatmap-legend"
            });

        legend.createSpan({
            text:
                "少"
        });

        for (
            let level = 0;
            level <= 4;
            level++
        ) {
            const cell =
                legend.createDiv({
                    cls:
                        "writer-stats-modal__heatmap-legend-cell"
                });

            cell.classList.add(
                `level-${level}`
            );
        }

        legend.createSpan({
            text: "多"
        });
    }

    private getHeatmapWeekday(
        date?: string
    ): number {
        if (!date) {
            return 0;
        }

        const parsed =
            new Date(
                `${date}T00:00:00Z`
            );

        if (
            Number.isNaN(
                parsed.getTime()
            )
        ) {
            return 0;
        }

        return parsed.getUTCDay();
    }

    private getHeatmapLevel(
        value: number,
        maxValue: number
    ): number {
        if (
            value <= 0 ||
            maxValue <= 0
        ) {
            return 0;
        }

        const ratio =
            Math.sqrt(
                value /
                maxValue
            );

        if (ratio <= 0.25) {
            return 1;
        }

        if (ratio <= 0.5) {
            return 2;
        }

        if (ratio <= 0.75) {
            return 3;
        }

        return 4;
    }
}