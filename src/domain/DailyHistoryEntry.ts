export interface DailyHistoryEntry {
  date: string;

  added: number;
  deleted: number;
  net: number;

  activeFiles: number;
}