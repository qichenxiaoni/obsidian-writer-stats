import { Notice, Plugin } from "obsidian";
import { ActivityTracker } from "./core/ActivityTracker";
import { JsonStatsRepository } from "./persistence/JsonStatsRepository";
import { ObsidianPluginDataStore } from "./persistence/ObsidianPluginDataStore";
import { TextAnalyzer } from "./core/TextAnalyzer";
import { EditorEventController } from "./events/EditorEventController";
import { VaultEventController } from "./events/VaultEventController";
import type { StatsRepository } from "./persistence/StatsRepository";
import { DailyStatsService } from "./core/DailyStatsService";
import { StatusBarController } from "./ui/StatusBarController";

export default class WordCountPlugin extends Plugin {
    private activityTracker!: ActivityTracker;
    private editorEvents!: EditorEventController;
    private repository!: StatsRepository;
    private vaultEvents!: VaultEventController;
    private dailyStatsService!: DailyStatsService;
    private statusBar!: StatusBarController;

    async onload(): Promise<void> {
        console.log("Word Count Plugin v1 loaded");

        const dataStore = new ObsidianPluginDataStore(this);
        
        this.repository = new JsonStatsRepository(dataStore);
        this.activityTracker = new ActivityTracker(this.repository);
        this.dailyStatsService = new DailyStatsService(this.repository);
        this.statusBar = new StatusBarController(this,this.dailyStatsService);
        this.statusBar.start();

        const analyze = new TextAnalyzer();

        // this.editorEvents = new EditorEventController(this,analyze,this.activityTracker);
        this.editorEvents = new EditorEventController(
            this,
            analyze,
            this.activityTracker,

            async date => {
                await this.statusBar.refresh(
                    date
                ); 
            }
        )
        this.editorEvents.start();

        this.vaultEvents = new VaultEventController(this,this.repository);
        this.vaultEvents.start();

        this.addCommand({
            id: "show-word-count-test-nitice",
            name: "测试插件是否正常运行",
            callback: () => {
                new Notice("Word Count Plugin V1 运行正常");
            }
        });

        this.addCommand({
            id: "test-stats-persistence",
            name: "测试统计数据持久化",
            callback: async () => {
                const snapshot = await this.activityTracker.getSnapshot("__test__.md");

                new Notice(
                    snapshot
                        ? `测试数据存在: ${snapshot.counts.total}`
                        : "当前没有测试统计数据"
                );
            }
        });
    }

    onunload(): void {
        this.editorEvents?.stop();
        this.statusBar?.stop();

        console.log("Word Count Plugin v1 unloaded");
    }
}