
import type {
    DailyHistorySummary
} from "../src/domain/DailyHistorySummary";

import {
    renderHistorySection
} from "../src/ui/HistorySection";

jest.mock("../src/ui/TrendChartSection", () => ({
    renderTrendChartSection: jest.fn()
}));

interface FakeOptions {
    cls?: string | string[];
    text?: string;
    attr?: Record<string, string>;
}

class FakeElement {
    readonly children: FakeElement[] = [];
    readonly attrs: Record<string, string> = {};
    readonly listeners: Record<string, () => void> = {};
    readonly classes = new Set<string>();

    readonly classList = {
        toggle: (name: string, force: boolean): void => {
            if (force) {
                this.classes.add(name);
            } else {
                this.classes.delete(name);
            }
        }
    };

    text = "";
    isConnected = true;

    constructor(options: FakeOptions = {}) {
        const classes = typeof options.cls === "string"
            ? options.cls.split(" ")
            : options.cls ?? [];

        classes.forEach(name => this.classes.add(name));
        Object.assign(this.attrs, options.attr ?? {});
        this.text = options.text ?? "";
    }

    private add(options: FakeOptions): FakeElement {
        const child = new FakeElement(options);
        this.children.push(child);
        return child;
    }

    createDiv(options: FakeOptions = {}): FakeElement {
        return this.add(options);
    }

    createEl(
        _tag: string,
        options: FakeOptions = {}
    ): FakeElement {
        return this.add(options);
    }

    createSpan(options: FakeOptions = {}): FakeElement {
        return this.add(options);
    }

    addEventListener(
        event: string,
        callback: () => void
    ): void {
        this.listeners[event] = callback;
    }

    setAttribute(name: string, value: string): void {
        this.attrs[name] = value;
    }

    empty(): void {
        this.children.length = 0;
    }

    findByText(text: string): FakeElement | undefined {
        if (this.text === text) {
            return this;
        }

        for (const child of this.children) {
            const found = child.findByText(text);
            if (found) return found;
        }

        return undefined;
    }

    findByClass(name: string): FakeElement | undefined {
        if (this.classes.has(name)) {
            return this;
        }

        for (const child of this.children) {
            const found = child.findByClass(name);
            if (found) return found;
        }

        return undefined;
    }
}

function createSummary(
    start: string,
    end: string
): DailyHistorySummary {
    return {
        startDate: start,
        endDate: end,
        totalDays: 7,
        activeDays: 1,
        added: 12,
        deleted: 2,
        net: 10,
        writingStreak: 1,
        longesWritingStreak: 1,
        bestWritingDay: {
            date: end,
            added: 12
        },
        days: []
    };
}

describe("HistorySection 7/30 天历史模块", () => {
    test("切换至 30 天后更新按钮、日期和选择状态", async () => {
        const root = new FakeElement();
        const onSelectDays = jest.fn();

        const getRecentSummary = jest.fn().mockResolvedValue(
            createSummary("2026-10-14", "2026-11-12")
        );

        renderHistorySection(
            root as unknown as HTMLElement,
            "2026-11-12",
            createSummary("2026-11-06", "2026-11-12"),
            {
                historyService: { getRecentSummary },
                selectedDays: 7,
                onSelectDays
            }
        );

        // 确认选择容器使用与 CSS 一致的类名
        expect(
            root.findByClass(
                "writer-stats-dashboard__history-selector"
            )
        ).toBeDefined();

        // 初始状态： 7 天选中， 30 天未选中
        expect(
            root.findByText("7 天")?.classes.has("is-active")
        ).toBe(true);

        expect(
            root.findByText("30 天")?.classes.has("is-active")
        ).toBe(false);

        expect(
            root.findByText("7 天")?.attrs["aria-pressed"]
        ).toBe("true");

        root.findByText("30 天")?.listeners.click();

        expect(onSelectDays).toHaveBeenCalledWith(30);
        expect(getRecentSummary).toHaveBeenCalledWith(
            "2026-11-12",
            30
        );

        expect(
            root.findByText("30 天")?.attrs["aria-pressed"]
        ).toBe("true");

        // 切换之后，视觉状态对应的 CSS 类也必须更新

        expect(
            root.findByText("30 天")?.classes.has("is-active")
        ).toBe(true);

        expect(
            root.findByText("7 天")?.classes.has("is-active")
        ).toBe(false);

        await Promise.resolve();

        expect(
            root.findByText("2026-10-14 ~ 2026-11-12")
        ).toBeDefined();
    });

    test("旧的 30 天请求不能覆盖新的 7 天结果", async () => {
        const root = new FakeElement();

        const resolvers: Array<
            (value: DailyHistorySummary) => void
        > = [];

        const getRecentSummary = jest.fn().mockImplementation(
            () => new Promise<DailyHistorySummary>(resolve => {
                resolvers.push(resolve);
            })
        );

        renderHistorySection(
            root as unknown as HTMLElement,
            "2026-11-12",
            createSummary("2026-11-06", "2026-11-12"),
            {
                historyService: { getRecentSummary },
                selectedDays: 7,
                onSelectDays: jest.fn()
            }
        );

        root.findByText("30 天")?.listeners.click();
        root.findByText("7 天")?.listeners.click();

        resolvers[1](
            createSummary("2026-11-06", "2026-11-12")
        );

        await Promise.resolve();

        resolvers[0](
            createSummary("2026-10-14", "2026-11-12")
        );

        await Promise.resolve();

        expect(
            root.findByText("2026-11-06 ~ 2026-11-12")
        ).toBeDefined();

        expect(
            root.findByText("2026-10-14 ~ 2026-11-12")
        ).toBeUndefined();
    });

    test("销毁后未完成的请求不得写回 DOM", async () => {
        const root = new FakeElement();

        let resolveSummary!:
            (value: DailyHistorySummary) => void;

        const getRecentSummary = jest.fn().mockImplementation(
            () => new Promise<DailyHistorySummary>(resolve => {
                resolveSummary = resolve;
            })
        );

        const handle = renderHistorySection(
            root as unknown as HTMLElement,
            "2026-11-12",
            createSummary("2026-11-06", "2026-11-12"),
            {
                historyService: { getRecentSummary },
                selectedDays: 7,
                onSelectDays: jest.fn()
            }
        );

        root.findByText("30 天")?.listeners.click();

        handle.dispose();

        resolveSummary(
            createSummary("2026-10-14", "2026-11-12")
        );

        await Promise.resolve();

        expect(
            root.findByClass(
                "writer-stats-dashboard__history-loading"
            )
        ).toBeDefined();

        expect(
            root.findByText("2026-10-14 ~ 2026-11-12")
        ).toBeUndefined();
    });
});
