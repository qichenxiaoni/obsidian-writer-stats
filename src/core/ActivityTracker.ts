import type { CountResult } from "../domain/CountResult";
import type { DailyFileActivity } from "../domain/DailyFileActivity";
import type { FileSnapshot } from "../domain/FileSnapshot";
import type { StatsRepository } from "src/persistence/StatsRepository";

import { diffCounts } from "./CountDiff";
import {
    addCounts,
    createEmptyCount
} from "./CountMath";

export class ActivityTracker {
    constructor(
        private readonly repository: StatsRepository
    ) {}

    async track(
        date: string,
        filePath: string,
        modifiedAt: number,
        currentCounts: CountResult
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

            const activity: DailyFileActivity = {
                date,
                filePath,
                start: currentCounts,
                added: createEmptyCount(),
                deleted: createEmptyCount(),
                net: createEmptyCount()
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

        const updateActivity: DailyFileActivity = {
            ...activity,

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

        await this.repository.saveActivity(
            updateActivity
        );

        await this.repository.saveSnapshot({
            path: filePath,
            modifiedAt,
            counts: currentCounts
        });

        return updateActivity;
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
