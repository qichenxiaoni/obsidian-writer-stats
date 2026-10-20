import type { StatsRepository } from "../persistence/StatsRepository";

export interface FileWritingDay {
    date: string,
    added: number,
    deleted: number,
    net: number,
    active: boolean;
}

export interface FileWritingDetail {
    filePath: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    activeDays: number;
    added: number;
    deleted: number;
    net: number;
    bestWritingDay: {
        date: string;
        added: number;
    } | null;
    days: FileWritingDay[];
    isEmpty: boolean;
}

const ONE_DAY = 86_400_000;

// 校验真实的 YYYY_MMM_DD 日期
function parseDate(value: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new Error(`无效日期: ${value}`);
    }

    const [year,month,day] = value.split("-").map(Number);

    if (year < 1000 || year > 9999 || month < 1 || month > 12) {
        throw new Error(`无效日期: ${value}`);
    }

    const parsed = new Date(
        Date.UTC(year,month -1 ,day)
    );

    if (parsed.toISOString().slice(0,10) !== value) {
        throw new Error(`无效日期: ${value}`);
    }

    return parsed;
}

/**
 * 按文件路径查询指定日期范围内的写作历史。
 *
 * - 不要求文件当前仍存在
 * - 缺失日期补零
 * - 删除行为计入活跃天数
 * - 不修改 Repository 中的原始数据
 */

export class FileWritingDetailService {
    constructor(
        private readonly repository: Pick<StatsRepository, "getActivitiesBetween">
    ){}

    async getDetail(
        filePath: string,
        startDate: string,
        endDate: string
    ): Promise<FileWritingDetail> {
        if (!filePath.trim()){
            throw new Error("文件路径不能为空");
        }

        const start = parseDate(startDate);
        const end = parseDate(endDate);

        const totalDays = Math.round(
            (end.getTime() - start.getTime()) / ONE_DAY
        ) + 1;

        if (totalDays < 1 || totalDays > 366) {
            throw new RangeError("日期范围必须在 1 至 366 天内");
        }

        const records = await this.repository.getActivitiesBetween(
            startDate,
            endDate
        );

        const daily = new Map<string, {
            added: number;
            deleted: number;
            net: number;
        }>();

        for (const activity of records) {
            if (
                activity.filePath !== filePath ||
                activity.date < startDate ||
                activity.date > endDate
            ) {
                continue;
            }

            const row = daily.get(activity.date) ?? {
                added: 0,
                deleted: 0,
                net: 0
            };

            row.added += activity.added.total;
            row.deleted += activity.deleted.total;
            row.net += activity.net.total;

            daily.set(activity.date,row);
        }

        const days: FileWritingDay[] = [];

        let added = 0;
        let deleted = 0;
        let net = 0;
        let activeDays = 0;

        let bestWritingDay: FileWritingDetail["bestWritingDay"] = null;

        for (let i = 0; i < totalDays; i++) {
            const date = new Date(
                start.getTime() + i * ONE_DAY
            ).toISOString().slice(0,10);

            const row = daily.get(date) ?? {
                added: 0,
                deleted: 0,
                net: 0
            };

            const active = row.added > 0 || row.deleted > 0;

            days.push({
                date,
                ...row,
                active
            });

            added += row.added;
            deleted += row.deleted;
            net += row.net;

            if (active) {
                activeDays++;
            }

            //与已有历史统计一致，最大新增量并列时，选择较晚日期
            if (
                row.added > 0 &&
                (
                    !bestWritingDay ||
                    row.added >= bestWritingDay.added
                )
            ){
                bestWritingDay = {
                    date,
                    added: row.added
                };
            }        
        }

        return {
            filePath,
            startDate,
            endDate,
            totalDays,
            activeDays,
            added,
            deleted,
            net,
            bestWritingDay,
            days,
            isEmpty: activeDays === 0
        };
    }
}