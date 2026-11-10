import { TFile, type Editor, type Plugin } from "obsidian";
import { EditorEventController } from "../src/events/EditorEventController";
import { ActivityTracker } from "../src/core/ActivityTracker";
import { TextAnalyzer } from "../src/core/TextAnalyzer";
import { MemoryStatsRepository } from "../src/persistence/MemoryStatsRepository";
import type { CountResult } from "../src/domain/CountResult";
import { getLocalDateKey } from "../src/utils/DateService";

jest.mock(
    "obsidian",
    () => ({
        MarkdownView: class MarkdownView { },
        TFile: class TFile { }
    }),
    { virtual: true }
);

function counts(total: number): CountResult {
    return {
        chinese: total,
        englishWords: 0,
        englishChars: 0,
        numbers: 0,
        punctuation: 0,
        spaces: 0,
        total
    };
}

function setup() {
    const handlers = new Map<
        string,
        (...args: any[]) => void
    >();

    const plugin = {
        app: {
            workspace: {
                getLeavesOfType: () => [],

                on: (
                    name: string,
                    handler: (...args: any[]) => void
                ) => {
                    handlers.set(name, handler);
                    return {};
                }
            },

            vault: {
                catchRead: async () => ""
            }
        },

        registerEvent: () => undefined,
        registerDomEvent: () => undefined
    } as unknown as Plugin;

    const repository = new MemoryStatsRepository();
    const tracker = new ActivityTracker(repository);
    const analyzer = {
        analyze: (text: string) =>
            counts(text.length)
    } as TextAnalyzer;
    const controller = new EditorEventController(
        plugin,
        analyzer,
        tracker
    );

    controller.start();

    const file = (path: string) => ({
        path,
        stat: { mtime: 1 }
    }) as TFile;

    return {
        handlers,
        repository,
        tracker,
        controller,
        file
    };
}

describe("EditorEventController", () => {
    beforeEach(() => {
        jest.useFakeTimers();

        Object.defineProperty(
            globalThis,
            "window",
            {
                configurable: true,
                value: {}
            }
        );
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test("切换文件后保存事件发生时的正文", async () => {
        const {
            handlers,
            tracker,
            controller,
            repository,
            file
        } = setup();

        await tracker.ensureBaseline(
            "A.md",
            0,
            counts(0)
        );

        let text = "abc";

        const editor = {
            getValue: () => text
        } as Editor;

        handlers.get("editor-change")!(
            editor,
            { file: file("A.md") }
        );

        text = "另一篇笔记";

        handlers.get("file-open")!(null);

        await controller.flushAll();

        expect(
            (
                await repository.getSnapshot(
                    "A.md"
                )
            )?.counts.total
        ).toBe(3);

        await controller.stop();
    });

    test("停止时提交尚在防抖窗口中的编辑", async () => {
        const {
            handlers,
            tracker,
            controller,
            repository,
            file
        } = setup();

        await tracker.ensureBaseline(
            "A.md",
            0,
            counts(0)
        );

        handlers.get("editor-change")!(
            { getValue: () => "hello" },
            { file: file("A.md") }
        );

        await controller.stop();

        expect(
            (
                await repository.getSnapshot(
                    "A.md"
                )
            )?.counts.total
        ).toBe(5);

        handlers.get("editor-change")!(
            { getValue: () => "ignored" },
            { file: file("A.md") }
        );

        await jest.runOnlyPendingTimersAsync();

        expect(
            (
                await repository.getSnapshot(
                    "A.md"
                )
            )?.counts.total
        ).toBe(5);
    });


    test("跨午夜按事件日期分别保存编辑与计时",async () => {
            const {
                handlers,
                tracker,
                controller,
                repository,
                file
            } = setup();

            // 初始文件为空
            await tracker.ensureBaseline(
                "A.md",
                0,
                counts(0)
            );

            const emit = (
                date: Date,
                text: string
            ) => {
                jest.setSystemTime(date);

                handlers.get("editor-change")!(
                    {
                        getValue: () => text
                    } as Editor,
                    {
                        file: file("A.md")
                    }
                );
            };

            // 11月4日：从0字增加到2字
            const day1 = new Date(
                2026, 10, 4,
                23, 59, 59, 600
            );

            emit(day1, "a");

            emit(
                new Date(
                    2026, 10, 4,
                    23, 59, 59, 800
                ),
                "aa"
            );

            // 11月5日：从2字增加到4字
            const day2 = new Date(
                2026, 10, 5,
                0, 0, 0, 100
            );

            emit(day2, "aaa");

            emit(
                new Date(
                    2026, 10, 5,
                    0, 0, 0, 400
                ),
                "aaaa"
            );

            // 将两天的防抖任务全部提交
            await controller.flushAll();

            const oldDate =
                await repository.getActivity(
                    getLocalDateKey(day1),
                    "A.md"
                );

            const newDate =
                await repository.getActivity(
                    getLocalDateKey(day2),
                    "A.md"
                );

            const snapshot =
                await repository.getSnapshot(
                    "A.md"
                );

            // 两个日期的新增字数分别为2
            expect(
                oldDate?.added.total
            ).toBe(2);

            expect(
                newDate?.added.total
            ).toBe(2);

            // 午夜前两次编辑间隔200ms
            expect(
                oldDate?.time?.activeMs
            ).toBe(200);

            // 午夜后两次编辑间隔300ms
            expect(
                newDate?.time?.activeMs
            ).toBe(300);

            // 最终文件快照应当是4字
            expect(
                snapshot?.counts.total
            ).toBe(4);

            await controller.stop();
        }
    );
})