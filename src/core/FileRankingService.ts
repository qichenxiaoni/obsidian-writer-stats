
import type { StatsRepository } from "../persistence/StatsRepository";

export type FileRankingSort = "added" | "net" | "deleted";

export interface FileRankingEntry {
    filePath: string;
    added: number;
    deleted: number;
    net: number;
    activeDays: number;
}

export interface FileRankingSummary {
    startDate: string;
    endDate: string;
    totalFiles: number;
    files: FileRankingEntry[];
}

/**
 * 按文件路径聚合日期范围内的写作活动。
 * 与 DailyHistoryService 使用同一份持久化活动记录。
 */
export class FileRankingService {
    constructor(
        private readonly repository:
            Pick<StatsRepository, "getActivitiesBetween">
    ) { }

    async getRanking(
        startDate: string,
        endDate: string
    ): Promise<FileRankingSummary> {
        if (startDate > endDate) {
            throw new RangeError("文件排行榜开始日期不能晚于结束日期");
        }

        const activities = await this.repository.getActivitiesBetween(
            startDate,
            endDate
        );

        const grouped = new Map<string, {
            added: number;
            deleted: number;
            net: number;
            dates: Set<string>;
        }>();

        for (const activity of activities) {
            const added = activity.added.total;
            const deleted = activity.deleted.total;

            // 只有新增或删除才构成活跃文件。
            if (added <= 0 && deleted <= 0) continue;

            const row = grouped.get(activity.filePath) ?? {
                added: 0,
                deleted: 0,
                net: 0,
                dates: new Set<string>()
            };

            row.added += added;
            row.deleted += deleted;
            row.net += activity.net.total;
            row.dates.add(activity.date);
            grouped.set(activity.filePath, row);
        }

        const files: FileRankingEntry[] = [...grouped].map(
            ([filePath, row]) => ({
                filePath,
                added: row.added,
                deleted: row.deleted,
                net: row.net,
                activeDays: row.dates.size
            })
        );

        return {
            startDate,
            endDate,
            totalFiles: files.length,
            files
        };
    }
}

/** 排序不修改源数组；并列时按新增量、文件路径稳定排序。 */
export function sortFileRanking(
    files: readonly FileRankingEntry[],
    sort: FileRankingSort
): FileRankingEntry[] {
    return [...files].sort((a, b) => {
        const primary = b[sort] - a[sort];
        if (primary !== 0) return primary;
        const added = b.added - a.added;
        if (added !== 0) return added;
        return a.filePath.localeCompare(b.filePath, "zh-CN");
    });
}
