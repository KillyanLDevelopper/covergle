import { useEffect, useMemo, useRef, useState } from "react";
import { igdbSearch, type IgdbGame } from "../lib/igdb";
import { normalizeGuess } from "../lib/normalize";

type Props = {
    disabled?: boolean;
    onSubmit: (guess: string) => void;
};

export function GuessBox({ disabled, onSubmit }: Props) {
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
            setItems(res.slice(0, 8));
        }, 180);

        return () => clearTimeout(t);
    }, [q, value, disabled]);

    function submit(v: string) {
        const guess = v.trim();
        if (!guess) return;
        onSubmit(guess);
        setValue("");
        setOpen(false);
        setItems([]);
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
                        if (e.key === "Enter") submit(value);
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
                    onClick={() => submit(value)}
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
                        background: "rgba(0,0,0,0.55)"
                    }}
                >
                    {items.map(g => (
                        <button
                            key={g.id}
                            onMouseDown={e => {
                                e.preventDefault();
                                submit(g.title);
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
