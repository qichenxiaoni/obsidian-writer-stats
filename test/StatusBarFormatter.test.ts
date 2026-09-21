import {
    formatStatusBarText,
    formatStatusBarTooltip
} from "../src/ui/StatusBarFormatter";

import type { DailySummary } from
    "../src/domain/DailySummary";


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
    }
);