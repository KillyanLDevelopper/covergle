import { isSameTitle } from "./normalize";
import type { IgdbGame } from "./igdb";
import type { Mode } from "./storage";

export const MAX_TRIES = 6;

export const OBSCURE_PLATFORMS = new Set([
    "Google Stadia", "Amazon Luna", "OnLive", "Ouya", "Nvidia Shield",
    "Oculus Quest", "Oculus Quest 2", "Oculus Rift", "Meta Quest 3",
    "Windows Phone", "Windows Mixed Reality", "Evercade", "Zeebo",
    "Tapwave Zodiac", "Gizmondo", "N-Gage", "Phantom"
]);

export function filterPlatforms(platforms: string[]): string[] {
    return platforms.filter(p => !OBSCURE_PLATFORMS.has(p));
}

export function isCorrect(guess: string, g: IgdbGame): boolean {
    if (isSameTitle(guess, g.title)) return true;
    return (g.aliases ?? []).some((a) => isSameTitle(guess, a));
}

export function getCommonPlatforms(guessedGame: IgdbGame | null, targetGame: IgdbGame): string[] {
    if (!guessedGame || !guessedGame.platforms || !targetGame.platforms) return [];
    return guessedGame.platforms.filter(p => targetGame.platforms?.includes(p));
}

export function getCommonGenres(guessedGame: IgdbGame | null, targetGame: IgdbGame): string[] {
    if (!guessedGame || !guessedGame.genres || !targetGame.genres) return [];
    return guessedGame.genres.filter(g => targetGame.genres?.includes(g));
}

export function hasSameYear(guessedGame: IgdbGame | null, targetGame: IgdbGame): boolean {
    if (!guessedGame || !guessedGame.year || !targetGame.year) return false;
    return guessedGame.year === targetGame.year;
}

export function shareText(triesUsed: number, win: boolean, mode: Mode, dateIso: string): string {
    const blocks = ["⬛", "🟫", "🟨", "🟧", "🟧", "🟧"];
    const emojis: string[] = [];
    for (let i = 0; i < Math.min(triesUsed, MAX_TRIES); i++) {
        emojis.push(blocks[Math.min(i, blocks.length - 1)]);
    }
    if (win && emojis.length > 0) emojis[emojis.length - 1] = "🟩";
    const header = `Covergle • ${mode === "daily" ? `Daily ${dateIso}` : "Infinite"}`;
    const score = win ? `Trouvé en ${triesUsed}/${MAX_TRIES} !` : `Pas trouvé (${MAX_TRIES}/${MAX_TRIES})`;
    return `${header}\n${score}\n${emojis.join(" ")}`;
}

export async function buildPool(): Promise<IgdbGame[]> {
    const res = await fetch("/api/pool");
    if (!res.ok) throw new Error(`/api/pool HTTP ${res.status}`);
    return res.json();
}
