import type { CountResult } from "./CountResult";

export interface FileSnapshot {
    path: string;
    modifiedAt: number;
    counts: CountResult;
}