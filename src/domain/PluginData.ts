import type { DailyFileActivity } from "./DailyFileActivity";
import type { FileSnapshot } from "./FileSnapshot";

export interface PluginData {
    schemaVersion: number;

    fileSnapshots: Record<string, FileSnapshot>;

    dailyActivities: Record<string, DailyFileActivity>;
}

export const CURRENT_SCHEMA_VERSION = 1;

export function createEmptyPluginData(): PluginData {
    return {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        fileSnapshots: {},
        dailyActivities: {}
    };
}