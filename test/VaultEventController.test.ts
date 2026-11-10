
import {
    TFile,
    type Plugin
} from "obsidian";

import {
    MemoryStatsRepository
} from "../src/persistence/MemoryStatsRepository";

import {
    VaultEventController
} from "../src/events/VaultEventController";

import type {
    EditorEventController
} from "../src/events/EditorEventController";

jest.mock(
    "obsidian",
    () => ({
        TFile: class TFile {
            path: string;
            extension = "md";

            constructor(path: string) {
                this.path = path;
            }
        },

        MarkdownView: class MarkdownView { }
    }),
    { virtual: true }
);

function createMockMarkdownFile(path: string): TFile {
    return Object.assign(
        Object.create(TFile.prototype) as TFile,
        {
            path,
            extension: "md"
        }
    );
}

function setup(
    flushFile: (path: string) => Promise<void>
) {
    const handlers = new Map<
        string,
        (...args: any[]) => void
    >();

    const plugin = {
        app: {
            vault: {
                on: (
                    name: string,
                    handler: (...args: any[]) => void
                ) => {
                    handlers.set(name, handler);
                    return {};
                }
            }
        },

        registerEvent: () => undefined
    } as unknown as Plugin;

    const repository =
        new MemoryStatsRepository();

    const controller =
        new VaultEventController(
            plugin,
            repository,
            { flushFile } as EditorEventController
        );

    controller.start();

    return {
        handlers,
        repository,
        controller
    };
}

const zero = {
    chinese: 0,
    englishWords: 0,
    englishChars: 0,
    numbers: 0,
    punctuation: 0,
    spaces: 0,
    total: 0
};

describe("VaultEventController", () => {
    test(
        "重命名前等待旧文件编辑提交",
        async () => {
            const events: string[] = [];

            const {
                handlers,
                repository,
                controller
            } = setup(async () => {
                events.push("flush");

                await repository.saveSnapshot({
                    path: "old.md",
                    modifiedAt: 1,
                    counts: zero
                });
            });

            const originalRename =
                repository.renameFile.bind(
                    repository
                );

            jest.spyOn(
                repository,
                "renameFile"
            ).mockImplementation(async (...args) => {
                events.push("rename");

                return originalRename(...args);
            });

            handlers.get("rename")!(
                createMockMarkdownFile("new.md"),
                "old.md"
            );

            await controller.stop();

            expect(events).toEqual([
                "flush",
                "rename"
            ]);

            expect(
                await repository.getSnapshot(
                    "new.md"
                )
            ).toBeDefined();

            expect(
                await repository.getSnapshot(
                    "old.md"
                )
            ).toBeUndefined();
        }
    );

    test(
        "删除前等待编辑提交，再移除快照",
        async () => {
            const events: string[] = [];

            const {
                handlers,
                repository,
                controller
            } = setup(async () => {
                events.push("flush");

                await repository.saveSnapshot({
                    path: "delete.md",
                    modifiedAt: 1,
                    counts: zero
                });
            });

            const originalDelete =
                repository.removeSnapshot.bind(
                    repository
                );

            jest.spyOn(
                repository,
                "removeSnapshot"
            ).mockImplementation(async path => {
                events.push("delete");

                return originalDelete(path);
            });

            handlers.get("delete")!(
                createMockMarkdownFile("delete.md")
            );

            await controller.stop();

            expect(events).toEqual([
                "flush",
                "delete"
            ]);

            expect(
                await repository.getSnapshot(
                    "delete.md"
                )
            ).toBeUndefined();
        }
    );
});
