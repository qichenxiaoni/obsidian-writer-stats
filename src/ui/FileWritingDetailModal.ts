import { App, Modal, TFile } from "obsidian";

import type {
    FileWritingDetail,
    FileWritingDay,
    FileWritingDetailService
} from "../core/FileWritingDetailService";

function signed(value: number): string {
    return value > 0 ? `+${value}` : String(value);
}

/**
 * 单文件指定日期范围的历史统计弹窗。
 * 即使原始文件已经删除，也可以查看历史数据。
 */

export class FileWritingDetailModal extends Modal {
    private requestVersion = 0;

    constructor(
        app: App,
        private readonly service: FileWritingDetailService,
        private readonly filePath: string,
        private readonly startDate: string,
        private readonly endDate: string
    ) {
        super(app);
    }

    onOpen(): void {
        this.containerEl.addClass(
            "writer-stats-file-detail-modal"
        );

        this.titleEl.setText("单文件写作详情");

        void this.load();
    }

    onClose(): void {
        ++this.requestVersion;
        this.contentEl.empty();
    }

    private async load(): Promise<void> {
        const version = ++this.requestVersion;

        this.contentEl.empty();
        this.contentEl.createDiv({
            text: "正在加载文件写作详情..."
        });

        try {
            const detail = await this.service.getDetail(
                this.filePath,
                this.startDate,
                this.endDate
            );

            if (
                version !== this.requestVersion ||
                !this.contentEl.isConnected
            ) {
                return;
            }

            this.renderDetail(detail);
        } catch (error) {
            if (
                version !== this.requestVersion ||
                !this.contentEl.isConnected
            ) {
                return;
            }

            console.error(
                "[Writter Stats] 单文件写作详情加载失败",
                error
            );

            this.contentEl.empty();

            this.contentEl.createDiv({
                text: "单文件写作详情加载失败，请关闭后重试"
            });
        }
    }

    private renderDetail(
        detail: FileWritingDetail
    ): void {
        const root = this.contentEl;
        root.empty();

        // 文件名称，完整路径和统计日期
        const header = root.createDiv({
            cls:
                "writer-stats-file-detail__header"
        });

        header.createEl("h3", {
            text:
                detail.filePath.split("/").pop() ||
                detail.filePath
        });

        header.createDiv({
            cls:
                "writer-stats-file-detail__path",
            text: detail.filePath
        });

        header.createDiv({
            cls:
                "writer-stats-file-detail__dates",
            text:
                `${detail.startDate} ~ ${detail.endDate}`
        });

        // 文件存在时允许打开，文件已删除时仅展示历史信息
        const currentFile = this.app.vault.getAbstractFileByPath(detail.filePath);

        if (currentFile instanceof TFile) {
            const open = header.createEl("button", {
                text: "打开笔记"
            });

            open.type = "button";

            open.addEventListener("click", () => {
                this.close();

                void this.app.workspace
                    .getLeaf("tab")
                    .openFile(currentFile);
            });
        } else {
            header.createDiv({
                cls:
                    "writer-stats-file-detail__missing",
                text:
                    "原文件已删除或不在当前仓库中;" +
                    "以下为保留的历史写作数据"
            });
        }

        // 四项核心统计指标
        const metrics = root.createDiv({
            cls:
                "writer-stats-file-detail__metrics"
        });

        const metricData = [
            ["新增", signed(detail.added)],
            ["删除", String(detail.deleted)],
            ["净增长", signed(detail.net)],
            [
                "活跃天数",
                `${detail.activeDays} / ${detail.totalDays}`
            ]
        ];

        for (const [label, value] of metricData) {
            const card = metrics.createDiv({
                cls:
                    "writer-stats-file-detail__metric"
            });

            card.createDiv({
                text: label
            });

            card.createEl("strong", {
                text: value
            });
        }

        // 无记录时不渲染空图表
        if (detail.isEmpty) {
            root.createDiv({
                cls:
                    "writer-stats-file-detail__empty",
                text: "这段时间没有该文件的写作活动"
            });

            return;
        }

        // 每日新增趋势
        root.createEl("h4", {
            text: "每日新增趋势"
        });

        const plot = root.createDiv({
            cls:
                "writer-stats-file-detail__plot"
        });

        plot.style.setProperty(
            "--file-detail-columns",
            String(detail.days.length)
        );

        plot.setAttribute("role", "img");
        plot.setAttribute(
            "aria-label",
            "每日新增量柱状图，详细数据见下方日期明细"
        );

        const max = Math.max(
            1,
            ...detail.days.map(day => day.added)
        );

        for (const day of detail.days) {
            const column = plot.createDiv({
                cls:
                    "writer-stats-file-detail__column"
            });

            column.title =
                `${day.date}\n` +
                `新增：${signed(day.added)}\n` +
                `删除：${day.deleted}\n` +
                `净增长：${signed(day.net)}`;

            const bar = column.createDiv({
                cls:
                    "writer-stats-file-detail__bar"
            });

            bar.style.height =
                day.added > 0
                    ? `${Math.max(
                        4,
                        day.added / max * 100
                    )}%`
                    : "2px";

            if (day.added === 0) {
                bar.addClass("is-empty");
            }

            if (
                day.date ===
                detail.bestWritingDay?.date
            ) {
                bar.addClass("is-best");
            }
        }

        // 最佳新增日期
        const best = detail.bestWritingDay;

        if (best) {
            root.createDiv({
                cls:
                    "writer-stats-file-detail__best",
                text:
                    `最佳新增日期: ${best.date}` +
                    `· ${signed(best.added)}`
            });
        }

        // 活跃日期明细表
        root.createEl("h4", {
            text: "活跃日期明细"
        });

        const tableWrap = root.createDiv({
            cls:
                "writer-stats-file-detail__table-wrap"
        });

        const table = tableWrap.createEl("table", {
            cls:
                "writer-stats-file-detail__table"
        });

        // const headings = table.createEl("thead").createEl("tr");

        // 创建表头，只执行一次
        const thead = table.createEl("thead");
        const headerRow = thead.createEl("tr");

        for (const label of [
            "日期",
            "新增",
            "删除",
            "净增长"
        ]) {
            headerRow.createEl("th",{
                text: label
            });
        }

        // 创建表格内容区域
        const tbody = table.createEl("tbody");

        // 
        const activeByDate = new Map<string, FileWritingDay>();

        for (const day of detail.days) {
            if (!day.active) {
                continue;
            }

            activeByDate.set(day.date,day);
        }

        // 
        const activeDays = [...activeByDate.values()].sort(
            (a,b) => a.date.localeCompare(b.date)
        );

        // 
        for (const day of activeDays) {
            const tr = tbody.createEl("tr");

            tr.createEl("td",{
                text:day.date
            });

            tr.createEl("td",{
                text: signed(day.added)
            });

            tr.createEl("td",{
                text: String(day.deleted)
            });

            tr.createEl("td",{
                text:signed(day.net)
            });
        }
    }
}