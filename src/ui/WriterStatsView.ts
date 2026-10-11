import {
    ItemView,
    WorkspaceLeaf
} from "obsidian";

import type {
    DailyOverviewService
} from "../core/DailyOverviewService";

import type {
    DailyHistoryService
} from "../core/DailyHistoryService";

import type {
    DailyOverview
} from "../domain/DailyOverview";

import type {
    DailyHistorySummary
} from "../domain/DailyHistorySummary";

import {
    getLocalDateKey
} from "../utils/DateService";


export const WRITER_STATS_VIEW_TYPE =
    "writer-stats-dashboard";


export class WriterStatsView
    extends ItemView {

    // 历史查询范围，初次打开默认 7 天
    private historyRangeDays:
        7 | 30 = 7;

    // 防止多个异步 refresh 请求相互覆盖
    private refreshVersion = 0;

    constructor(
        leaf: WorkspaceLeaf,

        private readonly overviewService:
            DailyOverviewService,

        private readonly historyService:
            DailyHistoryService
    ) {
        super(leaf);
    }


    getViewType(): string {
        return WRITER_STATS_VIEW_TYPE;
    }


    getDisplayText(): string {
        return "Writer Stats";
    }


    getIcon(): string {
        return "bar-chart-3";
    }


    async onOpen(): Promise<void> {
        this.contentEl.addClass(
            "writer-stats-dashboard"
        );

        await this.refresh();
    }


    async onClose(): Promise<void> {
        this.contentEl.empty();
    }


    async refresh(): Promise<void> {
        const container = this.contentEl;
        const date = getLocalDateKey();

        // 标识本次刷新，避免较慢的旧请求覆盖新结果

        const currentVersion = ++this.refreshVersion;

        // 
        const previousScrollTop = container.scrollTop;

        // 
        const days = this.historyRangeDays;

        container.empty();

        container.createDiv({
            cls: "writer-stats-dashboard__loading",
            text: "正在加载写作统计"
        });

        try {
            const [overview, history] = await Promise.all([
                this.overviewService.getOverview(date),

                this.historyService.getRecentSummary(
                    date,
                    days
                )
            ]);

            // 
            if (currentVersion !== this.refreshVersion) {
                return;
            }

            container.empty();

            this.renderHeader(
                container,
                date
            );

            // 
            const content = this.renderOverview(
                container,
                overview
            );

            // 
            this.renderHistorySection(
                content,
                date,
                history
            );

            container.scrollTop = previousScrollTop;
        } catch (error) {
            if (currentVersion !== this.refreshVersion) {
                return;
            }

            console.error(
                "[Writer Stats] Failed to render dashboard",
                error
            );

            container.empty();

            container.createDiv({
                cls: "writer-stats-dashboard__error",
                text: "写作统计加载失败"
            });
        }
    }


    /*
     * ========================================
     * Header
     * ========================================
     */

    private renderHeader(
        container: HTMLElement,
        date: string
    ): void {
        const header =
            container.createDiv({
                cls:
                    "writer-stats-dashboard__header"
            });


        const titleGroup =
            header.createDiv({
                cls:
                    "writer-stats-dashboard__title-group"
            });


        titleGroup.createEl(
            "h1",
            {
                cls:
                    "writer-stats-dashboard__title",

                text:
                    "Writer Stats"
            }
        );


        titleGroup.createDiv({
            cls:
                "writer-stats-dashboard__subtitle",

            text:
                `${this.formatDate(date)} · 写作数据概览`
        });
    }


    /*
     * ========================================
     * Overview
     * ========================================
     */

    private renderOverview(
        container: HTMLElement,
        overview: DailyOverview
    ): HTMLElement {
        const content =
            container.createDiv({
                cls:
                    "writer-stats-dashboard__content"
            });

        // Today
        const todaySection =
            content.createDiv({
                cls:
                    "writer-stats-dashboard__section"
            });

        todaySection.createEl(
            "h2",
            {
                cls:
                    "writer-stats-dashboard__section-title",
                text: "今天"
            }
        );

        const metricGrid =
            todaySection.createDiv({
                cls:
                    "writer-stats-dashboard__metrics"
            });

        // 今日新增
        this.createMetricCard(
            metricGrid,
            "新增",
            `+${overview.summary.added.total}`,
            "今天写入的内容"
        );

        // 今日删除
        this.createMetricCard(
            metricGrid,
            "删除",
            overview.summary.deleted.total > 0
                ? `-${overview.summary.deleted.total}`
                : "0",
            "今天删除的内容"
        );

        // 今日净增长
        this.createMetricCard(
            metricGrid,
            "净增长",
            this.formatSigned(
                overview.summary.net.total
            ),
            "新增减去删除"
        );

        // 今日活跃文件
        this.createMetricCard(
            metricGrid,
            "活跃文件",
            String(
                overview.summary.activeFiles
            ),
            "今天有写作活动的文件"
        );

        // Goal

        this.renderGoalCard(
            todaySection,
            overview
        );

        return content;
    }


    // History Section

    private renderHistorySection(
        container: HTMLElement,
        date: string,
        initialSummary: DailyHistorySummary
    ): void {
        const section = container.createDiv({
            cls:[
                "writer-stats-dashboard__section",
                "writer-stats-dashboard__history"
            ],
        });

        // 

        const header = section.createDiv({
            cls: "writer-stats-dashboard__history-header"
        });

        header.createEl(
            "h2",
            {
                cls: "writer-stats-dashboard__section-title",
                text: "趋势与历史"
            }
        );

        //  7 / 30 转换
        const selector = header.createDiv({
            cls: "writer-stats-dashboard__history-selector"
        });


        const sevenButton = selector.createEl("button", {
            cls:
                "writer-stats-dashboard__history-button" +
                (this.historyRangeDays === 7 ? " is-active" : ""),
            text: "7 天",
            attr: {
                type: "button",
                "aria-pressed": String(this.historyRangeDays === 7)
            }
        });

        const thirtyButton = selector.createEl("button", {
            cls:
                "writer-stats-dashboard__history-button" +
                (this.historyRangeDays === 30 ? " is-active" : ""),
            text: "30 天",
            attr: {
                type: "button",
                "aria-pressed": String(this.historyRangeDays === 30)
            }
        });


        // 
        const historyContent = section.createDiv({
            cls: "writer-stats-dashboard__history-content"
        });

        // 
        let requestVersion = 0;

        // 
        const updateButtonState = (): void => {
            const isSevenActive =
                this.historyRangeDays === 7;

            const isThirtyActive =
                this.historyRangeDays === 30;

            sevenButton.classList.toggle(
                "is-active",
                isSevenActive
            );

            thirtyButton.classList.toggle(
                "is-active",
                isThirtyActive
            );

            sevenButton.setAttribute(
                "aria-pressed",
                String(isSevenActive)
            );

            thirtyButton.setAttribute(
                "aria-pressed",
                String(isThirtyActive)
            );
        };

        //切换历史查询范围 
        const changeRange = async (days: 7 | 30): Promise<void> => {

            // 保存用户选择
            this.historyRangeDays = days;

            // 立即更新按钮
            updateButtonState();

            const currentRequest = ++requestVersion;

            historyContent.empty();

            historyContent.createDiv({
                cls:
                    "writer-stats-dashboard__history-loading",
                text: "正在加载历史数据...."
            });

            try {
                const summary =
                    await this.historyService.getRecentSummary(
                        date,
                        days
                    );


                if (
                    currentRequest !== requestVersion ||
                    !historyContent.isConnected ||
                    this.historyRangeDays !== days
                ) {
                    return;
                }

                historyContent.empty();

                this.renderHistoryContent(
                    historyContent,
                    summary
                );
            } catch (error) {
                if (
                    currentRequest !== requestVersion ||
                    !historyContent.isConnected
                ) {
                    return;
                }

                console.error(
                    "[Writer Stats] Failed to load histroy",
                    error
                );

                historyContent.empty();

                historyContent.createDiv({
                    cls:
                        "writer-stats-dashboard__history-error",
                    text: "历史数据加载失败，请重试"
                });
            }
        };

        // 注册按钮事件

        sevenButton.addEventListener(
            "click",
            () => {
                void changeRange(7);
            }
        );

        thirtyButton.addEventListener(
            "click",
            () => {
                void changeRange(30);
            }
        );

        // 
        updateButtonState();

        this.renderHistoryContent(
            historyContent,
            initialSummary
        );
    }

    // History Content

    private renderHistoryContent(
        container: HTMLElement,
        summary: DailyHistorySummary
    ): void {
        container.createDiv({
            cls:
                "writer-stats-dashboard__history-dates",
            text: `${summary.startDate} ~ ${summary.endDate}`
        });

        const grid = container.createDiv({
            cls:
                "writer-stats-dashboard__overview-grid"
        });

        this.createOverviewItem(
            grid,
            "新增",
            this.formatSigned(summary.added)
        );

        this.createOverviewItem(
            grid,
            "删除",
            String(summary.deleted)
        );

        this.createOverviewItem(
            grid,
            "净增长",
            this.formatSigned(summary.net)
        );

        this.createOverviewItem(
            grid,
            "活跃天数",
            `${summary.activeDays} / ${summary.totalDays}`
        );

        this.createOverviewItem(
            grid,
            "连续写作",
            `${summary.writingStreak} 天`
        );

        this.createOverviewItem(
            grid,
            "最长连续",
            `${summary.longesWritingStreak} 天`
        );

        // 

        this.renderHistoryTrend(
            container,
            summary
        );

        // 

        const bestDay = container.createDiv({
            cls:
                "writer-stats-dashboard__best-day"
        });

        bestDay.createDiv({
            cls:
                "writer-stats-dashboard__best-day-label",
            text: "最佳写作日"
        });

        const bestWritingDay =
            summary.bestWritingDay;

        if (bestWritingDay) {
            bestDay.createDiv({
                cls:
                    "writer-stats-dashboard__best-day-value",
                text:
                    `${bestWritingDay.date} ·` +
                    this.formatSigned(bestWritingDay.added)
            });
        } else {
            bestDay.createDiv({
                cls:
                    "writer-stats-dashboard__best-day-value" + "is-empty",
                text: "暂无写作记录"
            });
        }
    }

    // Daily Trend

    private renderHistoryTrend(
        container: HTMLElement,
        summary: DailyHistorySummary
    ): void {
        const section = container.createDiv({
            cls:
                "writer-stats-dashboard__trend"
        });

        section.createDiv({
            cls:
                "writer-stats-dashboard__trend-title",
            text: "每日新增趋势"
        });

        const panel = section.createDiv({
            cls:
                "writer-stats-dashboard__trend-panel"
        });

        // 

        const maxAdded = Math.max(
            0,
            ...summary.days.map(
                day => day.added
            )
        );

        // 

        const plot = panel.createDiv({
            cls:
                "writer-stats-dashboard__trend-plot"
        });

        plot.style.setProperty(
            "--writer-stats-dashboard-trend-columns",
            String(summary.days.length)
        );

        for (const day of summary.days) {
            const item = plot.createDiv({
                cls:
                    "writer-stats-dashboard__trend-item"
            });

            const bar = item.createDiv({
                cls:
                    "writer-stats-dashboard__trend-bar"
            });

            // 

            const height = this.getTrendBarHeight(
                day.added,
                maxAdded,
                summary.days.length
            );

            bar.style.height = `${height}%`;

            // 

            if (day.added <= 0) {
                bar.classList.add("is-empty");
            }

            // 

            if (
                summary.bestWritingDay?.date ===
                day.date
            ) {
                bar.classList.add("is-best");
            }

            // 

            item.setAttribute(
                "title",
                [
                    day.date,
                    `新增: ${this.formatSigned(day.added)}`,
                    `删除: ${day.deleted}`,
                    `净增长: ${this.formatSigned(day.net)}`
                ].join("\n")
            );

            item.setAttribute(
                "aria-label",
                [
                    day.date,
                    `新增: ${day.added}`,
                    `删除: ${day.deleted}`,
                    `净增长: ${day.net}`
                ].join("\n")
            );
        }

        // 日期坐标轴

        const axis = panel.createDiv({
            cls:
                "writer-stats-dashboard__trend-axis"
        });

        axis.style.setProperty(
            "--writer-stats-dashboard-trend-columns",
            String(summary.days.length)
        );

        for (
            let index = 0;
            index < summary.days.length;
            index++
        ) {
            const day = summary.days[index];

            const label = axis.createDiv({
                cls:
                    "writer-stats-dashboard__trend-axis-label"
            });

            // 

            if (
                this.shouldShowTrendLabel(
                    index,
                    summary.days.length
                )
            ) {
                label.setText(
                    this.formatTrendDate(day.date)
                );
            }

            if (index === 0) {
                label.classList.add("is-first");
            }

            if (
                index === summary.days.length - 1
            ) {
                label.classList.add("is-last");
            }
        }
    }

    // Trend Helpers

    // 
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

        const ratio = value / maxValue;

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

    // 控制日期标签密度
    private shouldShowTrendLabel(
        index: number,
        total: number
    ): boolean {
        if (total <= 7) {
            return true;
        }

        return (
            index === 0 ||
            index === total - 1 ||
            index % 5 === 0
        );
    }

    // 2026-10-07 -> 10/07
    private formatTrendDate(
        date: string
    ): string {
        const parts = date.split("-");

        if (parts.length !== 3) {
            return date;
        }

        return `${parts[1]}/${parts[2]}`;
    }

    /*
     * ========================================
     * Metric Card
     * ========================================
     */

    private createMetricCard(
        container: HTMLElement,
        label: string,
        value: string,
        description: string
    ): void {
        const card =
            container.createDiv({
                cls:
                    "writer-stats-dashboard__metric"
            });


        card.createDiv({
            cls:
                "writer-stats-dashboard__metric-label",

            text:
                label
        });


        card.createDiv({
            cls:
                "writer-stats-dashboard__metric-value",

            text:
                value
        });


        card.createDiv({
            cls:
                "writer-stats-dashboard__metric-description",

            text:
                description
        });
    }


    /*
     * ========================================
     * Goal
     * ========================================
     */

    private renderGoalCard(
        container: HTMLElement,
        overview: DailyOverview
    ): void {
        const {
            goal
        } =
            overview;


        const card =
            container.createDiv({
                cls:
                    "writer-stats-dashboard__goal"
            });


        const header =
            card.createDiv({
                cls:
                    "writer-stats-dashboard__goal-header"
            });


        const title =
            header.createDiv();


        title.createDiv({
            cls:
                "writer-stats-dashboard__goal-title",

            text:
                "今日目标"
        });


        title.createDiv({
            cls:
                "writer-stats-dashboard__goal-count",

            text:
                `${goal.current} / ${goal.goal}`
        });


        header.createDiv({
            cls:
                "writer-stats-dashboard__goal-percentage",

            text:
                `${goal.percentage}%`
        });


        const track =
            card.createDiv({
                cls:
                    "writer-stats-dashboard__goal-track"
            });


        const bar =
            track.createDiv({
                cls:
                    "writer-stats-dashboard__goal-bar"
            });


        bar.style.width =
            `${Math.min(
                goal.percentage,
                100
            )}%`;


        card.createDiv({
            cls:
                "writer-stats-dashboard__goal-footer",

            text:
                goal.completed
                    ? `今日目标已完成 · ${goal.percentage}%`
                    : `还差 ${goal.remaining}`
        });
    }


    /*
     * ========================================
     * Recent item
     * ========================================
     */

    private createOverviewItem(
        container: HTMLElement,
        label: string,
        value: string
    ): void {
        const item =
            container.createDiv({
                cls:
                    "writer-stats-dashboard__overview-item"
            });


        item.createDiv({
            cls:
                "writer-stats-dashboard__overview-label",

            text:
                label
        });


        item.createDiv({
            cls:
                "writer-stats-dashboard__overview-value",

            text:
                value
        });
    }


    /*
     * ========================================
     * Format
     * ========================================
     */

    private formatSigned(
        value: number
    ): string {
        if (value > 0) {
            return `+${value}`;
        }

        return String(value);
    }


    private formatDate(
        date: string
    ): string {
        const [
            year,
            month,
            day
        ] =
            date.split("-");


        return (
            `${year}年` +
            `${Number(month)}月` +
            `${Number(day)}日`
        );
    }
}