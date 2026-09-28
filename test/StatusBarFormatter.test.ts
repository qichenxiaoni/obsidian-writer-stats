import {
    formatStatusBarText,
    formatStatusBarTooltip,
    formatGoalStatusBarText,
    formatGoalStatusBarTooltip
} from "../src/ui/StatusBarFormatter";

import type { DailySummary } from
    "../src/domain/DailySummary";
import { DailyOverview } from "../src/domain/DailyOverview";


function makeSummary(
    added: number,
    deleted: number,
    net: number,
    activeFiles: number
): DailySummary {
    return {
        date: "2026-09-20",

        added: {
            chinese: added,
            englishWords: 0,
            englishChars: 0,
            numbers: 0,
            punctuation: 0,
            spaces: 0,
            total: added
        },

        deleted: {
            chinese: deleted,
            englishWords: 0,
            englishChars: 0,
            numbers: 0,
            punctuation: 0,
            spaces: 0,
            total: deleted
        },

        net: {
            chinese: net,
            englishWords: 0,
            englishChars: 0,
            numbers: 0,
            punctuation: 0,
            spaces: 0,
            total: net
        },

        activeFiles
    };
}


describe(
    "StatusBarFormatter",
    () => {
        test(
            "正确格式化正向写作数据",
            () => {
                const summary =
                    makeSummary(
                        118,
                        24,
                        94,
                        3
                    );

                expect(
                    formatStatusBarText(
                        summary
                    )
                ).toBe(
                    "今日 +118 · 净增 +94"
                );
            }
        );


        test(
            "净增长为负数时正确显示",
            () => {
                const summary =
                    makeSummary(
                        30,
                        45,
                        -15,
                        2
                    );

                expect(
                    formatStatusBarText(
                        summary
                    )
                ).toBe(
                    "今日 +30 · 净增 -15"
                );
            }
        );


        test(
            "tooltip 包含完整统计信息",
            () => {
                const summary =
                    makeSummary(
                        118,
                        24,
                        94,
                        3
                    );

                const tooltip =
                    formatStatusBarTooltip(
                        summary
                    );

                expect(tooltip)
                    .toContain(
                        "新增：118"
                    );

                expect(tooltip)
                    .toContain(
                        "删除：24"
                    );

                expect(tooltip)
                    .toContain(
                        "净增：+94"
                    );

                expect(tooltip)
                    .toContain(
                        "活跃文件：3"
                    );
            }
        );

        test(
            "正确格式化每日目标状态栏",
            () => {
                const overview: DailyOverview = {
                    summary:
                        makeSummary(
                            638,
                            126,
                            512,
                            3
                        ),

                    goal: {
                        current: 638,
                        goal: 1500,
                        remaining: 862,
                        percentage: 43,
                        completed: false
                    }
                };

                expect(
                    formatGoalStatusBarText(
                        overview
                    )
                ).toBe(
                    "今日 +638 / 1500 · 43%"
                );
            }
        );


        test(
            "目标 tooltip 包含进度信息",
            () => {
                const overview: DailyOverview = {
                    summary:
                        makeSummary(
                            638,
                            126,
                            512,
                            3
                        ),

                    goal: {
                        current: 638,
                        goal: 1500,
                        remaining: 862,
                        percentage: 43,
                        completed: false
                    }
                };

                const tooltip =
                    formatGoalStatusBarTooltip(
                        overview
                    );

                expect(tooltip)
                    .toContain(
                        "每日目标：1500"
                    );

                expect(tooltip)
                    .toContain(
                        "完成进度：43%"
                    );

                expect(tooltip)
                    .toContain(
                        "还差：862"
                    );
            }
        );
    }
)