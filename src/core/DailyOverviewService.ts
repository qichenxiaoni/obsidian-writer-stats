import type { DailyOverview } from "../domain/DailyOverview";
import type { DailyStatsService } from "./DailyStatsService";
import type { PluginSettingsService } from "./PluginSettingsService";
import type { GoalService } from "./GoalService";

export class DailyOverviewService {
    constructor(
        private readonly statsService:
            DailyStatsService,

        private readonly settingsService:
            PluginSettingsService,

        private readonly goalService:
            GoalService
    ) {}

    async getOverview(
        date: string
    ): Promise<DailyOverview> {
        const [
            summary,
            settings
        ] = await Promise.all([
            this.statsService.getSummary(
                date
            ),

            this.settingsService
                .getSettings()
        ]);

        return {
            summary,

            goal:
                this.goalService.calculte(
                    summary.added.total,
                    settings.dailyGoal
                )
        };
    }
}