import type { Plugin } from "obsidian";
import type { DailyOverviewService } from "../core/DailyOverviewService";
import { getLocalDateKey } from "../utils/DateService";
import { formatGoalStatusBarText, formatGoalStatusBarTooltip } from "./StatusBarFormatter";

const DATE_CHECK_INTERVAL_MS = 60_000;

export class StatusBarController {
    private element: HTMLElement | null = null;

    constructor(
        private readonly plugin: Plugin,
        private readonly overviewService: DailyOverviewService,

        private readonly onClick?:
            () => void
    ) { }

    start(): void {
        this.element = this.plugin.addStatusBarItem();
        this.element.addClass("writer-stats-status-bar");
        this.element.setAttr(
            "data-tooltip-position",
            "top"
        );
        this.element.setAttr(
            "data-tooltip-delay",
            "200"
        );

        if (this.onClick) {
            this.element.addClass(
                "wirter-stats-status-bar--clickable"
            );

            this.plugin.registerDomEvent(
                this.element,
                "click",
                () => {
                    this.onClick?.();
                }
            );
        }

        this.element.textContent = "今日 +0 / 0 · 0%";

        void this.refresh();

        // 防止 Obsidian 跨午夜一直不关闭时，状态栏还显示前一天数据。
        this.plugin.registerInterval(
            window.setInterval(() => {
                void this.refresh();
            },
                DATE_CHECK_INTERVAL_MS
            )
        );
    }

    async refresh(
        date: string =
            getLocalDateKey()
    ): Promise<void> {
        if (!this.element) {
            return;
        }

        const overview =
            await this.overviewService
                .getOverview(date);

        const tooltip =
            formatGoalStatusBarTooltip(
                overview
            );

        this.element.textContent =
            formatGoalStatusBarText(
                overview
            );

        // this.element.title =
        //     formatGoalStatusBarTooltip(
        //         overview
        //     );

        // 使用 Obsidian 自己的 tooltip 机制
        this.element.setAttr(
            "aria-label",
            tooltip
        );

        this.element.setAttr(
            "data-tooltip-position",
            "top"
        );

        this.element.setAttr(
            "data-tooltip-delay",
            "200"
        );

        // 防止 native title 与 obsidian tooltip 重复
        this.element.setAttr(
            "title",
            null
        );
    }

    stop(): void {
        this.element?.remove();
        this.element = null;
    }
}