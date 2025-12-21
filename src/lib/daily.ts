export function isoDateParis(d = new Date()): string {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Paris",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(d);

    const y = parts.find(p => p.type === "year")?.value ?? "1970";
    const m = parts.find(p => p.type === "month")?.value ?? "01";
    const day = parts.find(p => p.type === "day")?.value ?? "01";
    return `${y}-${m}-${day}`;
}

function fnv1a32(str: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

export function dailyIndex(dateIso: string, size: number): number {
    if (size <= 0) return 0;
    const h = fnv1a32(dateIso);
    return h % size;
}

export function randomIndex(size: number): number {
    if (size <= 0) return 0;
    return Math.floor(Math.random() * size);
}
