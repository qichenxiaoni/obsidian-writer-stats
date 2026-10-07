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
        const container =
            this.contentEl;

        const date =
            getLocalDateKey();

        container.empty();


        /*
         * Loading
         */

        const loading =
            container.createDiv({
                cls:
                    "writer-stats-dashboard__loading",

                text:
                    "正在加载写作统计…"
            });


        try {
            const [
                overview,
                recent
            ] =
                await Promise.all([
                    this.overviewService
                        .getOverview(
                            date
                        ),

                    this.historyService
                        .getRecentSummary(
                            date,
                            7
                        )
                ]);


            container.empty();

            this.renderHeader(
                container,
                date
            );

            this.renderOverview(
                container,
                overview,
                recent
            );
        } catch (error) {
            console.error(
                "[Writer Stats] Failed to render dashboard",
                error
            );

            loading.remove();

            container.empty();

            container.createDiv({
                cls:
                    "writer-stats-dashboard__error",

                text:
                    "写作统计加载失败"
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
        overview: DailyOverview,
        recent: DailyHistorySummary
    ): void {
        const content =
            container.createDiv({
                cls:
                    "writer-stats-dashboard__content"
            });


        /*
         * Today
         */

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

                text:
                    "今天"
            }
        );


        const metricGrid =
            todaySection.createDiv({
                cls:
                    "writer-stats-dashboard__metrics"
            });


        this.createMetricCard(
            metricGrid,
            "新增",
            `+${overview.summary.added.total}`,
            "今天写入的内容"
        );


        this.createMetricCard(
            metricGrid,
            "删除",
            overview.summary.deleted.total > 0
                ? `-${overview.summary.deleted.total}`
                : "0",
            "今天删除的内容"
        );


        this.createMetricCard(
            metricGrid,
            "净增长",
            this.formatSigned(
                overview.summary.net.total
            ),
            "新增减去删除"
        );


        this.createMetricCard(
            metricGrid,
            "活跃文件",
            String(
                overview.summary.activeFiles
            ),
            "今天有写作活动的文件"
        );


        /*
         * Goal
         */

        this.renderGoalCard(
            todaySection,
            overview
        );


        /*
         * Recent 7 days
         */

        const recentSection =
            content.createDiv({
                cls:
                    "writer-stats-dashboard__section"
            });


        const recentHeader =
            recentSection.createDiv({
                cls:
                    "writer-stats-dashboard__section-header"
            });


        recentHeader.createEl(
            "h2",
            {
                cls:
                    "writer-stats-dashboard__section-title",

                text:
                    "最近 7 天"
            }
        );


        recentHeader.createDiv({
            cls:
                "writer-stats-dashboard__section-range",

            text:
                `${recent.startDate} ~ ${recent.endDate}`
        });


        const recentGrid =
            recentSection.createDiv({
                cls:
                    "writer-stats-dashboard__overview-grid"
            });


        this.createOverviewItem(
            recentGrid,
            "新增",
            this.formatSigned(
                recent.added
            )
        );


        this.createOverviewItem(
            recentGrid,
            "删除",
            String(
                recent.deleted
            )
        );


        this.createOverviewItem(
            recentGrid,
            "净增长",
            this.formatSigned(
                recent.net
            )
        );


        this.createOverviewItem(
            recentGrid,
            "活跃天数",
            `${recent.activeDays} / ${recent.totalDays}`
        );


        this.createOverviewItem(
            recentGrid,
            "连续写作",
            `${recent.writingStreak} 天`
        );


        this.createOverviewItem(
            recentGrid,
            "最长连续",
            `${recent.longesWritingStreak} 天`
        );
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