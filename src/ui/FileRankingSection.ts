import { TFile } from "obsidian";
import type { App } from "obsidian";
import {
    sortFileRanking,
    type FileRankingSort,
    type FileRankingSummary
} from "../core/FileRankingService";

const OPTIONS: ReadonlyArray<{ sort: FileRankingSort; label: string }> = [
    {sort: "added",label: "按新增"},
    {sort: "net", label: "按净增长"},
    {sort: "deleted", label: "按删除"}
];

function signed(value: number): string {
    return value > 0 ? `+${value}`: String(value);
}

/**
 * 排行榜纯 UI：点击排序只使用已加载数据，不再次查询仓库。
 * 用户切换月份时，由 WriterStatsView 重新创建此组件。
 */

export function renderFileRankingSection(
    parent: HTMLElement,
    app: App,
    summary: FileRankingSummary,
    initialSort: FileRankingSort,
    onSortChange: (sort: FileRankingSort) => void
): void {
    const section = parent.createDiv({
        cls:
            "writer-stats-dashboard__ranking"
    });

    const header = section.createDiv({
        cls: 
            "writer-stats-dashboard__ranking-header"
    });

    header.createEl("h3",{
        cls:
            "writer-stats-dashboard__section-title",
            text: "文件写作排行榜"
    });

    const controls = header.createDiv({
        cls:
            "writer-stats-dasboard__ranking-filters"
    });

    const buttons = new Map<FileRankingSort, HTMLButtonElement>();

    section.createDiv({
        cls:
            "writer-stats-dashboard__ranking-caption",
        text:
            `${summary.startDate} ~ ${summary.endDate} · ` +
            `共 ${summary.totalFiles} 个活跃文件 · 最多显示前10名`
    });

    const list = section.createDiv({
        cls:
            "writer-stats-dashboard__ranking-list"
    });

    const update = (sort: FileRankingSort): void => {
        for (const [key,button] of buttons) {
            const selected = key === sort;
            button.classList.toggle("is-active",selected);
            button.setAttribute("aria-pressed", String(selected));
        }

        list.empty();

        if (summary.files.length === 0) {
            list.createDiv({
                cls:
                    "writer-stats-dashboard__ranking-empty",
                text: "这个月暂无文件写作记录"
            });
            return;
        }

        const ordered = sortFileRanking(summary.files,sort).slice(0,10);
        // 净增长可能为负值；以绝对量显示条形图，数值仍保留正负号
        const maxMagnitude = Math.max(
            1,
            ...ordered.map(file => Math.abs(file[sort]))
        );

        for (const [index,entry] of ordered.entries()) {
            const row = list.createDiv({
                cls:
                    "writer-stats-dashboard__ranking-row"
            });

            row.createSpan({
                cls:
                    "writer-stats-dashboard__ranking-index",
                text: String(index + 1)
            });

            const detail = row.createDiv({
                cls:
                    "writer-stats-dashboard__ranking-info"
            });

            const fileName = entry.filePath.split("/").pop() || entry.filePath;
            const abstractFile = app.vault.getAbstractFileByPath(entry.filePath);

            if (abstractFile instanceof TFile) {
                const link = detail.createEl("button",{
                    cls:
                        "writer-stats-dashboard__ranking-file",
                    text: fileName
                });
                link.type = "button";
                link.title = `打开 ${entry.filePath}`;
                link.addEventListener("click", () => {
                    void app.workspace.getLeaf("tab").openFile(abstractFile);
                });
            }else {
                const label = detail.createSpan({
                    cls:
                        "writer-stats-dashboard__ranking-file is-missing",
                    text: fileName
                });

                label.title = "文件已删除或不在当前仓库中";
            }

            detail.createDiv({
                cls:
                    "writer-stats-dashboard__ranking-path",
                text: `${entry.filePath} · 活跃 ${entry.activeDays} 天`
            });
            
            const values = row.createDiv({
                cls:
                    "writer-stats-dashboard__ranking-values"
            });

            values.createSpan({ text: `新增 ${signed(entry.added)}`});
            values.createSpan({ text: `删除 ${entry.deleted}` });
            values.createSpan({ text:`净增 ${signed(entry.net)}`});

            const track = row.createDiv({
                cls:
                    "writer-stats-dashboard__ranking-track"
            });

            const bar = track.createDiv({
                cls:
                    "writer-stats-dashboard__ranking-bar"
            });

            bar.style.width = `${Math.abs(entry[sort]) / maxMagnitude * 100}%`;
            
            if (entry[sort] < 0) {
                bar.addClass("is-negative");
            }

            track.title = `排序值: ${signed(entry[sort])}`;
        }
    };

    for (const option of OPTIONS) {
        const button = controls.createEl("button",{
            cls:
                "writer-stats-dashboard__ranking-sort",
            text: option.label
        });

        button.type = "button";
        button.addEventListener("click", () => {
            onSortChange(option.sort);
            update(option.sort);
        });
        buttons.set(option.sort,button);
    }

    update(initialSort);
}