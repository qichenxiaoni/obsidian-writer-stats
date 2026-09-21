import type { Plugin } from "obsidian";
import type { DailyStatsService } from "../core/DailyStatsService";
import { getLocalDateKey } from "../utils/DateService";
import { formatStatusBarText, formatStatusBarTooltip } from "./StatusBarFormatter";

const DATE_CHECK_INTERVAL_MS = 60_000;

export class StatusBarController {
    private element: HTMLElement | null = null;

    constructor(
        private readonly plugin: Plugin,
        private readonly statsService: DailyStatsService
    ) { }

    start(): void {
        this.element = this.plugin.addStatusBarItem();
        this.element.addClass("writer-stats-status-bar");
        this.element.textContent = "今日 +0 · 净增0";

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
        date: string = getLocalDateKey()
    ): Promise<void> {
        if (!this.element) {
            return;
        }

        const summary = await this.statsService.getSummary(date);

        this.element.textContent = formatStatusBarText(summary);
        this.element.title = formatStatusBarTooltip(summary);
    }

    stop(): void {
        this.element?.remove();
        this.element = null;
    }
}