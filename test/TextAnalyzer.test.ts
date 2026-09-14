import { TextAnalyzer } from "../src/core/TextAnalyzer";

describe("TextAnalyzer", () => {
    const analyze = new TextAnalyzer();

    test("统计中文字符",() => {
        const result = analyze.analyze("你好世界");

        expect(result.chinese).toBe(4);
        expect(result.englishWords).toBe(0);
    });

    test("统计英文单词和字符", () => {
        const result = analyze.analyze("Hello world");

        expect(result.englishWords).toBe(2);
        expect(result.englishChars).toBe(10);
    });

    test("统计中英文混合文本",() => {
        const result = analyze.analyze("你好 Hello world");

        expect(result.chinese).toBe(2);
        expect(result.englishWords).toBe(2);
        expect(result.englishChars).toBe(10);
    });

    test("统计数字" , () => {
        const result = analyze.analyze("今天写了123个字");
        
        expect(result.numbers).toBe(3);
    });

    test("英文缩写中的撇号保持为一个单词", () => {
        const result = analyze.analyze("dont't stop");

        expect(result.englishWords).toBe(2);
    });

    test("连字符英文单词作为一个单词" , () => {
        const result = analyze.analyze("mother-in-law");

        expect(result.englishWords).toBe(1);
    });

    test("emoji不计入中文或英文", () => {
        const result = analyze.analyze("你好 👋 world");

        expect(result.chinese).toBe(2);
        expect(result.englishWords).toBe(1);
    });

    test("空文本返回全部为 0", () => {
        const result = analyze.analyze("");

        expect(result.chinese).toBe(0);
        expect(result.englishWords).toBe(0);
        expect(result.englishChars).toBe(0);
        expect(result.numbers).toBe(0);
        expect(result.total).toBe(0);
    });
});