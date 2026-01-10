export type IgdbGame = {
    id: string;
    title: string;
    year: number | null;
    platforms?: string[];
    genres?: string[];
    cover: string | null;
    aliases: string[];
};

export async function igdbSearch(q: string): Promise<IgdbGame[]> {
    const params = new URLSearchParams({ q });
    const res = await fetch(`/api/search?${params}`);
    if (!res.ok) return [];
    return res.json();
}

export async function igdbGet(id: string): Promise<IgdbGame | null> {
    const res = await fetch(`/api/game/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return res.json();
}

export async function igdbPopular(page: number, limit: number): Promise<IgdbGame[]> {
    const params = new URLSearchParams({
        page: String(page),
        limit: String(limit)
    });
    const res = await fetch(`/api/popular?${params}`);
    if (!res.ok) return [];
    return res.json();
}
