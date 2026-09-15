import type { CountResult } from "../domain/CountResult";

export interface AnalyzerOptions {
    excludeFrontmatter: boolean;
    excludeCodeBlocks: boolean;
    excludeInlineCode: boolean;
    excludeComments: boolean;
    excludeEmbeds: boolean;
}

const DEFAULT_OPTIONS: AnalyzerOptions = {
    excludeFrontmatter: true,
    excludeCodeBlocks: true,
    excludeInlineCode: true,
    excludeComments: true,
    excludeEmbeds: true
};

export class TextAnalyzer {
    analyze(
        text: string,
        options: Partial<AnalyzerOptions> = {}
    ): CountResult {
        const resolvedOptions: AnalyzerOptions = {
            ...DEFAULT_OPTIONS,
            ...options
        };

        const content = this.preprocess(
            text,
            resolvedOptions
        );

        return this.count(content);
    }

    private preprocess(
        text: string,
        options: AnalyzerOptions
    ): string {
        let result = text;

        // ---------------------------------
        // 1. YAML Frontmatter
        // ---------------------------------

        if (options.excludeFrontmatter) {
            result = result.replace(
                /^---\s*\n[\s\S]*?\n---\s*(?:\n|$)/,
                ""
            );
        }

        // ---------------------------------
        // 2. Fenced code blocks
        // ---------------------------------

        if (options.excludeCodeBlocks) {
            result = result.replace(
                /```[\s\S]*?```/g,
                ""
            );
        }

        // ---------------------------------
        // 3. Inline code
        // ---------------------------------

        if (options.excludeInlineCode) {
            result = result.replace(
                /`[^`\n]*`/g,
                ""
            );
        }

        // ---------------------------------
        // 4. Obsidian comments
        // ---------------------------------

        if (options.excludeComments) {
            result = result.replace(
                /%%[\s\S]*?%%/g,
                ""
            );
        }

        // ---------------------------------
        // 5. Obsidian embeds
        //
        // ![[image.png]]
        // ![[note]]
        //
        // 默认完全不统计
        // ---------------------------------

        if (options.excludeEmbeds) {
            result = result.replace(
                /!\[\[[^\]]+\]\]/g,
                ""
            );
        }

        // ---------------------------------
        // 6. Obsidian wikilink with alias
        //
        // [[Project Plan|项目计划]]
        //          ↓
        // 项目计划
        // ---------------------------------

        result = result.replace(
            /\[\[[^|\]]+\|([^\]]+)\]\]/g,
            "$1"
        );

        // ---------------------------------
        // 7. Normal Obsidian wikilink
        //
        // [[项目计划]]
        //      ↓
        // 项目计划
        // ---------------------------------

        result = result.replace(
            /\[\[([^\]]+)\]\]/g,
            "$1"
        );

        // ---------------------------------
        // 8. Markdown links
        //
        // [OpenAI](https://openai.com)
        //          ↓
        // OpenAI
        // ---------------------------------

        result = result.replace(
            /\[([^\]\n]*)\]\([^)\n]*\)/g,
            "$1"
        );

        // ---------------------------------
        // 9. Obsidian Callout marker
        //
        // > [!NOTE] 提醒
        //          ↓
        // 提醒
        // ---------------------------------

        result = result.replace(
            /^\s*>\s*\[![^\]]+\]\s*/gm,
            ""
        );

        // ---------------------------------
        // 10. 普通 blockquote marker
        //
        // > 正文
        //   ↓
        // 正文
        // ---------------------------------

        result = result.replace(
            /^\s*>\s?/gm,
            ""
        );

        // ---------------------------------
        // 11. Task checkbox syntax
        //
        // - [ ] 完成插件
        // - [x] 完成测试
        //
        // 只保留正文
        // ---------------------------------

        result = result.replace(
            /^\s*[-*+]\s+\[[ xX]\]\s*/gm,
            ""
        );

        // ---------------------------------
        // 12. Markdown list marker
        //
        // - 内容
        // * 内容
        // + 内容
        //
        // 只保留正文
        // ---------------------------------

        result = result.replace(
            /^\s*[-*+]\s+/gm,
            ""
        );

        // ---------------------------------
        // 13. Highlight
        //
        // ==重要内容==
        //      ↓
        // 重要内容
        // ---------------------------------

        result = result.replace(
            /==([^=\n]+)==/g,
            "$1"
        );

        // ---------------------------------
        // 14. Strikethrough
        //
        // ~~旧内容~~
        //     ↓
        // 旧内容
        // ---------------------------------

        result = result.replace(
            /~~([^~\n]+)~~/g,
            "$1"
        );

        // ---------------------------------
        // 15. Obsidian tags
        //
        // #写作
        //   ↓
        // 写作
        //
        // 这里只去掉 #，保留标签文本
        // ---------------------------------

        result = result.replace(
            /(^|\s)#(?=[\p{L}\p{N}_/-])/gu,
            "$1"
        );

        return result;
    }

    private count(text: string): CountResult {
        let chinese = 0;
        let englishChars = 0;
        let numbers = 0;
        let punctuation = 0;
        let spaces = 0;

        for (const char of text) {
            if (/\p{Script=Han}/u.test(char)) {
                chinese++;
                continue;
            }

            if (/[A-Za-z]/.test(char)) {
                englishChars++;
                continue;
            }

            if (/\p{N}/u.test(char)) {
                numbers++;
                continue;
            }

            if (/\p{P}/u.test(char)) {
                punctuation++;
                continue;
            }

            if (/\s/u.test(char)) {
                spaces++;
            }
        }

        const englishWords =
            text.match(
                /[A-Za-z]+(?:['’._-][A-Za-z]+)*/g
            )?.length ?? 0;

        return {
            chinese,
            englishWords,
            englishChars,
            numbers,
            punctuation,
            spaces,

            total:
                chinese +
                englishChars +
                numbers +
                punctuation
        };
    }
}