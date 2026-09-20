import { Plugin, TFile} from "obsidian";
import type { StatsRepository } from "src/persistence/StatsRepository";

export class VaultEventController {
    constructor(
        private readonly plugin: Plugin,
        private readonly repository: StatsRepository
    ) {}

    start(): void {
        this.plugin.registerEvent(
            this.plugin.app.vault.on(
                "rename",
                (file, oldPath) => {
                    if (!(file instanceof TFile)) {
                        return;
                    }

                    if (file.extension !== "md"){
                        return;
                    }

                    void this.repository.renameFile(
                        oldPath,
                        file.path
                    );
                }
            )
        );

        this.plugin.registerEvent (
            this.plugin.app.vault.on(
                "delete",
                file => {
                    if (!(file instanceof TFile)) {
                        return;
                    }

                    if (file.extension !== "md") {
                        return;
                    }

                    void this.repository.removeSnapshot(file.path);
                }
            )
        );
    }
}