import type { DailyHistoryService } from "../src/core/DailyHistoryService";
import type { DailyHistorySummary } from "../src/domain/DailyHistorySummary";
import { renderMonthlyStatsSection } from "../src/ui/MonthlyStatsSection";

jest.mock("obsidian", () => ({ Notice: jest.fn()}), { virtual: true });

jest.mock("../src/ui/CsvVaultExporter", () => ({saveMonthlyCsvToVault:jest.fn()}));

jest.mock("../src/ui/TrendChartSection", () => ({renderTrendChartSection: jest.fn()}));

interface CreateOptions {
    cls?: string | string[];
    text?: string;
}

class FakeElement {
    children: FakeElement[] = [];
    attrs: Record<string, string> = {};
    listeners: Record<string, () => void> = {};
    text = "";
    type = "";
    title = "";
    disabled = false;
    isConnected = true;
    classes: string[] = [];

    constructor(options: CreateOptions = {}) {
        this.classes = typeof options.cls === "string"
            ? options.cls.split(" ")
            : options.cls ?? [];
        this.text = options.text ?? "";
    }

    createDiv(options: CreateOptions = {}): FakeElement {
        return this.add(options);
    }

    createEl(_tag: string, options: CreateOptions = {}): FakeElement {
        return this.add(options);
    }

    createSpan(options: CreateOptions = {}): FakeElement {
        return this.add(options);
    }

    add(options: CreateOptions): FakeElement {
        const child = new FakeElement(options);
        this.children.push(child);
        return child;
    }

    setAttribute(key: string, value: string): void {
        this.attrs[key] = value;
    }

    setText(value: string): void {
        this.text = value;
    }

    addClass(value: string): void {
        this.classes.push(value);
    }

    removeClass(value: string): void {
        this.classes = this.classes.filter(item => item !== value);
    }

    empty(): void {
        this.children = [];
    }

    addEventListener(name: string, callback: () => void): void {
        this.listeners[name] = callback;
    }

    findByAria(label: string): FakeElement | undefined {
        if (this.attrs["aria-label"] === label) {
            return this;
        }

        for (const child of this.children) {
            const found = child.findByAria(label);
            if (found) return found;
        }

        return undefined;
    }
}

function summary(date: string): DailyHistorySummary {
    return {
        startDate: date,
        endDate:date,
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

describe("MonthlyStatsSection 请求有效性", () => {
    test("快速切换月份时，旧请求不会覆盖新月份", async () => {
        const resolvers: Array<
            (value: DailyHistorySummary) => void
        > = [];

        const getSummary = jest.fn(
            () => new Promise<DailyHistorySummary>(resolve => {
                resolvers.push(resolve);
            })
        );

        const root = new FakeElement();
        const onSupplementaryContent = jest.fn();
        const onSelectMonth = jest.fn();

        renderMonthlyStatsSection(
            root as unknown as HTMLElement,
            "2026-11-12",
            {
                app: {} as never,
                historyService: {
                    getSummary
                } as unknown as DailyHistoryService,
                csvExportService: {} as never,
                selectedMonth: null,
                onSelectMonth,
                onSupplementaryContent
            }
        );

        root.findByAria("上一个月")?.listeners.click();

        expect(onSelectMonth).toHaveBeenCalledWith("2026-10");

        resolvers[0](summary("2026-11-12"));
        await Promise.resolve();
        await Promise.resolve();

        expect(onSupplementaryContent).not.toHaveBeenCalled();

        resolvers[1](summary("2026-10-31"));
        await Promise.resolve();
        await Promise.resolve();

        expect(onSupplementaryContent).toHaveBeenCalledTimes(1);
        expect(onSupplementaryContent.mock.calls[0][1].month).toBe("2026-10");
    });

    test("销毁区域之后，未完成请求不能继续渲染", async () => {
        let resolveSummary!: (value: DailyHistorySummary) => void;

        const root = new FakeElement();
        const onSupplementaryContent = jest.fn();

        const handle = renderMonthlyStatsSection(
            root as unknown as HTMLElement,
            "2026-11-12",
            {
               app: {} as never,
               historyService: {
                    getSummary: () => 
                        new Promise<DailyHistorySummary>(
                            resolve => {
                                resolveSummary = resolve;
                            }
                        )
               } as unknown as DailyHistoryService,
               csvExportService: {} as never,
               selectedMonth: null,
               onSelectMonth: jest.fn(),
               onSupplementaryContent
            }
        );

        handle.dispose();
        resolveSummary(summary("2026-11-12"));

        await Promise.resolve();
        await Promise.resolve();

        expect(onSupplementaryContent).not.toHaveBeenCalled();
    });
});