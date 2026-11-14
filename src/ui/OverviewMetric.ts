// Dashboard 历史汇总与月度汇总共用的指标项
export function renderOverviewMetric (
    container: HTMLElement,
    label: string,
    value: string
): void {
    const item = container.createDiv({
        cls: "writer-stats-dashboard__overview-item"
    });

    item.createDiv({
        cls: "writer-stats-dashboard__overview-label",
        text: label
    });

    item.createDiv({
        cls: "writer-stats-dashboard__overview-value",
        text: value
    });
}