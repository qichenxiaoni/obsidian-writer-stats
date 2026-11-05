export interface WritingTimeDelta {
    activeMs: number,
    hourlyMs: number[];
}

export const MAX_ACTIVE_GAP_MS = 60_000;

function emptyDelta(): WritingTimeDelta {
    return {
        activeMs: 0,
        hourlyMs: Array(24).fill(0) as number[]
    };
}

export class WritingTimeClock {
    private last: {
        path: string;
        date: string;
        at: number
    } | null = null;

    private readonly pending = new Map<string, WritingTimeDelta>();

    record(
        path: string,
        date: string,
        hour: number,
        at: number
    ): void {
        if (
            !path ||
            !Number.isFinite(at) ||
            !Number.isInteger(hour) ||
            hour < 0 ||
            hour > 23
        ) {
            return;
        }

        const last = this.last;

        if (
            last &&
            last.path === path &&
            last.date === date
        ) {
            const gap = at - last.at;

            if (
                gap > 0 &&
                gap <= MAX_ACTIVE_GAP_MS
            ) {
                const key = JSON.stringify([
                    date,
                    path
                ]);

                const delta = this.pending.get(key) ?? emptyDelta();

                delta.activeMs += gap;
                delta.hourlyMs[hour] += gap;

                this.pending.set(key,delta);
            }
        }
        this.last = { path,date,at };
    }

    take(
        path: string,
        date: string
    ): WritingTimeDelta {
        const key = JSON.stringify([
            date,
            path
        ]);

        const result = this.pending.get(key) ?? emptyDelta();

        this.pending.delete(key);

        return result;
    }

    restore(
        path: string,
        date: string,
        delta: WritingTimeDelta
    ): void {
        const key = JSON.stringify([
            date,
            path
        ]);

        const current = this.pending.get(key) ?? emptyDelta();

        current.activeMs += delta.activeMs;

        for (let i = 0; i < 24; i++) {
            current.hourlyMs[i] += delta.hourlyMs[i];
        }

        this.pending.set(key,current);
    }

    reset(): void {
        this.last = null;
        this.pending.clear();
    }
}