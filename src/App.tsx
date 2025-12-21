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

function hasCommonPlatform(guessedGame: IgdbGame | null, targetGame: IgdbGame): boolean {
    if (!guessedGame || !guessedGame.platforms || !targetGame.platforms) return false;
    return guessedGame.platforms.some(p => targetGame.platforms?.includes(p));
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
        <div style={{ minHeight: "100vh", color: "white", display: "flex", justifyContent: "center", padding: 18 }}>
            <div style={{ width: "min(980px, 96vw)", display: "flex", flexDirection: "column", gap: 16 }}>
                <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div>
                        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 0.3 }}>Covergle</div>
                        <div style={{ opacity: 0.7, fontSize: 13 }}>
                            {title}
                            {mode === "daily" ? ` · ${dateIso}` : ""}
                            {!poolReady ? " · chargement…" : ""}
                            {poolReady && poolError ? ` · erreur: ${poolError}` : ""}
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <button
                            onClick={() => setMode("daily")}
                            style={{
                                padding: "10px 12px",
                                borderRadius: 12,
                                border: "1px solid rgba(255,255,255,0.16)",
                                background: mode === "daily" ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)",
                                color: "white",
                                cursor: "pointer"
                            }}
                        >
                            Daily
                        </button>
                        <button
                            onClick={() => setMode("infinite")}
                            style={{
                                padding: "10px 12px",
                                borderRadius: 12,
                                border: "1px solid rgba(255,255,255,0.16)",
                                background: mode === "infinite" ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)",
                                color: "white",
                                cursor: "pointer"
                            }}
                        >
                            Infinite
                        </button>
                        <button
                            onClick={() => loadPool()}
                            style={{
                                padding: "10px 12px",
                                borderRadius: 12,
                                border: "1px solid rgba(255,255,255,0.16)",
                                background: "rgba(255,255,255,0.08)",
                                color: "white",
                                cursor: "pointer"
                            }}
                        >
                            Recharger le pool
                        </button>
                    </div>
                </header>

                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
                    <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ width: 320, height: 320 }}>
                            {currentGame?.cover ? (
                                <CanvasPixelCover src={currentGame.cover} revealStep={revealStep} size={320} />
                            ) : (
                                <div
                                    style={{
                                        width: 320,
                                        height: 320,
                                        borderRadius: 16,
                                        border: "1px solid rgba(255,255,255,0.12)",
                                        background: "rgba(255,255,255,0.06)"
                                    }}
                                />
                            )}
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, minWidth: 280 }}>
                            <GuessBox disabled={isOver} onSubmit={submitGuess} />

                            {/* Légende du système de couleurs */}
                            <div style={{
                                padding: "8px 12px",
                                borderRadius: 12,
                                border: "1px solid rgba(255,255,255,0.1)",
                                background: "rgba(255,255,255,0.04)",
                                fontSize: 12,
                                opacity: 0.85
                            }}>
                                <div style={{ fontWeight: 700, marginBottom: 4 }}>Indices de couleur :</div>
                                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                                    <span>✅ Jeu trouvé</span>
                                    <span>🟨 Même plateforme</span>
                                    <span>❌ Plateforme différente</span>
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                {Array.from({ length: MAX_TRIES }).map((_, i) => {
                                    const filled = i < guesses.length;
                                    return (
                                        <div
                                            key={i}
                                            style={{
                                                width: 44,
                                                height: 44,
                                                borderRadius: 12,
                                                border: "1px solid rgba(255,255,255,0.14)",
                                                background: filled ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontWeight: 800
                                            }}
                                            title={filled ? guesses[i] : ""}
                                        >
                                            {filled ? i + 1 : ""}
                                        </div>
                                    );
                                })}
                            </div>

                            {guesses.length > 0 && (
                                <div
                                    style={{
                                        width: "min(520px, 92vw)",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 8
                                    }}
                                >
                                    {guesses.map((g, i) => {
                                        const ok = currentGame ? isCorrect(g, currentGame) : false;
                                        const guessedGame = guessedGames.get(g);
                                        const hasCorrectPlatform = currentGame && guessedGame ? hasCommonPlatform(guessedGame, currentGame) : false;

                                        // Afficher un indice après chaque 2e essai (après 2, 4 essais)
                                        const showHint = (i + 1) % 2 === 0 && (i + 1) < MAX_TRIES && !isOver;

                                        return (
                                            <div key={`${i}-${g}`} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "space-between",
                                                        gap: 12,
                                                        padding: "10px 12px",
                                                        borderRadius: 12,
                                                        border: `1px solid ${ok ? "rgba(0,255,0,0.3)" : hasCorrectPlatform ? "rgba(255,255,0,0.3)" : "rgba(255,255,255,0.12)"}`,
                                                        background: ok ? "rgba(0,255,0,0.15)" : hasCorrectPlatform ? "rgba(255,255,0,0.15)" : "rgba(0,0,0,0.25)"
                                                    }}
                                                >
                                                    <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1 }}>
                                                        <div
                                                            style={{
                                                                width: 28,
                                                                height: 28,
                                                                borderRadius: 10,
                                                                border: "1px solid rgba(255,255,255,0.14)",
                                                                background: "rgba(255,255,255,0.08)",
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                                fontWeight: 800
                                                            }}
                                                        >
                                                            {i + 1}
                                                        </div>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontWeight: 700 }}>{g}</div>
                                                            {hasCorrectPlatform && !ok && guessedGame && currentGame && (
                                                                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                                                                    🎮 Plateforme commune trouvée !
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div style={{ fontWeight: 900 }}>
                                                        {ok ? "✅" : hasCorrectPlatform ? "🟨" : "❌"}
                                                    </div>
                                                </div>

                                                {showHint && currentGame && (
                                                    <div
                                                        style={{
                                                            padding: "10px 12px",
                                                            borderRadius: 12,
                                                            border: "1px solid rgba(100,200,255,0.3)",
                                                            background: "rgba(100,200,255,0.1)",
                                                            fontSize: 13,
                                                            opacity: 0.9
                                                        }}
                                                    >
                                                        <div style={{ fontWeight: 700, marginBottom: 4 }}>💡 Indice :</div>
                                                        {currentGame.year && <div>📅 Année : {currentGame.year}</div>}
                                                        {currentGame.platforms && currentGame.platforms.length > 0 && (
                                                            <div>🎮 Plateformes : {currentGame.platforms.slice(0, 3).join(", ")}{currentGame.platforms.length > 3 ? "..." : ""}</div>
                                                        )}
                                                        {currentGame.genres && currentGame.genres.length > 0 && (
                                                            <div>🎯 Genres : {currentGame.genres.slice(0, 2).join(", ")}{currentGame.genres.length > 2 ? "..." : ""}</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {isOver && currentGame && (
                                <div
                                    style={{
                                        padding: 12,
                                        borderRadius: 14,
                                        border: "1px solid rgba(255,255,255,0.12)",
                                        background: "rgba(0,0,0,0.35)"
                                    }}
                                >
                                    <div style={{ fontWeight: 800, fontSize: 16 }}>{isWin ? "Gagné !" : "Perdu"}</div>
                                    <div style={{ opacity: 0.8, marginTop: 4 }}>
                                        Réponse : <span style={{ fontWeight: 800 }}>{currentGame.title}</span>
                                    </div>

                                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
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
                                                padding: "10px 12px",
                                                borderRadius: 12,
                                                border: "1px solid rgba(255,255,255,0.16)",
                                                background: "rgba(255,255,255,0.12)",
                                                color: "white",
                                                cursor: "pointer"
                                            }}
                                        >
                                            Copier le share
                                        </button>

                                        {mode === "infinite" && (
                                            <button
                                                onClick={resetInfinite}
                                                style={{
                                                    padding: "10px 12px",
                                                    borderRadius: 12,
                                                    border: "1px solid rgba(255,255,255,0.16)",
                                                    background: "rgba(255,255,255,0.12)",
                                                    color: "white",
                                                    cursor: "pointer"
                                                }}
                                            >
                                                Rejouer
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", opacity: 0.85, fontSize: 13 }}>
                                <div
                                    style={{
                                        padding: "8px 10px",
                                        borderRadius: 12,
                                        border: "1px solid rgba(255,255,255,0.12)",
                                        background: "rgba(255,255,255,0.06)"
                                    }}
                                >
                                    Parties: <b>{stats.played}</b>
                                </div>
                                <div
                                    style={{
                                        padding: "8px 10px",
                                        borderRadius: 12,
                                        border: "1px solid rgba(255,255,255,0.12)",
                                        background: "rgba(255,255,255,0.06)"
                                    }}
                                >
                                    Victoires: <b>{stats.wins}</b>
                                </div>
                                <div
                                    style={{
                                        padding: "8px 10px",
                                        borderRadius: 12,
                                        border: "1px solid rgba(255,255,255,0.12)",
                                        background: "rgba(255,255,255,0.06)"
                                    }}
                                >
                                    Série: <b>{stats.currentStreak}</b> (max {stats.bestStreak})
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", opacity: 0.75, fontSize: 12 }}>
                                <span>Distribution:</span>
                                {(["1", "2", "3", "4", "5", "6"] as const).map((k) => (
                                    <span
                                        key={k}
                                        style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)" }}
                                    >
                    {k}: <b>{stats.winDistribution[k]}</b>
                  </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <footer style={{ opacity: 0.65, fontSize: 12 }}>
                        Daily = même jeu pour tout le monde (Europe/Paris). Infinite = jeux aléatoires. Données via IGDB.
                    </footer>
                </div>
            </div>
        </div>
    );
}
