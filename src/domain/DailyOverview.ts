import type { DailySummary } from "./DailySummary";
import type { GoalProgress } from "./GoalProgress";

export interface DailyOverview {
    summary: DailySummary;
    goal: GoalProgress;
}