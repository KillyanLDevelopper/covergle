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
import { CookieBanner, hasConsent, initAnalytics } from "./ui/CookieBanner";
import { igdbGet, igdbSearch, type IgdbGame } from "./lib/igdb";
import posthog from "posthog-js";

const MAX_TRIES = 6;

const OBSCURE_PLATFORMS = new Set([
    "Google Stadia", "Amazon Luna", "OnLive", "Ouya", "Nvidia Shield",
    "Oculus Quest", "Oculus Quest 2", "Oculus Rift", "Meta Quest 3",
    "Windows Phone", "Windows Mixed Reality", "Evercade", "Zeebo",
    "Tapwave Zodiac", "Gizmondo", "N-Gage", "Phantom"
]);

function filterPlatforms(platforms: string[]): string[] {
    return platforms.filter(p => !OBSCURE_PLATFORMS.has(p));
}

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

function shareText(triesUsed: number, win: boolean, mode: Mode, dateIso: string) {
    const blocks = ["⬛", "🟫", "🟨", "🟧", "🟧", "🟧"];
    const emojis: string[] = [];
    for (let i = 0; i < Math.min(triesUsed, MAX_TRIES); i++) {
        emojis.push(blocks[Math.min(i, blocks.length - 1)]);
    }
    if (win && emojis.length > 0) emojis[emojis.length - 1] = "🟩";

    const header = `Covergle • ${mode === "daily" ? `Daily ${dateIso}` : "Infinite"}`;
    const score = win ? `Trouvé en ${triesUsed}/${MAX_TRIES} !` : `Pas trouvé (${MAX_TRIES}/${MAX_TRIES})`;
    const grid = emojis.join(" ");
    return `${header}\n${score}\n${grid}`;
}

async function buildPool(): Promise<IgdbGame[]> {
    const res = await fetch("/api/pool");
    if (!res.ok) throw new Error(`/api/pool HTTP ${res.status}`);
    return res.json();
}

async function resolveGameFromId(id: string, pool: IgdbGame[]) {
    const fromPool = pool.find((g) => g.id === id);
    if (fromPool) return fromPool;
    return await igdbGet(id);
}

function useIsMobile() {
    const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 520);
    useEffect(() => {
        const update = () => setIsMobile(window.innerWidth <= 520);
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, []);
    return isMobile;
}

type Difficulty = "easy" | "medium" | "hard";

const DIFFICULTY_THRESHOLDS: Record<Difficulty, number> = {
    easy: 500,
    medium: 50,
    hard: 5,
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
    easy: "Facile",
    medium: "Moyen",
    hard: "Difficile",
};

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
    easy: "#10b981",
    medium: "#f59e0b",
    hard: "#ef4444",
};

