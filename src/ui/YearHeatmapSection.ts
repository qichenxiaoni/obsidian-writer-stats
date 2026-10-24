import type {
    DailyHistorySummary
} from "../domain/DailyHistorySummary";

import {
    buildYearHeatmapLayout
} from "../core/YearHeatmapLayout";

function signed(value: number): string {
    return value > 0
        ? `+${value}`
        : String(value);
}

/**
 * 公共年度热力图组件。
 *
 * 不自行查询数据。
 * 数据由 Dashboard 或统计弹窗提供。
 */

export function renderYearHeatmapSection(
    container: HTMLElement,
    summary: DailyHistorySummary,
    headeing: string
): void {
    const layout = buildYearHeatmapLayout(summary.days);

    const section = container.createDiv({
        cls:
            "writer-stats-modal__heatmap"
    });

    const header = section.createDiv({
        cls:
            "writer-stats-modal__heatmap-header"
    });

    header.createDiv({
        cls:
            "writer-stats-modal__heatmap-title",
        text: headeing
    });

    header.createDiv({
        cls:
            "writer-stats-modal__heatmap-summary",
        text:
            `${summary.activeDays} 个活跃日 · ` +
            `新增 ${signed(summary.added)}`
    });

    if (layout.weekCount === 0) {
        section.createDiv({
            text: "暂无写作记录"
        });

        return;
    }

    // 月份标签
    const months = section.createDiv({
        cls:
            "writer-stats-modal__heatmap-months"
    });

    months.style.setProperty(
        "--writer-stats-heatmap-weeks",
        String(layout.weekCount)
    );

    for (const month of layout.months) {
        const label = months.createDiv({
            cls:
                "writer-stats-modal__heatmap-month",
            text: month.label
        });

        label.style.gridColumn =
            `${month.startColumn} / span ${month.span}`;
    }

    // 热力图主体
    const body = section.createDiv({
        cls:
            "writer-stats-modal__heatmap-body"
    });

    const weekdays = body.createDiv({
        cls:
            "writer-stats-modal__heatmap-weekdays"
    });

    for (const name of [
        "日", "一", "二", "三", "四", "五", "六"
    ]) {
        weekdays.createDiv({
            cls:
                "writer-stats-modal__heatmap-weekday",
            text: name
        });
    }

    const grid = body.createDiv({
        cls:
            "writer-stats-modal__heatmap-grid"
    });

    grid.style.setProperty(
        "--writer-stats-heatmap-weeks",
        String(layout.weekCount)
    );

    // 每日格子
    for (const cellData of layout.cells) {
        const cell = grid.createDiv({
            cls: `writer-stats-modal__heatmap-cell level-${cellData.level}`
        });

        // 
        cell.textContent = "\u200B";

        cell.style.fontSize = "0";
        cell.style.lineHeight = "0";

        cell.style.gridColumn = String(cellData.column);

        cell.style.gridRow = String(cellData.row);

        const day = cellData.day;

        cell.title = [
            day.date,
            `新增：${signed(day.added)}`,
            `删除：${day.deleted}`,
            `净增长: ${signed(day.net)}`
        ].join("\n");

        cell.setAttribute(
            "aria-label",
            cell.title.replace(/\n/g, ". ")
        );
    }

    // 颜色等级图例
    const legend = section.createDiv({
        cls:
            "writer-stats-modal__heatmap-legend"
    });

    legend.createSpan({
        text: "少"
    });

    for (let level = 0; level <= 4; level++) {
        const legendCell = legend.createDiv({
            cls: `writer-stats-modal__heatmap-legend-cell level-${level}`
        });

        // 采用与日期格子一致的非空元素处理
        legendCell.textContent = "\u200B";
        legendCell.style.fontSize = "0";
        legendCell.style.lineHeight = "0";
    }

    legend.createSpan({
        text: "多"
    });
}