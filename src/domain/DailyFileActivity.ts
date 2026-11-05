import type { CountResult } from "./CountResult";

export interface DailyFileActivity {
    date: string;
    filePath: string;

    start: CountResult;

    added: CountResult;
    deleted: CountResult;
    net: CountResult;

    // 可选编辑市场
    time?: {
        activeMs: number;
        hourlyMs: number[];
    }
}