import type { DailyFileActivity } from "../domain/DailyFileActivity";

import type { FileSnapshot } from "../domain/FileSnapshot";

import {
    createEmptyPluginData,
    type PluginData
} from "../domain/PluginData";

import type { PluginDataStore } from "./PluginDataStore";

import type { StatsRepository } from "./StatsRepository";

import { PluginDataMutationQueue } from "./PluginDataMutationQueue";

export class JsonStatsRepository
    implements StatsRepository {

    private readonly mutations:
        PluginDataMutationQueue;

    constructor(
        private readonly store: PluginDataStore
    ) {
        this.mutations = PluginDataMutationQueue.forStore(store);
    }

    async getSnapshot(
        filePath: string
    ): Promise<FileSnapshot | undefined> {
        const data = await this.loadData();

        return data.fileSnapshots[filePath];
    }

    async saveSnapshot(
        snapshot: FileSnapshot
    ): Promise<void> {
        await this.mutations.run(data => {
            data.fileSnapshots[snapshot.path] = snapshot;
        });
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
        await this.mutations.run(data => {
            data.dailyActivities[
                this.createActivityKey(
                    activity.date,
                    activity.filePath
                )
            ] = activity;
        });
    }

    async getActivitiesForDate(
        date: string
    ): Promise<DailyFileActivity[]> {
        const data = await this.loadData();

        return Object.values(
            data.dailyActivities
        ).filter(
            activity => activity.date === date
        );
    }

    async renameFile(
        oldPath: string,
        newPath: string
    ): Promise<void> {
        await this.mutations.run(data => {
            const snapshot =
                data.fileSnapshots[oldPath];

            if (snapshot) {
                delete data.fileSnapshots[oldPath];

                data.fileSnapshots[newPath] = {
                    ...snapshot,
                    path: newPath
                };
            }

            for (const [key, activity] of Object.entries(data.dailyActivities)) {
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
        })
    }

    async removeSnapshot(
        filePath: string
    ): Promise<void> {
        await this.mutations.run(data => {
            delete data.fileSnapshots[filePath];
        });
    }

    async saveTrackingResult(
        snapshot: FileSnapshot,
        activity: DailyFileActivity
    ): Promise<void> {
        await this.mutations.run(data => {
            data.fileSnapshots[
                snapshot.path
            ] = snapshot;

            data.dailyActivities[
                this.createActivityKey(
                    activity.date,
                    activity.filePath
                )
            ] = activity;
        })
    }

    async getActivitiesBetween(
        startDate: string,
        endDate: string
    ): Promise<DailyFileActivity[]> {
        const data = await this.loadData();

        return Object.values(
            data.dailyActivities
        ).filter(
            activity =>
                activity.date >= startDate &&
                activity.date <= endDate
        );
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
}