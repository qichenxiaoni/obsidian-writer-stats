import {
    CURRENT_SCHEMA_VERSION,
    createEmptyPluginData,
    normalizePluginData
} from "../src/domain/PluginData";

describe("PluginData", () => {
    test(
        "createEmptyPluginData 创建正确的初始结构",
        () => {
            const data =
                createEmptyPluginData();

            expect(data).toEqual({
                schemaVersion:
                    CURRENT_SCHEMA_VERSION,

                fileSnapshots: {},
                dailyActivities: {}
            });
        }
    );

    test(
        "null 会被规范化为空数据",
        () => {
            const data =
                normalizePluginData(null);

            expect(data.fileSnapshots)
                .toEqual({});

            expect(data.dailyActivities)
                .toEqual({});
        }
    );

    test(
        "空对象会补全缺失字段",
        () => {
            const data =
                normalizePluginData({});

            expect(data.schemaVersion)
                .toBe(CURRENT_SCHEMA_VERSION);

            expect(data.fileSnapshots)
                .toEqual({});

            expect(data.dailyActivities)
                .toEqual({});
        }
    );

    test(
        "已有合法数据会被保留",
        () => {
            const data =
                normalizePluginData({
                    schemaVersion: 1,

                    fileSnapshots: {
                        "A.md": {
                            path: "A.md",
                            modifiedAt: 1000,

                            counts: {
                                chinese: 10,
                                englishWords: 0,
                                englishChars: 0,
                                numbers: 0,
                                punctuation: 0,
                                spaces: 0,
                                total: 10
                            }
                        }
                    },

                    dailyActivities: {}
                });

            expect(
                data.fileSnapshots["A.md"]
                    .counts.total
            ).toBe(10);
        }
    );
});