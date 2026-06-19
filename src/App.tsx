import { useEffect, useMemo, useState } from "react";
import { dailyIndex, isoDateParis, randomIndex } from "./lib/daily";
import { isSameTitle } from "./lib/normalize";
import { loadDailyState, loadStats, saveDailyState, saveStats, type DailyState, type Mode } from "./lib/storage";
import { igdbGet, igdbSearch, type IgdbGame } from "./lib/igdb";
import { isCorrect, shareText, buildPool, MAX_TRIES } from "./lib/gameLogic";
import { type Difficulty, DIFFICULTY_THRESHOLDS } from "./lib/difficulty";
import { useIsMobile } from "./hooks/useIsMobile";
import { CanvasPixelCover } from "./ui/CanvasPixelCover";
import { GuessBox } from "./ui/GuessBox";
import { GuessCard } from "./ui/GuessCard";
import { Header } from "./ui/Header";
import { Footer } from "./ui/Footer";
import { GameResultPopup } from "./ui/GameResultPopup";
import { RulesPopup } from "./ui/RulesPopup";
import { CookieBanner, hasConsent, initAnalytics } from "./ui/CookieBanner";
import posthog from "posthog-js";

async function resolveGameFromId(id: string, pool: IgdbGame[]) {
    const fromPool = pool.find((g) => g.id === id);
    if (fromPool) return fromPool;
    return await igdbGet(id);
}

