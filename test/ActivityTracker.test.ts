import { ActivityTracker } from "../src/core/ActivityTracker";
import type { CountResult } from "../src/domain/CountResult";
import { MemoryStatsRepository } from "../src/persistence/MemoryStatsRepository";

function makeCount(
    total: number
): CountResult {
    return {
        chinese: total,
        englishWords: 0,
        englishChars: 0,
        numbers: 0,
        punctuation: 0,
        spaces: 0,
        total
    };
}

function createTracker(): ActivityTracker {
    const repository = new MemoryStatsRepository();

    return new ActivityTracker(repository);
}

describe("ActivityTracker", () => {
    test("第一次看到文件只建立基线，不计入新增", async () => {
        const tracker = createTracker();

        const activity = await tracker.track(
            "2026-09-18",
            "A.md",
            1000,
            makeCount(100)
        );

        expect(activity.start.total).toBe(100);
        expect(activity.added.total).toBe(0);
        expect(activity.deleted.total).toBe(0);
        expect(activity.net.total).toBe(0);
    });

    test("后续新增内容会累计到 added 和 net", async () => {
        const tracker = createTracker();

        await tracker.track(
            "2026-09-18",
            "A.md",
            1000,
            makeCount(100)
        );

        const activity = await tracker.track(
            "2026-09-18",
            "A.md",
            2000,
            makeCount(130)
        );

        expect(activity.added.total).toBe(30);
        expect(activity.deleted.total).toBe(0);
        expect(activity.net.total).toBe(30);
    });

    test("删除内容会累计到 deleted", async () => {
        const tracker = createTracker();

        await tracker.track(
            "2026-09-18",
            "A.md",
            1000,
            makeCount(100)
        );

        await tracker.track(
            "2026-09-18",
            "A.md",
            2000,
            makeCount(130)
        );

        const activity =  await tracker.track(
            "2026-09-18",
            "A.md",
            3000,
            makeCount(110)
        );

        expect(activity.added.total).toBe(30);
        expect(activity.deleted.total).toBe(20);
        expect(activity.net.total).toBe(10);
    });

    test("多次新增会正确累计", async () => {
        const tracker = createTracker();

        await tracker.track(
            "2026-09-18",
            "A.md",
            1000,
            makeCount(100)
        );

        await tracker.track(
            "2026-09-18",
            "A.md",
            2000,
            makeCount(120)
        );

        const activity = await tracker.track(
            "2026-09-18",
            "A.md",
            3000,
            makeCount(150)
        );

        expect(activity.added.total).toBe(50);
        expect(activity.deleted.total).toBe(0);
        expect(activity.net.total).toBe(50);
    });

    test("不同日期的 activity 相互独立",  async () => {
        const tracker = createTracker();

        await tracker.track(
            "2026-09-18",
            "A.md",
            1000,
            makeCount(100)
        );

        await tracker.track(
            "2026-09-18",
            "A.md",
            2000,
            makeCount(120)
        );

        const nextDay = await tracker.track(
            "2026-09-19",
            "A.md",
            3000,
            makeCount(130)
        );

        expect(nextDay.start.total).toBe(120);
        expect(nextDay.added.total).toBe(10);
        expect(nextDay.net.total).toBe(10);
    });

    test("track 会把 activity 保存到 repository", async () => {
        const repository = new MemoryStatsRepository();

        const tracker = new ActivityTracker(repository);

        await tracker.track(
            "2026-09-18",
            "A.md",
            1000,
            makeCount(100)
        );

        await tracker.track(
            "2026-09-18",
            "A.md",
            2000,
            makeCount(140)
        );

        const activity = await repository.getActivity(
            "2026-09-18",
            "A.md"
        );

        expect(activity?.added.total).toBe(40);
        expect(activity?.net.total).toBe(40);
    });

    test("track 会更新 repository 中的 snapshot", async () => {
        const repository = new MemoryStatsRepository();

        const tracker = new ActivityTracker(repository);

        await tracker.track(
            "2026-09-18",
            "A.md",
            1000,
            makeCount(100)
        );

        await tracker.track(
            "2026-09-18",
            "A.md",
            2000,
            makeCount(125)
        );

        const snapshot = await repository.getSnapshot("A.md");

        expect(snapshot?.counts.total).toBe(125);
        expect(snapshot?.modifiedAt).toBe(2000);
    });
});