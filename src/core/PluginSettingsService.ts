import type { PluginSettings } from "../domain/PluginSettings";
import type { PluginDataStore } from "../persistence/PluginDataStore";

export class PluginSettingsService {
    constructor(
        private readonly store:
            PluginDataStore
    ) {}

    async getSettings():
        Promise<PluginSettings> {
            const data =
                await this.store.load();

            return {
                ...data.settings
            };
        }

        async setDailyGoal(
            dailyGoal: number
        ): Promise<PluginSettings> {
            if (
                !Number.isInteger(dailyGoal) ||
                dailyGoal <= 0
            ) {
                throw new RangeError(
                    "dailyGoal must be a positive integer"
                );
            }

            const data =
                await this.store.load();

            // 没变化时不重复写磁盘
            if (
                data.settings.dailyGoal ===
                dailyGoal
            ) {
                return {
                    ...data.settings
                };
            }

            const settings:
                PluginSettings = {
                    ...data.settings,
                    dailyGoal
                };

            data.settings = settings;

            await this.store.save(data);

            return {
                ...settings
            };
        }
}