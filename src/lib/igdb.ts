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
    const url = new URL("http://localhost:5174/api/search");
    url.searchParams.set("q", q);
    const res = await fetch(url);
    if (!res.ok) return [];
    return res.json();
}

export async function igdbGet(id: string): Promise<IgdbGame | null> {
    const res = await fetch(`http://localhost:5174/api/game/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return res.json();
}

export async function igdbPopular(page: number, limit: number): Promise<IgdbGame[]> {
    const url = new URL("http://localhost:5174/api/popular");
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", String(limit));
    const res = await fetch(url);
    if (!res.ok) return [];
    return res.json();
}
