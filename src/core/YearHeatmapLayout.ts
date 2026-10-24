import type {
    DailyHistoryEntry
} from "../domain/DailyHistoryEntry";

export interface YearHeatmapMonth {
    label: string;
    startColumn: number;
    span: number;
}

export interface YearHeatmapCell {
    day: DailyHistoryEntry;
    column: number;
    row: number;
    level: 0 | 1 | 2 | 3 | 4; 
}

export interface YearHeatmapLayout {
    weekCount: number;
    months: YearHeatmapMonth[];
    cells: YearHeatmapCell[];
}

// 根据最大新增量确定 0～4 级颜色强度
export function getHeatmapLevel(
    value: number,
    maximun: number
): 0 | 1 | 2 | 3 | 4 {
    if (value <= 0 || maximun <= 0) {
        return 0;
    }

    const ratio = Math.sqrt(value / maximun);

    if (ratio <= 0.25) return 1;
    if (ratio <= 0.5) return 2;
    if (ratio <= 0.75) return 3;

    return 4;
}

/**
 * 构建热力图布局。
 *
 * 输入必须按日期升序排列，并补齐无写作活动的日期。
 * DailyHistoryService.getSummary() 已提供这一能力。
 *
 * 星期布局：周日第一行，周六第七行。
 */

export function buildYearHeatmapLayout (
    days: readonly DailyHistoryEntry[]
): YearHeatmapLayout {
    if (days.length === 0) {
        return {
            weekCount: 0,
            months: [],
            cells: []
        };
    }

    const first = new Date (
        `${days[0].date}T00:00:00Z`
    );

    if (Number.isNaN(first.getTime())) {
        throw new Error("热力图开始日期无效");
    }

    const offset = first.getUTCDay();

    const weekCount = Math.ceil(
        (offset + days.length) / 7
    );

    const maximun = Math.max(
        0,
        ...days.map(day => day.added)
    );

    const monthStarts: Array<{
        label: string;
        startColumn: number;
    }> = [];

    const cells: YearHeatmapCell[] = [];

    let previousMonth = "";

    days.forEach((day, index) => {
        const monthKey = day.date.slice(0,7);

        const position = offset + index;

        const column = Math.floor(position / 7) + 1;

        const row = position % 7 + 1;

        if (monthKey !== previousMonth) {
            monthStarts.push({
                label: 
                    `${Number(day.date.slice(5,7))}月`,
                startColumn: column
            });

            previousMonth = monthKey;
        }

        cells.push({
            day,
            column,
            row,
            level: getHeatmapLevel(
                day.added,
                maximun
            )
        });
    });

    const months = monthStarts.map (
        (month,index) => ({
            ...month,
            span: Math.max(
                1,
                (
                    monthStarts[index + 1]
                        ?.startColumn ??
                    (weekCount + 1)
                ) - month.startColumn
            )
        })
    );

    return {
        weekCount,
        months,
        cells
    };
}