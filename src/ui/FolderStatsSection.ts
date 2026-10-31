import {
    buildFolderStats,
    parentFolderPath,
    sortFolderStats
} from "../core/FolderStatsService";

import type {
    FileRankingSort,
    FileRankingSummary
} from "../core/FileRankingService";

const SORT_OPTIONS: ReadonlyArray<{
    key: FileRankingSort;
    label: string;
}> = [
        { key: "added", label: "按新增" },
        { key: "net", label: "按净增长" },
        { key: "deleted", label: "按删除" }
    ];

function signed(value: number): string {
    return value > 0
        ? `+${value}`
        : String(value);
}

/**
 * 文件夹统计 UI。
 *
 * 只使用传入的文件排行，
 * 不发起任何 Repository 查询。
 */

export function renderFolderStatsSection(
    parent: HTMLElement,
    ranking: FileRankingSummary,
    path: string,
    sort: FileRankingSort,
    onNavigate: (nextPath: string) => void,
    onSort: (nextPath: FileRankingSort) => void
): void {
    const summary = buildFolderStats(ranking, path);

    const section = parent.createDiv({
        cls:
            "writer-stats-dashboard__folders"
    });

    // 标题
    const header = section.createDiv({
        cls:
            "writer-stats-dashboard__folders-header"
    });

    header.createEl("h3", {
        cls:
            "writer-stats-dashboard__section-title",
        text: "文件夹写作统计"
    });

    // 排序按钮
    const sortButtons = header.createDiv({
        cls:
            "writer-stats-dashboard__folders-sort"
    });

    for (const option of SORT_OPTIONS) {
        const active = option.key === sort;

        const button = sortButtons.createEl(
            "button",
            {
                cls:
                    "writer-stats-dashboard__folders-sort-button" +
                    (active ? " is-active " : ""),
                text: option.label
            }
        );

        button.type = "button";

        button.setAttribute(
            "aria-pressed",
            String(active)
        );

        button.addEventListener(
            "click",
            () => {
                if (!active) {
                    onSort(option.key);
                }
            }
        );
    }

    // 路径导航

    const navigation = section.createDiv({
        cls:
            "writer-stats-dashboard__folders-navigation"
    });

    if (path) {
        const back = navigation.createEl(
            "button",
            {
                cls:
                    "writer-stats-dashboard__folders-back",
                text: "‹ 返回上级"
            }
        );

        back.type = "button";

        back.addEventListener(
            "click",
            () => {
                onNavigate(
                    parentFolderPath(path)
                );
            }
        );
    }

    navigation.createSpan({
        cls:
            "writer-stats-dashboard__folders-location",
        text: path
            ? `当前文件夹：${path}`
            : "当前文件夹：仓库根目录"
    });

    // 统计说明

    section.createDiv({
        cls:
            "writer-stats-dashboard__folders-caption",
        text:
            `${summary.startDate} ~ ${summary.endDate} · ` +
            `当前范围 ${summary.fileCount} 个活跃文件 ·` +
            `直属文件 ${summary.directFileCount} 个 · ` +
            `子文件夹 ${summary.folders.length} 个`
    });

    // 当前目录汇总

    const totals = section.createDiv({
        cls:
            "writer-stats-dashboard__folders-totals"
    });

    const items = [
        ["新增", signed(summary.added)],
        ["删除", signed(summary.deleted)],
        ["净增长", signed(summary.net)],
        ["活跃文件", signed(summary.fileCount)]
    ];

    for (const [label, value] of items) {
        const card = totals.createDiv({
            cls:
                "writer-stats-dashboard__folders-total"
        });

        card.createDiv({
            text: label
        });

        card.createEl("strong", {
            text: value
        });
    }

    // 下级文件夹

    const list = section.createDiv({
        cls:
            "writer-stats-dashboard__folders-list"
    });

    const ordered = sortFolderStats(
        summary.folders,
        sort
    );

    if (ordered.length === 0) {
        list.createDiv({
            cls:
                "writer-stats-dashboard__folders-empty",
            text:
                summary.fileCount === 0
                    ? "当前范围没有文件写作活动"
                    : "没有下级文件夹：当前活动来自直属文件"
        });

        return;
    }

    for (const folder of ordered) {
        const row = list.createEl(
            "button",
            {
                cls:
                    "writer-stats-dashboard__folders-row"
            }
        );

        row.type = "button";
        row.title = `进入 ${folder.path}`;

        row.setAttribute(
            "aria-label",
            `查看文件夹 ${folder.path} 的写作统计`
        );

        const info = row.createSpan({
            cls:
                "writer-stats-dashboard__folders-name",
            text: `📁 ${folder.name}`
        });

        info.createSpan({
            cls:
                "writer-stats-dashboard__folders-file-count",
            text:
                ` · ${folder.fileCount} 个文件`
        });

        row.createSpan({
            cls:
                "writer-stats-dashboard__folders-values",
            text:
                `新增 ${signed(folder.added)} ` +
                `删除 ${folder.deleted} ` +
                `净增长 ${signed(folder.net)}`
        });

        row.addEventListener(
            "click",
            () => onNavigate(folder.path)
        );
    }
}