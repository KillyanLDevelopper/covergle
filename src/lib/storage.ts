export type Mode = "daily" | "infinite";

export type Stats = {
    played: number;
    wins: number;
    currentStreak: number;
    bestStreak: number;
    winDistribution: Record<"1" | "2" | "3" | "4" | "5" | "6", number>;
};

const STATS_KEY = "covergle.stats.v1";
const DAILY_STATE_PREFIX = "covergle.daily.v1.";

export function loadStats(): Stats {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) {
        try {
            return JSON.parse(raw) as Stats;
        } catch {
            localStorage.removeItem(STATS_KEY);
        }
    }
    return {
        played: 0,
        wins: 0,
        currentStreak: 0,
        bestStreak: 0,
        winDistribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0 }
    };
}

export function saveStats(stats: Stats): void {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

export type DailyState = {
    dateIso: string;
    gameId: string;
    guesses: string[];
    isOver: boolean;
    isWin: boolean;
};

export function loadDailyState(dateIso: string): DailyState | null {
    const raw = localStorage.getItem(DAILY_STATE_PREFIX + dateIso);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as DailyState;
    } catch {
        localStorage.removeItem(DAILY_STATE_PREFIX + dateIso);
        return null;
    }
}

export function saveDailyState(state: DailyState): void {
    localStorage.setItem(DAILY_STATE_PREFIX + state.dateIso, JSON.stringify(state));
}

export function clearDailyState(dateIso: string): void {
    localStorage.removeItem(DAILY_STATE_PREFIX + dateIso);
}
