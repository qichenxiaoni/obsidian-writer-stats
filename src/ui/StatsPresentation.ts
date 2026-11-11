/**
 * Dashboard 和 StatisticsModal 共用的展示规则。
 * 不包含 DOM 操作，也不依赖 Obsidian API。
 */

export function formatSigned(value: number): string {
    return value > 0
        ? `+${value}`
        : String(value);
}

// YYYY-MM-DD -> YYYY年M月D日

export function formatDate(date: string): string {
    const [year, month, day] = date.split("-");

    return (
        `${year}年` +
        `${Number(month)}月` +
        `${Number(day)}日`
    );
}

// YYYY-MM-DD -> MM/DD

export function formatTrendDate(date: string): string {
    const parts = date.split("-");

    if (parts.length !== 3) {
        return date;
    }

    return `${parts[1]}/${parts[2]}`;
}

// 7天显示全部标签。较长时间范围显示首尾及每5天的标签

export function shouldShowTrendLabel(
    index: number,
    total: number
): boolean {
    return (
        total <= 7 ||
        index === 0 ||
        index === total - 1 ||
        index % 5 === 0
    );
}

/**
 * 短期趋势使用线性高度。
 * 长期趋势使用平方根缩放。
 * 保持原有最小柱高规则。
 */

export function getTrendBarHeight (
    value: number,
    maxValue: number,
    totalDays: number
): number {
    if (value <= 0 || maxValue <= 0) {
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