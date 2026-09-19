import { getLocalDateKey } from "../src/utils/DateService";

describe("DateService", () => {
    test("生成 YYYY-MM-DD 本地日期", () => {
        const date = new Date(2026,8,19);
        
        expect(getLocalDateKey(date)).toBe("2026-09-19");
    });

    test("月份和日期自动补零", () => {
        const date = new Date(2026,0,5);

        expect(getLocalDateKey(date)).toBe("2026-01-05");
    });
});