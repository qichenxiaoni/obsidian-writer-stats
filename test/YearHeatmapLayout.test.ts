import {
    buildYearHeatmapLayout,
    getHeatmapLevel
} from "../src/core/YearHeatmapLayout";

import type {
    DailyHistoryEntry
} from "../src/domain/DailyHistoryEntry";

function makeDays(
    start: string,
    count: number,
    writing: Record<string,number> = {}
): DailyHistoryEntry[] {
    const first = new Date(
        `${start}T00:00:00Z`
    );

    return Array.from(
        { length: count },
        (_, index) => {
            const date = new Date(
                first.getTime() +
                index * 86_400_000
            ).toISOString().slice(0,10);

            const added = writing[date] ?? 0;

            return {
                date,
                added,
                deleted: 0,
                net: added,
                activeFiles: added > 0 ? 1 : 0
            };
        }
    );
}

describe("YearHeatmapLayout",() => {
    test("空数据返回空布局",() => {
        expect(
            buildYearHeatmapLayout([])
        ).toEqual({
            weekCount: 0,
            months: [],
            cells: []
        });
    });

    test("正确处理星期跨列", () => {
        const layout = buildYearHeatmapLayout(
            makeDays("2026-01-01",5)
        );

        // 2026-01-01 是星期四
        expect(layout.cells[0]).toMatchObject({
            column: 1,
            row: 5
        });

        // 星期六在当前列第七行
        expect(layout.cells[2]).toMatchObject({
            column: 1,
            row: 7
        });

        // 星期日进入下一列
        expect(layout.cells[3]).toMatchObject({
            column: 2,
            row: 1
        });

        expect(layout.weekCount).toBe(2);
    });

    test("闰年完整包含366天",() => {
        const layout = buildYearHeatmapLayout(
            makeDays("2024-01-01",366)
        );

        expect(layout.cells).toHaveLength(366);

        expect(
            layout.cells[layout.cells.length - 1].day.date
        ).toBe("2024-12-31");

        expect(layout.months).toHaveLength(12);
        expect(layout.weekCount).toBe(53);
    });

    test("月份标签连续覆盖对应周列",() => {
        const layout = buildYearHeatmapLayout(
            makeDays("2026-01-01",59)
        );

        expect(
            layout.months.map(m => m.label)
        ).toEqual(["1月", "2月"]);

        expect(
            layout.months[0].startColumn
        ).toBe(1);

        expect(
            layout.months[0].span
        ).toBe(
            layout.months[1].startColumn - 1
        );

        expect(
            layout.months[1].startColumn +
            layout.months[1].span        
        ).toBe(layout.weekCount + 1);
    });

    test("当前年份只显示传入的日期", () => {
        const layout = buildYearHeatmapLayout(
            makeDays("2026-01-01",20)
        );

        expect(layout.cells).toHaveLength(20);

        expect(layout.cells[19].day.date).toBe("2026-01-20");
    });

    test("完全没有新增时颜色等级为0",() => {
        const layout = buildYearHeatmapLayout(
            makeDays("2026-01-01",7)
        );

        expect(
            layout.cells.every(c => c.level === 0)
        ).toBe(true);
    });

    test("颜色强度随新增量正确变化",() => {
        expect(getHeatmapLevel(0,100)).toBe(0);
        expect(getHeatmapLevel(1,100)).toBe(1);
        expect(getHeatmapLevel(16,100)).toBe(2);
        expect(getHeatmapLevel(49,100)).toBe(3);
        expect(getHeatmapLevel(100,100)).toBe(4);
    });
});