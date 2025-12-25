import { useEffect, useMemo, useState } from "react";
import { dailyIndex, isoDateParis, randomIndex } from "./lib/daily";
import { isSameTitle } from "./lib/normalize";
import {
    loadDailyState,
    loadStats,
    saveDailyState,
    saveStats,
    type DailyState,
    type Mode
} from "./lib/storage";
import { CanvasPixelCover } from "./ui/CanvasPixelCover";
import { GuessBox } from "./ui/GuessBox";
import { igdbGet, igdbSearch, type IgdbGame } from "./lib/igdb";

const MAX_TRIES = 6;

function isCorrect(guess: string, g: IgdbGame) {
    if (isSameTitle(guess, g.title)) return true;
    return (g.aliases ?? []).some((a) => isSameTitle(guess, a));
}

function getCommonPlatforms(guessedGame: IgdbGame | null, targetGame: IgdbGame): string[] {
    if (!guessedGame || !guessedGame.platforms || !targetGame.platforms) return [];
    return guessedGame.platforms.filter(p => targetGame.platforms?.includes(p));
}

function hasSameYear(guessedGame: IgdbGame | null, targetGame: IgdbGame): boolean {
    if (!guessedGame || !guessedGame.year || !targetGame.year) return false;
    return guessedGame.year === targetGame.year;
}

function getCommonGenres(guessedGame: IgdbGame | null, targetGame: IgdbGame): string[] {
    if (!guessedGame || !guessedGame.genres || !targetGame.genres) return [];
    return guessedGame.genres.filter(g => targetGame.genres?.includes(g));
}

function shareGrid(triesUsed: number, win: boolean) {
    const blocks = ["⬛", "🟫", "🟨", "🟧", "🟩"];
    const lines: string[] = [];
    for (let i = 0; i < Math.min(triesUsed, MAX_TRIES); i++) {
        const t = Math.min(blocks.length - 1, Math.floor((i / (MAX_TRIES - 1)) * (blocks.length - 1)));
        lines.push(Array(6).fill(blocks[t]).join(""));
    }
    if (win && triesUsed > 0) lines[lines.length - 1] = Array(6).fill("🟩").join("");
    return lines.join("\n");
}

function dedupeById(items: IgdbGame[]) {
    const m = new Map<string, IgdbGame>();
    for (const x of items) {
        if (!x?.id) continue;
        if (!x.cover) continue;
        m.set(x.id, x);
    }
    return Array.from(m.values());
}

async function buildPool(): Promise<IgdbGame[]> {
    const seeds = [
        "a",
        "e",
        "i",
        "o",
        "u",
        "the",
        "of",
        "re",
        "en",
        "la",
        "war",
        "super",
        "final",
        "legend",
        "mario",
        "zelda",
        "pokemon",
        "call",
        "duty",
        "fifa",
        "ninja",
        "king",
        "dark",
        "red",
        "blue"
    ];

    const settled = await Promise.allSettled(seeds.map((s) => igdbSearch(s)));
    const ok = settled
        .filter((r) => r.status === "fulfilled")
        .flatMap((r) => (r as PromiseFulfilledResult<IgdbGame[]>).value);

    const pool = dedupeById(ok);

    if (pool.length >= 200) return pool.slice(0, 1200);

    const extraSeeds = ["game", "world", "story", "night", "star", "chrono", "mega", "street", "need", "speed", "metal", "gear"];
    const settled2 = await Promise.allSettled(extraSeeds.map((s) => igdbSearch(s)));
    const ok2 = settled2
        .filter((r) => r.status === "fulfilled")
        .flatMap((r) => (r as PromiseFulfilledResult<IgdbGame[]>).value);

    const pool2 = dedupeById(pool.concat(ok2));
    return pool2.slice(0, 1200);
}

async function resolveGameFromId(id: string, pool: IgdbGame[]) {
    const fromPool = pool.find((g) => g.id === id);
    if (fromPool) return fromPool;
    return await igdbGet(id);
}

