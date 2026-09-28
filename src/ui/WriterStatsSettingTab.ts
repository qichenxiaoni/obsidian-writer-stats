import {
    App,
    Notice,
    Plugin,
    PluginSettingTab,
    Setting
} from "obsidian";

import type {
    PluginSettingsService
} from "../core/PluginSettingsService";

export class WriterStatsSettingTab
    extends PluginSettingTab {
    constructor(
        app: App,
        plugin: Plugin,

        private readonly settingsService:
            PluginSettingsService,

        private readonly onSettingsChanged?:
            () => Promise<void> | void
    ) {
        super(
            app,
            plugin
        );
    }

    display(): void {
        void this.render();
    }

    private async render():
        Promise<void> {
        const {
            containerEl
        } = this;

        containerEl.empty();

        containerEl.createEl(
            "h2",
            {
                text:
                    "Writer Stats"
            }
        );

        const settings =
            await this.settingsService
                .getSettings();

        new Setting(containerEl)
            .setName(
                "每日写作目标"
            )
            .setDesc(
                "每天希望完成的新增字数，目标进度按照“新增”字数计算，而不是净增长。"
            )
            .addText(text => {
                text
                    .setPlaceholder(
                        "1000"
                    )
                    .setValue(
                        String(
                            settings.dailyGoal
                        )
                    );

                // 使用真正的数字输入框
                text.inputEl.type =
                    "number";

                text.inputEl.min = "1";

                text.inputEl.step = "100";

                // 使用 change 而不是每次输入都保存，只有用户完成编辑并离开输入框后才持久化
                text.inputEl
                    .addEventListener(
                        "change",
                        () => {
                            void this.saveDailyGoal(
                                text.getValue(),
                                text.inputEl
                            );
                        }
                    );
            });
    }

    private async saveDailyGoal(
        rawValue: string,
        input:
            HTMLInputElement
    ): Promise<void> {
        const value = 
            Number(
                rawValue.trim()
            );

        if (
            !Number.isInteger(value) ||
            value <= 0
        ) {
            const current =
                await this.settingsService
                    .getSettings();

            input.value = 
                String(
                    current.dailyGoal
                );

            new Notice(
                "每日写作目标必须是大于 0 的整数"
            );

            return;
        }

        const settings = 
            await this.settingsService
                .setDailyGoal(value);

        await this.onSettingsChanged?.();

        input.value = 
            String(
                settings.dailyGoal
            );

        new Notice(
            `每日写作目标已更新为 ${settings.dailyGoal}`
        );
    }
}