export default function App() {
    const [mode, setMode] = useState<Mode>("daily");
    const [difficulty, setDifficulty] = useState<Difficulty>(() =>
        (localStorage.getItem("covergle_difficulty") as Difficulty) ?? "medium"
    );
    const isMobile = useIsMobile();
    const coverSize = isMobile ? Math.min(300, window.innerWidth - 48) : 320;

    const dateIso = useMemo(() => isoDateParis(), []);
    const initialDailyState = useMemo(() => loadDailyState(dateIso), [dateIso]);

    const [pool, setPool] = useState<IgdbGame[]>([]);
    const [poolReady, setPoolReady] = useState(false);
    const [poolError, setPoolError] = useState<string | null>(null);

    const [dailyGame, setDailyGame] = useState<IgdbGame | null>(null);
    const [infiniteGame, setInfiniteGame] = useState<IgdbGame | null>(null);

    const [dailyState, setDailyState] = useState<DailyState>(() =>
        initialDailyState ?? { dateIso, gameId: "", guesses: [], isOver: false, isWin: false }
    );
    const [infGuesses, setInfGuesses] = useState<string[]>([]);
    const [infOver, setInfOver] = useState(false);
    const [infWin, setInfWin] = useState(false);

    const [guessedGames, setGuessedGames] = useState<Map<string, IgdbGame>>(new Map());
    const [showWinPopup, setShowWinPopup] = useState(false);
    const [showLosePopup, setShowLosePopup] = useState(false);
    const [showRulesPopup, setShowRulesPopup] = useState(() => !localStorage.getItem("covergle_rules_seen_v2"));
    const [showCookieBanner, setShowCookieBanner] = useState(() => hasConsent() === null);

    useEffect(() => { initAnalytics(); }, []);

    const currentGame = mode === "daily" ? dailyGame : infiniteGame;
    const guesses = mode === "daily" ? dailyState.guesses : infGuesses;
    const isOver = mode === "daily" ? dailyState.isOver : infOver;
    const isWin = mode === "daily" ? dailyState.isWin : infWin;
    const revealStep = Math.min(Math.max(guesses.length, 0), MAX_TRIES - 1);

    const filteredPool = useMemo(() => {
        const threshold = DIFFICULTY_THRESHOLDS[difficulty];
        const filtered = pool.filter(g => (g.total_rating_count ?? 0) >= threshold);
        return filtered.length > 0 ? filtered : pool;
    }, [pool, difficulty]);

    const stats = useMemo(() => loadStats(), [mode, dailyState.isOver, infOver]);

    // Chargement du pool
    useEffect(() => {
        let alive = true;
        (async () => {
            setPoolReady(false);
            setPoolError(null);
            setDailyGame(null);
            setInfiniteGame(null);
            try {
                const p = await buildPool();
                if (!alive) return;
                if (!p.length) { setPool([]); setPoolError("Pool vide."); setPoolReady(true); return; }
                setPool(p);
                setPoolReady(true);
            } catch (e) {
                if (!alive) return;
                setPool([]);
                setPoolError(String((e as any)?.message ?? e));
                setPoolReady(true);
            }
        })();
        return () => { alive = false; };
    }, []);

    // Jeu daily
    useEffect(() => {
        let alive = true;
        if (!poolReady || !pool.length) return;
        (async () => {
            const existing = initialDailyState;
            if (existing?.dateIso === dateIso && existing?.gameId) {
                const g = await resolveGameFromId(existing.gameId, pool);
                if (!alive) return;
                if (g) { setDailyGame(g); return; }
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
        return () => { alive = false; };
    }, [poolReady, pool, dateIso, initialDailyState]);

    // Jeu infini initial
    useEffect(() => {
        if (!poolReady || !pool.length) return;
        const fp = pool.filter(g => (g.total_rating_count ?? 0) >= DIFFICULTY_THRESHOLDS[difficulty]);
        const src = fp.length > 0 ? fp : pool;
        setInfiniteGame(src[randomIndex(src.length)] ?? null);
    }, [poolReady, pool]);

    // Restaurer les jeux devinés au chargement (daily)
    useEffect(() => {
        if (!poolReady || dailyState.guesses.length === 0) return;
        (async () => {
            const map = new Map<string, IgdbGame>();
            for (const guess of dailyState.guesses) {
                let game = pool.find(g => isSameTitle(g.title, guess));
                if (!game) {
                    const results = await igdbSearch(guess);
                    if (results.length > 0) game = results[0];
                }
                if (game) map.set(guess, game);
            }
            setGuessedGames(map);
        })();
    }, [dailyState.guesses, poolReady, pool]);

    // Fermer les popups au changement de mode
    useEffect(() => {
        setShowWinPopup(false);
        setShowLosePopup(false);
    }, [mode]);

    function applyEnd(win: boolean, triesUsed: number) {
        const s = loadStats();
        s.played += 1;
        if (win) {
            s.wins += 1;
            s.currentStreak += 1;
            s.bestStreak = Math.max(s.bestStreak, s.currentStreak);
            const k = String(Math.min(Math.max(triesUsed, 1), 6)) as "1" | "2" | "3" | "4" | "5" | "6";
            s.winDistribution[k] += 1;
        } else {
            s.currentStreak = 0;
        }
        saveStats(s);
    }

    async function submitGuess(guess: string) {
        if (!currentGame || isOver) return;
        if (guesses.some(x => isSameTitle(x, guess))) return;

        let guessedGame = pool.find(g => isSameTitle(g.title, guess));
        if (!guessedGame) {
            const results = await igdbSearch(guess);
            if (results.length > 0) guessedGame = results[0];
        }
        if (guessedGame) setGuessedGames(prev => new Map(prev).set(guess, guessedGame!));

        const next = [...guesses, guess].slice(0, MAX_TRIES);
        const win = isCorrect(guess, currentGame);
        const over = win || next.length >= MAX_TRIES;

        if (mode === "daily") {
            const nextState: DailyState = { ...dailyState, gameId: dailyState.gameId || currentGame.id, guesses: next, isOver: over, isWin: win };
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
                posthog.capture("game_won", { mode, tries: next.length, game_title: currentGame.title, game_year: currentGame.year });
                setTimeout(() => setShowWinPopup(true), 500);
            } else {
                posthog.capture("game_lost", { mode, game_title: currentGame.title, game_year: currentGame.year });
                setTimeout(() => setShowLosePopup(true), 500);
            }
        } else {
            posthog.capture("guess_made", { mode, guess_number: next.length, correct: win });
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

    function switchMode() {
        setMode(m => m === "daily" ? "infinite" : "daily");
    }

    return (
        <div style={{ minHeight: "100vh", color: "white", display: "flex", justifyContent: "center", animation: "fadeIn 0.5s ease-out" }}>
            <div style={{ width: "min(1100px, 100%)", display: "flex", flexDirection: "column", gap: 24 }}>

                <Header
                    mode={mode}
                    difficulty={difficulty}
                    isMobile={isMobile}
                    dateIso={dateIso}
                    poolReady={poolReady}
                    poolError={poolError}
                    onSetMode={setMode}
                    onChangeDifficulty={changeDifficulty}
                    onShowRules={() => setShowRulesPopup(true)}
                />

                {/* Zone de jeu */}
                <div style={{
                    padding: "28px", background: "rgba(255,255,255,0.04)", backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 24, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", animation: "scaleIn 0.5s ease-out 0.2s both"
                }}>
                    <div style={{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap", justifyContent: "center" }}>

                        {/* Couverture */}
                        <div style={{ position: "relative", animation: "fadeIn 0.6s ease-out 0.3s both" }}>
                            <div style={{
                                width: coverSize, height: coverSize, borderRadius: 20, overflow: "hidden",
                                boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)", position: "relative"
                            }}>
                                {currentGame?.cover ? (
                                    <>
                                        <CanvasPixelCover src={currentGame.cover} revealStep={revealStep} size={coverSize} />
                                        <div style={{
                                            position: "absolute", bottom: 0, left: 0, right: 0, height: "40%",
                                            background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)", pointerEvents: "none"
                                        }} />
                                    </>
                                ) : (
                                    <div style={{
                                        width: "100%", height: "100%",
                                        background: "linear-gradient(135deg, rgba(124,58,237,0.1) 0%, rgba(6,182,212,0.1) 100%)",
                                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, opacity: 0.3
                                    }}>🎮</div>
                                )}
                            </div>
                            <div style={{
                                position: "absolute", top: 12, right: 12, padding: "6px 12px",
                                background: "rgba(0,0,0,0.7)", backdropFilter: "blur(10px)",
                                borderRadius: 999, fontSize: 13, fontWeight: 700, border: "1px solid rgba(255,255,255,0.2)"
                            }}>
                                {guesses.length}/{MAX_TRIES}
                            </div>
                        </div>

                        {/* Panneau droit */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1, minWidth: 300, animation: "fadeIn 0.6s ease-out 0.4s both" }}>
                            <GuessBox disabled={isOver} guesses={guesses} onSubmit={submitGuess} />

                            {/* Légende couleurs */}
                            <div style={{
                                padding: "12px 16px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)",
                                background: "linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(6,182,212,0.08) 100%)",
                                backdropFilter: "blur(10px)", fontSize: 13, fontWeight: 600
                            }}>
                                <div style={{ marginBottom: 8, opacity: 0.9, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>Guide des couleurs</div>
                                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                                    {[
                                        { bg: "linear-gradient(135deg, #10b981 0%, #34d399 100%)", label: "Identique", icon: "✓" },
                                        { bg: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)", label: "Similaire", icon: "◐" },
                                        { bg: "rgba(255,255,255,0.1)", label: "Différent", icon: "×" },
                                    ].map(({ bg, label, icon }) => (
                                        <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                            <div style={{ width: 20, height: 20, borderRadius: 6, background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>{icon}</div>
                                            <span>{label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Indicateurs d'essais */}
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {Array.from({ length: MAX_TRIES }).map((_, i) => {
                                    const filled = i < guesses.length;
                                    const isCurrent = i === guesses.length && !isOver;
                                    return (
                                        <div key={i} style={{
                                            width: 48, height: 48, borderRadius: 12,
                                            border: isCurrent ? "2px solid rgba(124,58,237,0.6)" : "1px solid rgba(255,255,255,0.12)",
                                            background: filled ? "linear-gradient(135deg, rgba(124,58,237,0.3) 0%, rgba(167,139,250,0.2) 100%)" : "rgba(255,255,255,0.04)",
                                            backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center",
                                            fontWeight: 800, fontSize: 16, transition: "all 0.3s ease",
                                            boxShadow: filled ? "0 4px 12px rgba(124,58,237,0.3)" : "none",
                                            animation: filled ? "scaleIn 0.3s ease-out" : "none", cursor: filled ? "pointer" : "default"
                                        }}
                                            title={filled ? guesses[i] : ""}
                                            onMouseEnter={(e) => { if (filled) e.currentTarget.style.transform = "scale(1.1)"; }}
                                            onMouseLeave={(e) => { if (filled) e.currentTarget.style.transform = "scale(1)"; }}
                                        >
                                            {filled ? i + 1 : ""}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Cartes des essais */}
                            {guesses.length > 0 && currentGame && (
                                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
                                    {[...guesses].reverse().map((g, i) => {
                                        const actualIndex = guesses.length - 1 - i;
                                        return (
                                            <GuessCard
                                                key={`${actualIndex}-${g}`}
                                                guess={g}
                                                index={actualIndex}
                                                currentGame={currentGame}
                                                guessedGame={guessedGames.get(g)}
                                            />
                                        );
                                    })}
                                </div>
                            )}

                            {/* Résultat inline */}
                            {isOver && currentGame && (
                                <div style={{
                                    padding: "20px 24px", borderRadius: 18,
                                    border: isWin ? "2px solid rgba(16,185,129,0.5)" : "2px solid rgba(239,68,68,0.5)",
                                    background: isWin
                                        ? "linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(52,211,153,0.1) 100%)"
                                        : "linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(248,113,113,0.1) 100%)",
                                    backdropFilter: "blur(10px)",
                                    boxShadow: isWin ? "0 8px 32px rgba(16,185,129,0.3)" : "0 8px 32px rgba(239,68,68,0.3)",
                                    animation: "scaleIn 0.5s ease-out"
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                                        <div style={{ fontSize: 36, animation: isWin ? "pulse 1s ease-in-out infinite" : "none" }}>
                                            {isWin ? "🎉" : "😢"}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 900, fontSize: 24, marginBottom: 4, color: isWin ? "#10b981" : "#ef4444" }}>
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
                                                try { await navigator.clipboard.writeText(text); } catch { alert(text); }
                                                posthog.capture("result_shared", { mode, win: isWin, tries: guesses.length });
                                            }}
                                            style={{
                                                padding: "12px 20px", borderRadius: 12, border: "1px solid rgba(124,58,237,0.5)",
                                                background: "linear-gradient(135deg, rgba(124,58,237,0.3) 0%, rgba(167,139,250,0.2) 100%)",
                                                backdropFilter: "blur(10px)", color: "white", cursor: "pointer", fontWeight: 600, fontSize: 14,
                                                transition: "all 0.3s ease", display: "flex", alignItems: "center", gap: 8
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 20px rgba(124,58,237,0.4)"; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                                        >
                                            📋 Copier le résultat
                                        </button>
                                        {mode === "infinite" && (
                                            <button
                                                onClick={resetInfinite}
                                                style={{
                                                    padding: "12px 20px", borderRadius: 12, border: "1px solid rgba(6,182,212,0.5)",
                                                    background: "linear-gradient(135deg, rgba(6,182,212,0.3) 0%, rgba(34,211,238,0.2) 100%)",
                                                    backdropFilter: "blur(10px)", color: "white", cursor: "pointer", fontWeight: 600, fontSize: 14,
                                                    transition: "all 0.3s ease", display: "flex", alignItems: "center", gap: 8
                                                }}
                                                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 20px rgba(6,182,212,0.4)"; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                                            >
                                                🔄 Rejouer
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Statistiques */}
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                                {[
                                    { icon: "🎮", label: "Parties", value: stats.played, border: "rgba(124,58,237,0.3)", bg: "linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(167,139,250,0.1) 100%)" },
                                    { icon: "🏆", label: "Victoires", value: stats.wins, border: "rgba(16,185,129,0.3)", bg: "linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(52,211,153,0.1) 100%)" },
                                    { icon: "🔥", label: "Série", value: stats.currentStreak, border: "rgba(245,158,11,0.3)", bg: "linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(251,191,36,0.1) 100%)", extra: `(max ${stats.bestStreak})` },
                                ].map(({ icon, label, value, border, bg, extra }) => (
                                    <div key={label} style={{ padding: "10px 14px", borderRadius: 12, border: `1px solid ${border}`, background: bg, backdropFilter: "blur(10px)", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ opacity: 0.8 }}>{icon}</span>
                                        <span>{label}:</span> <b>{value}</b>
                                        {extra && <span style={{ opacity: 0.6, fontSize: 11 }}>{extra}</span>}
                                    </div>
                                ))}
                            </div>

                            {/* Distribution des victoires */}
                            <div style={{ marginTop: 12, padding: "14px 16px", background: "rgba(255,255,255,0.03)", backdropFilter: "blur(10px)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)" }}>
                                <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.7, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
                                    📊 Distribution des victoires
                                </div>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                    {(["1", "2", "3", "4", "5", "6"] as const).map((k) => (
                                        <div key={k} style={{
                                            padding: "6px 12px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.1)",
                                            background: stats.winDistribution[k] > 0
                                                ? "linear-gradient(135deg, rgba(124,58,237,0.2) 0%, rgba(167,139,250,0.1) 100%)"
                                                : "rgba(255,255,255,0.03)",
                                            fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6
                                        }}>
                                            <span style={{ opacity: 0.7 }}>{k}</span>
                                            <b>{stats.winDistribution[k]}</b>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <Footer />
            </div>

            {/* Popups */}
            {showCookieBanner && <CookieBanner onConsent={() => setShowCookieBanner(false)} />}

            {showWinPopup && currentGame && isWin && (
                <GameResultPopup
                    win={true}
                    game={currentGame}
                    guessCount={guesses.length}
                    mode={mode}
                    onClose={() => setShowWinPopup(false)}
                    onReplay={mode === "infinite" ? resetInfinite : undefined}
                    onSwitchMode={() => { setShowWinPopup(false); switchMode(); }}
                />
            )}

            {showLosePopup && currentGame && (
                <GameResultPopup
                    win={false}
                    game={currentGame}
                    guessCount={guesses.length}
                    mode={mode}
                    onClose={() => setShowLosePopup(false)}
                    onReplay={mode === "infinite" ? resetInfinite : undefined}
                    onSwitchMode={() => { setShowLosePopup(false); switchMode(); }}
                />
            )}

            {showRulesPopup && <RulesPopup onClose={() => setShowRulesPopup(false)} />}
        </div>
    );
}
