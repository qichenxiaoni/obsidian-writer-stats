import { setTooltip } from "obsidian";
import type { DailyHistorySummary } from "../domain/DailyHistorySummary";
import {
    formatSigned,
    formatTrendDate,
    getTrendBarHeight,
    shouldShowTrendLabel
} from "./StatsPresentation";

export type TrendChartVariant = "dashboard" | "modal";

export interface TrendChartOptions {
    variant: TrendChartVariant;
    showAllDateLabels?: boolean;
}

/**
 * Dashboard 与 StatisticsModal 共用的趋势图渲染器。
 * 保留各自的 CSS 类名、容器层级及提示方式。
 */

export function renderTrendChartSection(
    container: HTMLElement,
    summary: DailyHistorySummary,
    options: TrendChartOptions
): void {
    const isDashboard = options.variant === "dashboard";

    const prefix = isDashboard
        ? "writer-stats-dashboard"
        : "writer-stats-modal";

    const columnVariable = isDashboard
        ? "--writer-stats-dashboard-trend-columns"
        : "--writer-stats-trend-columns";

    const dayCount = summary.days.length;

    const section = container.createDiv({
        cls: `${prefix}__trend`
    });

    section.createDiv({
        cls: `${prefix}__trend-title`,
        text: "每日新增趋势"
    });

    // 保留 Dashboard 和 Modal 各自原有的 DOM 结构
    const chartHost = isDashboard
        ? section.createDiv({
            cls: `${prefix}__trend-panel`
        })
        : section;

    const peak = Math.max(
        0,
        ...summary.days.map(day => day.added)
    );

    const plot = chartHost.createDiv({
        cls: `${prefix}__trend-plot`
    });

    plot.style.setProperty(
        columnVariable,
        String(dayCount)
    );

    for (const day of summary.days) {
        const item = plot.createDiv({
            cls: `${prefix}__trend-item`
        });

        const bar = item.createDiv({
            cls: `${prefix}__trend-bar`
        });

        bar.style.height = `${
            getTrendBarHeight(
                day.added,
                peak,
                dayCount
            )
        }%`;

        if (day.added <= 0) {
            bar.classList.add("is-empty");
        }

        if (summary.bestWritingDay?.date === day.date) {
            bar.classList.add("is-best");
        }

        // Dashboard 使用 Obsidian 原生 Tooltip
        if (isDashboard) {
            setTooltip(
                item,
                [
                    day.date,
                    `新增：${formatSigned(day.added)}`,
                    `删除：${day.deleted}`,
                    `净增长：${formatSigned(day.net)}`
                ].join("\n")
            );

            item.setAttribute(
                "aria-label",
                [
                    day.date,
                    `新增：${day.added}`,
                    `删除：${day.deleted}`,
                    `净增长：${day.net}`
                ].join("\n")
            );
        }else {
            // Modal 保留原有的 title 提示
            item.setAttribute(
                "title",
                [
                    day.date,
                    `新增：${formatSigned(day.added)}`,
                    `删除：${day.deleted}`,
                    `净增长：${formatSigned(day.net)}`
                ].join("\n")
            );
        }
    }

    const axis = chartHost.createDiv({
        cls: `${prefix}__trend-axis`
    });

    axis.style.setProperty(
        columnVariable,
        String(dayCount)
    );

    // 保留 Dashboard 短日期范围的居中样式
    if (isDashboard && dayCount <= 7) {
        axis.classList.add("is-short");
    }

    summary.days.forEach((day, index) => {
        const label = axis.createDiv({
            cls: `${prefix}__trend-axis-label`
        });

        if (
            options.showAllDateLabels === true ||
            shouldShowTrendLabel(index,dayCount)
        ) {
            label.setText(
                formatTrendDate(day.date)
            );
        }

        if (index === 0) {
            label.classList.add("is-first");
        }

        if (index === dayCount - 1) {
            label.classList.add("is-last");
        }
    });
}