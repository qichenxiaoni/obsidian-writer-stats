import type { CountResult } from "./CountResult";

export interface DailySummary {
    date: string;
    added: CountResult;
    deleted: CountResult;
    net: CountResult;
    activeFiles: number;
}