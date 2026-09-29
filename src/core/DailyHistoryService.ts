import type {
    DailyHistoryEntry
} from "../domain/DailyHistoryEntry";

import type {
    StatsRepository
} from "../persistence/StatsRepository";


export class DailyHistoryService {
    constructor(
        private readonly repository:
            StatsRepository
    ) { }


    async getHistory(
        startDate: string,
        endDate: string
    ): Promise<DailyHistoryEntry[]> {
        const activities =
            await this.repository
                .getActivitiesBetween(
                    startDate,
                    endDate
                );

        const entries =
            new Map<
                string,
                {
                    added: number;
                    deleted: number;
                    net: number;
                    files: Set<string>;
                }
            >();


        for (const activity of activities) {
            let entry =
                entries.get(
                    activity.date
                );

            if (!entry) {
                entry = {
                    added: 0,
                    deleted: 0,
                    net: 0,
                    files:
                        new Set<string>()
                };

                entries.set(
                    activity.date,
                    entry
                );
            }

            entry.added +=
                activity.added.total;

            entry.deleted +=
                activity.deleted.total;

            entry.net +=
                activity.net.total;

            entry.files.add(
                activity.filePath
            );
        }


        return Array.from(
            entries.entries()
        )
            .map(
                ([
                    date,
                    entry
                ]): DailyHistoryEntry => ({
                    date,

                    added:
                        entry.added,

                    deleted:
                        entry.deleted,

                    net:
                        entry.net,

                    activeFiles:
                        entry.files.size
                })
            )
            .sort(
                (a, b) =>
                    a.date.localeCompare(
                        b.date
                    )
            );
    }
}