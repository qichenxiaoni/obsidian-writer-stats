import { Notice, Plugin } from "obsidian";
import { ActivityTracker } from "./core/ActivityTracker";
import { JsonStatsRepository } from "./persistence/JsonStatsRepository";
import { ObsidianPluginDataStore } from "./persistence/ObsidianPluginDataStore";
import { BackupGuardedDataStore } from "./persistence/BackupGuardedDataStore";
import { BackupVaultService } from "./ui/BackupVaultService";
import { WriterStatsBackupModal } from "./ui/WriterStatsBackupModal";
import { TextAnalyzer } from "./core/TextAnalyzer";
import { EditorEventController } from "./events/EditorEventController";
import { VaultEventController } from "./events/VaultEventController";
import type { StatsRepository } from "./persistence/StatsRepository";
import { DailyStatsService } from "./core/DailyStatsService";
import { StatusBarController } from "./ui/StatusBarController";
import { StatisticsModal } from "./ui/StatisticsModal";
import { PluginSettingsService } from "./core/PluginSettingsService";
import { WriterStatsSettingTab } from "./ui/WriterStatsSettingTab";
import { GoalService } from "./core/GoalService";
import { DailyOverviewService } from "./core/DailyOverviewService";
import { DailyHistoryService } from "./core/DailyHistoryService";
import { FileRankingService } from "./core/FileRankingService";
import { FileWritingDetailService } from "./core/FileWritingDetailService";
import { MonthlyCsvExportService } from "./core/MonthlyCsvExportService";
import { WRITER_STATS_VIEW_TYPE, WriterStatsView } from "./ui/WriterStatsView";

export default class WordCountPlugin extends Plugin {
    private backupVaultService!: BackupVaultService;
    private activityTracker!: ActivityTracker;
    private editorEvents!: EditorEventController;
    private repository!: StatsRepository;
    private vaultEvents!: VaultEventController;
    private dailyStatsService!: DailyStatsService;
    private fileRankingService!: FileRankingService;
    private fileWritingDetailService!: FileWritingDetailService;
    private monthlyCsvExportService!: MonthlyCsvExportService;
    private statusBar!: StatusBarController;
    private settingsService!: PluginSettingsService;
    private goalService!: GoalService;
    private dailyOverviewService!: DailyOverviewService;
    private dailyHistoryService!: DailyHistoryService;

    async onload(): Promise<void> {
        console.log("Word Count Plugin v1 loaded");

        const dataStore = new BackupGuardedDataStore(
            new ObsidianPluginDataStore(this)
        );

        this.backupVaultService =
            new BackupVaultService(
                this.app,
                dataStore
            );

        this.settingsService =
            new PluginSettingsService(
                dataStore
            );

        this.repository = new JsonStatsRepository(dataStore);
        this.activityTracker = new ActivityTracker(this.repository);
        this.dailyStatsService = new DailyStatsService(this.repository);
        this.goalService = new GoalService();
        this.dailyOverviewService =
            new DailyOverviewService(
                this.dailyStatsService,
                this.settingsService,
                this.goalService
            );
        this.dailyHistoryService = new DailyHistoryService(this.repository);
        this.fileRankingService = new FileRankingService(this.repository);
        this.fileWritingDetailService = new FileWritingDetailService(this.repository);
        this.monthlyCsvExportService = new MonthlyCsvExportService(this.repository);
        this.statusBar = new StatusBarController(this, this.dailyOverviewService, () => {
            new StatisticsModal(
                this.app,
                this.dailyStatsService,
                this.dailyOverviewService,
                this.dailyHistoryService
            ).open();
        });
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

                await this.refreshWriterStatsDashboard();
            }
        )
        this.editorEvents.start();

        this.vaultEvents = new VaultEventController(this, this.repository);
        this.vaultEvents.start();

        this.registerView(
            WRITER_STATS_VIEW_TYPE,

            leaf =>
                new WriterStatsView(
                    leaf,
                    this.dailyOverviewService,
                    this.dailyHistoryService,
                    this.fileRankingService,
                    this.fileWritingDetailService,
                    this.monthlyCsvExportService
                )
        );

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

        this.addCommand({
            id: "open-daily-writing-statistics",
            name: "打开今日写作统计",

            callback: () => {
                new StatisticsModal(
                    this.app,
                    this.dailyStatsService,
                    this.dailyOverviewService,
                    this.dailyHistoryService
                ).open();
            }
        });

        this.addCommand({
            id:
                "open-writer-stats-dashboard",

            name:
                "打开 Writer Stats Dashboard",

            callback:
                async () => {
                    await this.openWriterStatsDashboard();
                }
        });

        this.addRibbonIcon(
            "bar-chart-3",
            "打开 Writer Stats Dashboard",
            async () => {
                await this.openWriterStatsDashboard();
            }
        );

        this.addCommand({
            id: "open-writer-stats-backups",
            name: "打开统计数据备份与恢复",

            callback: () => {
                new WriterStatsBackupModal(
                    this.app,
                    this.backupVaultService
                ).open();
            }
        });


        this.addSettingTab(
            new WriterStatsSettingTab(
                this.app,
                this,
                this.settingsService,

                async () => {
                    await this.statusBar.refresh();

                    await this.refreshWriterStatsDashboard();
                },

                () => {
                    new WriterStatsBackupModal(
                        this.app,
                        this.backupVaultService
                    ).open();
                }
            )
        );

    }

    private async openWriterStatsDashboard(): Promise<void> {
        const existingLeaves =
            this.app.workspace
                .getLeavesOfType(
                    WRITER_STATS_VIEW_TYPE
                );

        if (
            existingLeaves.length > 0
        ) {
            await this.app.workspace
                .revealLeaf(
                    existingLeaves[0]
                );

            return;
        }

        const leaf =
            this.app.workspace
                .getLeaf(
                    "tab"
                );

        await leaf.setViewState({
            type:
                WRITER_STATS_VIEW_TYPE,

            active:
                true
        });

        await this.app.workspace
            .revealLeaf(
                leaf
            );
    }

    private async refreshWriterStatsDashboard():
        Promise<void> {
        const leaves =
            this.app.workspace
                .getLeavesOfType(
                    WRITER_STATS_VIEW_TYPE
                );

        for (const leaf of leaves) {
            const view =
                leaf.view;

            if (
                view instanceof
                WriterStatsView
            ) {
                await view.refresh();
            }
        }
    }

    onunload(): void {

        this.app.workspace
            .detachLeavesOfType(
                WRITER_STATS_VIEW_TYPE
            );
        this.editorEvents?.stop();
        this.statusBar?.stop();

        console.log("Word Count Plugin v1 unloaded");
    }
}