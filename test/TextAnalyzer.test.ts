import { TextAnalyzer } from "../src/core/TextAnalyzer";

describe("TextAnalyzer", () => {
    const analyzer = new TextAnalyzer();

    test("统计中文字符", () => {
        const result = analyzer.analyze("你好世界");

        expect(result.chinese).toBe(4);
        expect(result.englishWords).toBe(0);
    });

    test("统计英文单词和字符", () => {
        const result = analyzer.analyze("Hello world");

        expect(result.englishWords).toBe(2);
        expect(result.englishChars).toBe(10);
    });

    test("统计中英文混合文本", () => {
        const result = analyzer.analyze("你好 Hello world");

        expect(result.chinese).toBe(2);
        expect(result.englishWords).toBe(2);
        expect(result.englishChars).toBe(10);
    });

    test("统计数字", () => {
        const result = analyzer.analyze("今天写了123个字");

        expect(result.numbers).toBe(3);
    });

    test("英文缩写中的撇号保持为一个单词", () => {
        const result = analyzer.analyze("dont't stop");

        expect(result.englishWords).toBe(2);
    });

    test("连字符英文单词作为一个单词", () => {
        const result = analyzer.analyze("mother-in-law");

        expect(result.englishWords).toBe(1);
    });

    test("emoji不计入中文或英文", () => {
        const result = analyzer.analyze("你好 👋 world");

        expect(result.chinese).toBe(2);
        expect(result.englishWords).toBe(1);
    });

    test("空文本返回全部为 0", () => {
        const result = analyzer.analyze("");

        expect(result.chinese).toBe(0);
        expect(result.englishWords).toBe(0);
        expect(result.englishChars).toBe(0);
        expect(result.numbers).toBe(0);
        expect(result.total).toBe(0);
    });

    test("默认忽略 YAML frontmatter", () => {
        const result = analyzer.analyze(
            `---
title: Hello
tags: test
---

正文内容`
        );

        expect(result.chinese).toBe(4);
        expect(result.englishWords).toBe(0);
    });

    test("默认忽略 fenced code block", () => {
        const result = analyzer.analyze(
            `正文

\`\`\`ts
const hello = "world";
\`\`\`

结束`
        );

        expect(result.chinese).toBe(4);
        expect(result.englishWords).toBe(0);
    });

    test("默认忽略 inline code", () => {
        const result = analyzer.analyze(
            "你好 `const test = true` 世界"
        );

        expect(result.chinese).toBe(4);
        expect(result.englishWords).toBe(0);
    });

    test("默认忽略 Obsidian comment", () => {
        const result = analyzer.analyze(
            "你好 %% hidden comment %% 世界"
        );

        expect(result.chinese).toBe(4);
        expect(result.englishWords).toBe(0);
    });

    test("Markdown link 只统计显示文本", () => {
        const result = analyzer.analyze(
            "[OpenAI](https://openai.com)"
        );

        expect(result.englishWords).toBe(1);
        expect(result.englishChars).toBe(6);
    });

    test("可以关闭 frontmatter 忽略", () => {
        const result = analyzer.analyze(
            `---
title: Hello
---
正文`,
            {
                excludeFrontmatter: false
            }
        );

        expect(result.englishWords).toBeGreaterThan(0);
    });

    test("wikilink 统计目标文本", () => {
        const result = analyzer.analyze("[[项目计划]]");

        expect(result.chinese).toBe(4);
    });

    test("带 alias 的 wikilink 只统计 alias", () => {
        const result = analyzer.analyze("[[Project Plan|项目计划]]");

        expect(result.chinese).toBe(4);
        expect(result.englishWords).toBe(0);
    });

    test("embed 默认不统计", () => {
        const result = analyzer.analyze("你好 ![[image.png]] 世界");

        expect(result.chinese).toBe(4);
        expect(result.englishWords).toBe(0);
    });

    test("Obsidian tag 不统计#", () => {
        const result = analyzer.analyze("#写作");

        expect(result.chinese).toBe(2);
        expect(result.punctuation).toBe(0);
    });

    test("高亮语法只统计内容", () => {
        const result = analyzer.analyze("==重要内容==");

        expect(result.chinese).toBe(4);
        expect(result.punctuation).toBe(0);
    });

    test("删除线默认统计正文", () => {
        const result = analyzer.analyze("~~旧内容~~");

        expect(result.chinese).toBe(3);
        expect(result.punctuation).toBe(0);
    });

    test("任务只统计任务正文", () => {
        const result = analyzer.analyze("- [ ] 完成插件");

        expect(result.chinese).toBe(4);
        expect(result.punctuation).toBe(0);
    });

    test("已完成任务只统计正文", () => {
        const result = analyzer.analyze("- [x] 完成测试");

        expect(result.chinese).toBe(4);
        expect(result.punctuation).toBe(0);
        expect(result.englishWords).toBe(0);
    });

    test("callout 标记本身不统计", () => {
        const result = analyzer.analyze(
            `> [!NOTE] 提醒
> 今天继续开发插件`
        );

        expect(result.englishWords).toBe(0);
        expect(result.chinese).toBe(10);
    });
});