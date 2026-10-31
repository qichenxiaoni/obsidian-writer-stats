import {
    ItemView,
    WorkspaceLeaf,
    Notice,
    setTooltip
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

import {
    MonthlyStatsService,
    shiftMonth
} from "../core/MonthlyStatsService";

import type {
    MonthlyWritingSummary
} from "../core/MonthlyStatsService";

import type {
    FileRankingService,
    FileRankingSort
} from "../core/FileRankingService";

import {
    renderFileRankingSection
} from "./FileRankingSection";

import {
    renderFolderStatsSection
} from "./FolderStatsSection";

import type {
    FileWritingDetailService
} from "../core/FileWritingDetailService";

import {
    FileWritingDetailModal
} from "./FileWritingDetailModal";

import {
    renderYearHeatmapSection
} from "./YearHeatmapSection";

import type {
    MonthlyCsvExportService
} from "../core/MonthlyCsvExportService";

import {
    saveMonthlyCsvToVault
} from "./CsvVaultExporter";


export const WRITER_STATS_VIEW_TYPE =
    "writer-stats-dashboard";


export class WriterStatsView
    extends ItemView {

    // 历史查询范围，初次打开默认 7 天
    private historyRangeDays:
        7 | 30 = 7;

    // 防止多个异步 refresh 请求相互覆盖
    private refreshVersion = 0;

    // 当前选择月份： null 表示当前自然月
    private selectedMonth: string | null = null;

    // 防止旧月份查询覆盖较新的结果
    private monthlyRequestVersion = 0;

    // 年度热力图异步请求版本
    private heatmapRequestVersion = 0;

    // null 表示初次打开使用当前年份
    private selectdHeatmapYear: number | null = null;

    // 月份切换时保留用户选择的排行榜排序
    private fileRankingSort: FileRankingSort = "added";

    // 文件夹浏览路径：空字符串表示根目录

    private folderStatsPath = "";

    // 文件夹统计排序

    private folderStatsSort: FileRankingSort = "added";

    constructor(
        leaf: WorkspaceLeaf,

        private readonly overviewService:
            DailyOverviewService,

        private readonly historyService:
            DailyHistoryService,

        private readonly fileRankingService:
            FileRankingService,
        
        private readonly fileWritingDetailService:
            FileWritingDetailService,
        
        private readonly monthlyCsvExportService:
            MonthlyCsvExportService
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
        ++this.refreshVersion;
        ++this.monthlyRequestVersion;
        ++this.heatmapRequestVersion;

        this.contentEl.empty();
    }


    async refresh(): Promise<void> {
        const container = this.contentEl;
        const date = getLocalDateKey();

        // 标识本次刷新，避免较慢的旧请求覆盖新结果

        const currentVersion = ++this.refreshVersion;

        // 整体刷新时，让上一次月度请求失败
        ++this.monthlyRequestVersion;
        ++this.heatmapRequestVersion;

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

            // 年度写作热力图
            this.renderAnnualHeatmapSection(
                content,
                date
            );

            // 在7/30天历史模块下方显示月度统计
            this.renderMonthlySection(
                content,
                date
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
            cls: [
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

            setTooltip(
                item,
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

        // 7 日趋势：日期必须与柱状图网格中心对齐

        if (summary.days.length <= 7) {
            axis.addClass("is-short");
        }

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

    // Dashboard 年度热力图，历史年份统计完整自然年，当前年份仅统计至今天，不允许向未来年份切换

    private renderAnnualHeatmapSection(
        container: HTMLElement,
        today: string
    ):void {
        const currentYear = Number(
            today.slice(0,4)
        );

        let year = Math.min(
            this.selectdHeatmapYear ?? currentYear,
            currentYear
        );

        const section = container.createDiv({
            cls:
                "writer-stats-dashboard__annual"
        });

        const header = section.createDiv({
            cls:
                "writer-stats-dashboard__annual-header"
        });

        header.createEl("h2",{
            cls:
                "writer-stats-dashboard__section-title",
            text:"年度写作热力图"
        });

        const controls = header.createDiv({
            cls:
                "writer-stats-dashboard__annual-nav"
        });

        const previous = controls.createEl(
            "button",
            { text: "‹" }
        );

        previous.type = "button";
        previous.setAttribute(
            "aria-label",
            "上一年"
        );

        const label = controls.createSpan({
            cls:
                "writer-stats-dashboard__annual-year"
        });

        const next = controls.createEl(
            "button",
            { text: "›" }
        );

        next.type = "button";
        next.setAttribute(
            "aria-label",
            "下一年"
        );

        const viewport = section.createDiv({
            cls:
                "writer-stats-dashboard__annual-viewport"
        });

        const load = async (): Promise<void> => {
            const version = ++this.heatmapRequestVersion;

            const requestedYear = year;

            label.setText(`${year}年`);

            previous.disabled = year <= 1000;
            next.disabled = year >= currentYear;

            viewport.setAttribute(
                "aria-busy",
                "true"
            );

            // 首次加载显示提示，切换年份时保留旧内容，减少空白闪烁
            if (!viewport.hasChildNodes()) {
                viewport.createDiv({
                    text: "正在加载年度热力图...."
                });
            }

            try{
                const firstDate = `${requestedYear}-01-01`;

                const lastDate = 
                    requestedYear === currentYear
                        ? today
                        : `${requestedYear}-12-31`
                
                const summary =
                    await this.historyService.getSummary(
                        firstDate,
                        lastDate
                    );

                // 旧请求、已关闭的视图不再更新 DOM
                if (
                    version !== this.heatmapRequestVersion ||
                    !viewport.isConnected
                ) {
                    return;
                }

                viewport.empty();

                renderYearHeatmapSection(
                    viewport,
                    summary,
                    `${requestedYear} 年`
                );

                viewport.setAttribute(
                    "aria-busy",
                    "false"
                );
            } catch (error) {
                if (
                    version !== this.heatmapRequestVersion ||
                    !viewport.isConnected
                ) {
                    return;
                }

                console.error(
                    "[Writer Stats] 年度热力图加载失败",
                    error
                );

                viewport.empty();

                viewport.createDiv({
                    text:
                        "年度热力图加载失败." +
                        "请重新选择年份"
                });

                viewport.setAttribute(
                    "aria-busy",
                    "false"
                );
            }
        };

        previous.addEventListener("click", () => {
            if (year <= 1000) {
                return;
            }

            this.selectdHeatmapYear = --year;

            void load();
        });

        next.addEventListener("click", () => {
            if (year >= currentYear) {
                return;
            }

            this.selectdHeatmapYear = ++year;

            void load();
        });

        void load();
    }

    // 月度统计入口，与现有7/30天历史统计独立
    private renderMonthlySection(
        container: HTMLElement,
        today: string
    ): void {
        let month = this.selectedMonth ?? today.slice(0, 7);

        const service = new MonthlyStatsService(this.historyService);

        // 使用独立的CSS 类名
        const section = container.createDiv({
            cls: [
                "writer-stats-dashboard__section",
                "writer-stats-dashboard__monthly"
            ]
        });

        const header = section.createDiv({
            cls:
                "writer-stats-dashboard__monthly-header"
        });

        header.createEl("h2", {
            cls:
                "writer-stats-dashboard__section-title",
            text: "月度统计"
        });

        const navigation = header.createDiv({
            cls:
                "writer-stats-dashboard__month-nav"
        });

        const previous = navigation.createEl(
            "button",
            {
                cls:
                    "writer-stats-dashboard__month-button",
                text: "‹"
            }
        );

        previous.type = "button";
        previous.setAttribute(
            "aria-label",
            "上一个月"
        );

        const label = navigation.createSpan({
            cls:
                "writer-stats-dashboard__month-label"
        });

        const next = navigation.createEl(
            "button",
            {
                cls:
                    "writer-stats-dashboard__month-button",
                text: "›"
            }
        );

        next.type = "button";
        next.setAttribute(
            "aria-label",
            "下一个月"
        );

        // 月度 CSV 导出工具栏
        const exportToolbar = section.createDiv({
            cls:
                "writer-stats-dashboard__monthly-export-toolbar"
        });

        const exportButton = exportToolbar.createEl(
            "button",
            {
                cls:
                    "writer-stats-dashboard__monthly-export-button",
                text: "导出当前月份 CSV"
            }
        );

        exportButton.type = "button";
        exportButton.title =
            "在 Vault 的 Writer Stats Exports 文件夹中" +
            "生成每日汇总与文件明细";

        // 点击导出当前选择的自然月
        exportButton.addEventListener("click",() => {
            // 立即保存月份，避免用户切换月份时混淆
            const requestedMonth = month;

            // 防止连续点击创建重复导出任务
            exportButton.disabled = true;
            exportButton.setText("正在导出....");

            void (async () => {
                try {
                    // 生成两份 CSV 内容
                    const bundle = 
                        await this.monthlyCsvExportService
                            .buildMonthlyCsv(
                                requestedMonth,
                                today
                            );

                    // 保存到当前 Obsidian Vault
                    await saveMonthlyCsvToVault(
                        this.app,
                        bundle
                    );

                    new Notice(
                        `已导出 ${requestedMonth} 的两份 CSV` +
                        `Writer Stats Exports`
                    );
                } catch(error) {
                    console.error(
                        "[Writer Stats] CSV 导出失败",
                        error
                    );

                    new Notice(
                        "CSV 导出失败，请查看开发者工具中的错误信息"
                    );
                } finally {
                    exportButton.disabled = false;
                    exportButton.setText(
                        "导出当前月份 CSV"
                    );
                }
            })();
        });

        const content = section.createDiv({
            cls:
                "writer-stats-dashboard__monthly-content"
        });

        content.createDiv({
            cls:
                "writer-stats-dashboard__history-loading",
            text: "正在加载月度统计....."
        });

        // 查询月份数据
        const load = async (): Promise<void> => {
            const version = ++this.monthlyRequestVersion;

            const requestedMonth = month;

            const [year, monthNumber] = requestedMonth.split("-");

            label.setText(
                `${year}年${Number(monthNumber)}月`
            );

            previous.disabled = requestedMonth <= "1000-01";

            next.disabled = requestedMonth >= today.slice(0, 7);

            // content.empty();

            // content.createDiv({
            //     cls:
            //         "writer-stats-dashboard__history-loading",
            //     text:"正在加载月度统计...."
            // });


            /*
             * 不再清空已经显示的月度统计。
             * 新请求完成前保留旧内容，并标记正在更新。
             */
            content.addClass("is-updating");
            content.setAttribute("aria-busy", "true");


            try {
                const summary =
                    await service.getMonthSummary(
                        requestedMonth,
                        today
                    );

                if (
                    version !== this.monthlyRequestVersion ||
                    !content.isConnected
                ) {
                    return;
                }

                content.empty();

                this.renderMonthlyContent(
                    content,
                    summary
                );

                // 月度统计完成后，加载同一月份的文件排行榜。
                // 排行榜加载失败，不影响前面已经显示的月度数据
                this.renderMonthlyFileRanking(
                    content,
                    summary
                );

                content.removeClass("is-updating");
                content.setAttribute("aria-busy", "false");
            } catch (error) {
                if (
                    version !== this.monthlyRequestVersion ||
                    !content.isConnected
                ) {
                    return;
                }

                console.error(
                    "[Writer Stats] 月度统计加载失败",
                    error
                );

                content.empty();

                content.createDiv({
                    cls:
                        "writer-stats-dashboard__history-error",
                    text: "月度统计加载失败，请切换月份重试"
                });

                content.removeClass("is-updating");
                content.setAttribute("aria-busy", "false");
            }
        };

        // 上个月
        previous.addEventListener("click", () => {
            if (month <= "1000-01") {
                return;
            }

            month = shiftMonth(month, -1);

            this.selectedMonth = month;

            void load();
        });

        // 下个月
        next.addEventListener("click", () => {
            if (month >= today.slice(0, 7)) {
                return;
            }

            month = shiftMonth(month, 1);

            this.selectedMonth = month;

            void load();
        });

        // 首次加载
        void load();
    }

    // 月度统计内容

    private renderMonthlyContent(
        container: HTMLElement,
        summary: MonthlyWritingSummary
    ): void {
        container.createDiv({
            cls:
                "writer-stats-dashboard__monthly-dates",
            text:
                `${summary.startDate} ~ ${summary.endDate}` +
                (
                    summary.isCurrentMonth
                        ? " · 截至今天"
                        : ""
                )
        });

        // 月度汇总
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

        // 空记录壮体啊

        if (summary.isEmpty) {
            container.createDiv({
                cls:
                    "writer-stats-dashboard__monthly-empty",
                text:
                    "这个月暂无写作记录"
            });

            return;
        }

        /*
        * MonthlyWritingSummary 继承自
        * DailyHistorySummary。
        *
        * 因此可以直接复用已存在的趋势图，
        * 不需要再次实现绘图方法。
        */

        this.renderHistoryTrend(
            container,
            summary
        );

        // 最佳写作日
        const best = container.createDiv({
            cls:
                "writer-stats-dashboard__best-day"
        });

        best.createDiv({
            cls:
                "writer-stats-dashboard__best-label",
            text: "本月最佳写作日"
        });

        best.createDiv({
            cls:
                "writer-stats-dashboard__best-day-value",
            text: summary.bestWritingDay
                ? (
                    `${summary.bestWritingDay.date} · ` +
                    this.formatSigned(summary.bestWritingDay.added)
                )
                : "本月暂无新增记录"
        });
    }

    /*
     * ========================================
     * Metric Card
     * ========================================
     */

    /**
    * 加载月度文件排行榜。
    *
    * 月度主统计已经渲染完成，
    * 排行榜失败不影响月度汇总。
    *
    * monthlyRequestVersion 负责防止
    * 旧月份的结果覆盖新界面。
    */

    private renderMonthlyFileRanking(
        container: HTMLElement,
        summary: MonthlyWritingSummary
    ): void {
        const host = container.createDiv({
            cls:
                "writer-stats-dashboard__ranking-host"
        });

        host.createDiv({
            cls:
                "writer-stats-dashboard__history-loading",
            text: "正在加载文件夹统计文件排行榜"
        });

        const version = this.monthlyRequestVersion;

        // 两个模块共用一次排行榜查询，避免重复读取历史活动
        
        void this.fileRankingService.getRanking(
            summary.startDate,
            summary.endDate
        ).then(ranking => {
            if (
                version !== this.monthlyRequestVersion ||
                !host.isConnected
            ) {
                return;
            }

            host.empty();

            // 文件夹统计容器

            const folderHost = host.createDiv({
                cls:
                    "writer-stats-dashboard__folders-host"
            });

            // 原有文件排行榜容器

            const rankingHost = host.createDiv({
                cls:
                    "writer-stats-dashboard__files-host"
            });

            // 文件夹导航、排序时只重新渲染，文件夹组件，不再次读取 Repository

            const drawFolders = (): void => {
                if (!folderHost.isConnected) {
                    return;
                }

                folderHost.empty();

                renderFolderStatsSection(
                    folderHost,
                    ranking,
                    this.folderStatsPath,
                    this.folderStatsSort,

                    path => {
                        this.folderStatsPath = path;
                        drawFolders();
                    },

                    sort => {
                        this.folderStatsSort = sort;
                        drawFolders();
                    }
                );
            };

            // 首次显示文件夹统计

            drawFolders();

            // 保留原有文件写作排行榜

            renderFileRankingSection(
                rankingHost,
                this.app,
                ranking,
                this.fileRankingSort,

                sort => {
                    this.fileRankingSort = sort;
                },

                filePath => {
                    new FileWritingDetailModal(
                        this.app,
                        this.fileWritingDetailService,
                        filePath,
                        ranking.startDate,
                        ranking.endDate
                    ).open();
                }
            );
        }).catch(error => {
            if (
                version !== this.monthlyRequestVersion ||
                !host.isConnected
            ) {
                return;
            }

            console.error(
                "[Writer Stats] 文件夹/排行榜加载失败",
                error
            );

            host.empty();

            host.createDiv({
                cls:
                    "writer-stats-dashboard__history-error",
                text:
                    "文件夹统计与文件排行榜加载失败。" +
                    "请切换月份重试"
            });
        });
    }

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