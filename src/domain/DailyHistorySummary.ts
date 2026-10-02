import type {
    DailyHistoryEntry
} from "./DailyHistoryEntry";

export interface DailyHistorySummary {
    startDate: string;

    endDate: string;
    
    totalDays: number;

    activeDays: number;

    writingStreak: number;

    added: number;

    deleted: number;

    net: number;

    days: DailyHistoryEntry[];
}