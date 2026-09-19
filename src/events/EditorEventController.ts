import {
    type Editor,
    MarkdownView,
    Plugin,
    TFile
} from "obsidian";

import { ActivityTracker } from "src/core/ActivityTracker";
import { TextAnalyzer } from "src/core/TextAnalyzer";
import { getLocalDateKey } from "src/utils/DateService";

const EDIT_DEBOUNCE_MS = 500;

export class EditorEventController {
    private readonly timers = new Map<string,number>();

    constructor(
        private readonly plugin: Plugin,
        private readonly analyzer: TextAnalyzer,
        private readonly tracker: ActivityTracker
    ) {}

    start(): void {
        this.initializeOpenMarkdownFiles();
        this.plugin.registerEvent(
            this.plugin.app.workspace.on(
                "file-open",file => {
                    if (!file) {
                        return;
                    }

                    void this.initializeFile(file);
                }
            )
        );

        this.plugin.registerEvent(
            this.plugin.app.workspace.on(
                "editor-change",(editor,info) => {
                    const file = info.file;

                    if(!file) {
                        return;
                    }

                    this.scheduleEditorChange(
                        editor,file
                    );
                }
            )
        );
    }

    stop(): void {
        for (const timer of this.timers.values()) {
            window.clearTimeout(timer);
        }

        this.timers.clear();
    }

    private initializeOpenMarkdownFiles(): void {
        const leaves = this.plugin.app.workspace.getLeavesOfType("markdown");

        for (const leaf of leaves) {
            const view = leaf.view;

            if (!(view instanceof MarkdownView)) {
                continue;
            }

            const file = view.file;

            if (!file){
                continue;
            }

            void this.initializeFile(file);
        }
    }

    private async initializeFile(
        file: TFile
    ): Promise<void> {
        const content = await this.plugin.app.vault.cachedRead(file);
        const counts = this.analyzer.analyze(content);
        await this.tracker.ensureBaseline(file.path,file.stat.mtime,counts);
    }

    private scheduleEditorChange(
        editor: Editor,
        file: TFile
    ): void {
        const existing = this.timers.get(file.path);

        if (existing !== undefined) {
            window.clearTimeout(existing);
        }

        const timer = window.setTimeout(() => {
            this.timers.delete(file.path);

            void this.processEditorChange(editor,file);
        }, EDIT_DEBOUNCE_MS);

        this.timers.set(file.path,timer);
    }

    private async processEditorChange(
        editor: Editor,
        file: TFile
    ): Promise<void> {
        const text = editor.getValue();
        const counts = this.analyzer.analyze(text);
        const date = getLocalDateKey();

        await this.tracker.track(date,file.path,Date.now(),counts);
    }
}