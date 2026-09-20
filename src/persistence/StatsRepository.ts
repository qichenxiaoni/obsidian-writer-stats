import type { DailyFileActivity } from "../domain/DailyFileActivity";
import type { FileSnapshot } from "../domain/FileSnapshot";

export interface StatsRepository {
    getSnapshot(
        filePath: string
    ): Promise<FileSnapshot | undefined>;

    saveSnapshot(
        snapshot: FileSnapshot
    ): Promise<void>;

    getActivity(
        date: string,
        filePath: string
    ): Promise<DailyFileActivity | undefined>;

    saveActivity(
        activity: DailyFileActivity
    ): Promise<void>;

    getActivitiesForDate(
        date: string
    ): Promise<DailyFileActivity[]>;

    renameFile(
        oldPath: string,
        newPath: string,
    ): Promise<void>;

    removeSnapshot(
        filePath: string
    ): Promise<void>;

    saveTrackingResult(
        snapshot: FileSnapshot,
        activity: DailyFileActivity
    ): Promise<void>;
}