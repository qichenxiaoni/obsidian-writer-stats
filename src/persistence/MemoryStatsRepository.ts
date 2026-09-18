import type { DailyFileActivity } from "src/domain/DailyFileActivity";
import type { FileSnapshot } from "src/domain/FileSnapshot";
import type { StatsRepository } from "./StatsRepository";

export class MemoryStatsRepository implements StatsRepository {
    private readonly snapshots = new Map<string, FileSnapshot>();

    private readonly activities = new Map<string, DailyFileActivity>();

    async getSnapshot(filePath: string): Promise<FileSnapshot | undefined> {
        return this.snapshots.get(filePath);
    }

    async saveSnapshot(snapshot: FileSnapshot): Promise<void> {
        this.snapshots.set(
            snapshot.path,
            snapshot
        );
    }

    async getActivity(date: string, filePath: string): Promise<DailyFileActivity | undefined> {
        return this.activities.get(
            this.createActivityKey(date, filePath)
        );
    }

    async saveActivity(activity: DailyFileActivity): Promise<void> {
        this.activities.set(
            this.createActivityKey(
                activity.date,
                activity.filePath
            ),
            activity
        );
    }

    async getActivitiesForDate(date: string): Promise<DailyFileActivity[]> {
        return Array.from(
            this.activities.values()
        ).filter(
            activity => activity.date === date
        );
    }

    async renameFile(oldPath: string, newPath: string): Promise<void> {
        const snapshot = this.snapshots.get(oldPath);

        if (snapshot) {
            this.snapshots.delete(oldPath);
            
            this.snapshots.set(
                newPath,
                {
                    ...snapshot,
                    path: newPath
                }
            );
        }

        const affected = Array.from(this.activities.values()).filter(
            activity => activity.filePath === oldPath
        );

        for (const activity of affected) {
            this.activities.delete(
                this.createActivityKey(
                    activity.date,
                    oldPath
                )
            );

            const renameActivity = {
                ...activity,
                filepath: newPath
            };

            this.activities.set(
                this.createActivityKey(
                    renameActivity.date,
                    newPath
                ),
                renameActivity
            );
        }
    }

    async deleteFile(filePath: string): Promise<void> {
        this.snapshots.delete(filePath);

        for (
            const [key , activity]
            of this.activities.entries()
        ){
            if (activity.filePath === filePath) {
                this.activities.delete(key);
            }
        }
    }

    private createActivityKey(
        date: string,
        filePath: string
    ): string {
        return `${date}:${filePath}`;
    }
}