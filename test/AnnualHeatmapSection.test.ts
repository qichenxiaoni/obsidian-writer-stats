
import type {
    DailyHistorySummary
} from "../src/domain/DailyHistorySummary";

import {
    renderAnnualHeatmapSection
} from "../src/ui/AnnualHeatmapSection";

import {
    renderYearHeatmapSection
} from "../src/ui/YearHeatmapSection";

jest.mock("../src/ui/YearHeatmapSection", () => ({
    renderYearHeatmapSection: jest.fn()
}));

interface FakeOptions {
    cls?: string;
    text?: string;
}

class FakeElement {
    readonly children: FakeElement[] = [];
    readonly attrs: Record<string, string> = {};
    readonly listeners: Record<string, () => void> = {};
    readonly classes = new Set<string>();

    text = "";
    type = "";
    disabled = false;
    isConnected = true;

    constructor(options: FakeOptions = {}) {
        options.cls?.split(" ").forEach(
            cls => this.classes.add(cls)
        );

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

    createSpan(options: FakeOptions = {}): FakeElement {
        return this.add(options);
    }

    createEl(
        _tag: string,
        options: FakeOptions = {}
    ): FakeElement {
        return this.add(options);
    }

    setAttribute(
        name: string,
        value: string
    ): void {
        this.attrs[name] = value;
    }

    setText(text: string): void {
        this.text = text;
    }

    hasChildNodes(): boolean {
        return this.children.length > 0;
    }

    empty(): void {
        this.children.length = 0;
    }

    addEventListener(
        event: string,
        callback: () => void
    ): void {
        this.listeners[event] = callback;
    }

    findByClass(name: string): FakeElement | undefined {
        if (this.classes.has(name)) {
            return this;
        }

        for (const child of this.children) {
            const found = child.findByClass(name);

            if (found) {
                return found;
            }
        }

        return undefined;
    }

    findByAria(label: string): FakeElement | undefined {
        if (this.attrs["aria-label"] === label) {
            return this;
        }

        for (const child of this.children) {
            const found = child.findByAria(label);

            if (found) {
                return found;
            }
        }

        return undefined;
    }
}

function summary(date: string): DailyHistorySummary {
    return {
        startDate: date,
        endDate: date,
        totalDays: 1,
        activeDays: 0,
        added: 0,
        deleted: 0,
        net: 0,
        writingStreak: 0,
        longesWritingStreak: 0,
        bestWritingDay: null,
        days: []
    };
}

describe("AnnualHeatmapSection Dashboard 年度控制器", () => {

    test(
        "当前年份仅查到今天且禁止向未来切换",
        async () => {
            const root = new FakeElement();

            const getSummary = jest.fn()
                .mockResolvedValue(
                    summary("2026-11-16")
                );

            const onSelectYear = jest.fn();

            renderAnnualHeatmapSection(
                root as unknown as HTMLElement,
                "2026-11-16",
                {
                    historyService: { getSummary },
                    selectedYear: null,
                    onSelectYear
                }
            );

            expect(getSummary).toHaveBeenCalledWith(
                "2026-01-01",
                "2026-11-16"
            );

            expect(
                root.findByClass(
                    "writer-stats-dashboard__annual-year"
                )?.text
            ).toBe("2026年");

            expect(
                root.findByAria("下一年")?.disabled
            ).toBe(true);

            root.findByAria("下一年")?.listeners.click();

            expect(getSummary).toHaveBeenCalledTimes(1);

            expect(onSelectYear).not.toHaveBeenCalled();

            await Promise.resolve();

            expect(renderYearHeatmapSection).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    endDate: "2026-11-16"
                }),
                "2026 年"
            );

            expect(
                root.findByClass(
                    "writer-stats-dashboard__annual-viewport"
                )?.attrs["aria-busy"]
            ).toBe("false");
        }
    );

    test(
        "历史年份查询自然年且选中年份通过回调保留",
        async () => {
            const root = new FakeElement();

            const getSummary = jest.fn()
                .mockResolvedValue(
                    summary("2024-12-31")
                );

            const onSelectYear = jest.fn();

            const handle = renderAnnualHeatmapSection(
                root as unknown as HTMLElement,
                "2026-11-16",
                {
                    historyService: { getSummary },
                    selectedYear: 2024,
                    onSelectYear
                }
            );

            expect(getSummary).toHaveBeenCalledWith(
                "2024-01-01",
                "2024-12-31"
            );

            expect(
                root.findByAria("下一年")?.disabled
            ).toBe(false);

            root.findByAria("下一年")?.listeners.click();

            expect(onSelectYear).toHaveBeenCalledWith(2025);

            expect(getSummary).toHaveBeenLastCalledWith(
                "2025-01-01",
                "2025-12-31"
            );

            expect(
                root.findByClass(
                    "writer-stats-dashboard__annual-year"
                )?.text
            ).toBe("2025年");

            handle.dispose();

            const reloaded = new FakeElement();

            renderAnnualHeatmapSection(
                reloaded as unknown as HTMLElement,
                "2026-11-16",
                {
                    historyService: { getSummary },
                    selectedYear: 2025,
                    onSelectYear
                }
            );

            expect(getSummary).toHaveBeenLastCalledWith(
                "2025-01-01",
                "2025-12-31"
            );

            await Promise.resolve();
        }
    );

    test(
        "快速切换年份时旧请求不能覆盖最新年份",
        async () => {
            const resolvers: Array<
                (value: DailyHistorySummary) => void
            > = [];

            const getSummary = jest.fn(
                () => new Promise<DailyHistorySummary>(
                    resolve => {
                        resolvers.push(resolve);
                    }
                )
            );

            const root = new FakeElement();

            renderAnnualHeatmapSection(
                root as unknown as HTMLElement,
                "2026-11-16",
                {
                    historyService: { getSummary },
                    selectedYear: null,
                    onSelectYear: jest.fn()
                }
            );

            root.findByAria("上一年")?.listeners.click();
            root.findByAria("上一年")?.listeners.click();

            expect(getSummary).toHaveBeenNthCalledWith(
                3,
                "2024-01-01",
                "2024-12-31"
            );

            resolvers[2](summary("2024-12-31"));
            await Promise.resolve();

            resolvers[1](summary("2025-12-31"));
            resolvers[0](summary("2026-11-16"));
            await Promise.resolve();

            expect(
                renderYearHeatmapSection
            ).toHaveBeenCalledTimes(1);

            expect(
                renderYearHeatmapSection
            ).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                "2024 年"
            );

            expect(
                root.findByClass(
                    "writer-stats-dashboard__annual-year"
                )?.text
            ).toBe("2024年");
        }
    );

    test(
        "模块销毁后未完成的请求不得更新界面",
        async () => {
            let resolveSummary!:
                (value: DailyHistorySummary) => void;

            const getSummary = jest.fn(
                () => new Promise<DailyHistorySummary>(
                    resolve => {
                        resolveSummary = resolve;
                    }
                )
            );

            const onSelectYear = jest.fn();
            const root = new FakeElement();

            const handle = renderAnnualHeatmapSection(
                root as unknown as HTMLElement,
                "2026-11-16",
                {
                    historyService: { getSummary },
                    selectedYear: null,
                    onSelectYear
                }
            );

            handle.dispose();

            resolveSummary(summary("2026-11-16"));
            await Promise.resolve();

            expect(
                renderYearHeatmapSection
            ).not.toHaveBeenCalled();

            root.findByAria("上一年")?.listeners.click();

            expect(onSelectYear).not.toHaveBeenCalled();
            expect(getSummary).toHaveBeenCalledTimes(1);
        }
    );

    test(
        "请求失败时显示错误并解除忙碌状态",
        async () => {
            const root = new FakeElement();

            const getSummary = jest.fn()
                .mockRejectedValue(
                    new Error("bad data")
                );

            const spy = jest.spyOn(console, "error")
                .mockImplementation(() => { });

            try {
                renderAnnualHeatmapSection(
                    root as unknown as HTMLElement,
                    "2026-11-16",
                    {
                        historyService: { getSummary },
                        selectedYear: null,
                        onSelectYear: jest.fn()
                    }
                );

                await Promise.resolve();

                expect(
                    root.findByClass(
                        "writer-stats-dashboard__annual-viewport"
                    )?.attrs["aria-busy"]
                ).toBe("false");

                expect(spy).toHaveBeenCalledTimes(1);

                expect(
                    renderYearHeatmapSection
                ).not.toHaveBeenCalled();

            } finally {
                spy.mockRestore();
            }
        }
    );
});
