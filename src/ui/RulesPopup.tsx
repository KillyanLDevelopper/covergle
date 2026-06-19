const DISCORD_SVG = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
);

interface Props {
    onClose: () => void;
}

export function RulesPopup({ onClose }: Props) {
    function close() {
        localStorage.setItem("covergle_rules_seen_v2", "1");
        onClose();
    }

    return (
        <div
            style={{
                position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                background: "rgba(0, 0, 0, 0.85)", backdropFilter: "blur(8px)",
                display: "flex", alignItems: "center", justifyContent: "center",
                zIndex: 9999, animation: "fadeIn 0.3s ease-out", padding: 20
            }}
            onClick={close}
        >
            <div
                style={{
                    background: "linear-gradient(135deg, rgba(124, 58, 237, 0.95) 0%, rgba(167, 139, 250, 0.95) 100%)",
                    borderRadius: 24, padding: "32px", maxWidth: 600, width: "100%",
                    boxShadow: "0 20px 60px rgba(124, 58, 237, 0.5)", animation: "scaleIn 0.4s ease-out",
                    border: "2px solid rgba(255, 255, 255, 0.2)", maxHeight: "85vh", overflowY: "auto"
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                    <div style={{ fontSize: 48, marginBottom: 8, animation: "pulse 1s ease-in-out infinite" }}>🎮</div>
                    <h2 style={{ fontSize: 32, fontWeight: 900, color: "white", marginBottom: 8, textShadow: "0 2px 10px rgba(0,0,0,0.3)" }}>
                        Bienvenue à Covergle !
                    </h2>
                    <div style={{ fontSize: 14, color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>Voici comment jouer</div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 20, fontSize: 15, lineHeight: 1.6, color: "rgba(255,255,255,0.95)" }}>
                    <Section title="🎯 L'objectif">
                        <p style={{ margin: 0 }}>
                            Devinez le jeu vidéo à partir de sa couverture, qui se révèle progressivement à chaque essai. Vous avez un maximum de 6 tentatives.
                        </p>
                    </Section>

                    <Section title="🔍 La couverture se révèle">
                        <p style={{ margin: 0 }}>
                            La couverture commence très pixelisée. À chaque essai, l'image devient progressivement plus nette. Au 6e essai, elle est presque entièrement visible.
                        </p>
                    </Section>

                    <Section title="💡 Indices après chaque essai">
                        <p style={{ margin: "0 0 10px 0" }}>Chaque jeu deviné affiche trois informations comparées au jeu cible :</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <InfoBlock>
                                <strong>📅 Année</strong> — avec une flèche <strong>▲</strong> si le jeu cible est sorti après, <strong>▼</strong> si avant
                            </InfoBlock>
                            <InfoBlock>
                                <strong>Plateformes & Genres</strong> — s'affichent en badges :
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
                            </InfoBlock>
                        </div>
                    </Section>

                    <Section title="💪 Conseils">
                        <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                            <li>Utilisez les badges verts pour identifier les plateformes et genres du jeu cible</li>
                            <li>La flèche sur l'année vous indique si le jeu cible est plus récent ou plus ancien</li>
                            <li>Observez les couleurs dominantes de la couverture dès le début</li>
                            <li>Le pool contient plus de 3000 jeux, des plus récents aux classiques rétro !</li>
                        </ul>
                    </Section>

                    <Section title="🕐 Modes de jeu">
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <InfoBlock borderColor="#7c3aed"><strong>📅 Daily :</strong> Un nouveau défi chaque jour à minuit. Vous et vos amis jouez au même jeu !</InfoBlock>
                            <InfoBlock borderColor="#06b6d4"><strong>♾️ Infini :</strong> Jouez autant que vous le souhaitez, sans limite. Un nouveau jeu à chaque victoire !</InfoBlock>
                        </div>
                    </Section>

                    <Section title="🎚️ Difficulté (mode Infini)">
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <InfoBlock borderColor="#10b981"><strong style={{ color: "#10b981" }}>Facile</strong> — Jeux très populaires et bien connus (GTA, Zelda, Minecraft…)</InfoBlock>
                            <InfoBlock borderColor="#f59e0b"><strong style={{ color: "#f59e0b" }}>Moyen</strong> — Jeux populaires mais moins évidents</InfoBlock>
                            <InfoBlock borderColor="#ef4444"><strong style={{ color: "#ef4444" }}>Difficile</strong> — Tout le pool, y compris les jeux obscurs et rétro</InfoBlock>
                        </div>
                    </Section>
                </div>

                <a
                    href="https://discord.gg/KaS62Tueu"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                        marginTop: 20, padding: "12px 24px", borderRadius: 12,
                        border: "2px solid rgba(88, 101, 242, 0.6)",
                        background: "linear-gradient(135deg, rgba(88, 101, 242, 0.3) 0%, rgba(114, 137, 218, 0.2) 100%)",
                        color: "white", fontWeight: 700, fontSize: 15, textDecoration: "none",
                        transition: "all 0.3s ease", backdropFilter: "blur(10px)"
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
                    {DISCORD_SVG} Rejoindre le Discord
                </a>

                <button
                    onClick={close}
                    style={{
                        width: "100%", marginTop: 12, padding: "14px 24px", borderRadius: 12,
                        border: "2px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.1)",
                        color: "white", cursor: "pointer", fontWeight: 700, fontSize: 16,
                        transition: "all 0.3s ease", backdropFilter: "blur(10px)"
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.2)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.transform = "translateY(0)"; }}
                >
                    C'est parti ! 🚀
                </button>
            </div>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "white" }}>{title}</h3>
            {children}
        </div>
    );
}

function InfoBlock({ children, borderColor = "rgba(255,255,255,0.4)" }: { children: React.ReactNode; borderColor?: string }) {
    return (
        <div style={{ padding: "10px 12px", background: "rgba(0,0,0,0.3)", borderRadius: 8, borderLeft: `3px solid ${borderColor}` }}>
            {children}
        </div>
    );
}
