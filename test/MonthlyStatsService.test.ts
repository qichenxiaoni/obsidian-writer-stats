import {
    MonthlyStatsService,
    getMonthRange,
    shiftMonth
} from "../src/core/MonthlyStatsService";

import {
    DailyHistoryService
} from "../src/core/DailyHistoryService";

import {
    MemoryStatsRepository
} from "../src/persistence/MemoryStatsRepository";

import type {
    CountResult
} from "../src/domain/CountResult";

function count(total: number):CountResult {
    return {
        chinese:total,
        englishWords: 0,
        englishChars: 0,
        numbers: 0,
        punctuation: 0,
        spaces: 0,
        total
    };
}

function createFixture() {
    const repository =new MemoryStatsRepository();

    const history = new DailyHistoryService(repository);

    const monthly = new MonthlyStatsService(history);

    async function record (
        date: string,
        added: number,
        deleted: number,
        filePath = "A.md"
    ): Promise<void> {
        await repository.saveActivity({
            date,
            filePath,
            start: count(0),
            added: count(added),
            deleted: count(deleted),
            net: count(added - deleted)
        });
    }

    return {
        history,
        monthly,
        record
    };
}

describe("MonthlyStatsService", () => {
    test("当前月只统计到今天",() => {
        expect(
            getMonthRange("2026-10", "2026-10-11")
        ).toEqual({
            month: "2026-10",
            startDate: "2026-10-01",
            endDate: "2026-10-11",
            totalDays: 11,
            isCurrentMonth: true
        });
    });

    test("历史月统计完整自然月",() => {
        expect(
            getMonthRange("2026-09","2026-10-11")
        ).toEqual({
            month: "2026-09",
            startDate: "2026-09-01",
            endDate: "2026-09-30",
            totalDays: 30,
            isCurrentMonth: false
        });
    });

    test("正确处理闰年二月",() => {
        expect(
            getMonthRange("2024-02","2026-10-11")
                .totalDays
        ).toBe(29);

        expect(
            getMonthRange("2025-02","2026-10-11")
                .totalDays
        ).toBe(28);
    });

    test("跨年切换月份",() => {
        expect(
            shiftMonth("2026-01",-1)
        ).toBe("2025-12");

        expect(
            shiftMonth("2025-12",1)
        ).toBe("2026-01");
    });

    test("拒绝非法日期和未来月份",() => {
        expect(() => getMonthRange("2026-11","2026-10-11")).toThrow();

        expect(() => getMonthRange("2026-10","2026-02-30")).toThrow();

        expect(() => getMonthRange("2026-13","2026-10-11")).toThrow();

        expect(() => shiftMonth("2026-01",0.5)).toThrow();
    });

    test("31天月份只查询一次且不会遗漏月初", async () => {
        const { monthly , history , record } = createFixture();

        await record("2026-03-01", 10,0);
        await record("2026-03-05",20,3);
        await record("2026-03-31",5,2);

        const spy = jest.spyOn(history,"getSummary");

        const result = await monthly.getMonthSummary(
            "2026-03",
            "2026-10-11"
        );

        expect(spy).toHaveBeenCalledTimes(1);

        expect(spy).toHaveBeenCalledWith(
            "2026-03-01",
            "2026-03-31"
        );

        expect(result.days).toHaveLength(31);
        expect(result.added).toBe(35);
        expect(result.deleted).toBe(5);
        expect(result.net).toBe(30);
        expect(result.activeDays).toBe(3);

        expect(result.days[0]).toMatchObject({
            date: "2026-03-01",
            added: 10
        });

        expect(result.days[1]).toMatchObject({
            date: "2026-03-02",
            added: 0
        });
    });

    test("当前月不包含未来日期的数据", async () => {
        const {monthly,record} = createFixture();

        await record("2026-10-07",32,13);
        await record("2026-10-20",100,0);

        const result = 
            await monthly.getMonthSummary(
                "2026-10",
                "2026-10-11"
            );

        expect(result.days).toHaveLength(11);
        expect(result.added).toBe(32);
        expect(result.deleted).toBe(13);
        expect(result.isCurrentMonth).toBe(true);
    });

    test("跨月数据不会混入目标月份", async () => {
        const{ monthly,record } = createFixture();

        await record("2026-08-31",100,0);
        await record("2026-09-01",20,5);
        await record("2026-10-01",50,0);

        const result = 
            await monthly.getMonthSummary(
                "2026-09",
                "2026-10-11"
            );

        expect(result.added).toBe(20);
        expect(result.deleted).toBe(5);
        expect(result.days).toHaveLength(30);
    });

    test("只有删除也算活跃天数", async () => {
        const{ monthly,record } = createFixture();

        await record("2026-10-03",0,8);

        const result = 
            await monthly.getMonthSummary(
                "2026-10",
                "2026-10-11"
            );

        expect(result.added).toBe(0);
        expect(result.deleted).toBe(8);
        expect(result.net).toBe(-8);
        expect(result.activeDays).toBe(1);
        expect(result.isEmpty).toBe(false);
        expect(result.bestWritingDay).toBeNull();
    });

    test("最佳写作日并列时沿用历史服务器规则",async () => {
        const { monthly,record } = createFixture();

        await record("2026-10-02",50,0);
        await record("2026-10-05",50,0);

        const result = 
            await monthly.getMonthSummary(
                "2026-10",
                "2026-10-11"
            );

        // DailyHistoryService 规定并列时选择较晚的一天
        expect(result.bestWritingDay).toEqual({
            date: "2026-10-05",
            added: 50
        });
    });

    test("无记录月份返回空状态", async () => {
        const { monthly } = createFixture();

        const result = 
            await monthly.getMonthSummary(
                "2026-09",
                "2026-10-11"
            );

        expect(result.days).toHaveLength(30);
        expect(result.added).toBe(0),
        expect(result.deleted).toBe(0);
        expect(result.activeDays).toBe(0);
        expect(result.bestWritingDay).toBeNull();
        expect(result.isEmpty).toBe(true);
    });
});