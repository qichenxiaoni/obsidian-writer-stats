import { Notice, Plugin } from "obsidian";
import { ActivityTracker } from "./core/ActivityTracker";
import { JsonStatsRepository } from "./persistence/JsonStatsRepository";
import { ObsidianPluginDataStore } from "./persistence/ObsidianPluginDataStore";
import { TextAnalyzer } from "./core/TextAnalyzer";
import { EditorEventController } from "./events/EditorEventController";

export default class WordCountPlugin extends Plugin {
    private activityTracker!: ActivityTracker;
    private editorEvents!: EditorEventController;

    async onload(): Promise<void> {
        console.log("Word Count Plugin v1 loaded");

        const dataStore = new ObsidianPluginDataStore(this);
        const repository = new JsonStatsRepository(dataStore);

        this.activityTracker = new ActivityTracker(repository);

        const analyze = new TextAnalyzer();

        this.editorEvents = new EditorEventController(this,analyze,this.activityTracker);
        this.editorEvents.start();

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
        
        console.log("Word Count Plugin v1 unloaded");
    }
}