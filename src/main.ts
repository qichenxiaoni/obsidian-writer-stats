import { Notice, Plugin } from "obsidian";

export default class WordCountPlugin extends Plugin {
    async onload(): Promise<void> {
        console.log("Word Count Plugin v1 loaded");

        this.addCommand({
            id: "show-word-count-test-nitice",
            name: "测试插件是否正常运行",
            callback: () => {
                new Notice("Word Count Plugin V1 运行正常");
            }
        });
    }

    onunload(): void {
        console.log("Word Count Plugin v1 unloaded");
    }
}