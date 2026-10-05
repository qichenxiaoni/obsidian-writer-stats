import { 
    ItemView,
    WorkspaceLeaf
 } from "obsidian";

 export const WRITER_STATS_VIEW_TYPE =
    "writer-stats-dashboard";

export class WriterStatsView extends ItemView {
    constructor(
        leaf: WorkspaceLeaf
    ) {
        super(leaf);
    }

    getViewType(): string {
        return WRITER_STATS_VIEW_TYPE;
    }

    getDisplayText(): string {
        return "Writer Stats";
    }

    getIcon(): string {
        return "bar-chart-3";
    }

    async onOpen(): Promise<void> {
        const container =
            this.containerEl.children[1];

        container.empty();

        container.addClass(
            "writer-stats-dashboard"
        );

        // Header

        const header =
            container.createDiv({
                cls:
                    "writer-stats-dashboard__header"
            });

        const titleGroup = 
            header.createDiv({
                cls:
                    "writer-stats-dashboard__title-group"
            });

        titleGroup.createEl(
            "h1",
            {
                cls:
                    "writer-stats-dashboard__title",

                text:
                    "Writer Stats"
            }
        );

        titleGroup.createDiv({
            cls:
                "writer-stats-dashboard__subtitle",

            text:
                "写作数据概览"
        });

        // Content

        const content =
            container.createDiv({
                cls:
                    "writer-stats-dashboard__content"
            });

        /*
        * 这一轮先只建立 Dashboard
        * 的正式布局容器。
        *
        * 后续：
        *
        * overview
        * trend
        * heatmap
        * monthly
        * ranking
        *
        * 都放在这里。
        */ 

        const welcome =
            content.createDiv({
                cls:
                    "writer-stats-dashboard__welcome"
            });

        welcome.createEl(
            "h2",
            {
                text:
                    "写作统计"
            }
        );

        welcome.createEl(
            "p",
            {
                text:
                    "Dashboard 已准备就绪。后续的长期趋势、月度统计和文件排行榜将在这里展示。"
            }
        );
    }

    async onClose(): Promise<void> {
        /*
     * 当前没有需要手动释放的资源。
     *
     * 后续加入事件监听器、
     * ResizeObserver 等以后，
     * 再统一在这里释放。
     */
    }
}