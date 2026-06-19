import posthog from "posthog-js";
import type { Mode } from "../lib/storage";
import type { Difficulty } from "../lib/difficulty";
import { DIFFICULTY_LABELS, DIFFICULTY_COLORS } from "../lib/difficulty";

interface Props {
    mode: Mode;
    difficulty: Difficulty;
    isMobile: boolean;
    dateIso: string;
    poolReady: boolean;
    poolError: string | null;
    onSetMode: (m: Mode) => void;
    onChangeDifficulty: (d: Difficulty) => void;
    onShowRules: () => void;
}

export function Header({ mode, difficulty, isMobile, dateIso, poolReady, poolError, onSetMode, onChangeDifficulty, onShowRules }: Props) {
    const title = mode === "daily" ? "Daily" : "Infinite";

    return (
        <header style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
            padding: "20px 24px", background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 20, boxShadow: "0 8px 32px rgba(0,0,0,0.3)", animation: "slideIn 0.6s ease-out"
        }}>
            {/* Logo + titre */}
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 4px 15px rgba(124,58,237,0.4)", overflow: "hidden"
                }}>
                    <img src="/img/Covergle.png" alt="Covergle Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <div>
                    <div style={{
                        fontSize: 26, fontWeight: 900, letterSpacing: -0.5,
                        background: "linear-gradient(135deg, #ffffff 0%, #a78bfa 100%)",
                        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text"
                    }}>
                        Covergle
                    </div>
                    {!isMobile && (
                        <div style={{ display: "flex", opacity: 0.7, fontSize: 13, fontWeight: 500, alignItems: "center", gap: 8 }}>
                            <span style={{
                                padding: "2px 8px",
                                background: mode === "daily" ? "rgba(124,58,237,0.3)" : "rgba(6,182,212,0.3)",
                                borderRadius: 6, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5
                            }}>{title}</span>
                            {mode === "daily" && <span>· {dateIso}</span>}
                            {!poolReady && <span>· Chargement…</span>}
                            {poolReady && poolError && <span style={{ color: "#ef4444" }}>· Erreur</span>}
                        </div>
                    )}
                </div>
            </div>

            {/* Boutons */}
            <div style={{ display: "flex", gap: 8 }}>
                <ModeButton active={mode === "daily"} activeColor="rgba(124,58,237,0.5)" activeBg="linear-gradient(135deg, rgba(124,58,237,0.3) 0%, rgba(167,139,250,0.2) 100%)" activeShadow="0 4px 15px rgba(124,58,237,0.3)" onClick={() => { onSetMode("daily"); posthog.capture("mode_switched", { mode: "daily" }); }}>
                    📅{!isMobile && " Daily"}
                </ModeButton>
                <ModeButton active={mode === "infinite"} activeColor="rgba(6,182,212,0.5)" activeBg="linear-gradient(135deg, rgba(6,182,212,0.3) 0%, rgba(34,211,238,0.2) 100%)" activeShadow="0 4px 15px rgba(6,182,212,0.3)" onClick={() => { onSetMode("infinite"); posthog.capture("mode_switched", { mode: "infinite" }); }}>
                    ♾️{!isMobile && " Infinite"}
                </ModeButton>

                {mode === "infinite" && (
                    <div style={{ display: "flex", gap: 4 }}>
                        {(["easy", "medium", "hard"] as Difficulty[]).map(d => (
                            <button
                                key={d}
                                onClick={() => onChangeDifficulty(d)}
                                title={DIFFICULTY_LABELS[d]}
                                style={{
                                    padding: isMobile ? "10px 10px" : "10px 14px", borderRadius: 12,
                                    border: difficulty === d ? `2px solid ${DIFFICULTY_COLORS[d]}` : "1px solid rgba(255,255,255,0.1)",
                                    background: difficulty === d ? `${DIFFICULTY_COLORS[d]}33` : "rgba(255,255,255,0.05)",
                                    backdropFilter: "blur(10px)",
                                    color: difficulty === d ? DIFFICULTY_COLORS[d] : "rgba(255,255,255,0.6)",
                                    cursor: "pointer", fontWeight: 700, fontSize: isMobile ? 11 : 13,
                                    transition: "all 0.2s ease", whiteSpace: "nowrap"
                                }}
                            >
                                {isMobile ? DIFFICULTY_LABELS[d][0] : DIFFICULTY_LABELS[d]}
                            </button>
                        ))}
                    </div>
                )}

                <button
                    onClick={onShowRules}
                    style={{
                        padding: "10px 18px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)",
                        background: "rgba(255,255,255,0.05)", backdropFilter: "blur(10px)",
                        color: "white", cursor: "pointer", fontWeight: 600, fontSize: 14, transition: "all 0.3s ease"
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.transform = "translateY(0)"; }}
                >
                    ❓{!isMobile && " Règles"}
                </button>
            </div>
        </header>
    );
}

function ModeButton({ active, activeColor, activeBg, activeShadow, onClick, children }: {
    active: boolean; activeColor: string; activeBg: string; activeShadow: string;
    onClick: () => void; children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            style={{
                padding: "10px 18px", borderRadius: 12,
                border: active ? `2px solid ${activeColor}` : "1px solid rgba(255,255,255,0.1)",
                background: active ? activeBg : "rgba(255,255,255,0.05)",
                backdropFilter: "blur(10px)", color: "white", cursor: "pointer",
                fontWeight: 600, fontSize: 14, transition: "all 0.3s ease",
                boxShadow: active ? activeShadow : "none"
            }}
            onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.transform = "translateY(-2px)"; } }}
            onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.transform = "translateY(0)"; } }}
        >
            {children}
        </button>
    );
}
