import type { GoalProgress } from "../domain/GoalProgress";

export class GoalService {
    calculte (
        current: number,
        goal: number
    ): GoalProgress {
        const safeCurrent = 
            Math.max(
                0,
                current
            );

        const safeGoal = 
            Math.max(
                1,
                goal
            );

        const remaining = 
            Math.max(
                0,
                safeGoal - safeCurrent
            );

        const percentage = 
            Math.round(
                (
                    safeCurrent /
                    safeGoal
                ) * 100
            );

        return {
            current: safeCurrent,

            goal: safeGoal,

            remaining,

            percentage,

            completed: safeCurrent >= safeGoal
        };
    }
}