
import type {
    StatsRepository
} from "../persistence/StatsRepository";

export interface WritingTimeDay {
    date: string;
    activeMs: number;
}

export interface WritingTimeFile {
    path: string;
    activeMs: number;
}

export interface WritingTimeSummary {
    startDate: string;
    endDate: string;

    activeMs: number;
    activeDays: number;

    hourlyMs: number[];
    daily: WritingTimeDay[];
    files: WritingTimeFile[];

    added: number;
    charactersPerHour: number | null;
}

export class WritingTimeAnalysisService {
    constructor(
        private readonly repository: StatsRepository
    ) { }

    async getSummary(
        startDate: string,
        endDate: string
    ): Promise<WritingTimeSummary> {
        if (startDate > endDate) {
            throw new Error("无效的时间范围");
        }

        const activities =
            await this.repository.getActivitiesBetween(
                startDate,
                endDate
            );

        const dailyTotals = new Map<string, number>();
        const fileTotals = new Map<string, number>();
        const hourlyMs = Array<number>(24).fill(0);

        let activeMs = 0;
        let added = 0;

        for (const activity of activities) {
            const ms = activity.time?.activeMs ?? 0;

            if (!Number.isFinite(ms) || ms <= 0) {
                continue;
            }

            activeMs += ms;
            added += activity.added.total;

            // 按日期累计
            dailyTotals.set(
                activity.date,
                (dailyTotals.get(activity.date) ?? 0) + ms
            );

            // 按文件累计：本次重点修复位置
            fileTotals.set(
                activity.filePath,
                (fileTotals.get(activity.filePath) ?? 0) + ms
            );

            // 按小时累计
            for (let hour = 0; hour < 24; hour++) {
                hourlyMs[hour] +=
                    activity.time?.hourlyMs[hour] ?? 0;
            }
        }

        // 每日时长：补齐没有记录的日期
        const daily: WritingTimeDay[] = [];

        const cursor = new Date(
            `${startDate}T00:00:00Z`
        );

        const end = new Date(
            `${endDate}T00:00:00Z`
        );

        while (
            cursor <= end &&
            daily.length <= 366
        ) {
            const date =
                cursor.toISOString().slice(0, 10);

            daily.push({
                date,
                activeMs: dailyTotals.get(date) ?? 0
            });

            cursor.setUTCDate(
                cursor.getUTCDate() + 1
            );
        }

        // 文件时长排行：按时长降序
        const files: WritingTimeFile[] =
            Array.from(fileTotals.entries())
                .map(([path, ms]) => ({
                    path,
                    activeMs: ms
                }))
                .sort(
                    (a, b) =>
                        b.activeMs - a.activeMs ||
                        a.path.localeCompare(b.path)
                );

        return {
            startDate,
            endDate,

            activeMs,
            activeDays: dailyTotals.size,

            hourlyMs,
            daily,
            files,

            added,

            charactersPerHour:
                activeMs >= 60_000
                    ? Math.round(
                        added * 3_600_000 / activeMs
                    )
                    : null
        };
    }
}
