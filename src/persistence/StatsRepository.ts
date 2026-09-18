import type { DailyFileActivity } from "src/domain/DailyFileActivity";
import type { FileSnapshot } from "src/domain/FileSnapshot";

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

    deleteFile(
        filePath: string
    ): Promise<void>;
}