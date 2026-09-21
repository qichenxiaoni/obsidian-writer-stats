import type { DailySummary } from "../domain/DailySummary";

function formatSigned(
    value: number
): string {
    if (value > 0) {
        return `+${value}`;
    }

    return String(value);
}

export function formatStatusBarText(
    summary: DailySummary
): string {
    return (
        `今日 +${summary.added.total}` +
        ` · 净增 ${formatSigned(summary.net.total)}`
    );
}

export function formatStatusBarTooltip(
    summary: DailySummary
): string {
    return [
        `新增：${summary.added.total}`,
        `删除：${summary.deleted.total}`,
        `净增：${formatSigned(summary.net.total)}`,
        `活跃文件：${summary.activeFiles}`
    ].join("\n");
}