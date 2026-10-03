import type {
    DailyHistoryEntry
} from "./DailyHistoryEntry";
import type {
    BestWritingDay
} from "./BestWritingDay";

export interface DailyHistorySummary {
    startDate: string;

    endDate: string;
    
    totalDays: number;

    activeDays: number;

    // 截止 endDate 的当前连续写作天数
    writingStreak: number;

    // 当前查询区间内最长连续写作天数
    longesWritingStreak: number;

    bestWritingDay: BestWritingDay | null;

    added: number;

    deleted: number;

    net: number;

    days: DailyHistoryEntry[];
}