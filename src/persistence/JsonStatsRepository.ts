import type { DailyFileActivity } from
    "../domain/DailyFileActivity";

import type { FileSnapshot } from
    "../domain/FileSnapshot";

import {
    createEmptyPluginData,
    type PluginData
} from "../domain/PluginData";

import type { PluginDataStore } from
    "./PluginDataStore";

import type { StatsRepository } from
    "./StatsRepository";

export class JsonStatsRepository
    implements StatsRepository {
    constructor(
        private readonly store: PluginDataStore
    ) { }

    async getSnapshot(
        filePath: string
    ): Promise<FileSnapshot | undefined> {
        const data = await this.loadData();

        return data.fileSnapshots[filePath];
    }

    async saveSnapshot(
        snapshot: FileSnapshot
    ): Promise<void> {
        const data = await this.loadData();

        data.fileSnapshots[snapshot.path] =
            snapshot;

        await this.store.save(data);
    }

    async getActivity(
        date: string,
        filePath: string
    ): Promise<DailyFileActivity | undefined> {
        const data = await this.loadData();

        return data.dailyActivities[
            this.createActivityKey(
                date,
                filePath
            )
        ];
    }

    async saveActivity(
        activity: DailyFileActivity
    ): Promise<void> {
        const data = await this.loadData();

        data.dailyActivities[
            this.createActivityKey(
                activity.date,
                activity.filePath
            )
        ] = activity;

        await this.store.save(data);
    }

    async getActivitiesForDate(
        date: string
    ): Promise<DailyFileActivity[]> {
        const data = await this.loadData();

        return Object.values(
            data.dailyActivities
        ).filter(
            activity =>
                activity.date === date
        );
    }

    async renameFile(
        oldPath: string,
        newPath: string
    ): Promise<void> {
        const data = await this.loadData();

        const snapshot =
            data.fileSnapshots[oldPath];

        if (snapshot) {
            delete data.fileSnapshots[oldPath];

            data.fileSnapshots[newPath] = {
                ...snapshot,
                path: newPath
            };
        }

        const entries = Object.entries(
            data.dailyActivities
        );

        for (const [key, activity] of entries) {
            if (
                activity.filePath !== oldPath
            ) {
                continue;
            }

            delete data.dailyActivities[key];

            const renamedActivity = {
                ...activity,
                filePath: newPath
            };

            data.dailyActivities[
                this.createActivityKey(
                    renamedActivity.date,
                    newPath
                )
            ] = renamedActivity;
        }

        await this.store.save(data);
    }

    async removeSnapshot(
        filePath: string
    ): Promise<void> {
        const data = await this.loadData();

        delete data.fileSnapshots[filePath];

        await this.store.save(data);
    }

    private async loadData(): Promise<PluginData> {
        const data = await this.store.load();

        return data ??
            createEmptyPluginData();
    }

    private createActivityKey(
        date: string,
        filePath: string
    ): string {
        return `${date}:${filePath}`;
    }

    async saveTrackingResult(
        snapshot: FileSnapshot, 
        activity: DailyFileActivity
    ): Promise<void> {
        const data = await this.loadData();

        data.fileSnapshots[
            snapshot.path
        ] = snapshot;

        data.dailyActivities[
            this.createActivityKey(
                activity.date,
                activity.filePath
            )
        ] = activity;

        await this.store.save(data);
    }
}