import { useEffect, useMemo, useRef, useState } from "react";
import { igdbSearch, type IgdbGame } from "../lib/igdb";
import { normalizeGuess } from "../lib/normalize";

type Props = {
    disabled?: boolean;
    guesses?: string[];
    onSubmit: (guess: string) => void;
};

export function GuessBox({ disabled, guesses = [], onSubmit }: Props) {
    const [value, setValue] = useState("");
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<IgdbGame[]>([]);
    const lastQueryRef = useRef<string>("");

    const q = useMemo(() => normalizeGuess(value), [value]);

    useEffect(() => {
        if (disabled) return;
        if (!q) {
            setItems([]);
            return;
        }

        const t = setTimeout(async () => {
            lastQueryRef.current = q;
            const res = await igdbSearch(value);
            if (lastQueryRef.current !== q) return;
            const filtered = res.filter(g => !guesses.some(prev => normalizeGuess(prev) === normalizeGuess(g.title)));
            setItems(filtered.slice(0, 30));
        }, 180);

        return () => clearTimeout(t);
    }, [q, value, disabled, guesses]);

    function submit(gameTitle?: string) {
        const title = gameTitle ?? items[0]?.title;
        if (!title) return; // aucune suggestion valide → on bloque

        setValue("");
        setOpen(false);
        setItems([]);
        onSubmit(title);
    }

    return (
        <div style={{ width: "min(520px, 92vw)" }}>
            <div style={{ display: "flex", gap: 10 }}>
                <input
                    value={value}
                    disabled={disabled}
                    onFocus={() => setOpen(true)}
                    onBlur={() => setTimeout(() => setOpen(false), 120)}
                    onChange={e => {
                        setValue(e.target.value);
                        setOpen(true);
                    }}

                    onKeyDown={e => {
                        if (e.key === "Enter") submit(); // Pas de paramètre = utilise la logique automatique
                    }}
                    placeholder="Tape le nom du jeu…"
                    style={{
                        flex: 1,
                        padding: "12px 14px",
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.16)",
                        background: "rgba(0,0,0,0.25)",
                        color: "white",
                        outline: "none"
                    }}
                />
                <button
                    disabled={disabled}
                    onClick={() => submit()} // Pas de paramètre = utilise la logique automatique
                    style={{
                        padding: "12px 14px",
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.16)",
                        background: disabled ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.12)",
                        color: "white",
                        cursor: disabled ? "not-allowed" : "pointer"
                    }}
                >
                    Valider
                </button>
            </div>

            {open && items.length > 0 && !disabled && (
                <div
                    style={{
                        marginTop: 8,
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.12)",
                        overflow: "hidden",
                        background: "rgba(0,0,0,0.55)",
                        maxHeight: 320,
                        overflowY: "auto"
                    }}
                >
                    {items.map(g => (
                        <button
                            key={g.id}
                            onMouseDown={e => {
                                e.preventDefault();
                                submit(g.title); // Passe le titre du jeu cliqué
                            }}
                            style={{
                                width: "100%",
                                textAlign: "left",
                                padding: "10px 12px",
                                border: "none",
                                background: "transparent",
                                color: "white",
                                cursor: "pointer"
                            }}
                        >
                            {g.title}{g.year ? ` (${g.year})` : ""}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
