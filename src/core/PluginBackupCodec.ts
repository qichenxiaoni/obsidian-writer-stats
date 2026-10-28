import {
    CURRENT_SCHEMA_VERSION,
    type PluginData
} from "../domain/PluginData";

export const WRITER_STATS_BACKUP_FORMAT = "writer-stats-backup";

export const WRITER_STATS_BACKUP_VERSION = 1;

export const MAX_BACKUP_BYTES = 25 * 1024 * 1024;

export interface WriterStatsBackup {
    format: typeof WRITER_STATS_BACKUP_FORMAT;
    formatVersion: typeof WRITER_STATS_BACKUP_VERSION;
    createdAt: string;
    data: PluginData;
}

function record(
    value: unknown
): value is Record<string, unknown> {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
    );
}


function integer(
    value: unknown,
    allowNegative = false
): value is number {
    return (
        typeof value === "number" &&
        Number.isSafeInteger(value) &&
        (allowNegative || value >= 0)
    );
}


function validDate(
    value: unknown
): value is string {
    if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        return false;
    }

    const date = new Date(
        `${value}T00:00:00Z`
    );

    return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
    );
}


function validCounts(
    value: unknown,
    allowNegative = false
): boolean {
    if (!record(value)) {
        return false;
    }

    const fields = [
        "chinese",
        "englishWords",
        "englishChars",
        "numbers",
        "punctuation",
        "spaces",
        "total"
    ] as const;

    return fields.every(field => {
        const numberValue = value[field];

        return (
            typeof numberValue === "number" &&
            Number.isSafeInteger(numberValue) &&
            (
                allowNegative ||
                numberValue >= 0
            )
        );
    });
}


function safePath(
    path: unknown
): path is string {
    return (
        typeof path === "string" &&
        path.trim().length > 0 &&
        ![
            "__proto__",
            "constructor",
            "prototype"
        ].includes(path)
    );
}

/**
 * 严格校验插件数据。
 *
 * 不使用 normalizePluginData，
 * 不允许缺少历史数据对象，
 * 不接受未知 schemaVersion 。
 */

export function validateBackupData(
    value: unknown
): asserts value is PluginData {
    if (
        !record(value) ||
        value.schemaVersion !== CURRENT_SCHEMA_VERSION
    ) {
        throw new Error(
            "不支持的数据版本：当前只支持" +
            `schemaVersion ${CURRENT_SCHEMA_VERSION}`
        );
    }

    if (
        !record(value.settings) ||
        !integer(value.settings.dailyGoal) ||
        value.settings.dailyGoal <= 0
    ) {
        throw new Error(
            "备份设置无效： dailyGoal 必须是正整数"
        );
    }

    if (
        !record(value.fileSnapshots) ||
        !record(value.dailyActivities)
    ) {
        throw new Error(
            "备份必须包含 fileSnapshots" +
            "和 dailyActivities 对象"
        );
    }

    // 文件快照
    for (
        const [path, entry] of
        Object.entries(value.fileSnapshots)
    ) {
        if (
            !safePath(path) ||
            !record(entry) ||
            entry.path !== path ||
            !integer(entry.modifiedAt) ||
            !validCounts(entry.counts)
        ) {
            throw new Error(
                `无效文件快照：${path}`
            );
        }
    }

    // 每日历史活动
    for (
        const [key, entry] of
        Object.entries(value.dailyActivities)
    ) {
        if (
            !record(entry) ||
            !validDate(entry.date) ||
            !safePath(entry.filePath) ||
            key !== `${entry.date}:${entry.filePath}` ||
            !validCounts(entry.start) ||
            !validCounts(entry.added) ||
            !validCounts(entry.deleted) ||
            !validCounts(entry.net, true)
        ) {
            throw new Error(
                `无效历史活动: ${key}`
            );
        }
    }
}

// 将完整 PluginData 生成版本化备份

export function createBackupText(
    data: PluginData,
    createdAt = new Date().toISOString()
): string {
    validateBackupData(data);

    const backup: WriterStatsBackup = {
        format: WRITER_STATS_BACKUP_FORMAT,
        formatVersion: WRITER_STATS_BACKUP_VERSION,
        createdAt,
        data
    };

    const text = JSON.stringify(backup, null, 2) + "\n";

    if (
        new TextEncoder().encode(text).length >
        MAX_BACKUP_BYTES
    ) {
        throw new Error(
            "备份文件超过 25 MB，" +
            "请先优化历史数据存储"
        );
    }

    return text;
}

/**
 * 解析并校验备份 JSON。
 *
 * 校验失败直接抛错，
 * 不返回默认空数据。
 */

export function parseBackupText(
    text: string
): WriterStatsBackup {
    if (
        new TextEncoder().encode(text).length >
        MAX_BACKUP_BYTES
    ) {
        throw new Error(
            "备份文件超过 25 MB，拒绝恢复"
        );
    }

    let parsed: unknown;

    try {
        parsed = JSON.parse(
            text.replace(/^\uFEFF/, "")
        );
    } catch {
        throw new Error(
            "备份不是有效 JSON"
        );
    }

    if (
        !record(parsed) ||
        parsed.format !== WRITER_STATS_BACKUP_FORMAT ||
        parsed.formatVersion !== WRITER_STATS_BACKUP_VERSION ||
        typeof parsed.createdAt !== "string" ||
        !Number.isFinite(
            Date.parse(parsed.createdAt)
        )
    ) {
        throw new Error(
            "备份格式或版本不受支持"
        );
    }

    validateBackupData(parsed.data);

    return parsed as unknown as WriterStatsBackup;
}