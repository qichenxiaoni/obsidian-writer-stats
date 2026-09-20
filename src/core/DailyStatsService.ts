import type { CountResult } from "../domain/CountResult";
import type { DailySummary } from "../domain/DailySummary";
import type { DailyFileActivity } from "../domain/DailyFileActivity";
import type { StatsRepository } from "../persistence/StatsRepository";

import {
    addCounts,
    createEmptyCount
} from "./CountMath";

export class DailyStatsService {
    constructor(
        private readonly repository: StatsRepository
    ) { }

    async getSummary(
        date: string
    ): Promise<DailySummary> {
        const activities =
            await this.repository.getActivitiesForDate(
                date
            );

        let added = createEmptyCount();
        let deleted = createEmptyCount();
        let net = createEmptyCount();

        let activeFiles = 0;

        for (const activity of activities) {
            added = addCounts(
                added,
                activity.added
            );

            deleted = addCounts(
                deleted,
                activity.deleted
            );

            net = addCounts(
                net,
                activity.net
            );

            if (this.hasActivity(activity)) {
                activeFiles++;
            }
        }

        return {
            date,
            added,
            deleted,
            net,
            activeFiles
        };
    }

    private hasActivity(
        activity: DailyFileActivity
    ): boolean {
        return (
            this.hasNonZeroValue(activity.added) ||
            this.hasNonZeroValue(activity.deleted)
        );
    }

    private hasNonZeroValue(
        counts: CountResult
    ): boolean {
        return Object.values(counts)
            .some(value => value !== 0);
    }
}