import { WritingTimeClock } from "../src/core/WritingTimeClock";

describe("WritingTimeClock", () => {
    test("首个事件不虚构时长，连续编辑计算问题", () => {
        const clock = new WritingTimeClock();

        clock.record(
            "A.md",
            "2026-10-30",
            9,
            1000
        );

        clock.record(
            "A.md",
            "2026-10-30",
            9,
            9000
        );

        const delta = clock.take(
            "A.md",
            "2026-10-30"
        );

        expect(delta.activeMs).toBe(8000);
        expect(delta.hourlyMs[9]).toBe(8000);

        expect(
            delta.hourlyMs.reduce(
                (a,b) => a + b,
                0
            )
        ).toBe(8000);
    });

    test("超过 60 秒的空闲时间被排除", () => {
        const clock = new WritingTimeClock();

        clock.record(
            "A.md",
            "2026-10-30",
            9,
            1000
        );

        clock.record(
            "A.md",
            "2026-10-30",
            9,
            620001
        );

        expect(
            clock.take(
                "A.md",
                "2026-10-30"
            ).activeMs
        ).toBe(0);
    });

    test("切换文件不把其他文件的阅读时间算进去", () => {
        const clock = new WritingTimeClock();

        clock.record(
            "A.md",
            "2026-10-30",
            9,
            1000
        );

        clock.record(
            "B.md",
            "2026-10-30",
            9,
            3000
        );

        clock.record(
            "A.md",
            "2026-10-30",
            9,
            5000
        );

        expect(
            clock.take(
                "A.md",
                "2026-10-30"
            ).activeMs
        ).toBe(0);

        expect(
            clock.take(
                "B.md",
                "2026-10-30"
            ).activeMs
        ).toBe(0);
    });

    test("跨日不混合两个日期的编辑时间", () => {
        const clock = new WritingTimeClock();

        clock.record(
            "A.md",
            "2026-10-30",
            23,
            1000
        );

        clock.record(
            "A.md",
            "2026-10-31",
            0,
            3000
        );

        clock.record(
            "A.md",
            "2026-10-31",
            0,
            5000
        );

        expect(
            clock.take(
                "A.md",
                "2026-10-30"
            ).activeMs
        ).toBe(0);

        expect(
            clock.take(
                "A.md",
                "2026-10-31"
            ).activeMs
        ).toBe(2000);
    });

    test("按小时合计， take 只读取一次", () => {
        const clock = new WritingTimeClock();

        clock.record(
            "A.md",
            "2026-10-30",
            9,
            1000
        );

        clock.record(
            "A.md",
            "2026-10-30",
            10,
            3000
        );

        expect(
            clock.take(
                "A.md",
                "2026-10-30"
            ).hourlyMs[10]
        ).toBe(2000);

        expect(
            clock.take(
                "A.md",
                "2026-10-30"
            ).activeMs
        ).toBe(0);
    });

    test("写入失败时重新放回待保存时长", () => {
        const clock = new WritingTimeClock();

        clock.record(
            "A.md",
            "2026-10-30",
            9,
            1000
        );

        clock.record(
            "A.md",
            "2026-10-30",
            9,
            3000
        );

        const taken = clock.take(
            "A.md",
            "2026-10-30"
        );

        clock.restore(
            "A.md",
            "2026-10-30",
            taken
        );

        expect(
            clock.take(
                "A.md",
                "2026-10-30"
            ).activeMs
        ).toBe(2000);
    });

    test("切换文件中断会话，但保留待保存时长", () => {
        const clock = new WritingTimeClock();

        clock.record(
            "A.md",
            "2026-11-04",
            9,
            1000
        );

        clock.record(
            "A.md",
            "2026-11-04",
            9,
            3000
        );
        
        clock.breakSession();

        clock.record(
            "A.md",
            "2026-11-04",
            9,
            5000
        );

        expect(
            clock.take(
                "A.md",
                "2026-11-04"
            ).activeMs
        ).toBe(2000);
    });
});