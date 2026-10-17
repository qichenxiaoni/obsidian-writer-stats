
import type {
    DailyHistoryService
} from "./DailyHistoryService";

import type {
    DailyHistorySummary
} from "../domain/DailyHistorySummary";

/*
 * 月度统计沿用已有历史摘要的数据结构。
 *
 * 包括：
 * - 每日新增、删除、净增长
 * - 活跃文件
 * - 活跃天数
 * - 连续写作
 * - 最长连续
 * - 最佳写作日
 */
export interface MonthlyWritingSummary
    extends DailyHistorySummary {
    month: string;
    isCurrentMonth: boolean;
    isEmpty: boolean;
}

export interface MonthRange {
    month: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    isCurrentMonth: boolean;
}

/**
 * 解析 YYYY-MM 格式的自然月。
 */
function parseMonth(
    month: string
): {
    year: number;
    monthNumber: number;
} {
    if (
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)
    ) {
        throw new Error(`无效月份：${month}`);
    }

    const year = Number(month.slice(0, 4));

    if (year < 1000 || year > 9999) {
        throw new RangeError(
            `不支持的年份：${year}`
        );
    }

    return {
        year,
        monthNumber: Number(month.slice(5, 7))
    };
}

/**
 * 切换自然月。
 *
 * 示例：
 * 2026-01, -1 -> 2025-12
 * 2025-12,  1 -> 2026-01
 */
export function shiftMonth(
    month: string,
    offset: number
): string {
    const { year, monthNumber } =
        parseMonth(month);

    if (!Number.isInteger(offset)) {
        throw new RangeError(
            "月份偏移量必须是整数"
        );
    }

    const index =
        year * 12 +
        monthNumber - 1 +
        offset;

    const nextYear = Math.floor(index / 12);

    if (nextYear < 1000 || nextYear > 9999) {
        throw new RangeError(
            "月份超出支持范围"
        );
    }

    return (
        `${nextYear}-` +
        String(index % 12 + 1).padStart(2, "0")
    );
}

/**
 * 计算自然月的查询范围。
 *
 * 历史月：1 日到月末。
 * 当前月：1 日到今天。
 * 禁止查询未来月。
 */
export function getMonthRange(
    month: string,
    today: string
): MonthRange {
    const { year, monthNumber } =
        parseMonth(month);

    const match =
        /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
            .exec(today);

    if (
        !match ||
        Number(match[1]) < 1000
    ) {
        throw new Error(
            `无效的当前日期：${today}`
        );
    }

    const todayYear = Number(match[1]);
    const todayMonth = Number(match[2]);
    const todayDay = Number(match[3]);

    // 检查真实日历日期，例如拒绝 2 月 30 日。
    const todayLastDay = new Date(
        Date.UTC(todayYear, todayMonth, 0)
    ).getUTCDate();

    if (todayDay > todayLastDay) {
        throw new Error(
            `无效的当前日期：${today}`
        );
    }

    const currentMonth = today.slice(0, 7);

    if (month > currentMonth) {
        throw new RangeError(
            "不允许查询未来月份"
        );
    }

    // 当前选择月份的最后一天。
    const lastDay = new Date(
        Date.UTC(year, monthNumber, 0)
    ).getUTCDate();

    const isCurrentMonth =
        month === currentMonth;

    const endDay = isCurrentMonth
        ? todayDay
        : lastDay;

    return {
        month,
        startDate: `${month}-01`,
        endDate:
            `${month}-` +
            String(endDay).padStart(2, "0"),
        totalDays: endDay,
        isCurrentMonth
    };
}

/**
 * 月度统计服务。
 *
 * 只负责确定月份范围并调用已有的
 * DailyHistoryService.getSummary()。
 *
 * 不再重复计算每日数据或拼接查询结果。
 */
export class MonthlyStatsService {
    constructor(
        private readonly historyService:
            Pick<DailyHistoryService, "getSummary">
    ) { }

    async getMonthSummary(
        month: string,
        today: string
    ): Promise<MonthlyWritingSummary> {
        const range = getMonthRange(
            month,
            today
        );

        const summary =
            await this.historyService.getSummary(
                range.startDate,
                range.endDate
            );

        return {
            ...summary,
            month: range.month,
            isCurrentMonth:
                range.isCurrentMonth,
            isEmpty:
                summary.activeDays === 0
        };
    }
}
