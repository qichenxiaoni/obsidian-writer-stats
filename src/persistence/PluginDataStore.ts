import type { PluginData } from "../domain/PluginData";

export interface PluginDataStore {
    load(): Promise<PluginData>;

    save(
        data: PluginData
    ): Promise<void>;
}