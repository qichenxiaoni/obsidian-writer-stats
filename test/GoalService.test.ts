import { GoalService } from "../src/core/GoalService";

describe(
    "GoalService",
    () => {
        const service = 
            new GoalService();

        test(
            "正确计算未完成目标",
            () => {
                const result = 
                    service.calculte(
                        640,
                        1000
                    );
                
                expect(result.current)
                    .toBe(640);
                
                expect(result.goal)
                    .toBe(1000);

                expect(result.remaining)
                    .toBe(360);

                expect(result.percentage)
                    .toBe(64);

                expect(result.completed)
                    .toBe(false);
            }
        );

        test(
            "达到目标时标记为完成",
            () => {
                const result =
                    service.calculte(
                        1000,
                        1000
                    );

                expect(result.current)
                    .toBe(1000);

                expect(result.remaining)
                    .toBe(0);

                expect(result.percentage)
                    .toBe(100);

                expect(result.completed)
                    .toBe(true);
            }
        );

        test(
            "超出目标时保留实际百分比",
            () => {
                const result =
                    service.calculte(
                        1350,
                        1000
                    );

                expect(result.current)
                    .toBe(1350);

                expect(result.remaining)
                    .toBe(0);

                expect(result.percentage)
                    .toBe(135);

                expect(result.completed)
                    .toBe(true);
            }
        );

        test(
            "负数 current 会被保护为 0",
            () => {
                const result =
                    service.calculte(
                        -100,
                        1000
                    );

                expect(result.current)
                    .toBe(0);

                expect(result.remaining)
                    .toBe(1000);

                expect(result.percentage)
                    .toBe(0);

                expect(result.completed)
                    .toBe(false);
            }
        );

        test(
            "非法的零目标会被保护",
            () => {
                const result =
                    service.calculte(
                        10,
                        0
                    );

                expect(result.goal)
                    .toBe(1);

                expect(result.percentage)
                    .toBe(1000);

                expect(result.completed)
                    .toBe(true);
            }
        );
    }
);