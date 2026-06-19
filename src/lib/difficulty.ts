export type Difficulty = "easy" | "medium" | "hard";

export const DIFFICULTY_THRESHOLDS: Record<Difficulty, number> = {
    easy: 500,
    medium: 50,
    hard: 5,
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
    easy: "Facile",
    medium: "Moyen",
    hard: "Difficile",
};

export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
    easy: "#10b981",
    medium: "#f59e0b",
    hard: "#ef4444",
};
