import posthog from "posthog-js";

const CONSENT_KEY = "covergle_analytics_consent";
const PH_KEY = "phc_skSLV4GNcFisizujfwEwW5vfzWY65EYqASydVx5LdQkg";
const PH_HOST = "https://eu.i.posthog.com";

// Appelé au démarrage — initialise toujours PostHog en mode anonyme (pas de cookie, pas de profil)
// pour compter les visites sans consentement requis.
export function initAnalytics() {
    posthog.init(PH_KEY, {
        api_host: PH_HOST,
        person_profiles: "never",       // aucun profil persistant
        persistence: "memory",          // pas de cookie ni localStorage
        autocapture: false,             // pas de capture automatique des clics
    });

    // Si l'utilisateur avait déjà accepté, on opt-in pour les events détaillés
    if (localStorage.getItem(CONSENT_KEY) === "accepted") {
        posthog.opt_in_capturing();
        posthog.set_config({ persistence: "localStorage+cookie", person_profiles: "identified_only" });
    }
}

export function hasConsent(): boolean | null {
    const val = localStorage.getItem(CONSENT_KEY);
    if (val === "accepted") return true;
    if (val === "refused") return false;
    return null;
}

interface Props {
    onConsent: (accepted: boolean) => void;
}

export function CookieBanner({ onConsent }: Props) {
    function accept() {
        localStorage.setItem(CONSENT_KEY, "accepted");
        posthog.opt_in_capturing();
        posthog.set_config({ persistence: "localStorage+cookie", person_profiles: "identified_only" });
        onConsent(true);
    }

    function refuse() {
        localStorage.setItem(CONSENT_KEY, "refused");
        onConsent(false);
    }

    return (
        <div style={{
            position: "fixed",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(560px, calc(100% - 32px))",
            background: "rgba(15, 10, 30, 0.95)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: 16,
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            zIndex: 9998,
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
            animation: "slideUp 0.4s ease-out"
        }}>
            <p style={{
                margin: 0,
                fontSize: 13,
                color: "rgba(255, 255, 255, 0.8)",
                lineHeight: 1.5,
                flex: 1
            }}>
                🍪 Nous utilisons des cookies analytiques (PostHog) pour améliorer l'expérience de jeu.
                Aucune donnée personnelle n'est collectée.
            </p>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button
                    onClick={refuse}
                    style={{
                        padding: "8px 14px",
                        borderRadius: 10,
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        background: "rgba(255, 255, 255, 0.06)",
                        color: "rgba(255, 255, 255, 0.6)",
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: 13,
                        transition: "all 0.2s ease"
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.12)"}
                    onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                >
                    Refuser
                </button>
                <button
                    onClick={accept}
                    style={{
                        padding: "8px 14px",
                        borderRadius: 10,
                        border: "1px solid rgba(124, 58, 237, 0.4)",
                        background: "linear-gradient(135deg, rgba(124, 58, 237, 0.5) 0%, rgba(167, 139, 250, 0.4) 100%)",
                        color: "white",
                        cursor: "pointer",
                        fontWeight: 700,
                        fontSize: 13,
                        transition: "all 0.2s ease"
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "linear-gradient(135deg, rgba(124, 58, 237, 0.7) 0%, rgba(167, 139, 250, 0.6) 100%)"}
                    onMouseLeave={e => e.currentTarget.style.background = "linear-gradient(135deg, rgba(124, 58, 237, 0.5) 0%, rgba(167, 139, 250, 0.4) 100%)"}
                >
                    Accepter
                </button>
            </div>
        </div>
    );
}
