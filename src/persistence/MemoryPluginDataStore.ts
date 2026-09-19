import {
    createEmptyPluginData,
    type PluginData
} from "../domain/PluginData";

import type { PluginDataStore } from "./PluginDataStore";

export class MemoryPluginDataStore implements PluginDataStore {
    private data: PluginData;

    constructor(
        initialData?: PluginData
    ) {
        this.data = initialData ?? createEmptyPluginData();
    }

    async load(): Promise<PluginData> {
        return structuredClone(this.data);
    }

    async save(data: PluginData): Promise<void> {
        this.data = structuredClone(data);
    }
}