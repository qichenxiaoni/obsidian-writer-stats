import type { DailyHistoryService } from "../core/DailyHistoryService";
import type { DailyHistorySummary } from "../domain/DailyHistorySummary";
import { formatSigned } from "./StatsPresentation";
import { renderOverviewMetric } from "./OverviewMetric";
import { renderTrendChartSection } from "./TrendChartSection";

export type historyRangeDays = 7 | 30;

export interface HistorySectionOptions {
    historyService: Pick<DailyHistoryService, "getRecentSummary">;
    selectedDays: historyRangeDays;
    onSelectDays: (days: historyRangeDays) => void;
}

export interface HistorySectionHandle {
    dispose(): void;
}

function renderHistoryContent(
    container: HTMLElement,
    summary: DailyHistorySummary
): void {
    container.createDiv({
        cls: "writer-stats-dashboard__history-dates",
        text: `${summary.startDate} ~ ${summary.endDate}`
    });

    const grid = container.createDiv({
        cls: "writer-stats-dashboard__overview-grid"
    });

    renderOverviewMetric(grid, "新增", formatSigned(summary.added));
    renderOverviewMetric(grid, "删除", formatSigned(summary.deleted));
    renderOverviewMetric(grid, "净增长", formatSigned(summary.net));
    renderOverviewMetric(grid, "活跃天数", `${summary.activeDays} / ${summary.totalDays}`);
    renderOverviewMetric(grid, "连续写作", `${summary.writingStreak} 天`);
    renderOverviewMetric(grid, "最长连续", `${summary.longesWritingStreak} 天`);

    renderTrendChartSection(container, summary, {variant: "dashboard"});

    const bestDay = container.createDiv({
        cls: "writer-stats-dashboard__best-day"
    });

    bestDay.createDiv({
        cls: "writer-stats-dashboard__best-day-label",
        text: "最佳写作日"
    });

    const best = summary.bestWritingDay;

    bestDay.createDiv({
        cls: best
            ? "writer-stats-dashboard__best-day-value"
            : "writer-stats-dashboard__best-day-value is-empty",
        text: best
            ? `${best.date} ·${formatSigned(best.added)}`
            : "暂无写作记录"
    });
}

/**
 * 7/30 天历史模块。
 * 独立维护异步请求状态，防止过期结果回写。
 */

export function renderHistorySection(
    container: HTMLElement,
    date: string,
    initialSummary: DailyHistorySummary,
    options: HistorySectionOptions
): HistorySectionHandle {
    let selectedDays = options.selectedDays;
    let requestVersion = 0;
    let disposed = false;

    const section = container.createDiv({
        cls: [
            "writer-stats-dashboard__section",
            "writer-stats-dashboard__history"
        ]
    });

    const header = section.createDiv({
        cls: "writer-stats-dashboard__history-header"
    });

    header.createEl("h2", {
        cls: "writer-stats-dashboard__section-title",
        text: "趋势与历史"
    });

    const selector = header.createDiv({
        cls: "writer-stats-dashboard__history-selector"
    });

    const createButton = (days: historyRangeDays): HTMLButtonElement =>
        selector.createEl("button", {
            cls: "writer-stats-dashboard__history-button" +
                (selectedDays === days ? " is-active" : ""),
            text: `${days} 天`,
            attr: {
                type: "button",
                "aria-pressed": String(selectedDays === days)
            }
        });

    const sevenButton = createButton(7);
    const thirtyButton = createButton(30);

    const historyContent = section.createDiv({
        cls: "writer-stats-dashboard__history-content"
    });

    const updateButtonState = (): void => {
        for (const [button, days] of [
            [sevenButton, 7],
            [thirtyButton, 30]
        ] as const) {
            const active = selectedDays === days;

            button.classList.toggle("is-active", active);
            button.setAttribute("aria-pressed", String(active));
        }
    };

    const isCurrent = (version: number): boolean =>
        !disposed &&
        version === requestVersion &&
        historyContent.isConnected;

    const changeRange = async (days: historyRangeDays): Promise<void> => {
        if (disposed || days === selectedDays) {
            return;
        }

        selectedDays = days;
        options.onSelectDays(days);
        updateButtonState();

        const version = ++requestVersion;

        historyContent.empty();
        historyContent.createDiv({
            cls: "writer-stats-dashboard__history-loading",
            text: "正在加载历史数据....."
        });

        try {
            const summary = await options.historyService.getRecentSummary(date,days);
            
            if (!isCurrent(version)) {
                return;
            }

            historyContent.empty();
            renderHistoryContent(historyContent,summary);
        } catch (error) {
            if (!isCurrent(version)) {
                return;
            }

            console.error(
                "[Writer Stats] 历史数据加载失败",
                error
            );

            historyContent.empty();
            historyContent.createDiv({
                cls: "writer-stats-dashboard__history-error",
                text: "历史数据加载失败，请重试"
            });
        }
    };

    sevenButton.addEventListener("click", () => {
        void changeRange(7);
    });

    thirtyButton.addEventListener("click", () => {
        void changeRange(30);
    });

    updateButtonState();
    renderHistoryContent(historyContent,initialSummary);

    return {
        dispose(): void {
            disposed = true;
            ++requestVersion;
        }
    };
}