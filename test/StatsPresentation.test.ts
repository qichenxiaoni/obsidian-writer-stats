import {
    formatSigned,
    formatDate,
    formatTrendDate,
    shouldShowTrendLabel,
    getTrendBarHeight
} from "../src/ui/StatsPresentation";

describe("StatsPresentation", () => {
    test("正数加正号，零与负数保持原样", () => {
        expect(formatSigned(12)).toBe("+12");
        expect(formatSigned(0)).toBe("0");
        expect(formatSigned(-7)).toBe("-7");
    });

    test("日期格式与原有展示保持一致", () => {
        expect(
            formatDate("2026-11-04")
        ).toBe("2026年11月4日");

        expect(
            formatTrendDate("2026-11-04")
        ).toBe("11/04");

        expect(
            formatTrendDate("invalid")
        ).toBe("invalid");
    });

    test("7天趋势显示全部日期", () => {
        for (let index = 0; index < 7; index++) {
            expect(
                shouldShowTrendLabel(index, 7)
            ).toBe(true);
        }
    });

    test("30天趋势仅显示两端和每五天", () => {
        expect(shouldShowTrendLabel(0,30)).toBe(true);
        expect(shouldShowTrendLabel(1,30)).toBe(false);
        expect(shouldShowTrendLabel(5,30)).toBe(true);
        expect(shouldShowTrendLabel(29,30)).toBe(true);
    });

    test("没有新增时柱高为0", () => {
        expect(getTrendBarHeight(0,100,7)).toBe(0);
        expect(getTrendBarHeight(-2,100,30)).toBe(0);
        expect(getTrendBarHeight(2,0,30)).toBe(0);
    });

    test("短趋势保持线性比例与最小柱高", () => {
        expect(getTrendBarHeight(50,100,7)).toBe(50);
        expect(getTrendBarHeight(1,100,7)).toBe(8);
    });

    test("长趋势保持平方根比例与最小柱高", () => {
        expect(getTrendBarHeight(25,100,30)).toBe(50);
        expect(getTrendBarHeight(0.01, 100,30)).toBe(5);
    });
});