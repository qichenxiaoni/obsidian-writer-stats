import type { PluginData } from "src/domain/PluginData";

export interface PluginDataStore {
    load(): Promise<PluginData>;

    save(
        data: PluginData
    ): Promise<void>;
}