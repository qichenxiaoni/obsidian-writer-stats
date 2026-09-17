import type { CountResult } from "../domain/CountResult";
import type { DailyFileActivity } from "../domain/DailyFileActivity";
import type { FileSnapshot } from "../domain/FileSnapshot";

import { diffCounts } from "./CountDiff";
import {
    addCounts,
    createEmptyCount
} from "./CountMath";

export class ActivityTracker {
    private readonly snapshots = new Map<string, FileSnapshot>();

    private readonly activities =
        new Map<string, DailyFileActivity>();

    track(
        date: string,
        filePath: string,
        modifiedAt: number,
        currentCounts: CountResult
    ): DailyFileActivity {
        const snapshotKey = filePath;
        const activityKey = this.createActivityKey(
            date,
            filePath
        );

        const previousSnapshot =
            this.snapshots.get(snapshotKey);

        // 第一次看到这个文件：
        // 只建立基线，不把整个文件算成“今天新增”
        if (!previousSnapshot) {
            const snapshot: FileSnapshot = {
                path: filePath,
                modifiedAt,
                counts: currentCounts
            };

            this.snapshots.set(
                snapshotKey,
                snapshot
            );

            const activity: DailyFileActivity = {
                date,
                filePath,
                start: currentCounts,

                added: createEmptyCount(),
                deleted: createEmptyCount(),
                net: createEmptyCount()
            };

            this.activities.set(
                activityKey,
                activity
            );

            return activity;
        }

        const delta = diffCounts(
            previousSnapshot.counts,
            currentCounts
        );

        let activity =
            this.activities.get(activityKey);

        // 文件之前就有 snapshot，
        // 但今天第一次发生编辑
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

        const updatedActivity: DailyFileActivity = {
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

        this.activities.set(
            activityKey,
            updatedActivity
        );

        this.snapshots.set(snapshotKey, {
            path: filePath,
            modifiedAt,
            counts: currentCounts
        });

        return updatedActivity;
    }

    getActivity(
        date: string,
        filePath: string
    ): DailyFileActivity | undefined {
        return this.activities.get(
            this.createActivityKey(date, filePath)
        );
    }

    getSnapshot(
        filePath: string
    ): FileSnapshot | undefined {
        return this.snapshots.get(filePath);
    }

    private createActivityKey(
        date: string,
        filePath: string
    ): string {
        return `${date}:${filePath}`;
    }
}