export default function App() {
    const [mode, setMode] = useState<Mode>("daily");

    const dateIso = useMemo(() => isoDateParis(), []);
    const initialDailyState = useMemo(() => loadDailyState(dateIso), [dateIso]);

    const [pool, setPool] = useState<IgdbGame[]>([]);
    const [poolReady, setPoolReady] = useState(false);
    const [poolError, setPoolError] = useState<string | null>(null);

    const [dailyGame, setDailyGame] = useState<IgdbGame | null>(null);
    const [infiniteGame, setInfiniteGame] = useState<IgdbGame | null>(null);

    const [dailyState, setDailyState] = useState<DailyState>(() => {
        if (initialDailyState) return initialDailyState;
        return { dateIso, gameId: "", guesses: [], isOver: false, isWin: false };
    });

    const [infGuesses, setInfGuesses] = useState<string[]>([]);
    const [infOver, setInfOver] = useState(false);
    const [infWin, setInfWin] = useState(false);

    // Stocke les jeux devinés pour la comparaison des plateformes
    const [guessedGames, setGuessedGames] = useState<Map<string, IgdbGame>>(new Map());

    const currentGame = mode === "daily" ? dailyGame : infiniteGame;
    const guesses = mode === "daily" ? dailyState.guesses : infGuesses;
    const isOver = mode === "daily" ? dailyState.isOver : infOver;
    const isWin = mode === "daily" ? dailyState.isWin : infWin;

    const revealStep = Math.min(Math.max(guesses.length, 0), MAX_TRIES - 1);

    async function loadPool() {
        setPoolReady(false);
        setPoolError(null);
        setDailyGame(null);
        setInfiniteGame(null);
        try {
            const p = await buildPool();
            if (!p.length) {
                setPool([]);
                setPoolError("Pool vide (recherche IGDB).");
                setPoolReady(true);
                return;
            }
            setPool(p);
            setPoolReady(true);
        } catch (e) {
            setPool([]);
            setPoolError(String((e as any)?.message ?? e));
            setPoolReady(true);
        }
    }

    useEffect(() => {
        let alive = true;
        (async () => {
            await loadPool();
            if (!alive) return;
        })();
        return () => {
            alive = false;
        };
    }, []);

    useEffect(() => {
        let alive = true;
        if (!poolReady) return;
        if (!pool.length) return;

        (async () => {
            const existing = initialDailyState;

            if (existing?.dateIso === dateIso && existing?.gameId) {
                const g = await resolveGameFromId(existing.gameId, pool);
                if (!alive) return;
                if (g) {
                    setDailyGame(g);
                    return;
                }
            }

            const idx = dailyIndex(dateIso, pool.length);
            const pick = pool[idx] ?? null;
            if (!alive) return;

            if (pick) {
                setDailyGame(pick);
                const nextState: DailyState = { dateIso, gameId: pick.id, guesses: [], isOver: false, isWin: false };
                setDailyState(nextState);
                saveDailyState(nextState);
            }
        })();

        return () => {
            alive = false;
        };
    }, [poolReady, pool, dateIso, initialDailyState]);

    useEffect(() => {
        if (!poolReady) return;
        if (!pool.length) return;
        setInfiniteGame(pool[randomIndex(pool.length)] ?? null);
    }, [poolReady, pool]);

    function applyEnd(win: boolean, triesUsed: number) {
        const stats = loadStats();
        stats.played += 1;
        if (win) {
            stats.wins += 1;
            stats.currentStreak += 1;
            stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
            const k = String(Math.min(Math.max(triesUsed, 1), 6)) as "1" | "2" | "3" | "4" | "5" | "6";
            stats.winDistribution[k] += 1;
        } else {
            stats.currentStreak = 0;
        }
        saveStats(stats);
    }

    async function submitGuess(guess: string) {
        if (!currentGame) return;
        if (isOver) return;
        if (guesses.some((x) => isSameTitle(x, guess))) return;

        // Chercher le jeu deviné dans le pool
        const guessedGame = pool.find(g => isSameTitle(g.title, guess));
        if (guessedGame) {
            setGuessedGames(prev => new Map(prev).set(guess, guessedGame));
        }

        const next = [...guesses, guess].slice(0, MAX_TRIES);
        const win = isCorrect(guess, currentGame);
        const over = win || next.length >= MAX_TRIES;

        if (mode === "daily") {
            const nextState: DailyState = {
                ...dailyState,
                gameId: dailyState.gameId || currentGame.id,
                guesses: next,
                isOver: over,
                isWin: win
            };
            setDailyState(nextState);
            saveDailyState(nextState);
            if (over) applyEnd(win, next.length);
        } else {
            setInfGuesses(next);
            setInfOver(over);
            setInfWin(win);
            if (over) applyEnd(win, next.length);
        }
    }

    function resetInfinite() {
        if (!poolReady || pool.length === 0) return;
        setInfiniteGame(pool[randomIndex(pool.length)] ?? null);
        setInfGuesses([]);
        setInfOver(false);
        setInfWin(false);
        setGuessedGames(new Map());
    }

    const stats = useMemo(() => loadStats(), [mode, dailyState.isOver, infOver]);
    const title = mode === "daily" ? "Daily" : "Infinite";

    return (
        <div style={{
            minHeight: "100vh",
            color: "white",
            display: "flex",
            justifyContent: "center",
            padding: "20px",
            animation: "fadeIn 0.5s ease-out"
        }}>
            <div style={{
                width: "min(1100px, 100%)",
                display: "flex",
                flexDirection: "column",
                gap: 24
            }}>
                {/* Header moderne avec glassmorphism */}
                <header style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    padding: "20px 24px",
                    background: "rgba(255, 255, 255, 0.05)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: 20,
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
                    animation: "slideIn 0.6s ease-out"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <div style={{
                            width: 48,
                            height: 48,
                            borderRadius: 12,
                            background: "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 24,
                            fontWeight: 800,
                            boxShadow: "0 4px 15px rgba(124, 58, 237, 0.4)"
                        }}>
                            🎮
                        </div>
                        <div>
                            <div style={{
                                fontSize: 26,
                                fontWeight: 900,
                                letterSpacing: -0.5,
                                background: "linear-gradient(135deg, #ffffff 0%, #a78bfa 100%)",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                                backgroundClip: "text"
                            }}>
                                Covergle
                            </div>
                            <div style={{
                                opacity: 0.7,
                                fontSize: 13,
                                fontWeight: 500,
                                display: "flex",
                                alignItems: "center",
                                gap: 8
                            }}>
                                <span style={{
                                    padding: "2px 8px",
                                    background: mode === "daily" ? "rgba(124, 58, 237, 0.3)" : "rgba(6, 182, 212, 0.3)",
                                    borderRadius: 6,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                    letterSpacing: 0.5
                                }}>
                                    {title}
                                </span>
                                {mode === "daily" && <span>· {dateIso}</span>}
                                {!poolReady && <span>· Chargement…</span>}
                                {poolReady && poolError && <span style={{ color: "#ef4444" }}>· Erreur</span>}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <button
                            onClick={() => setMode("daily")}
                            style={{
                                padding: "10px 18px",
                                borderRadius: 12,
                                border: mode === "daily" ? "2px solid rgba(124, 58, 237, 0.5)" : "1px solid rgba(255,255,255,0.1)",
                                background: mode === "daily"
                                    ? "linear-gradient(135deg, rgba(124, 58, 237, 0.3) 0%, rgba(167, 139, 250, 0.2) 100%)"
                                    : "rgba(255,255,255,0.05)",
                                backdropFilter: "blur(10px)",
                                color: "white",
                                cursor: "pointer",
                                fontWeight: 600,
                                fontSize: 14,
                                transition: "all 0.3s ease",
                                boxShadow: mode === "daily" ? "0 4px 15px rgba(124, 58, 237, 0.3)" : "none"
                            }}
                            onMouseEnter={(e) => {
                                if (mode !== "daily") {
                                    e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                                    e.currentTarget.style.transform = "translateY(-2px)";
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (mode !== "daily") {
                                    e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                                    e.currentTarget.style.transform = "translateY(0)";
                                }
                            }}
                        >
                            📅 Daily
                        </button>
                        <button
                            onClick={() => setMode("infinite")}
                            style={{
                                padding: "10px 18px",
                                borderRadius: 12,
                                border: mode === "infinite" ? "2px solid rgba(6, 182, 212, 0.5)" : "1px solid rgba(255,255,255,0.1)",
                                background: mode === "infinite"
                                    ? "linear-gradient(135deg, rgba(6, 182, 212, 0.3) 0%, rgba(34, 211, 238, 0.2) 100%)"
                                    : "rgba(255,255,255,0.05)",
                                backdropFilter: "blur(10px)",
                                color: "white",
                                cursor: "pointer",
                                fontWeight: 600,
                                fontSize: 14,
                                transition: "all 0.3s ease",
                                boxShadow: mode === "infinite" ? "0 4px 15px rgba(6, 182, 212, 0.3)" : "none"
                            }}
                            onMouseEnter={(e) => {
                                if (mode !== "infinite") {
                                    e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                                    e.currentTarget.style.transform = "translateY(-2px)";
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (mode !== "infinite") {
                                    e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                                    e.currentTarget.style.transform = "translateY(0)";
                                }
                            }}
                        >
                            ♾️ Infinite
                        </button>
                        <button
                            onClick={() => loadPool()}
                            style={{
                                padding: "10px 18px",
                                borderRadius: 12,
                                border: "1px solid rgba(255,255,255,0.1)",
                                background: "rgba(255,255,255,0.05)",
                                backdropFilter: "blur(10px)",
                                color: "white",
                                cursor: "pointer",
                                fontWeight: 600,
                                fontSize: 14,
                                transition: "all 0.3s ease"
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                                e.currentTarget.style.transform = "translateY(-2px)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                                e.currentTarget.style.transform = "translateY(0)";
                            }}
                        >
                            🔄 Recharger
                        </button>
                    </div>
                </header>

                {/* Zone de jeu principale avec carte glassmorphism */}
                <div style={{
                    padding: "28px",
                    background: "rgba(255, 255, 255, 0.04)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: 24,
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
                    animation: "scaleIn 0.5s ease-out 0.2s both"
                }}>
                    <div style={{
                        display: "flex",
                        gap: 28,
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        justifyContent: "center"
                    }}>
                        {/* Image de couverture avec effet premium */}
                        <div style={{
                            position: "relative",
                            animation: "fadeIn 0.6s ease-out 0.3s both"
                        }}>
                            <div style={{
                                width: 320,
                                height: 320,
                                borderRadius: 20,
                                overflow: "hidden",
                                boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)",
                                position: "relative"
                            }}>
                                {currentGame?.cover ? (
                                    <>
                                        <CanvasPixelCover src={currentGame.cover} revealStep={revealStep} size={320} />
                                        {/* Overlay gradient subtil */}
                                        <div style={{
                                            position: "absolute",
                                            bottom: 0,
                                            left: 0,
                                            right: 0,
                                            height: "40%",
                                            background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)",
                                            pointerEvents: "none"
                                        }} />
                                    </>
                                ) : (
                                    <div style={{
                                        width: "100%",
                                        height: "100%",
                                        background: "linear-gradient(135deg, rgba(124, 58, 237, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 48,
                                        opacity: 0.3
                                    }}>
                                        🎮
                                    </div>
                                )}
                            </div>
                            {/* Indicateur d'essai */}
                            <div style={{
                                position: "absolute",
                                top: 12,
                                right: 12,
                                padding: "6px 12px",
                                background: "rgba(0, 0, 0, 0.7)",
                                backdropFilter: "blur(10px)",
                                borderRadius: 999,
                                fontSize: 13,
                                fontWeight: 700,
                                border: "1px solid rgba(255, 255, 255, 0.2)"
                            }}>
                                {guesses.length}/{MAX_TRIES}
                            </div>
                        </div>

                        <div style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 16,
                            flex: 1,
                            minWidth: 300,
                            animation: "fadeIn 0.6s ease-out 0.4s both"
                        }}>
                            <GuessBox disabled={isOver} onSubmit={submitGuess} />

                            {/* Légende du système de couleurs avec design amélioré */}
                            <div style={{
                                padding: "12px 16px",
                                borderRadius: 14,
                                border: "1px solid rgba(255,255,255,0.1)",
                                background: "linear-gradient(135deg, rgba(124, 58, 237, 0.08) 0%, rgba(6, 182, 212, 0.08) 100%)",
                                backdropFilter: "blur(10px)",
                                fontSize: 13,
                                fontWeight: 600
                            }}>
                                <div style={{ marginBottom: 8, opacity: 0.9, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
                                    Guide des couleurs
                                </div>
                                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <div style={{
                                            width: 20,
                                            height: 20,
                                            borderRadius: 6,
                                            background: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: 11
                                        }}>✓</div>
                                        <span>Jeu trouvé</span>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <div style={{
                                            width: 20,
                                            height: 20,
                                            borderRadius: 6,
                                            background: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: 11
                                        }}>○</div>
                                        <span>Correspondances</span>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <div style={{
                                            width: 20,
                                            height: 20,
                                            borderRadius: 6,
                                            background: "rgba(255, 255, 255, 0.1)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: 11
                                        }}>×</div>
                                        <span>Aucune</span>
                                    </div>
                                </div>
                            </div>

                            {/* Indicateurs d'essais modernisés */}
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {Array.from({ length: MAX_TRIES }).map((_, i) => {
                                    const filled = i < guesses.length;
                                    const isCurrent = i === guesses.length && !isOver;
                                    return (
                                        <div
                                            key={i}
                                            style={{
                                                width: 48,
                                                height: 48,
                                                borderRadius: 12,
                                                border: isCurrent
                                                    ? "2px solid rgba(124, 58, 237, 0.6)"
                                                    : "1px solid rgba(255,255,255,0.12)",
                                                background: filled
                                                    ? "linear-gradient(135deg, rgba(124, 58, 237, 0.3) 0%, rgba(167, 139, 250, 0.2) 100%)"
                                                    : "rgba(255,255,255,0.04)",
                                                backdropFilter: "blur(10px)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontWeight: 800,
                                                fontSize: 16,
                                                transition: "all 0.3s ease",
                                                boxShadow: filled ? "0 4px 12px rgba(124, 58, 237, 0.3)" : "none",
                                                animation: filled ? "scaleIn 0.3s ease-out" : "none",
                                                cursor: filled ? "pointer" : "default"
                                            }}
                                            title={filled ? guesses[i] : ""}
                                            onMouseEnter={(e) => {
                                                if (filled) e.currentTarget.style.transform = "scale(1.1)";
                                            }}
                                            onMouseLeave={(e) => {
                                                if (filled) e.currentTarget.style.transform = "scale(1)";
                                            }}
                                        >
                                            {filled ? i + 1 : ""}
                                        </div>
                                    );
                                })}
                            </div>

                            {guesses.length > 0 && (
                                <div
                                    style={{
                                        width: "100%",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 10
                                    }}
                                >
                                    {guesses.map((g, i) => {
                                        const ok = currentGame ? isCorrect(g, currentGame) : false;
                                        const guessedGame = guessedGames.get(g);
                                        const commonPlatforms = currentGame && guessedGame ? getCommonPlatforms(guessedGame, currentGame) : [];
                                        const sameYear = currentGame && guessedGame ? hasSameYear(guessedGame, currentGame) : false;
                                        const commonGenres = currentGame && guessedGame ? getCommonGenres(guessedGame, currentGame) : [];
                                        const hasCorrectPlatform = commonPlatforms.length > 0;
                                        const hasMatches = hasCorrectPlatform || sameYear || commonGenres.length > 0;

                                        return (
                                            <div key={`${i}-${g}`} style={{
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: 10,
                                                animation: "slideIn 0.4s ease-out"
                                            }}>
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "space-between",
                                                        gap: 12,
                                                        padding: "14px 16px",
                                                        borderRadius: 14,
                                                        border: ok
                                                            ? "2px solid rgba(16, 185, 129, 0.5)"
                                                            : hasMatches
                                                                ? "2px solid rgba(245, 158, 11, 0.5)"
                                                                : "1px solid rgba(255,255,255,0.1)",
                                                        background: ok
                                                            ? "linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(52, 211, 153, 0.1) 100%)"
                                                            : hasMatches
                                                                ? "linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(251, 191, 36, 0.1) 100%)"
                                                                : "rgba(255, 255, 255, 0.03)",
                                                        backdropFilter: "blur(10px)",
                                                        boxShadow: ok
                                                            ? "0 4px 20px rgba(16, 185, 129, 0.3)"
                                                            : hasMatches
                                                                ? "0 4px 20px rgba(245, 158, 11, 0.2)"
                                                                : "0 2px 8px rgba(0, 0, 0, 0.2)",
                                                        transition: "all 0.3s ease"
                                                    }}
                                                >
                                                    <div style={{ display: "flex", gap: 12, alignItems: "center", flex: 1 }}>
                                                        <div
                                                            style={{
                                                                width: 36,
                                                                height: 36,
                                                                borderRadius: 10,
                                                                background: ok
                                                                    ? "linear-gradient(135deg, #10b981 0%, #34d399 100%)"
                                                                    : hasMatches
                                                                        ? "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)"
                                                                        : "rgba(255,255,255,0.08)",
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                                fontWeight: 900,
                                                                fontSize: 15,
                                                                boxShadow: ok || hasMatches ? "0 2px 8px rgba(0, 0, 0, 0.3)" : "none"
                                                            }}
                                                        >
                                                            {i + 1}
                                                        </div>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontWeight: 700, fontSize: 15 }}>{g}</div>
                                                            {!ok && hasMatches && (
                                                                <div style={{
                                                                    fontSize: 12,
                                                                    opacity: 0.9,
                                                                    marginTop: 6,
                                                                    fontWeight: 600,
                                                                    color: "#fbbf24",
                                                                    display: "flex",
                                                                    flexDirection: "column",
                                                                    gap: 4
                                                                }}>
                                                                    {sameYear && guessedGame?.year && (
                                                                        <div style={{
                                                                            display: "flex",
                                                                            flexWrap: "wrap",
                                                                            alignItems: "center",
                                                                            gap: 6
                                                                        }}>
                                                                            <span>📅 Même année :</span>
                                                                            <span
                                                                                style={{
                                                                                    padding: "2px 8px",
                                                                                    background: "rgba(245, 158, 11, 0.3)",
                                                                                    border: "1px solid rgba(245, 158, 11, 0.5)",
                                                                                    borderRadius: 6,
                                                                                    fontSize: 11,
                                                                                    fontWeight: 700
                                                                                }}
                                                                            >
                                                                                {guessedGame.year}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                    {commonPlatforms.length > 0 && (
                                                                        <div style={{
                                                                            display: "flex",
                                                                            flexWrap: "wrap",
                                                                            alignItems: "center",
                                                                            gap: 6
                                                                        }}>
                                                                            <span>🎮 Plateforme{commonPlatforms.length > 1 ? 's' : ''} :</span>
                                                                            {commonPlatforms.map((platform, idx) => (
                                                                                <span
                                                                                    key={idx}
                                                                                    style={{
                                                                                        padding: "2px 8px",
                                                                                        background: "rgba(245, 158, 11, 0.3)",
                                                                                        border: "1px solid rgba(245, 158, 11, 0.5)",
                                                                                        borderRadius: 6,
                                                                                        fontSize: 11,
                                                                                        fontWeight: 700
                                                                                    }}
                                                                                >
                                                                                    {platform}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                    {commonGenres.length > 0 && (
                                                                        <div style={{
                                                                            display: "flex",
                                                                            flexWrap: "wrap",
                                                                            alignItems: "center",
                                                                            gap: 6
                                                                        }}>
                                                                            <span>🎯 Genre{commonGenres.length > 1 ? 's' : ''} :</span>
                                                                            {commonGenres.map((genre, idx) => (
                                                                                <span
                                                                                    key={idx}
                                                                                    style={{
                                                                                        padding: "2px 8px",
                                                                                        background: "rgba(245, 158, 11, 0.3)",
                                                                                        border: "1px solid rgba(245, 158, 11, 0.5)",
                                                                                        borderRadius: 6,
                                                                                        fontSize: 11,
                                                                                        fontWeight: 700
                                                                                    }}
                                                                                >
                                                                                    {genre}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div style={{
                                                        fontWeight: 900,
                                                        fontSize: 20,
                                                        filter: ok ? "drop-shadow(0 0 8px rgba(16, 185, 129, 0.8))" : "none"
                                                    }}>
                                                        {ok ? "✅" : hasMatches ? "🟨" : "❌"}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Indices progressifs après les réponses */}
                                    {guesses.length >= 2 && !isOver && currentGame && (
                                        <div style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 10
                                        }}>
                                            {/* Indice 1 : Date (après 2 essais) */}
                                            {guesses.length >= 2 && currentGame.year && (
                                                <div
                                                    style={{
                                                        padding: "16px 18px",
                                                        borderRadius: 14,
                                                        border: "2px solid rgba(6, 182, 212, 0.3)",
                                                        background: "linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(14, 165, 233, 0.1) 100%)",
                                                        backdropFilter: "blur(10px)",
                                                        fontSize: 13,
                                                        boxShadow: "0 4px 20px rgba(6, 182, 212, 0.2)",
                                                        animation: "scaleIn 0.4s ease-out"
                                                    }}
                                                >
                                                    <div style={{
                                                        fontWeight: 800,
                                                        marginBottom: 10,
                                                        fontSize: 14,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 8,
                                                        color: "#22d3ee"
                                                    }}>
                                                        💡 <span>Indice #1</span>
                                                    </div>
                                                    <div style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 8,
                                                        padding: "6px 0"
                                                    }}>
                                                        <span style={{ opacity: 0.8 }}>📅</span>
                                                        <span style={{ fontWeight: 600 }}>Année de sortie :</span>
                                                        <span style={{
                                                            padding: "2px 10px",
                                                            background: "rgba(6, 182, 212, 0.2)",
                                                            borderRadius: 6,
                                                            fontWeight: 700
                                                        }}>
                                                            {currentGame.year}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Indice 2 : Plateformes (après 3 essais) */}
                                            {guesses.length >= 3 && currentGame.platforms && currentGame.platforms.length > 0 && (
                                                <div
                                                    style={{
                                                        padding: "16px 18px",
                                                        borderRadius: 14,
                                                        border: "2px solid rgba(6, 182, 212, 0.3)",
                                                        background: "linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(14, 165, 233, 0.1) 100%)",
                                                        backdropFilter: "blur(10px)",
                                                        fontSize: 13,
                                                        boxShadow: "0 4px 20px rgba(6, 182, 212, 0.2)",
                                                        animation: "scaleIn 0.4s ease-out"
                                                    }}
                                                >
                                                    <div style={{
                                                        fontWeight: 800,
                                                        marginBottom: 10,
                                                        fontSize: 14,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 8,
                                                        color: "#22d3ee"
                                                    }}>
                                                        💡 <span>Indice #2</span>
                                                    </div>
                                                    <div style={{
                                                        display: "flex",
                                                        alignItems: "flex-start",
                                                        gap: 8,
                                                        padding: "6px 0"
                                                    }}>
                                                        <span style={{ opacity: 0.8 }}>🎮</span>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontWeight: 600, marginBottom: 6 }}>Plateformes :</div>
                                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                                                {currentGame.platforms.slice(0, 3).map((p, idx) => (
                                                                    <span key={idx} style={{
                                                                        padding: "4px 10px",
                                                                        background: "rgba(6, 182, 212, 0.2)",
                                                                        border: "1px solid rgba(6, 182, 212, 0.3)",
                                                                        borderRadius: 8,
                                                                        fontSize: 12,
                                                                        fontWeight: 600
                                                                    }}>
                                                                        {p}
                                                                    </span>
                                                                ))}
                                                                {currentGame.platforms.length > 3 && (
                                                                    <span style={{
                                                                        padding: "4px 10px",
                                                                        opacity: 0.6,
                                                                        fontSize: 12
                                                                    }}>
                                                                        +{currentGame.platforms.length - 3}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Indice 3 : Genres (après 4 essais) */}
                                            {guesses.length >= 4 && currentGame.genres && currentGame.genres.length > 0 && (
                                                <div
                                                    style={{
                                                        padding: "16px 18px",
                                                        borderRadius: 14,
                                                        border: "2px solid rgba(6, 182, 212, 0.3)",
                                                        background: "linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(14, 165, 233, 0.1) 100%)",
                                                        backdropFilter: "blur(10px)",
                                                        fontSize: 13,
                                                        boxShadow: "0 4px 20px rgba(6, 182, 212, 0.2)",
                                                        animation: "scaleIn 0.4s ease-out"
                                                    }}
                                                >
                                                    <div style={{
                                                        fontWeight: 800,
                                                        marginBottom: 10,
                                                        fontSize: 14,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 8,
                                                        color: "#22d3ee"
                                                    }}>
                                                        💡 <span>Indice #3</span>
                                                    </div>
                                                    <div style={{
                                                        display: "flex",
                                                        alignItems: "flex-start",
                                                        gap: 8,
                                                        padding: "6px 0"
                                                    }}>
                                                        <span style={{ opacity: 0.8 }}>🎯</span>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontWeight: 600, marginBottom: 6 }}>Genres :</div>
                                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                                                {currentGame.genres.slice(0, 2).map((genre, idx) => (
                                                                    <span key={idx} style={{
                                                                        padding: "4px 10px",
                                                                        background: "rgba(6, 182, 212, 0.2)",
                                                                        border: "1px solid rgba(6, 182, 212, 0.3)",
                                                                        borderRadius: 8,
                                                                        fontSize: 12,
                                                                        fontWeight: 600
                                                                    }}>
                                                                        {genre}
                                                                    </span>
                                                                ))}
                                                                {currentGame.genres.length > 2 && (
                                                                    <span style={{
                                                                        padding: "4px 10px",
                                                                        opacity: 0.6,
                                                                        fontSize: 12
                                                                    }}>
                                                                        +{currentGame.genres.length - 2}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {isOver && currentGame && (
                                <div
                                    style={{
                                        padding: "20px 24px",
                                        borderRadius: 18,
                                        border: isWin
                                            ? "2px solid rgba(16, 185, 129, 0.5)"
                                            : "2px solid rgba(239, 68, 68, 0.5)",
                                        background: isWin
                                            ? "linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(52, 211, 153, 0.1) 100%)"
                                            : "linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(248, 113, 113, 0.1) 100%)",
                                        backdropFilter: "blur(10px)",
                                        boxShadow: isWin
                                            ? "0 8px 32px rgba(16, 185, 129, 0.3)"
                                            : "0 8px 32px rgba(239, 68, 68, 0.3)",
                                        animation: "scaleIn 0.5s ease-out"
                                    }}
                                >
                                    <div style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 12,
                                        marginBottom: 12
                                    }}>
                                        <div style={{
                                            fontSize: 36,
                                            animation: isWin ? "pulse 1s ease-in-out infinite" : "none"
                                        }}>
                                            {isWin ? "🎉" : "😢"}
                                        </div>
                                        <div>
                                            <div style={{
                                                fontWeight: 900,
                                                fontSize: 24,
                                                marginBottom: 4,
                                                color: isWin ? "#10b981" : "#ef4444"
                                            }}>
                                                {isWin ? "Gagné !" : "Perdu"}
                                            </div>
                                            <div style={{ opacity: 0.9, fontSize: 14 }}>
                                                Réponse : <span style={{ fontWeight: 800, fontSize: 15 }}>{currentGame.title}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
                                        <button
                                            onClick={async () => {
                                                const text = `Covergle ${mode === "daily" ? dateIso : "Infinite"}\n${shareGrid(
                                                    guesses.length,
                                                    isWin
                                                )}`;
                                                try {
                                                    await navigator.clipboard.writeText(text);
                                                } catch {
                                                    alert(text);
                                                }
                                            }}
                                            style={{
                                                padding: "12px 20px",
                                                borderRadius: 12,
                                                border: "1px solid rgba(124, 58, 237, 0.5)",
                                                background: "linear-gradient(135deg, rgba(124, 58, 237, 0.3) 0%, rgba(167, 139, 250, 0.2) 100%)",
                                                backdropFilter: "blur(10px)",
                                                color: "white",
                                                cursor: "pointer",
                                                fontWeight: 600,
                                                fontSize: 14,
                                                transition: "all 0.3s ease",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 8
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = "translateY(-2px)";
                                                e.currentTarget.style.boxShadow = "0 8px 20px rgba(124, 58, 237, 0.4)";
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = "translateY(0)";
                                                e.currentTarget.style.boxShadow = "none";
                                            }}
                                        >
                                            📋 Copier le résultat
                                        </button>

                                        {mode === "infinite" && (
                                            <button
                                                onClick={resetInfinite}
                                                style={{
                                                    padding: "12px 20px",
                                                    borderRadius: 12,
                                                    border: "1px solid rgba(6, 182, 212, 0.5)",
                                                    background: "linear-gradient(135deg, rgba(6, 182, 212, 0.3) 0%, rgba(34, 211, 238, 0.2) 100%)",
                                                    backdropFilter: "blur(10px)",
                                                    color: "white",
                                                    cursor: "pointer",
                                                    fontWeight: 600,
                                                    fontSize: 14,
                                                    transition: "all 0.3s ease",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 8
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.transform = "translateY(-2px)";
                                                    e.currentTarget.style.boxShadow = "0 8px 20px rgba(6, 182, 212, 0.4)";
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.transform = "translateY(0)";
                                                    e.currentTarget.style.boxShadow = "none";
                                                }}
                                            >
                                                🔄 Rejouer
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Statistiques avec design amélioré */}
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                                <div
                                    style={{
                                        padding: "10px 14px",
                                        borderRadius: 12,
                                        border: "1px solid rgba(124, 58, 237, 0.3)",
                                        background: "linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(167, 139, 250, 0.1) 100%)",
                                        backdropFilter: "blur(10px)",
                                        fontSize: 13,
                                        fontWeight: 600,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8
                                    }}
                                >
                                    <span style={{ opacity: 0.8 }}>🎮</span>
                                    <span>Parties:</span> <b>{stats.played}</b>
                                </div>
                                <div
                                    style={{
                                        padding: "10px 14px",
                                        borderRadius: 12,
                                        border: "1px solid rgba(16, 185, 129, 0.3)",
                                        background: "linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(52, 211, 153, 0.1) 100%)",
                                        backdropFilter: "blur(10px)",
                                        fontSize: 13,
                                        fontWeight: 600,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8
                                    }}
                                >
                                    <span style={{ opacity: 0.8 }}>🏆</span>
                                    <span>Victoires:</span> <b>{stats.wins}</b>
                                </div>
                                <div
                                    style={{
                                        padding: "10px 14px",
                                        borderRadius: 12,
                                        border: "1px solid rgba(245, 158, 11, 0.3)",
                                        background: "linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(251, 191, 36, 0.1) 100%)",
                                        backdropFilter: "blur(10px)",
                                        fontSize: 13,
                                        fontWeight: 600,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8
                                    }}
                                >
                                    <span style={{ opacity: 0.8 }}>🔥</span>
                                    <span>Série:</span> <b>{stats.currentStreak}</b> <span style={{ opacity: 0.6, fontSize: 11 }}>(max {stats.bestStreak})</span>
                                </div>
                            </div>

                            {/* Distribution des victoires */}
                            <div style={{
                                marginTop: 12,
                                padding: "14px 16px",
                                background: "rgba(255, 255, 255, 0.03)",
                                backdropFilter: "blur(10px)",
                                borderRadius: 14,
                                border: "1px solid rgba(255, 255, 255, 0.08)"
                            }}>
                                <div style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    opacity: 0.7,
                                    marginBottom: 10,
                                    textTransform: "uppercase",
                                    letterSpacing: 0.5
                                }}>
                                    📊 Distribution des victoires
                                </div>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                    {(["1", "2", "3", "4", "5", "6"] as const).map((k) => (
                                        <div
                                            key={k}
                                            style={{
                                                padding: "6px 12px",
                                                borderRadius: 999,
                                                border: "1px solid rgba(255,255,255,0.1)",
                                                background: stats.winDistribution[k] > 0
                                                    ? "linear-gradient(135deg, rgba(124, 58, 237, 0.2) 0%, rgba(167, 139, 250, 0.1) 100%)"
                                                    : "rgba(255,255,255,0.03)",
                                                fontSize: 12,
                                                fontWeight: 600,
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 6,
                                                transition: "all 0.3s ease"
                                            }}
                                        >
                                            <span style={{ opacity: 0.7 }}>{k}</span>
                                            <b>{stats.winDistribution[k]}</b>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer moderne */}
                <footer style={{
                    marginTop: 20,
                    padding: "16px 20px",
                    background: "rgba(255, 255, 255, 0.03)",
                    backdropFilter: "blur(10px)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    borderRadius: 16,
                    fontSize: 12,
                    opacity: 0.8,
                    textAlign: "center",
                    animation: "fadeIn 0.6s ease-out 0.8s both"
                }}>
                    <div style={{ marginBottom: 8, fontWeight: 600 }}>
                        <span style={{ opacity: 0.7 }}>⚡</span> Daily = même jeu pour tous (Europe/Paris)
                        <span style={{ margin: "0 8px", opacity: 0.4 }}>•</span>
                        <span style={{ opacity: 0.7 }}>🔄</span> Infinite = jeux aléatoires illimités
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.6 }}>
                        Données fournies par <a href="https://www.igdb.com/" target="_blank" rel="noopener noreferrer" style={{
                            color: "#a78bfa",
                            textDecoration: "none",
                            fontWeight: 600,
                            transition: "all 0.2s ease"
                        }}>IGDB</a>
                        <span style={{ margin: "0 6px" }}>•</span>
                        Inspiré de <a href="https://www.nytimes.com/games/wordle/" target="_blank" rel="noopener noreferrer" style={{
                            color: "#06b6d4",
                            textDecoration: "none",
                            fontWeight: 600,
                            transition: "all 0.2s ease"
                        }}>Wordle</a>
                    </div>
                </footer>
            </div>
        </div>
    );
}
