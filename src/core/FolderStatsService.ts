import type { FileRankingSort, FileRankingSummary } from "./FileRankingService";

export interface FolderStatsEntry {
    path: string;
    name: string;
    added: number;
    deleted: number;
    net: number;
    fileCount: number;
}

export interface FolderStatsSummary {
    path: string;
    startDate: string;
    endDate: string;
    added: number;
    deleted: number;
    net: number;
    fileCount: number;
    directFileCount: number;
    folders: FolderStatsEntry[];
}

// 返回上一级路径。
// 空字符串代表 Vault 根目录

export function parentFolderPath(
    path: string
): string {
    const slash = path.lastIndexOf("/");

    return slash < 0
        ? ""
        : path.slice(0, slash);
}

/**
 * 从文件排行构建文件夹统计。
 *
 * 不再查询 Repository。
 * 子文件夹包含其所有后代文件。
 * 相同文件不会因目录嵌套而重复计数。
 */

export function buildFolderStats(
    ranking: FileRankingSummary,
    path = ""
): FolderStatsSummary {
    const folders = new Map<string, FolderStatsEntry>();

    const summary: FolderStatsSummary = {
        path,
        startDate: ranking.startDate,
        endDate: ranking.endDate,
        added: 0,
        deleted: 0,
        net: 0,
        fileCount: 0,
        directFileCount: 0,
        folders: []
    };

    const prefix = path
        ? `${path}/`
        : "";

    for (const file of ranking.files) {
        // 当前文件夹及其后代文件

        if (!file.filePath.startsWith(prefix)) {
            continue;
        }

        // 与原文件排行榜一致的活跃规则

        if (
            file.added <= 0 &&
            file.deleted <= 0
        ) {
            continue;
        }

        const relativePath = file.filePath.slice(prefix.length);

        if (!relativePath) {
            continue;
        }

        // 当前文件夹递归汇总

        summary.added += file.added;
        summary.deleted += file.deleted;
        summary.net += file.net;
        summary.fileCount++

        const slash = relativePath.indexOf("/");

        // 没有后续路径说明是直属文件

        if (slash < 0) {
            summary.directFileCount++;
            continue;
        }

        const name = relativePath.slice(0,slash);

        const folderPath = `${prefix}${name}`;

        const item = folders.get(folderPath) ?? {
            path: folderPath,
            name,
            added: 0,
            deleted: 0,
            net: 0,
            fileCount: 0
        };

        item.added += file.added;
        item.deleted += file.deleted;
        item.net += file.net;
        item.fileCount++;

        folders.set(folderPath,item);
    }

    summary.folders = [
        ...folders.values()
    ];

    return summary;
}

// 按选定指标降序排序。
// 同分时用新增量及路径确保稳定排序

export function sortFolderStats(
    folders: readonly FolderStatsEntry[],
    sort: FileRankingSort
): FolderStatsEntry[] {
    return [...folders].sort(
        (a,b) => 
            b[sort] - a[sort] ||
        b.added - a.added ||
        a.path.localeCompare(
            b.path,
            "zh-CN"
        )
    );
}