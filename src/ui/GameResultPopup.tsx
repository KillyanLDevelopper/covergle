import type { IgdbGame } from "../lib/igdb";
import type { Mode } from "../lib/storage";

interface Props {
    win: boolean;
    game: IgdbGame;
    guessCount: number;
    mode: Mode;
    onClose: () => void;
    onReplay?: () => void;
    onSwitchMode: () => void;
}

export function GameResultPopup({ win, game, guessCount, mode, onClose, onReplay, onSwitchMode }: Props) {
    const color = win ? "#10b981" : "#ef4444";
    const gradient = win
        ? "linear-gradient(135deg, rgba(16,185,129,0.95) 0%, rgba(52,211,153,0.95) 100%)"
        : "linear-gradient(135deg, rgba(239,68,68,0.95) 0%, rgba(220,38,38,0.95) 100%)";
    const shadow = win
        ? "0 20px 60px rgba(16,185,129,0.5)"
        : "0 20px 60px rgba(239,68,68,0.5)";

    return (
        <div
            style={{
                position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                background: win ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0.8)",
                backdropFilter: "blur(8px)", display: "flex", alignItems: "center",
                justifyContent: "center", zIndex: 9999, animation: "fadeIn 0.3s ease-out", padding: 20
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: gradient, borderRadius: 24, padding: "32px", maxWidth: 500, width: "100%",
                    boxShadow: shadow, animation: "scaleIn 0.4s ease-out", border: "2px solid rgba(255,255,255,0.2)"
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                    <div style={{ fontSize: 48, marginBottom: 8, animation: "pulse 1s ease-in-out infinite" }}>
                        {win ? "🎉" : "😔"}
                    </div>
                    <h2 style={{ fontSize: 32, fontWeight: 900, color: "white", marginBottom: 8, textShadow: "0 2px 10px rgba(0,0,0,0.3)" }}>
                        {win ? "Félicitations !" : "Perdu !"}
                    </h2>
                    <div style={{ fontSize: 16, color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>
                        {win
                            ? `Vous avez trouvé le jeu en ${guessCount} essai${guessCount > 1 ? "s" : ""} !`
                            : "Vous n'avez pas trouvé le jeu cette fois..."}
                    </div>
                </div>

                {/* Couverture originale */}
                <div style={{ width: "100%", display: "flex", justifyContent: "center", marginBottom: 20 }}>
                    <div style={{ width: 264, height: 352, borderRadius: 16, overflow: "hidden", boxShadow: "0 10px 40px rgba(0,0,0,0.4)", border: "3px solid rgba(255,255,255,0.3)" }}>
                        <img src={game.cover || ""} alt={game.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                </div>

                {/* Titre */}
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                    {!win && <div style={{ fontSize: 20, fontWeight: 700, color: "rgba(255,255,255,0.8)", marginBottom: 6 }}>C'était :</div>}
                    <div style={{ fontSize: 24, fontWeight: 800, color: "white", textShadow: "0 2px 8px rgba(0,0,0,0.3)", marginBottom: 8 }}>{game.title}</div>
                    {game.year && (
                        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>
                            📅 {game.year}
                            {game.platforms && game.platforms.length > 0 && <span> • 🎮 {game.platforms.slice(0, 2).join(", ")}</span>}
                        </div>
                    )}
                </div>

                {/* Boutons */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
                    {mode === "infinite" && onReplay && (
                        <ActionButton
                            onClick={onReplay}
                            border="rgba(6,182,212,0.5)"
                            bg="linear-gradient(135deg, rgba(6,182,212,0.4) 0%, rgba(34,211,238,0.3) 100%)"
                            bgHover="linear-gradient(135deg, rgba(6,182,212,0.5) 0%, rgba(34,211,238,0.4) 100%)"
                            shadow="0 4px 15px rgba(6,182,212,0.3)"
                        >
                            {win ? "♾️ Rejouer (Infinite)" : "♾️ Réessayer (Infinite)"}
                        </ActionButton>
                    )}
                    <ActionButton
                        onClick={onSwitchMode}
                        border={mode === "infinite" ? "rgba(124,58,237,0.5)" : "rgba(6,182,212,0.5)"}
                        bg={mode === "infinite"
                            ? "linear-gradient(135deg, rgba(124,58,237,0.3) 0%, rgba(167,139,250,0.2) 100%)"
                            : "linear-gradient(135deg, rgba(6,182,212,0.3) 0%, rgba(34,211,238,0.2) 100%)"}
                        bgHover={mode === "infinite"
                            ? "linear-gradient(135deg, rgba(124,58,237,0.4) 0%, rgba(167,139,250,0.3) 100%)"
                            : "linear-gradient(135deg, rgba(6,182,212,0.4) 0%, rgba(34,211,238,0.3) 100%)"}
                        shadow={mode === "infinite" ? "0 4px 15px rgba(124,58,237,0.3)" : "0 4px 15px rgba(6,182,212,0.3)"}
                    >
                        {mode === "infinite" ? "📅 Aller au Daily" : "♾️ Aller à l'Infinite"}
                    </ActionButton>
                    <ActionButton
                        onClick={onClose}
                        border="rgba(255,255,255,0.2)"
                        bg="rgba(255,255,255,0.1)"
                        bgHover="rgba(255,255,255,0.2)"
                        shadow="none"
                    >
                        Fermer
                    </ActionButton>
                </div>
            </div>
        </div>
    );
}

function ActionButton({ onClick, border, bg, bgHover, shadow, children }: {
    onClick: () => void;
    border: string;
    bg: string;
    bgHover: string;
    shadow: string;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            style={{
                width: "100%", padding: "14px 24px", borderRadius: 12, border: `2px solid ${border}`,
                background: bg, color: "white", cursor: "pointer", fontWeight: 700, fontSize: 16,
                transition: "all 0.3s ease", backdropFilter: "blur(10px)", boxShadow: shadow
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = bgHover; e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = bg; e.currentTarget.style.transform = "translateY(0)"; }}
        >
            {children}
        </button>
    );
}
