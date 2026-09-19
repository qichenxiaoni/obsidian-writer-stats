import type { Plugin } from "obsidian";

import {
    normalizePluginData,
    type PluginData
} from "../domain/PluginData";

import type { PluginDataStore } from
    "./PluginDataStore";

export class ObsidianPluginDataStore
    implements PluginDataStore {
    constructor(
        private readonly plugin: Plugin
    ) { }

    async load(): Promise<PluginData> {
        const raw =
            await this.plugin.loadData();

        return normalizePluginData(raw);
    }

    async save(
        data: PluginData
    ): Promise<void> {
        await this.plugin.saveData(data);
    }
}