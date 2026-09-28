import type { DailySummary } from "../domain/DailySummary";
import type { DailyOverview } from "../domain/DailyOverview";

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

export function formatGoalStatusBarText(
  overview: DailyOverview
): string {
  const {
    goal
  } = overview;

  return (
    `今日 +${goal.current}` +
    ` / ${goal.goal}` +
    ` · ${goal.percentage}%`
  );
}


export function formatGoalStatusBarTooltip(
  overview: DailyOverview
): string {
  const {
    summary,
    goal
  } = overview;

  const net =
    summary.net.total > 0
      ? `+${summary.net.total}`
      : String(
          summary.net.total
        );

  return [
    `今日新增：${summary.added.total}`,
    `今日删除：${summary.deleted.total}`,
    `今日净增：${net}`,
    `活跃文件：${summary.activeFiles}`,
    "",
    `每日目标：${goal.goal}`,
    `完成进度：${goal.percentage}%`,
    goal.completed
      ? "今日目标：已完成"
      : `还差：${goal.remaining}`
  ].join("\n");
}