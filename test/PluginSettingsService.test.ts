import {
    PluginSettingsService
} from "../src/core/PluginSettingsService";

import {
    createEmptyPluginData
} from "../src/domain/PluginData";

import type {
    PluginData
} from "../src/domain/PluginData";

import type {
    PluginDataStore
} from "../src/persistence/PluginDataStore";


class TestPluginDataStore
    implements PluginDataStore {
    constructor(
        private data:
            PluginData =
            createEmptyPluginData()
    ) { }


    async load():
        Promise<PluginData> {
        return structuredClone(
            this.data
        );
    }


    async save(
        data: PluginData
    ): Promise<void> {
        this.data =
            structuredClone(data);
    }
}


describe(
    "PluginSettingsService",
    () => {
        test(
            "读取默认每日目标",
            async () => {
                const store =
                    new TestPluginDataStore();

                const service =
                    new PluginSettingsService(
                        store
                    );

                const settings =
                    await service.getSettings();

                expect(
                    settings.dailyGoal
                ).toBe(1000);
            }
        );


        test(
            "可以保存每日目标",
            async () => {
                const store =
                    new TestPluginDataStore();

                const service =
                    new PluginSettingsService(
                        store
                    );

                await service.setDailyGoal(
                    1500
                );

                const settings =
                    await service.getSettings();

                expect(
                    settings.dailyGoal
                ).toBe(1500);
            }
        );


        test(
            "拒绝非法每日目标",
            async () => {
                const store =
                    new TestPluginDataStore();

                const service =
                    new PluginSettingsService(
                        store
                    );

                await expect(
                    service.setDailyGoal(0)
                ).rejects.toThrow(
                    RangeError
                );

                const settings =
                    await service.getSettings();

                expect(
                    settings.dailyGoal
                ).toBe(1000);
            }
        );
    }
);