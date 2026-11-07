import type { PluginSettings } from "../domain/PluginSettings";
import type { PluginDataStore } from "../persistence/PluginDataStore";
import { PluginDataMutationQueue } from "../persistence/PluginDataMutationQueue";

export class PluginSettingsService {
    private readonly mutations: PluginDataMutationQueue;

    constructor(
        private readonly store:
            PluginDataStore
    ) {
        this.mutations = PluginDataMutationQueue.forStore(store);
    }

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

            let result: PluginSettings | undefined;

            await this.mutations.run(data => {
                // 目标没有变化，不进行磁盘写入
                if (
                    data.settings.dailyGoal === dailyGoal
                ) {
                    result = {
                        ...data.settings
                    };

                    return false;
                }

                data.settings = {
                    ...data.settings,
                    dailyGoal
                };

                result = {
                    ...data.settings
                };

                return true;
            });

            if (!result) {
                throw new Error(
                    "Failed to save daily goal"
                );
            }

            return result;
        }
}