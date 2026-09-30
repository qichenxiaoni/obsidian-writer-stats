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

        /*
         * 第一步：
         * 先把实际存在的 activity
         * 按日期聚合。
         */
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


        /*
         * 第二步：
         * 不再只遍历 entries。
         *
         * 而是遍历 startDate ~ endDate
         * 之间的每一天。
         */
        const dates =
            this.getDatesBetween(
                startDate,
                endDate
            );


        return dates.map(
            date => {
                const entry =
                    entries.get(date);

                /*
                 * 当天没有任何 activity：
                 * 主动返回一条全 0 数据。
                 */
                if (!entry) {
                    return {
                        date,
                        added: 0,
                        deleted: 0,
                        net: 0,
                        activeFiles: 0
                    };
                }

                return {
                    date,

                    added:
                        entry.added,

                    deleted:
                        entry.deleted,

                    net:
                        entry.net,

                    activeFiles:
                        entry.files.size
                };
            }
        );
    }


    /**
     * 返回包含 startDate 和 endDate
     * 在内的全部日期。
     *
     * 例如：
     *
     * 2026-09-28
     * 2026-09-29
     * 2026-09-30
     */
    private getDatesBetween(
        startDate: string,
        endDate: string
    ): string[] {
        const dates: string[] = [];

        const current =
            this.parseDate(
                startDate
            );

        const end =
            this.parseDate(
                endDate
            );


        while (
            current.getTime() <=
            end.getTime()
        ) {
            dates.push(
                this.formatDate(
                    current
                )
            );

            /*
             * 使用 UTC 增加一天，
             * 避免夏令时导致
             * 23 / 25 小时日期问题。
             */
            current.setUTCDate(
                current.getUTCDate() + 1
            );
        }


        return dates;
    }


    private parseDate(
        date: string
    ): Date {
        const [
            year,
            month,
            day
        ] = date
            .split("-")
            .map(Number);

        return new Date(
            Date.UTC(
                year,
                month - 1,
                day
            )
        );
    }


    private formatDate(
        date: Date
    ): string {
        const year =
            date.getUTCFullYear();

        const month =
            String(
                date.getUTCMonth() + 1
            ).padStart(
                2,
                "0"
            );

        const day =
            String(
                date.getUTCDate()
            ).padStart(
                2,
                "0"
            );

        return (
            `${year}-${month}-${day}`
        );
    }

    async getActiveDays(
        startDate: string,
        endDate: string
    ): Promise<number> {
        const history =
            await this.getHistory(
                startDate,
                endDate
            );

        return history.filter(
            entry =>
                entry.added > 0 ||
                entry.deleted > 0
        ).length;
    }

    async getWritingStreak(
        startDate: string,
        endDate: string
    ): Promise<number> {
        const history =
            await this.getHistory(
                startDate,
                endDate
            );

        let streak = 0;

        /*
        * getHistory() 已经保证：
        *
        * 1. 日期是连续的
        * 2. 没有活动的日期会补成 0
        * 3. 日期按照从早到晚排列
        *
        * 所以这里只需要从最后一天
        * 向前检查即可。
        */

        for (
            let index = history.length -1;
            index >= 0;
            index--
        ) {
            const entry =
                history[index];

            // added > 0

            if (entry.added <= 0){
                break;
            }

            streak++;
        }

        return streak;
    }
}