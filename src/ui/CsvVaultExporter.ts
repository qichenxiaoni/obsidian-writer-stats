
import {
    App,
    TFolder,
    type TFile
} from "obsidian";

import type {
    MonthlyCsvExport
} from "../core/MonthlyCsvExportService";

export interface SavedCsvPaths {
    dailyPath: string;
    filePath: string;
}

// 统一导出目录名称
const EXPORT_FOLDER = "Writer Stats Exports";

/**
 * 将月度 CSV 导出到当前 Obsidian Vault。
 *
 * 功能：
 * 1. 自动创建导出目录
 * 2. 检查真实文件路径是否存在
 * 3. 自动生成不重复的文件名
 * 4. 保存每日汇总和逐文件明细
 * 5. 第二份文件保存失败时回滚第一份
 */
export async function saveMonthlyCsvToVault(
    app: App,
    data: MonthlyCsvExport
): Promise<SavedCsvPaths> {
    const vault = app.vault;

    // ========================================
    // 1. 检查或创建导出文件夹
    // ========================================

    const existingFolder =
        vault.getAbstractFileByPath(EXPORT_FOLDER);

    if (
        existingFolder &&
        !(existingFolder instanceof TFolder)
    ) {
        throw new Error(
            "导出目录路径已被同名文件占用"
        );
    }

    if (!existingFolder) {
        await vault.createFolder(EXPORT_FOLDER);
    }

    // ========================================
    // 2. 寻找不会覆盖已有文件的路径
    // ========================================

    let dailyPath: string | null = null;
    let filePath: string | null = null;

    for (let attempt = 1; attempt <= 1000; attempt++) {
        const suffix =
            attempt === 1 ? "" : `-${attempt}`;

        const basename =
            `${EXPORT_FOLDER}/writer-stats-${data.month}`;

        const nextDailyPath =
            `${basename}-daily${suffix}.csv`;

        const nextFilePath =
            `${basename}-files${suffix}.csv`;

        // 直接检查 Vault 底层路径是否存在
        const dailyExists =
            await vault.adapter.exists(nextDailyPath);

        const filesExists =
            await vault.adapter.exists(nextFilePath);

        // 任意一份已存在，就尝试下一组名称
        if (dailyExists || filesExists) {
            continue;
        }

        // 找到两条均不存在的路径
        dailyPath = nextDailyPath;
        filePath = nextFilePath;

        break;
    }

    if (!dailyPath || !filePath) {
        throw new Error(
            "无法找到可用的 CSV 导出文件名，" +
            "请检查导出目录中是否已有大量重名文件"
        );
    }

    // ========================================
    // 3. 创建每日汇总文件
    // ========================================

    const dailyFile: TFile = await vault.create(
        dailyPath,
        data.dailyCsv
    );

    // ========================================
    // 4. 创建逐文件明细
    // ========================================

    try {
        await vault.create(
            filePath,
            data.fileCsv
        );
    } catch (error) {
        // 第二份保存失败，尽量回滚刚创建的第一份
        try {
            await vault.delete(dailyFile);
        } catch (rollbackError) {
            console.error(
                "[Writer Stats] CSV 导出回滚失败",
                rollbackError
            );
        }

        throw error;
    }

    // ========================================
    // 5. 返回实际保存路径
    // ========================================

    return {
        dailyPath,
        filePath
    };
}
