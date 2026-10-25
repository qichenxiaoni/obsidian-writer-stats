import { getMonthRange } from "./MonthlyStatsService";

import type { StatsRepository } from "../persistence/StatsRepository";

export interface MonthlyCsvExport {
    month: string;
    startDate: string;
    endDate: string;
    dailyCsv: string;
    fileCsv: string;
}

/**
 * CSV 字段转义。
 *
 * - 转义逗号、双引号和换行
 * - 对可能被电子表格识别为公式的
 *   文件名添加文本标识
 */


export function escapeCsvField(
    value: string | number
): string {
    let text = String(value);

    // 防止电子表格将文件名解释为公式。
    // 只添加开头的单引号，不添加结尾单引号。
    if (
        typeof value === "string" &&
        /^\s*[=+\-@]/.test(text)
    ) {
        text = "'" + text;
    }

    // 标准 CSV 转义：
    // 遇到逗号、双引号或换行时使用双引号包裹，
    // 并将内部的双引号替换为两个双引号。
    return /[",\r\n]/.test(text)
        ? `"${text.replace(/"/g, '""')}"`
        : text;
}


// 生成UTF-8 CSV， BOM 可设置 Windows Excel，直接打开中文CSV时的编码兼容性

function makeCsv(
    rows: ReadonlyArray<ReadonlyArray<string | number>>
): string {
    return "\uFEFF" + rows.map(
        row => row.map(
            escapeCsvField
        ).join(",")
    ).join("\r\n") + "\r\n";
}

/**
 * 月度 CSV 导出服务。
 *
 * 一个自然月只读取一次 Repository。
 * 同一次读取同时生成：
 *
 * 1. 每日汇总 CSV
 * 2. 逐文件明细 CSV
 *
 * 不读取原始笔记正文。
 * 不修改插件统计数据。
 */

export class MonthlyCsvExportService {
    constructor(
        private readonly repository: Pick<StatsRepository, "getActivitiesBetween">
    ) { }

    async buildMonthlyCsv(
        month: string,
        today: string
    ): Promise<MonthlyCsvExport> {
        const range = getMonthRange(
            month,
            today
        );

        const activities =
            await this.repository.getActivitiesBetween(
                range.startDate,
                range.endDate
            );

        type Metrics = {
            added: number;
            deleted: number;
            net: number;
        };

        const daily = new Map<
            string,
            Metrics & {
                files: Set<string>;
            }
        >();

        const byFile = new Map<
            string,
            Metrics & {
                date: string;
                path: string;
            }
        >();

        // 读取并汇总当前月份全部文件活动
        for (const activity of activities) {
            if (
                activity.date < range.startDate ||
                activity.date > range.endDate
            ) {
                continue;
            }

            const added = activity.added.total;
            const deleted = activity.deleted.total;
            const net = activity.net.total;

            // 每日汇总
            const day = daily.get(
                activity.date
            ) ?? {
                added: 0,
                deleted: 0,
                net: 0,
                files: new Set<string>()
            };

            day.added += added;
            day.deleted += deleted;
            day.net += net;
            day.files.add(
                activity.filePath
            );

            daily.set(
                activity.date,
                day
            );

            // 文件汇总，避免同一天通文件重复
            const key = JSON.stringify([
                activity.date,
                activity.filePath
            ]);

            const file = byFile.get(key) ?? {
                date: activity.date,
                path: activity.filePath,
                added: 0,
                deleted: 0,
                net: 0
            };

            file.added += added;
            file.deleted += deleted;
            file.net += net;

            byFile.set(
                key,
                file
            );
        }

        // 第一步： 每日汇总CSV
        const dailyRows:
            Array<Array<string | number>> = [[
                "日期",
                "新增",
                "删除",
                "净增长",
                "活跃文件数"
            ]];

        const start = new Date(
            `${range.startDate}T00:00:00Z`
        );

        // 补齐当前查询范围内的每一天
        for (
            let index = 0;
            index < range.totalDays;
            index++
        ) {
            const date = new Date(
                start.getTime() +
                index * 86_400_000
            ).toISOString().slice(0, 10);

            const row = daily.get(date);

            dailyRows.push([
                date,
                row?.added ?? 0,
                row?.deleted ?? 0,
                row?.net ?? 0,
                row?.files.size ?? 0
            ]);
        }

        // 第二份： 逐文件明细 CSV
        const fileRows:
            Array<Array<string | number>> = [[
                "日期",
                "文件路径",
                "新增",
                "删除",
                "净增长"
            ]];

        const sortedFiles = [
            ...byFile.values()
        ].sort(
            (a, b) =>
                a.date.localeCompare(b.date) ||
                a.path.localeCompare(
                    b.path,
                    "zh-CN"
                )
        );

        for (const row of sortedFiles) {
            fileRows.push([
                row.date,
                row.path,
                row.added,
                row.deleted,
                row.net
            ]);
        }

        return {
            month: range.month,
            startDate: range.startDate,
            endDate: range.endDate,
            dailyCsv: makeCsv(dailyRows),
            fileCsv: makeCsv(fileRows)
        };
    }
}