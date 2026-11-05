import type { CountResult } from "../domain/CountResult";
import type { DailyFileActivity } from "../domain/DailyFileActivity";
import type { FileSnapshot } from "../domain/FileSnapshot";
import type { StatsRepository } from "../persistence/StatsRepository";
import { diffCounts } from "./CountDiff";
import {
    addCounts,
    createEmptyCount
} from "./CountMath";
import type { WritingTimeDelta } from "./WritingTimeClock";

export class ActivityTracker {
    constructor(
        private readonly repository: StatsRepository
    ) { }

    async ensureBaseline(
        filePath: string,
        modifiedAt: number,
        currentCounts: CountResult
    ): Promise<FileSnapshot> {
        const existing =
            await this.repository.getSnapshot(
                filePath
            );

        if (existing) {
            return existing;
        }

        const snapshot: FileSnapshot = {
            path: filePath,
            modifiedAt,
            counts: currentCounts
        };

        await this.repository.saveSnapshot(
            snapshot
        );

        return snapshot;
    }

    async track(
        date: string,
        filePath: string,
        modifiedAt: number,
        currentCounts: CountResult,
        time?: WritingTimeDelta
    ): Promise<DailyFileActivity> {
        const previousSnapshot = await this.repository.getSnapshot(filePath);

        // 第一次看到这个文件：
        // 只建立基线，不把整个文件算成“今天新增”
        if (!previousSnapshot) {
            const snapshot: FileSnapshot = {
                path: filePath,
                modifiedAt,
                counts: currentCounts
            };

            await this.repository.saveSnapshot(snapshot);

            const existingActivity = await this.repository.getActivity(date, filePath);

            if (existingActivity) {
                if (!time?.activeMs) {
                    return existingActivity;
                }

                const previous = existingActivity.time;

                const updated: DailyFileActivity = {
                    ...existingActivity,
                    time: {
                        activeMs:
                            (previous?.activeMs ?? 0) +
                            time.activeMs,

                        hourlyMs: Array.from(
                            { length: 24 },
                            (_, hour) => 
                                (previous?.hourlyMs[hour] ?? 0) +
                                time.hourlyMs[hour]
                        )
                    }
                };

                await this.repository.saveActivity(updated);

                return updated;
            }

            const activity: DailyFileActivity = {
                date,
                filePath,
                start: currentCounts,
                added: createEmptyCount(),
                deleted: createEmptyCount(),
                net: createEmptyCount(),
                ...(time?.activeMs ? { time } : {})
            };

            await this.repository.saveActivity(activity);

            return activity;
        }

        const delta = diffCounts(
            previousSnapshot.counts,
            currentCounts
        );

        let activity =
            await this.repository.getActivity(
                date,
                filePath
            );

        // 有历史 snapshot，
        // 但今天第一次编辑此文件。
        if (!activity) {
            activity = {
                date,
                filePath,
                start: previousSnapshot.counts,
                added: createEmptyCount(),
                deleted: createEmptyCount(),
                net: createEmptyCount()
            };
        }

        const previousTime = activity.time;

        const updatedTime = time?.activeMs
            ? {
                activeMs: 
                    (previousTime?.activeMs ?? 0) +
                    time.activeMs,
                hourlyMs: Array.from(
                    { length: 24 },
                    (_, hour) => 
                    (previousTime?.hourlyMs[hour] ?? 0) +
                    time?.hourlyMs[hour]
                )
            }
            : previousTime;

        const updatedActivity: DailyFileActivity = {
            ...activity,

            ...(updatedTime ? { time: updatedTime }: {}),

            added: addCounts(
                activity.added,
                delta.added
            ),

            deleted: addCounts(
                activity.deleted,
                delta.deleted
            ),

            net: addCounts(
                activity.net,
                delta.net
            )
        };

        const updatedSnapshot: FileSnapshot = {
            path: filePath,
            modifiedAt,
            counts: currentCounts
        };

        await this.repository.saveTrackingResult(
            updatedSnapshot,
            updatedActivity
        );

        return updatedActivity;
    }

    async getActivity(
        date: string,
        filePath: string
    ): Promise<DailyFileActivity | undefined> {
        return this.repository.getActivity(
            date,
            filePath
        );
    }

    async getSnapshot(
        filePath: string
    ): Promise<FileSnapshot | undefined> {
        return this.repository.getSnapshot(filePath);
    }
}
