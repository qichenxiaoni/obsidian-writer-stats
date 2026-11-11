import { setTooltip } from "obsidian";

import type { WritingTimeSummary } from "../core/WritingTimeAnalysisService";

const WRITING_BAR_TRACK_HEIGHT = 112;

/**
 * 使用明确的像素尺寸绘制柱形。
 *
 * 不依赖父级容器的百分比高度计算，
 * 避免轨道高度被计算为 0px。
 */

function setWritingBarSize(
    track: HTMLElement,
    fill: HTMLElement,
    value: number,
    peak: number,
    maxWidthPx?: number
):void {
    const height = value > 0
        ? Math.max(
            3,
            Math.round(
                value / Math.max(1,peak) * WRITING_BAR_TRACK_HEIGHT
            )
        )
        : 0;

        // 轨道始终占用明确的绘制空间
        track.style.display = "block";
        track.style.position = "relative";
        track.style.width = "100%";
        track.style.minWidth = "0";
        track.style.height =
            `${WRITING_BAR_TRACK_HEIGHT}px`;
        track.style.minHeight =
            `${WRITING_BAR_TRACK_HEIGHT}px`;
        track.style.flex = 
            `0 0 ${WRITING_BAR_TRACK_HEIGHT}px`;
        
        // 柱形使用像素高度，不再使用 %
        fill.style.position = "absolute";
        fill.style.bottom = "0";
        fill.style.left = "50%";
        fill.style.transform = "translateX(-50%)";

        fill.style.width = maxWidthPx
            ? `min(${maxWidthPx}px, 100%)`
            : "100%";

        fill.style.height = `${height}px`;
        fill.style.flex = "none";
        fill.style.backgroundColor = "var(--interactive-accent)";
        fill.style.borderRadius = "4px 4px 0 0";
}

export function formatWritingDuration(
    ms: number
): string {
    if (ms <= 0) {
        return "0 分钟";
    }

    const minutes = Math.round(
        ms / 60_000
    );

    if (minutes === 0) {
        return `${Math.max(
            1,
            Math.round(ms / 1000)
        )} 秒`;
    }

    const hours = Math.floor(
        minutes / 60
    );

    return hours
        ? `${hours} 小时 ${minutes % 60} 分`
        : `${minutes} 分钟`;
}

export function renderWritingTimeSection(
    host: HTMLElement,
    summary: WritingTimeSummary
): void {
    const section = host.createDiv({
        cls:
            "writer-stats-dashboard__writing-time"
    });

    section.createEl("h3",{
        cls:
            "writer-stats-dashboard__section-title",
        text: "写作时间分析"
    });

    section.createDiv({
        cls:
            "writer-stats-dashboard__writing-time-hint",
        text:
            `${summary.startDate} - ${summary.endDate} · ` +
            "依据连续编辑事件估算： 间隔超过 60 秒不计入，" +
            "不代表应用打开时长。旧记录无法追溯。"
    });

    if (summary.activeMs === 0) {
        section.createDiv({
            cls:
                "writer-stats-dashboard__writing-time-empty",
            text:
                "当前月份尚无可用的编辑时长记录。" +
                "开始编辑笔记后逐步产生数据。" 
        });

        return;
    }

    // 汇总卡片

    const cards = section.createDiv({
        cls:
            "writer-stats-dashboard__writing-time-cards"
    });

    const metrics = [
        ["有效编辑时间", formatWritingDuration(summary.activeMs)],
        ["有时长记录的天数", `${summary.activeDays} 天`],
        [
            "新增效率（估算）",
            summary.charactersPerHour === null
                ? "样本不足"
                : `${summary.charactersPerHour} 字/小时`
        ]
    ];

    for (const [label,value] of metrics) {
        const card = cards.createDiv({
            cls:
                "writer-stats-dashboard__writing-time-card"
        });

        card.createDiv({
            text: label
        });

        card.createEl("strong",{
            text: value
        });
    }

    // 24 小时分布

    section.createEl("h4",{
        text: "24 小时编辑分布"
    });

    const hours = section.createDiv({
        cls:
            "writer-stats-dashboard__writing-time-hours"
    });

    const hourPeak = Math.max(
        1,
        ...summary.hourlyMs
    );

    summary.hourlyMs.forEach((ms,hour) => {
        const item = hours.createDiv({
            cls:
                "writer-stats-dashboard__writing-time-hour"
        });

        const track = item.createDiv({
            cls:
                "writer-stats-dashboard__writing-time-hour-track"
        });

        const fill = track.createDiv({
            cls:
                "writer-stats-dashboard__writing-time-hour-fill"
        });

        setWritingBarSize(
            track,
            fill,
            ms,
            hourPeak,
            24
        );

        if (hour % 4 === 0) {
            item.createSpan({
                text:
                    `${String(hour).padStart(2,"0")}:00`
            });
        }

        setTooltip(
            item,
            `${hour}:00-${hour + 1}:00 · ` +
            formatWritingDuration(ms)
        );
    });

    // 每日编辑时长
    section.createEl("h4",{
        text: "每日编辑时长"
    });

    const viewport = section.createDiv({
        cls:
            "writer-stats-dashboard__writing-time-scroll"
    });

    const days = viewport.createDiv({
        cls:
            "writer-stats-dashboard__writing-time-days"
    });

    days.style.setProperty(
        "--writing-time-days",
        String(summary.daily.length)
    );

    const dayPeak = Math.max(
        1,
        ...summary.daily.map(
            day => day.activeMs
        )
    );

    summary.daily.forEach((day,index) => {
        const item = days.createDiv({
            cls:
                "writer-stats-dashboard__writing-time-day"
        });

        const track = item.createDiv({
            cls:
                "writer-stats-dashboard__writinng-time-day-track"
        });

        const fill = track.createDiv({
            cls:
                "writer-stats-dashboard__writing-time-day-fill"
        });

        setWritingBarSize(
            track,
            fill,
            day.activeMs,
            dayPeak,
            28
        );

        const showLabel = 
            summary.daily.length <= 7 ||
            day.activeMs > 0 ||
            index === 0 ||
            index === summary.daily.length - 1 ||
            index % 5 === 0;
        
        item.createSpan({
            text: showLabel
                ? day.date.slice(5)
                : ""
        });

        setTooltip(
            item,
            `${day.date} · ` +
            formatWritingDuration(day.activeMs)
        );
    });

    // 文件排行
    section.createEl("h4",{
        text: "文件编辑时长前 5 名"
    });

    const list = section.createDiv({
        cls:
            "writer-stats-dashboard__writing-time-files"
    });

    summary.files.slice(0,5).forEach(
        (file,index) => {
            const row = list.createDiv({
                cls:
                    "writer-stats-dashboard__writing-time-file"
            });

            row.createSpan({
                text:
                    `${index + 1}. ${file.path}`
            });

            row.createSpan({
                text:
                    formatWritingDuration(file.activeMs)
            });
        }
    );
}