import type { DailyHistoryService } from "../core/DailyHistoryService";
import { renderYearHeatmapSection } from "./YearHeatmapSection";

export interface AnnualHeatmapSectionOptions {
    historyService: Pick<DailyHistoryService, "getSummary">;
    selectedYear: number | null;
    onSelectYear: (year: number) => void;
}

export interface AnnualHeatmapSectionHandle {
    dispose(): void;
}

/**
 * Dashboard 年度热力图控制模块。
 *
 * 负责年份导航、数据请求与生命周期；实际热力图绘制
 * 仍由 Dashboard 和统计弹窗共用的 YearHeatmapSection 完成。
 */

export function renderAnnualHeatmapSection(
    container: HTMLElement,
    today: string,
    options: AnnualHeatmapSectionOptions
): AnnualHeatmapSectionHandle {
    const currentYear = Number(today.slice(0,4));

    let year = Math.min(
        Math.max(1000,options.selectedYear ?? currentYear),
        currentYear
    );

    let disposed = false;
    let requestVersion = 0;

    const section = container.createDiv({
        cls: "writer-stats-dashboard__annual"
    });

    const header = section.createDiv({
        cls: "writer-stats-dashboard__annual-header"
    });

    header.createEl("h2", {
        cls: "writer-stats-dashboard__section-title",
        text: "年度写作热力图"
    });

    const controls = header.createDiv({
        cls: "writer-stats-dashboard__annual-nav"
    });

    const previous = controls.createEl("button",{
        text: "‹"
    });

    previous.type = "button";
    previous.setAttribute("aria-label","上一年");

    const label = controls.createSpan({
        cls: "writer-stats-dashboard__annual-year"
    });

    const next = controls.createEl("button",{
        text: "›"
    });

    next.type = "button";
    next.setAttribute("aria-label","下一年");

    const viewport = section.createDiv({
        cls: "writer-stats-dashboard__annual-viewport"
    });

    const load = async (): Promise<void> => {
        if (disposed) {
            return;
        }

        const version = ++requestVersion;
        const requestedYear = year;

        label.setText(`${requestedYear}年`);

        previous.disabled = requestedYear <= 1000;
        next.disabled = requestedYear >= currentYear;

        viewport.setAttribute("aria-busy","true");

        // 切换年份时保留原内容，避免出现空白闪烁
        if (!viewport.hasChildNodes()) {
            viewport.createDiv({
                text: "正在加载年度热力图...."
            });
        }

        try {
            const lastDate = requestedYear === currentYear
                ? today
                : `${requestedYear}-12-31`;

            const summary = await options.historyService.getSummary(
                `${requestedYear}-01-01`,
                lastDate
            );

            if (
                disposed ||
                version !== requestVersion ||
                !viewport.isConnected
            ) {
                return;
            }

            viewport.empty();

            renderYearHeatmapSection(
                viewport,
                summary,
                `${requestedYear} 年`
            );

            viewport.setAttribute("aria-busy","false");
        } catch (error) {
            if (
                disposed ||
                version !== requestVersion ||
                !viewport.isConnected
            ) {
                return;
            }

            console.error(
                "[Writer Stats] 年度热力图加载失败",
                error
            );

            viewport.empty();

            viewport.createDiv({
                text: "年度热力图加载失败，请重新选择年份"
            });

            viewport.setAttribute("aria-busy","false");
        }
    };

    previous.addEventListener("click", () => {
        if (disposed || year <= 1000) {
            return;
        }

        year -= 1;
        options.onSelectYear(year);

        void load();
    });

    next.addEventListener("click", () => {
        if (disposed || year >= currentYear) {
            return;
        }

        year += 1;
        options.onSelectYear(year);

        void load();
    });

    void load();

    return {
        dispose(): void {
            disposed = true;
            ++requestVersion;
        }
    };
}