export default function App() {
    const [mode, setMode] = useState<Mode>("daily");
    const [difficulty, setDifficulty] = useState<Difficulty>(() => {
        return (localStorage.getItem("covergle_difficulty") as Difficulty) ?? "medium";
    });
    const isMobile = useIsMobile();
    const coverSize = isMobile ? Math.min(300, window.innerWidth - 48) : 320;

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

    // État pour le pop-up de victoire
    const [showWinPopup, setShowWinPopup] = useState(false);

    // État pour le pop-up de défaite
    const [showLosePopup, setShowLosePopup] = useState(false);

    // État pour le pop-up des règles
    const [showRulesPopup, setShowRulesPopup] = useState(() => !localStorage.getItem("covergle_rules_seen_v2"));

    // Consentement cookies
    const [showCookieBanner, setShowCookieBanner] = useState(() => hasConsent() === null);
    useEffect(() => { initAnalytics(); }, []);

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
        const fp = pool.filter(g => (g.total_rating_count ?? 0) >= DIFFICULTY_THRESHOLDS[difficulty]);
        const src = fp.length > 0 ? fp : pool;
        setInfiniteGame(src[randomIndex(src.length)] ?? null);
    }, [poolReady, pool]);

    // Restaurer les infos des jeux devinés au chargement
    useEffect(() => {
        if (!poolReady) return;
        if (dailyState.guesses.length === 0) return;

        const fetchGuessedGames = async () => {
            const newGuessedGames = new Map<string, IgdbGame>();
            
            for (const guess of dailyState.guesses) {
                // Chercher dans le pool d'abord
                let game = pool.find(g => isSameTitle(g.title, guess));
                
                // Si pas trouvé, chercher via l'API
                if (!game) {
                    const searchResults = await igdbSearch(guess);
                    if (searchResults.length > 0) {
                        game = searchResults[0];
                    }
                }
                
                if (game) {
                    newGuessedGames.set(guess, game);
                }
            }
            
            setGuessedGames(newGuessedGames);
        };

        fetchGuessedGames();
    }, [dailyState.guesses, poolReady, pool]);

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
        let guessedGame = pool.find(g => isSameTitle(g.title, guess));
        
        // Si pas trouvé dans le pool, rechercher via l'API
        if (!guessedGame) {
            const searchResults = await igdbSearch(guess);
            if (searchResults.length > 0) {
                guessedGame = searchResults[0];
            }
        }
        
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

        if (over) {
            if (win) {
                posthog.capture("game_won", {
                    mode,
                    tries: next.length,
                    game_title: currentGame.title,
                    game_year: currentGame.year,
                });
                setTimeout(() => setShowWinPopup(true), 500);
            } else {
                posthog.capture("game_lost", {
                    mode,
                    game_title: currentGame.title,
                    game_year: currentGame.year,
                });
                setTimeout(() => setShowLosePopup(true), 500);
            }
        } else {
            posthog.capture("guess_made", {
                mode,
                guess_number: next.length,
                correct: win,
            });
        }
    }

    function changeDifficulty(d: Difficulty) {
        localStorage.setItem("covergle_difficulty", d);
        setDifficulty(d);
        const threshold = DIFFICULTY_THRESHOLDS[d];
        const fp = pool.filter(g => (g.total_rating_count ?? 0) >= threshold);
        const src = fp.length > 0 ? fp : pool;
        setInfiniteGame(src[randomIndex(src.length)] ?? null);
        setInfGuesses([]);
        setInfOver(false);
        setInfWin(false);
        setGuessedGames(new Map());
        setShowWinPopup(false);
        setShowLosePopup(false);
    }

    function resetInfinite() {
        if (!poolReady || pool.length === 0) return;
        setInfiniteGame(filteredPool[randomIndex(filteredPool.length)] ?? null);
        setInfGuesses([]);
        setInfOver(false);
        setInfWin(false);
        setGuessedGames(new Map());
        setShowWinPopup(false);
        setShowLosePopup(false);
    }

    const filteredPool = useMemo(() => {
        const threshold = DIFFICULTY_THRESHOLDS[difficulty];
        const filtered = pool.filter(g => (g.total_rating_count ?? 0) >= threshold);
        return filtered.length > 0 ? filtered : pool;
    }, [pool, difficulty]);

    const stats = useMemo(() => loadStats(), [mode, dailyState.isOver, infOver]);
    const title = mode === "daily" ? "Daily" : "Infinite";

    // Fermer le pop-up quand le mode change
    useEffect(() => {
        setShowWinPopup(false);
        setShowLosePopup(false);
    }, [mode]);

    return (
        <div style={{
            minHeight: "100vh",
            color: "white",
            display: "flex",
            justifyContent: "center",
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
                            boxShadow: "0 4px 15px rgba(124, 58, 237, 0.4)",
                            overflow: "hidden"
                        }}>
                            <img
                                src="/img/Covergle.png"
                                alt="Covergle Logo"
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover"
                                }}
                            />
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
                            {!isMobile && <div style={{
                                display: "flex",
                                opacity: 0.7,
                                fontSize: 13,
                                fontWeight: 500,
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
                            </div>}
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                        <button
                            onClick={() => { setMode("daily"); posthog.capture("mode_switched", { mode: "daily" }); }}
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
                            📅{!isMobile && " Daily"}
                        </button>
                        <button
                            onClick={() => { setMode("infinite"); posthog.capture("mode_switched", { mode: "infinite" }); }}
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
                            ♾️{!isMobile && " Infinite"}
                        </button>
                        {/* Sélecteur de difficulté — visible uniquement en mode infini */}
                        {mode === "infinite" && (
                            <div style={{ display: "flex", gap: 4 }}>
                                {(["easy", "medium", "hard"] as Difficulty[]).map(d => (
                                    <button
                                        key={d}
                                        onClick={() => changeDifficulty(d)}
                                        title={DIFFICULTY_LABELS[d]}
                                        style={{
                                            padding: isMobile ? "10px 10px" : "10px 14px",
                                            borderRadius: 12,
                                            border: difficulty === d
                                                ? `2px solid ${DIFFICULTY_COLORS[d]}`
                                                : "1px solid rgba(255,255,255,0.1)",
                                            background: difficulty === d
                                                ? `${DIFFICULTY_COLORS[d]}33`
                                                : "rgba(255,255,255,0.05)",
                                            backdropFilter: "blur(10px)",
                                            color: difficulty === d ? DIFFICULTY_COLORS[d] : "rgba(255,255,255,0.6)",
                                            cursor: "pointer",
                                            fontWeight: 700,
                                            fontSize: isMobile ? 11 : 13,
                                            transition: "all 0.2s ease",
                                            whiteSpace: "nowrap"
                                        }}
                                    >
                                        {isMobile ? DIFFICULTY_LABELS[d][0] : DIFFICULTY_LABELS[d]}
                                    </button>
                                ))}
                            </div>
                        )}
                        <button
                            onClick={() => setShowRulesPopup(true)}
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
                            ❓{!isMobile && " Règles"}
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
                    <div style={{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap", justifyContent: "center" }}>
                        {/* Image de couverture avec effet premium */}
                        <div style={{
                            position: "relative",
                            animation: "fadeIn 0.6s ease-out 0.3s both"
                        }}>
                            <div style={{
                                width: coverSize,
                                height: coverSize,
                                borderRadius: 20,
                                overflow: "hidden",
                                boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)",
                                position: "relative"
                            }}>
                                {currentGame?.cover ? (
                                    <>
                                        <CanvasPixelCover src={currentGame.cover} revealStep={revealStep} size={coverSize} />
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

                        <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1, minWidth: 300, animation: "fadeIn 0.6s ease-out 0.4s both" }}>
                            <GuessBox disabled={isOver} guesses={guesses} onSubmit={submitGuess} />

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
                                        <span>Identique</span>
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
                                        }}>◐</div>
                                        <span>Similaire</span>
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
                                        <span>Différent</span>
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
                                    {[...guesses].reverse().map((g, i) => {
                                        const actualIndex = guesses.length - 1 - i; // Index réel dans le tableau
                                        const ok = currentGame ? isCorrect(g, currentGame) : false;
                                        const guessedGame = guessedGames.get(g);
                                        const commonPlatforms = currentGame && guessedGame ? getCommonPlatforms(guessedGame, currentGame) : [];
                                        const sameYear = currentGame && guessedGame ? hasSameYear(guessedGame, currentGame) : false;
                                        const commonGenres = currentGame && guessedGame ? getCommonGenres(guessedGame, currentGame) : [];

                                        // Vert si toutes les valeurs cibles sont couvertes, jaune si partiel, gris si rien
                                        const allPlatformsMatch = currentGame?.platforms && currentGame.platforms.length > 0
                                            && currentGame.platforms.every(p => commonPlatforms.includes(p));
                                        const allGenresMatch = currentGame?.genres && currentGame.genres.length > 0
                                            && currentGame.genres.every(g => commonGenres.includes(g));

                                        const yearColor = ok || sameYear ? "#10b981" : "rgba(255,255,255,0.15)";
                                        const platformColor = ok || allPlatformsMatch ? "#10b981" : commonPlatforms.length > 0 ? "#f59e0b" : "rgba(255,255,255,0.15)";
                                        const genreColor = ok || allGenresMatch ? "#10b981" : commonGenres.length > 0 ? "#f59e0b" : "rgba(255,255,255,0.15)";

                                        return (
                                            <div key={`${actualIndex}-${g}`} style={{
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: 10,
                                                animation: "slideIn 0.4s ease-out"
                                            }}>
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        gap: 10,
                                                        padding: "14px 16px",
                                                        borderRadius: 14,
                                                        border: "1px solid rgba(255,255,255,0.1)",
                                                        background: "rgba(255, 255, 255, 0.03)",
                                                        backdropFilter: "blur(10px)",
                                                        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
                                                        transition: "all 0.3s ease"
                                                    }}
                                                >
                                                    {/* Ligne 1 : numéro + nom */}
                                                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                                                        <div
                                                            style={{
                                                                width: 32,
                                                                height: 32,
                                                                flexShrink: 0,
                                                                borderRadius: 10,
                                                                background: "rgba(255,255,255,0.08)",
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                                fontWeight: 900,
                                                                fontSize: 14
                                                            }}
                                                        >
                                                            {actualIndex + 1}
                                                        </div>
                                                        <div style={{ fontWeight: 700, fontSize: 15 }}>{g}</div>
                                                    </div>

                                                    {/* Ligne 2 : carrés d'info */}
                                                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                                        {/* Carré Année */}
                                                        <div
                                                            style={{
                                                                minWidth: 70,
                                                                minHeight: 56,
                                                                padding: "8px 10px",
                                                                borderRadius: 10,
                                                                border: `2px solid ${yearColor}`,
                                                                background: ok || sameYear
                                                                    ? `linear-gradient(135deg, ${yearColor} 0%, ${yearColor}cc 100%)`
                                                                    : "rgba(255,255,255,0.05)",
                                                                display: "flex",
                                                                flexDirection: "column",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                                fontWeight: 700,
                                                                fontSize: 10,
                                                                boxShadow: ok || sameYear ? `0 2px 8px ${yearColor}66` : "none",
                                                                transition: "all 0.3s ease",
                                                                gap: 4
                                                            }}
                                                        >
                                                            <div style={{ fontSize: 9, opacity: 0.7, textTransform: "uppercase", letterSpacing: 0.5 }}>📅 Année</div>
                                                            <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 13, fontWeight: 800 }}>
                                                                {guessedGame?.year || 'N/A'}
                                                                {!ok && guessedGame?.year && currentGame?.year && guessedGame.year !== currentGame.year && (
                                                                    <span style={{ fontSize: 11 }}>
                                                                        {currentGame.year > guessedGame.year ? '▲' : '▼'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Carré Plateforme */}
                                                        {(() => {
                                                            const displayPlatforms = ok
                                                                ? filterPlatforms(currentGame?.platforms ?? [])
                                                                : filterPlatforms(guessedGame?.platforms ?? []);
                                                            return (
                                                                <div
                                                                    style={{
                                                                        flex: 1,
                                                                        minWidth: 100,
                                                                        minHeight: 56,
                                                                        padding: "8px 10px",
                                                                        borderRadius: 10,
                                                                        border: `2px solid ${platformColor}`,
                                                                        background: "rgba(255,255,255,0.04)",
                                                                        display: "flex",
                                                                        flexDirection: "column",
                                                                        alignItems: "center",
                                                                        justifyContent: "center",
                                                                        fontSize: 10,
                                                                        transition: "all 0.3s ease",
                                                                        gap: 4,
                                                                    }}
                                                                >
                                                                    <div style={{ fontSize: 9, opacity: 0.7, textTransform: "uppercase", letterSpacing: 0.5 }}>🎮 Plateforme</div>
                                                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, justifyContent: "center" }}>
                                                                        {displayPlatforms.length > 0 ? displayPlatforms.map((p, idx) => {
                                                                            const match = ok || commonPlatforms.includes(p);
                                                                            return (
                                                                                <span key={idx} style={{
                                                                                    fontSize: 9,
                                                                                    padding: "2px 5px",
                                                                                    borderRadius: 4,
                                                                                    fontWeight: 700,
                                                                                    background: match ? "#10b981" : "rgba(255,255,255,0.12)",
                                                                                    color: "white"
                                                                                }}>{p}</span>
                                                                            );
                                                                        }) : <span style={{ fontSize: 9, opacity: 0.5 }}>N/A</span>}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}

                                                        {/* Carré Genre */}
                                                        {(() => {
                                                            const displayGenres = ok
                                                                ? (currentGame?.genres ?? [])
                                                                : (guessedGame?.genres ?? []);
                                                            return (
                                                                <div
                                                                    style={{
                                                                        flex: 1,
                                                                        minWidth: 100,
                                                                        minHeight: 56,
                                                                        padding: "8px 10px",
                                                                        borderRadius: 10,
                                                                        border: `2px solid ${genreColor}`,
                                                                        background: "rgba(255,255,255,0.04)",
                                                                        display: "flex",
                                                                        flexDirection: "column",
                                                                        alignItems: "center",
                                                                        justifyContent: "center",
                                                                        fontSize: 10,
                                                                        transition: "all 0.3s ease",
                                                                        gap: 4,
                                                                    }}
                                                                >
                                                                    <div style={{ fontSize: 9, opacity: 0.7, textTransform: "uppercase", letterSpacing: 0.5 }}>🎯 Genre</div>
                                                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, justifyContent: "center" }}>
                                                                        {displayGenres.length > 0 ? displayGenres.map((genre, idx) => {
                                                                            const match = ok || commonGenres.includes(genre);
                                                                            return (
                                                                                <span key={idx} style={{
                                                                                    fontSize: 9,
                                                                                    padding: "2px 5px",
                                                                                    borderRadius: 4,
                                                                                    fontWeight: 700,
                                                                                    background: match ? "#10b981" : "rgba(255,255,255,0.12)",
                                                                                    color: "white"
                                                                                }}>{genre}</span>
                                                                            );
                                                                        }) : <span style={{ fontSize: 9, opacity: 0.5 }}>N/A</span>}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
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
                                                const text = shareText(guesses.length, isWin, mode, dateIso);
                                                try {
                                                    await navigator.clipboard.writeText(text);
                                                } catch {
                                                    alert(text);
                                                }
                                                posthog.capture("result_shared", { mode, win: isWin, tries: guesses.length });
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
                        <span style={{ margin: "0 6px" }}>•</span>
                        <a href="https://discord.gg/KaS62Tueu" target="_blank" rel="noopener noreferrer" style={{
                            color: "#7289da",
                            textDecoration: "none",
                            fontWeight: 600,
                            transition: "all 0.2s ease",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4
                        }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="#7289da" xmlns="http://www.w3.org/2000/svg" style={{ display: "inline", verticalAlign: "middle" }}>
                                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                            </svg>
                            Discord
                        </a>
                    </div>
                </footer>
            </div>

            {/* Pop-up de victoire */}
            {showWinPopup && currentGame && isWin && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: "rgba(0, 0, 0, 0.85)",
                        backdropFilter: "blur(8px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 9999,
                        animation: "fadeIn 0.3s ease-out",
                        padding: 20
                    }}
                    onClick={() => setShowWinPopup(false)}
                >
                    <div
                        style={{
                            background: "linear-gradient(135deg, rgba(16, 185, 129, 0.95) 0%, rgba(52, 211, 153, 0.95) 100%)",
                            borderRadius: 24,
                            padding: "32px",
                            maxWidth: 500,
                            width: "100%",
                            boxShadow: "0 20px 60px rgba(16, 185, 129, 0.5)",
                            animation: "scaleIn 0.4s ease-out",
                            border: "2px solid rgba(255, 255, 255, 0.2)"
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div style={{
                            textAlign: "center",
                            marginBottom: 24
                        }}>
                            <div style={{
                                fontSize: 48,
                                marginBottom: 8,
                                animation: "pulse 1s ease-in-out infinite"
                            }}>
                                🎉
                            </div>
                            <h2 style={{
                                fontSize: 32,
                                fontWeight: 900,
                                color: "white",
                                marginBottom: 8,
                                textShadow: "0 2px 10px rgba(0, 0, 0, 0.3)"
                            }}>
                                Félicitations !
                            </h2>
                            <div style={{
                                fontSize: 16,
                                color: "rgba(255, 255, 255, 0.9)",
                                fontWeight: 600
                            }}>
                                Vous avez trouvé le jeu en {guesses.length} essai{guesses.length > 1 ? 's' : ''} !
                            </div>
                        </div>

                        {/* Cover non pixelisée */}
                        <div style={{
                            width: "100%",
                            display: "flex",
                            justifyContent: "center",
                            marginBottom: 20
                        }}>
                            <div style={{
                                width: 264,
                                height: 352,
                                borderRadius: 16,
                                overflow: "hidden",
                                boxShadow: "0 10px 40px rgba(0, 0, 0, 0.4)",
                                border: "3px solid rgba(255, 255, 255, 0.3)"
                            }}>
                                <img
                                    src={currentGame.cover || ''}
                                    alt={currentGame.title}
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover"
                                    }}
                                />
                            </div>
                        </div>

                        {/* Titre du jeu */}
                        <div style={{
                            textAlign: "center",
                            marginBottom: 24
                        }}>
                            <div style={{
                                fontSize: 24,
                                fontWeight: 800,
                                color: "white",
                                textShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
                                marginBottom: 8
                            }}>
                                {currentGame.title}
                            </div>
                            {currentGame.year && (
                                <div style={{
                                    fontSize: 14,
                                    color: "rgba(255, 255, 255, 0.8)",
                                    fontWeight: 600
                                }}>
                                    📅 {currentGame.year}
                                    {currentGame.platforms && currentGame.platforms.length > 0 && (
                                        <span> • 🎮 {currentGame.platforms.slice(0, 2).join(', ')}</span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Boutons d'action */}
                        <div style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                            width: "100%"
                        }}>
                            {mode === "infinite" && (
                                <button
                                    onClick={() => {
                                        resetInfinite();
                                    }}
                                    style={{
                                        width: "100%",
                                        padding: "14px 24px",
                                        borderRadius: 12,
                                        border: "2px solid rgba(6, 182, 212, 0.5)",
                                        background: "linear-gradient(135deg, rgba(6, 182, 212, 0.4) 0%, rgba(34, 211, 238, 0.3) 100%)",
                                        color: "white",
                                        cursor: "pointer",
                                        fontWeight: 700,
                                        fontSize: 16,
                                        transition: "all 0.3s ease",
                                        backdropFilter: "blur(10px)",
                                        boxShadow: "0 4px 15px rgba(6, 182, 212, 0.3)"
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = "linear-gradient(135deg, rgba(6, 182, 212, 0.5) 0%, rgba(34, 211, 238, 0.4) 100%)";
                                        e.currentTarget.style.transform = "translateY(-2px)";
                                        e.currentTarget.style.boxShadow = "0 6px 20px rgba(6, 182, 212, 0.4)";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = "linear-gradient(135deg, rgba(6, 182, 212, 0.4) 0%, rgba(34, 211, 238, 0.3) 100%)";
                                        e.currentTarget.style.transform = "translateY(0)";
                                        e.currentTarget.style.boxShadow = "0 4px 15px rgba(6, 182, 212, 0.3)";
                                    }}
                                >
                                    ♾️ Rejouer (Infinite)
                                </button>
                            )}

                            <button
                                onClick={() => {
                                    setShowWinPopup(false);
                                    if (mode === "infinite") {
                                        setMode("daily");
                                    } else {
                                        setMode("infinite");
                                    }
                                }}
                                style={{
                                    width: "100%",
                                    padding: "14px 24px",
                                    borderRadius: 12,
                                    border: mode === "infinite"
                                        ? "2px solid rgba(124, 58, 237, 0.5)"
                                        : "2px solid rgba(6, 182, 212, 0.5)",
                                    background: mode === "infinite"
                                        ? "linear-gradient(135deg, rgba(124, 58, 237, 0.3) 0%, rgba(167, 139, 250, 0.2) 100%)"
                                        : "linear-gradient(135deg, rgba(6, 182, 212, 0.3) 0%, rgba(34, 211, 238, 0.2) 100%)",
                                    color: "white",
                                    cursor: "pointer",
                                    fontWeight: 700,
                                    fontSize: 16,
                                    transition: "all 0.3s ease",
                                    backdropFilter: "blur(10px)",
                                    boxShadow: mode === "infinite"
                                        ? "0 4px 15px rgba(124, 58, 237, 0.3)"
                                        : "0 4px 15px rgba(6, 182, 212, 0.3)"
                                }}
                                onMouseEnter={(e) => {
                                    if (mode === "infinite") {
                                        e.currentTarget.style.background = "linear-gradient(135deg, rgba(124, 58, 237, 0.4) 0%, rgba(167, 139, 250, 0.3) 100%)";
                                        e.currentTarget.style.boxShadow = "0 6px 20px rgba(124, 58, 237, 0.4)";
                                    } else {
                                        e.currentTarget.style.background = "linear-gradient(135deg, rgba(6, 182, 212, 0.4) 0%, rgba(34, 211, 238, 0.3) 100%)";
                                        e.currentTarget.style.boxShadow = "0 6px 20px rgba(6, 182, 212, 0.4)";
                                    }
                                    e.currentTarget.style.transform = "translateY(-2px)";
                                }}
                                onMouseLeave={(e) => {
                                    if (mode === "infinite") {
                                        e.currentTarget.style.background = "linear-gradient(135deg, rgba(124, 58, 237, 0.3) 0%, rgba(167, 139, 250, 0.2) 100%)";
                                        e.currentTarget.style.boxShadow = "0 4px 15px rgba(124, 58, 237, 0.3)";
                                    } else {
                                        e.currentTarget.style.background = "linear-gradient(135deg, rgba(6, 182, 212, 0.3) 0%, rgba(34, 211, 238, 0.2) 100%)";
                                        e.currentTarget.style.boxShadow = "0 4px 15px rgba(6, 182, 212, 0.3)";
                                    }
                                    e.currentTarget.style.transform = "translateY(0)";
                                }}
                            >
                                {mode === "infinite" ? "📅 Aller au Daily" : "♾️ Aller à l'Infinite"}
                            </button>

                            <button
                                onClick={() => setShowWinPopup(false)}
                                style={{
                                    width: "100%",
                                    padding: "14px 24px",
                                    borderRadius: 12,
                                    border: "2px solid rgba(255, 255, 255, 0.2)",
                                    background: "rgba(255, 255, 255, 0.1)",
                                    color: "white",
                                    cursor: "pointer",
                                    fontWeight: 700,
                                    fontSize: 16,
                                    transition: "all 0.3s ease",
                                    backdropFilter: "blur(10px)"
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
                                    e.currentTarget.style.transform = "translateY(-2px)";
                                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.2)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                                    e.currentTarget.style.transform = "translateY(0)";
                                    e.currentTarget.style.boxShadow = "none";
                                }}
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Pop-up de défaite */}
            {showLosePopup && currentGame && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: "rgba(0, 0, 0, 0.8)",
                        backdropFilter: "blur(8px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 9999,
                        animation: "fadeIn 0.3s ease-out",
                        padding: 20
                    }}
                    onClick={() => setShowLosePopup(false)}
                >
                    <div
                        style={{
                            background: "linear-gradient(135deg, rgba(239, 68, 68, 0.95) 0%, rgba(220, 38, 38, 0.95) 100%)",
                            borderRadius: 24,
                            padding: "32px",
                            maxWidth: 500,
                            width: "100%",
                            boxShadow: "0 20px 60px rgba(239, 68, 68, 0.5)",
                            animation: "scaleIn 0.4s ease-out",
                            border: "2px solid rgba(255, 255, 255, 0.2)"
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div style={{
                            textAlign: "center",
                            marginBottom: 24
                        }}>
                            <div style={{
                                fontSize: 48,
                                marginBottom: 8,
                                animation: "pulse 1s ease-in-out infinite"
                            }}>
                                😔
                            </div>
                            <h2 style={{
                                fontSize: 32,
                                fontWeight: 900,
                                color: "white",
                                marginBottom: 8,
                                textShadow: "0 2px 10px rgba(0, 0, 0, 0.3)"
                            }}>
                                Perdu !
                            </h2>
                            <div style={{
                                fontSize: 16,
                                color: "rgba(255, 255, 255, 0.9)",
                                fontWeight: 600
                            }}>
                                Vous n'avez pas trouvé le jeu cette fois...
                            </div>
                        </div>

                        {/* Cover non pixelisée */}
                        <div style={{
                            width: "100%",
                            display: "flex",
                            justifyContent: "center",
                            marginBottom: 20
                        }}>
                            <div style={{
                                width: 264,
                                height: 352,
                                borderRadius: 16,
                                overflow: "hidden",
                                boxShadow: "0 10px 40px rgba(0, 0, 0, 0.4)",
                                border: "3px solid rgba(255, 255, 255, 0.3)"
                            }}>
                                <img
                                    src={currentGame.cover || ''}
                                    alt={currentGame.title}
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover"
                                    }}
                                />
                            </div>
                        </div>

                        {/* Titre du jeu */}
                        <div style={{
                            textAlign: "center",
                            marginBottom: 24
                        }}>
                            <div style={{
                                fontSize: 20,
                                fontWeight: 700,
                                color: "rgba(255, 255, 255, 0.8)",
                                marginBottom: 6
                            }}>
                                C'était :
                            </div>
                            <div style={{
                                fontSize: 24,
                                fontWeight: 800,
                                color: "white",
                                textShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
                                marginBottom: 8
                            }}>
                                {currentGame.title}
                            </div>
                            {currentGame.year && (
                                <div style={{
                                    fontSize: 14,
                                    color: "rgba(255, 255, 255, 0.8)",
                                    fontWeight: 600
                                }}>
                                    📅 {currentGame.year}
                                    {currentGame.platforms && currentGame.platforms.length > 0 && (
                                        <span> • 🎮 {currentGame.platforms.slice(0, 2).join(', ')}</span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Boutons d'action */}
                        <div style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                            width: "100%"
                        }}>
                            {mode === "infinite" && (
                                <button
                                    onClick={() => {
                                        resetInfinite();
                                    }}
                                    style={{
                                        width: "100%",
                                        padding: "14px 24px",
                                        borderRadius: 12,
                                        border: "2px solid rgba(6, 182, 212, 0.5)",
                                        background: "linear-gradient(135deg, rgba(6, 182, 212, 0.4) 0%, rgba(34, 211, 238, 0.3) 100%)",
                                        color: "white",
                                        cursor: "pointer",
                                        fontWeight: 700,
                                        fontSize: 16,
                                        transition: "all 0.3s ease",
                                        backdropFilter: "blur(10px)",
                                        boxShadow: "0 4px 15px rgba(6, 182, 212, 0.3)"
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = "linear-gradient(135deg, rgba(6, 182, 212, 0.5) 0%, rgba(34, 211, 238, 0.4) 100%)";
                                        e.currentTarget.style.transform = "translateY(-2px)";
                                        e.currentTarget.style.boxShadow = "0 6px 20px rgba(6, 182, 212, 0.4)";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = "linear-gradient(135deg, rgba(6, 182, 212, 0.4) 0%, rgba(34, 211, 238, 0.3) 100%)";
                                        e.currentTarget.style.transform = "translateY(0)";
                                        e.currentTarget.style.boxShadow = "0 4px 15px rgba(6, 182, 212, 0.3)";
                                    }}
                                >
                                    ♾️ Réessayer (Infinite)
                                </button>
                            )}

                            <button
                                onClick={() => {
                                    setShowLosePopup(false);
                                    if (mode === "infinite") {
                                        setMode("daily");
                                    } else {
                                        setMode("infinite");
                                    }
                                }}
                                style={{
                                    width: "100%",
                                    padding: "14px 24px",
                                    borderRadius: 12,
                                    border: mode === "infinite"
                                        ? "2px solid rgba(124, 58, 237, 0.5)"
                                        : "2px solid rgba(6, 182, 212, 0.5)",
                                    background: mode === "infinite"
                                        ? "linear-gradient(135deg, rgba(124, 58, 237, 0.3) 0%, rgba(167, 139, 250, 0.2) 100%)"
                                        : "linear-gradient(135deg, rgba(6, 182, 212, 0.3) 0%, rgba(34, 211, 238, 0.2) 100%)",
                                    color: "white",
                                    cursor: "pointer",
                                    fontWeight: 700,
                                    fontSize: 16,
                                    transition: "all 0.3s ease",
                                    backdropFilter: "blur(10px)",
                                    boxShadow: mode === "infinite"
                                        ? "0 4px 15px rgba(124, 58, 237, 0.3)"
                                        : "0 4px 15px rgba(6, 182, 212, 0.3)"
                                }}
                                onMouseEnter={(e) => {
                                    if (mode === "infinite") {
                                        e.currentTarget.style.background = "linear-gradient(135deg, rgba(124, 58, 237, 0.4) 0%, rgba(167, 139, 250, 0.3) 100%)";
                                        e.currentTarget.style.boxShadow = "0 6px 20px rgba(124, 58, 237, 0.4)";
                                    } else {
                                        e.currentTarget.style.background = "linear-gradient(135deg, rgba(6, 182, 212, 0.4) 0%, rgba(34, 211, 238, 0.3) 100%)";
                                        e.currentTarget.style.boxShadow = "0 6px 20px rgba(6, 182, 212, 0.4)";
                                    }
                                    e.currentTarget.style.transform = "translateY(-2px)";
                                }}
                                onMouseLeave={(e) => {
                                    if (mode === "infinite") {
                                        e.currentTarget.style.background = "linear-gradient(135deg, rgba(124, 58, 237, 0.3) 0%, rgba(167, 139, 250, 0.2) 100%)";
                                        e.currentTarget.style.boxShadow = "0 4px 15px rgba(124, 58, 237, 0.3)";
                                    } else {
                                        e.currentTarget.style.background = "linear-gradient(135deg, rgba(6, 182, 212, 0.3) 0%, rgba(34, 211, 238, 0.2) 100%)";
                                        e.currentTarget.style.boxShadow = "0 4px 15px rgba(6, 182, 212, 0.3)";
                                    }
                                    e.currentTarget.style.transform = "translateY(0)";
                                }}
                            >
                                {mode === "infinite" ? "📅 Aller au Daily" : "♾️ Aller à l'Infinite"}
                            </button>

                            <button
                                onClick={() => setShowLosePopup(false)}
                                style={{
                                    width: "100%",
                                    padding: "14px 24px",
                                    borderRadius: 12,
                                    border: "2px solid rgba(255, 255, 255, 0.2)",
                                    background: "rgba(255, 255, 255, 0.1)",
                                    color: "white",
                                    cursor: "pointer",
                                    fontWeight: 700,
                                    fontSize: 16,
                                    transition: "all 0.3s ease",
                                    backdropFilter: "blur(10px)"
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
                                    e.currentTarget.style.transform = "translateY(-2px)";
                                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.2)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                                    e.currentTarget.style.transform = "translateY(0)";
                                    e.currentTarget.style.boxShadow = "none";
                                }}
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bandeau consentement cookies */}
            {showCookieBanner && (
                <CookieBanner onConsent={() => setShowCookieBanner(false)} />
            )}

            {/* Pop-up des règles */}
            {showRulesPopup && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: "rgba(0, 0, 0, 0.85)",
                        backdropFilter: "blur(8px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 9999,
                        animation: "fadeIn 0.3s ease-out",
                        padding: 20
                    }}
                    onClick={() => setShowRulesPopup(false)}
                >
                    <div
                        style={{
                            background: "linear-gradient(135deg, rgba(124, 58, 237, 0.95) 0%, rgba(167, 139, 250, 0.95) 100%)",
                            borderRadius: 24,
                            padding: "32px",
                            maxWidth: 600,
                            width: "100%",
                            boxShadow: "0 20px 60px rgba(124, 58, 237, 0.5)",
                            animation: "scaleIn 0.4s ease-out",
                            border: "2px solid rgba(255, 255, 255, 0.2)",
                            maxHeight: "85vh",
                            overflowY: "auto"
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div style={{
                            textAlign: "center",
                            marginBottom: 24
                        }}>
                            <div style={{
                                fontSize: 48,
                                marginBottom: 8,
                                animation: "pulse 1s ease-in-out infinite"
                            }}>
                                🎮
                            </div>
                            <h2 style={{
                                fontSize: 32,
                                fontWeight: 900,
                                color: "white",
                                marginBottom: 8,
                                textShadow: "0 2px 10px rgba(0, 0, 0, 0.3)"
                            }}>
                                Bienvenue à Covergle !
                            </h2>
                            <div style={{
                                fontSize: 14,
                                color: "rgba(255, 255, 255, 0.9)",
                                fontWeight: 600
                            }}>
                                Voici comment jouer
                            </div>
                        </div>

                        {/* Contenu des règles */}
                        <div style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 20,
                            fontSize: 15,
                            lineHeight: 1.6,
                            color: "rgba(255, 255, 255, 0.95)"
                        }}>
                            {/* Objectif */}
                            <div>
                                <h3 style={{
                                    fontSize: 18,
                                    fontWeight: 700,
                                    marginBottom: 8,
                                    color: "white"
                                }}>
                                    🎯 L'objectif
                                </h3>
                                <p style={{ margin: 0 }}>
                                    Devinez le jeu vidéo à partir de sa couverture, qui se révèle progressivement à chaque essai. Vous avez un maximum de 6 tentatives pour trouver la bonne réponse.
                                </p>
                            </div>

                            {/* Système de révélation */}
                            <div>
                                <h3 style={{
                                    fontSize: 18,
                                    fontWeight: 700,
                                    marginBottom: 8,
                                    color: "white"
                                }}>
                                    🔍 La couverture se révèle
                                </h3>
                                <p style={{ margin: 0 }}>
                                    La couverture commence très pixelisée. À chaque essai, l'image devient progressivement plus nette. Au 6e essai, elle est presque entièrement visible.
                                </p>
                            </div>

                            {/* Indices de comparaison */}
                            <div>
                                <h3 style={{
                                    fontSize: 18,
                                    fontWeight: 700,
                                    marginBottom: 8,
                                    color: "white"
                                }}>
                                    💡 Indices après chaque essai
                                </h3>
                                <p style={{ margin: "0 0 10px 0" }}>
                                    Chaque jeu deviné affiche trois informations comparées au jeu cible :
                                </p>
                                <div style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 10
                                }}>
                                    <div style={{
                                        padding: "10px 12px",
                                        background: "rgba(0, 0, 0, 0.3)",
                                        borderRadius: 8,
                                        borderLeft: "3px solid rgba(255, 255, 255, 0.4)"
                                    }}>
                                        <strong>📅 Année</strong> — année de sortie du jeu deviné, avec une flèche <strong>▲</strong> si le jeu cible est sorti après, <strong>▼</strong> si avant
                                    </div>
                                    <div style={{
                                        padding: "10px 12px",
                                        background: "rgba(0, 0, 0, 0.3)",
                                        borderRadius: 8,
                                        borderLeft: "3px solid rgba(255, 255, 255, 0.4)"
                                    }}>
                                        <strong>Plateformes & Genres</strong> — toutes les plateformes et genres du jeu deviné s'affichent en badges :
                                        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <span style={{ background: "#10b981", borderRadius: 6, padding: "2px 10px", fontSize: 13, fontWeight: 700 }}>badge vert</span>
                                                <span>= aussi présent sur le jeu cible</span>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <span style={{ background: "rgba(255,255,255,0.15)", borderRadius: 6, padding: "2px 10px", fontSize: 13, fontWeight: 700 }}>badge gris</span>
                                                <span>= absent du jeu cible</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Conseils */}
                            <div>
                                <h3 style={{
                                    fontSize: 18,
                                    fontWeight: 700,
                                    marginBottom: 8,
                                    color: "white"
                                }}>
                                    💪 Conseils
                                </h3>
                                <ul style={{
                                    margin: 0,
                                    paddingLeft: 20,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 8
                                }}>
                                    <li>Utilisez les badges verts pour identifier les plateformes et genres du jeu cible</li>
                                    <li>La flèche sur l'année vous indique si le jeu cible est plus récent ou plus ancien</li>
                                    <li>Observez les couleurs dominantes de la couverture dès le début</li>
                                    <li>Le pool contient plus de 3000 jeux, des plus récents aux classiques rétro !</li>
                                </ul>
                            </div>

                            {/* Modes de jeu */}
                            <div>
                                <h3 style={{
                                    fontSize: 18,
                                    fontWeight: 700,
                                    marginBottom: 8,
                                    color: "white"
                                }}>
                                    🕐 Modes de jeu
                                </h3>
                                <div style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 10
                                }}>
                                    <div style={{
                                        padding: "10px 12px",
                                        background: "rgba(0, 0, 0, 0.3)",
                                        borderRadius: 8,
                                        borderLeft: "3px solid #7c3aed"
                                    }}>
                                        <strong>📅 Daily :</strong> Un nouveau défi chaque jour à minuit. Vous et vos amis jouez au même jeu !
                                    </div>
                                    <div style={{
                                        padding: "10px 12px",
                                        background: "rgba(0, 0, 0, 0.3)",
                                        borderRadius: 8,
                                        borderLeft: "3px solid #06b6d4"
                                    }}>
                                        <strong>♾️ Infini :</strong> Jouez autant que vous le souhaitez, sans limite. Un nouveau jeu à chaque victoire !
                                    </div>
                                </div>
                            </div>

                            {/* Difficulté */}
                            <div>
                                <h3 style={{
                                    fontSize: 18,
                                    fontWeight: 700,
                                    marginBottom: 8,
                                    color: "white"
                                }}>
                                    🎚️ Difficulté (mode Infini)
                                </h3>
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    <div style={{
                                        padding: "10px 12px",
                                        background: "rgba(0, 0, 0, 0.3)",
                                        borderRadius: 8,
                                        borderLeft: "3px solid #10b981"
                                    }}>
                                        <strong style={{ color: "#10b981" }}>Facile</strong> — Jeux très populaires et bien connus (GTA, Zelda, Minecraft…)
                                    </div>
                                    <div style={{
                                        padding: "10px 12px",
                                        background: "rgba(0, 0, 0, 0.3)",
                                        borderRadius: 8,
                                        borderLeft: "3px solid #f59e0b"
                                    }}>
                                        <strong style={{ color: "#f59e0b" }}>Moyen</strong> — Jeux populaires mais moins évidents
                                    </div>
                                    <div style={{
                                        padding: "10px 12px",
                                        background: "rgba(0, 0, 0, 0.3)",
                                        borderRadius: 8,
                                        borderLeft: "3px solid #ef4444"
                                    }}>
                                        <strong style={{ color: "#ef4444" }}>Difficile</strong> — Tout le pool, y compris les jeux obscurs et rétro
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Lien Discord */}
                        <a
                            href="https://discord.gg/KaS62Tueu"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 10,
                                marginTop: 20,
                                padding: "12px 24px",
                                borderRadius: 12,
                                border: "2px solid rgba(88, 101, 242, 0.6)",
                                background: "linear-gradient(135deg, rgba(88, 101, 242, 0.3) 0%, rgba(114, 137, 218, 0.2) 100%)",
                                color: "white",
                                fontWeight: 700,
                                fontSize: 15,
                                textDecoration: "none",
                                transition: "all 0.3s ease",
                                backdropFilter: "blur(10px)"
                            }}
                            onMouseEnter={(e) => {
                                (e.currentTarget as HTMLAnchorElement).style.background = "linear-gradient(135deg, rgba(88, 101, 242, 0.5) 0%, rgba(114, 137, 218, 0.4) 100%)";
                                (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-2px)";
                                (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 6px 20px rgba(88, 101, 242, 0.4)";
                            }}
                            onMouseLeave={(e) => {
                                (e.currentTarget as HTMLAnchorElement).style.background = "linear-gradient(135deg, rgba(88, 101, 242, 0.3) 0%, rgba(114, 137, 218, 0.2) 100%)";
                                (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0)";
                                (e.currentTarget as HTMLAnchorElement).style.boxShadow = "none";
                            }}
                        >
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                            </svg>
                            Rejoindre le Discord
                        </a>

                        {/* Bouton de fermeture */}
                        <button
                            onClick={() => {
                                localStorage.setItem("covergle_rules_seen_v2", "1");
                                setShowRulesPopup(false);
                            }}
                            style={{
                                width: "100%",
                                marginTop: 12,
                                padding: "14px 24px",
                                borderRadius: 12,
                                border: "2px solid rgba(255, 255, 255, 0.2)",
                                background: "rgba(255, 255, 255, 0.1)",
                                color: "white",
                                cursor: "pointer",
                                fontWeight: 700,
                                fontSize: 16,
                                transition: "all 0.3s ease",
                                backdropFilter: "blur(10px)"
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
                                e.currentTarget.style.transform = "translateY(-2px)";
                                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.2)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                                e.currentTarget.style.transform = "translateY(0)";
                                e.currentTarget.style.boxShadow = "none";
                            }}
                        >
                            C'est parti ! 🚀
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
