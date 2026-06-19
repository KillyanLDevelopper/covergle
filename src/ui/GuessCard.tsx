import type { IgdbGame } from "../lib/igdb";
import { filterPlatforms, getCommonPlatforms, getCommonGenres, hasSameYear, isCorrect } from "../lib/gameLogic";

interface Props {
    guess: string;
    index: number;
    currentGame: IgdbGame;
    guessedGame: IgdbGame | undefined;
}

export function GuessCard({ guess, index, currentGame, guessedGame }: Props) {
    const ok = isCorrect(guess, currentGame);
    const commonPlatforms = getCommonPlatforms(guessedGame ?? null, currentGame);
    const commonGenres = getCommonGenres(guessedGame ?? null, currentGame);
    const sameYear = hasSameYear(guessedGame ?? null, currentGame);

    const allPlatformsMatch = currentGame.platforms && currentGame.platforms.length > 0
        && currentGame.platforms.every(p => commonPlatforms.includes(p));
    const allGenresMatch = currentGame.genres && currentGame.genres.length > 0
        && currentGame.genres.every(g => commonGenres.includes(g));

    const yearColor = ok || sameYear ? "#10b981" : "rgba(255,255,255,0.15)";
    const platformColor = ok || allPlatformsMatch ? "#10b981" : commonPlatforms.length > 0 ? "#f59e0b" : "rgba(255,255,255,0.15)";
    const genreColor = ok || allGenresMatch ? "#10b981" : commonGenres.length > 0 ? "#f59e0b" : "rgba(255,255,255,0.15)";

    const displayPlatforms = ok ? filterPlatforms(currentGame.platforms ?? []) : filterPlatforms(guessedGame?.platforms ?? []);
    const displayGenres = ok ? (currentGame.genres ?? []) : (guessedGame?.genres ?? []);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, animation: "slideIn 0.4s ease-out" }}>
            <div style={{
                display: "flex", flexDirection: "column", gap: 10, padding: "14px 16px",
                borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.03)", backdropFilter: "blur(10px)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.2)", transition: "all 0.3s ease"
            }}>
                {/* Ligne 1 : numéro + nom */}
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{
                        width: 32, height: 32, flexShrink: 0, borderRadius: 10,
                        background: "rgba(255,255,255,0.08)", display: "flex",
                        alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14
                    }}>
                        {index + 1}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{guess}</div>
                </div>

                {/* Ligne 2 : carrés */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {/* Année */}
                    <div style={{
                        minWidth: 70, minHeight: 56, padding: "8px 10px", borderRadius: 10,
                        border: `2px solid ${yearColor}`,
                        background: ok || sameYear ? `linear-gradient(135deg, ${yearColor} 0%, ${yearColor}cc 100%)` : "rgba(255,255,255,0.05)",
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        fontWeight: 700, fontSize: 10, boxShadow: ok || sameYear ? `0 2px 8px ${yearColor}66` : "none",
                        transition: "all 0.3s ease", gap: 4
                    }}>
                        <div style={{ fontSize: 9, opacity: 0.7, textTransform: "uppercase", letterSpacing: 0.5 }}>📅 Année</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 13, fontWeight: 800 }}>
                            {guessedGame?.year ?? "N/A"}
                            {!ok && guessedGame?.year && currentGame.year && guessedGame.year !== currentGame.year && (
                                <span style={{ fontSize: 11 }}>{currentGame.year > guessedGame.year ? "▲" : "▼"}</span>
                            )}
                        </div>
                    </div>

                    {/* Plateformes */}
                    <div style={{
                        flex: 1, minWidth: 100, minHeight: 56, padding: "8px 10px", borderRadius: 10,
                        border: `2px solid ${platformColor}`, background: "rgba(255,255,255,0.04)",
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        fontSize: 10, transition: "all 0.3s ease", gap: 4
                    }}>
                        <div style={{ fontSize: 9, opacity: 0.7, textTransform: "uppercase", letterSpacing: 0.5 }}>🎮 Plateforme</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, justifyContent: "center" }}>
                            {displayPlatforms.length > 0
                                ? displayPlatforms.map((p, i) => (
                                    <span key={i} style={{ fontSize: 9, padding: "2px 5px", borderRadius: 4, fontWeight: 700, background: (ok || commonPlatforms.includes(p)) ? "#10b981" : "rgba(255,255,255,0.12)", color: "white" }}>{p}</span>
                                ))
                                : <span style={{ fontSize: 9, opacity: 0.5 }}>N/A</span>}
                        </div>
                    </div>

                    {/* Genres */}
                    <div style={{
                        flex: 1, minWidth: 100, minHeight: 56, padding: "8px 10px", borderRadius: 10,
                        border: `2px solid ${genreColor}`, background: "rgba(255,255,255,0.04)",
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        fontSize: 10, transition: "all 0.3s ease", gap: 4
                    }}>
                        <div style={{ fontSize: 9, opacity: 0.7, textTransform: "uppercase", letterSpacing: 0.5 }}>🎯 Genre</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, justifyContent: "center" }}>
                            {displayGenres.length > 0
                                ? displayGenres.map((genre, i) => (
                                    <span key={i} style={{ fontSize: 9, padding: "2px 5px", borderRadius: 4, fontWeight: 700, background: (ok || commonGenres.includes(genre)) ? "#10b981" : "rgba(255,255,255,0.12)", color: "white" }}>{genre}</span>
                                ))
                                : <span style={{ fontSize: 9, opacity: 0.5 }}>N/A</span>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
