import { Notice, type App } from "obsidian";
import type { DailyHistoryService } from "../core/DailyHistoryService";
import { MonthlyStatsService,shiftMonth,type MonthlyWritingSummary } from "../core/MonthlyStatsService";
import type { MonthlyCsvExportService } from "../core/MonthlyCsvExportService";
import { saveMonthlyCsvToVault } from "./CsvVaultExporter";
import { formatSigned } from "./StatsPresentation";
import { renderTrendChartSection } from "./TrendChartSection";
import { renderOverviewMetric } from "./OverviewMetric";

export interface MonthlyStatsSectionOptions {
    app: App;
    historyService: DailyHistoryService;
    csvExportService: MonthlyCsvExportService;
    selectedMonth: string | null;
    onSelectMonth: (month: string) => void;
    onSupplementaryContent: (
        container: HTMLElement,
        summary: MonthlyWritingSummary,
        isCurrent: () => boolean
    ) => void;
}

export interface MonthlyStatsSectionHandle {
    dispose(): void;
}

function renderMonthlySummary(
    container: HTMLElement,
    summary: MonthlyWritingSummary
): void {
    container.createDiv({
        cls: "writer-stats-dashboard__montly-dates",
        text: `${summary.startDate} ~ ${summary.endDate}` +
            (summary.isCurrentMonth ? " · 截至今天" : "")
    });

    const grid = container.createDiv({
        cls: "writer-stats-dashboard__overview-grid"
    });

    renderOverviewMetric(grid,"新增", formatSigned(summary.added));
    renderOverviewMetric(grid,"删除",String(summary.deleted));
    renderOverviewMetric(grid,"净增长",formatSigned(summary.net));
    renderOverviewMetric(
        grid,
        "活跃天数",
        `${summary.activeDays} / ${summary.totalDays}`
    );

    if (summary.isEmpty) {
        container.createDiv({
            cls: "writer-stats-dashboard__monthly-empty",
            text: "这个月暂无写作记录"
        });

        return;
    }

    renderTrendChartSection(container, summary, {
        variant: "dashboard",
        showAllDateLabels: summary.days.length <= 14
    });

    const best = container.createDiv({
        cls: "writer-stats-dashboard__best-day"
    });

    best.createDiv({
        cls: "writer-stats-dashboard__best-label",
        text: "本月最佳写作日"
    });

    best.createDiv({
        cls: "writer-stats-dashboard__best-day-value",
        text: summary.bestWritingDay
            ? `${summary.bestWritingDay.date} · ` +
                formatSigned(summary.bestWritingDay.added)
            : "本月暂无新增记录"
    });
}

/**
 * 月度统计区域独立控制器。
 *
 * 负责月份导航、月度数据请求、
 * CSV 导出及月度主统计展示。
 *
 * 其它异步区域由调用方渲染，
 * 通过 isCurrent 防止过期结果回写。
 */

export function renderMonthlyStatsSection (
    container: HTMLElement,
    today: string,
    options: MonthlyStatsSectionOptions
): MonthlyStatsSectionHandle {
    let month = options.selectedMonth ?? today.slice(0,7);
    let requestVersion = 0;
    let disposed = false;

    const service = new MonthlyStatsService(options.historyService);

    const section = container.createDiv({
        cls: [
            "writer-stats-dashboard__section",
            "writer-stats-dashboard__monthly"
        ]
    });

    const header = section.createDiv({
        cls: "writer-stats-dashboard__monthly-header"
    });

    header.createEl("h2", {
        cls: "writer-stats-dashboard__section-title",
        text: "月度统计"
    });

    const navigation = header.createDiv({
        cls: "writer-stats-dashboard__monthly-nav"
    });

    const previous = navigation.createEl("button", {
        cls: "writer-stats-dashboard__month-button",
        text: "‹"
    });

    previous.type = "button";
    previous.setAttribute("aria-label","上一个月");

    const label = navigation.createSpan({
        cls: "writer-stats-dashboard__month-label"
    });

    const next = navigation.createEl("button", {
        cls: "writer-stats-dashboard__month-button",
        text: "›"
    });

    next.type = "button";
    next.setAttribute("aria-label","下一个月");

    const exportToolbar = section.createDiv({
        cls: "writer-stats-dashboard__monthly-export-toolbar"
    });

    const exportButton = exportToolbar.createEl("button", {
        cls: "writer-stats-dashboard__monthly-export-button",
        text: "导出当前月份 CSV"
    });

    exportButton.type = "button";
    exportButton.title = 
        "在 Vault 的 Writer Stats Exports 文件夹中" +
        "生成每日汇总与文件明细";

    exportButton.addEventListener("click", () => {
        // 捕获点击瞬间的月份
        const requestedMonth = month;

        exportButton.disabled = true;
        exportButton.setText("正在导出....");

        void (async () => {
            try {
                const bundle = await options.csvExportService.buildMonthlyCsv(
                    requestedMonth,
                    today
                );

                await saveMonthlyCsvToVault(options.app,bundle);

                new Notice(
                    `已导出 ${requestedMonth} 的两份 CSV` +
                    "Writer Stats Exports"
                );
            } catch (error) {
                console.error(
                    "[Writer Stats] CSV 导出失败",
                    error
                );

                new Notice(
                    "CSV 导出失败，请查看开发者工具中的错误信息"
                );
            } finally {
                exportButton.disabled = false;
                exportButton.setText("导出当前月份 CSV");
            }
        })();
    });

    const content = section.createDiv({
        cls: "writer-stats-dashboard__monthly-content"
    });

    content.createDiv({
        cls: "writer-stats-dashboard__history-loading",
        text: "正在加载月度统计...."
    });

    const load = async (): Promise<void> => {
        const version = ++requestVersion;
        const requestedMonth = month;
        const [year,monthNumber] = requestedMonth.split("-");

        label.setText(`${year}年${Number(monthNumber)}月`);

        previous.disabled = requestedMonth <= "1000-01";
        next.disabled = requestedMonth >= today.slice(0,7);

        // 主统计和附属统计共用此判断
        const isCurrent = (): boolean =>
            !disposed &&
            version === requestVersion &&
            content.isConnected;
            
        // 等待请求期间保留已有内容
        content.addClass("is-updating");
        content.setAttribute("aria-busy","true");

        try {
            const summary = await service.getMonthSummary(
                requestedMonth,
                today
            );

            if (!isCurrent()) {
                return;
            }

            content.empty();

            renderMonthlySummary(content,summary);

            // 附属模块继续并行加载
            options.onSupplementaryContent(
                content,
                summary,
                isCurrent
            );

            content.removeClass("is-updating");
            content.setAttribute("aria-busy","false");
        } catch (error) {
            if (!isCurrent()) {
                return;
            }

            console.error(
                "[Writer Stats] 月度统计加载失败",
                error 
            );

            content.empty();

            content.createDiv({
                cls: "writer-stats-dashboard__history-error",
                text: "月度统计加载失败，请切换月份重试"
            });

            content.removeClass("is-updating");
            content.setAttribute("aria-busy","false");
        }
    };

    previous.addEventListener("click", () => {
        if (disposed || month <= "1000-01") {
            return;
        }

        month = shiftMonth(month, -1);
        options.onSelectMonth(month);
        void load();
    });

    next.addEventListener("click", () => {
        if (disposed || month >= today.slice(0,7)) {
            return;
        }

        month = shiftMonth(month,1);
        options.onSelectMonth(month);
        void load();
    });

    void load();

    return {
        dispose(): void {
            disposed = true;
            ++requestVersion;
        }
    };
}