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

export function normalizePluginData(
    value: unknown
): PluginData {
    if (typeof value !== "object" || value === null){
        return createEmptyPluginData();
    }

    const raw = value as Partial<PluginData>;

    return {
        schemaVersion:
            typeof raw.schemaVersion === "number"
                ? raw.schemaVersion
                : CURRENT_SCHEMA_VERSION,
        
        fileSnapshots:
            raw.fileSnapshots &&
            typeof raw.fileSnapshots === "object"
                ? raw.fileSnapshots
                : {},
        
        dailyActivities:
            raw.dailyActivities &&
            typeof raw.dailyActivities === "object"
                ? raw.dailyActivities
                : {}
    };
}