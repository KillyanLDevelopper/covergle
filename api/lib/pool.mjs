import { igdbGames, normalizeCoverUrl } from "./igdb.mjs";

let popularPool = [];
let popularPoolMap = new Map();
let popularPoolExpiresAt = 0;

export async function ensurePopularPool() {
    const now = Date.now();
    if (popularPool.length && now < popularPoolExpiresAt) return popularPool;

    console.log("🔄 Chargement du pool de jeux populaires...");

    const query = `
fields id,name,first_release_date,follows,total_rating_count,cover.url,platforms.name,genres.name;
where cover != null & first_release_date >= 1262304000 & total_rating_count > 10;
sort total_rating_count desc;
limit 500;
`;

    try {
        const data = await igdbGames(query);
        console.log(`📦 Réponse IGDB: ${Array.isArray(data) ? data.length : 0} jeux reçus`);

        const pool = (Array.isArray(data) ? data : [])
            .filter(g => g?.id && g?.name && g?.cover?.url)
            .map(g => ({
                id: String(g.id),
                title: g.name,
                year: g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : null,
                cover: normalizeCoverUrl(g.cover.url, "cover_big"),
                coverSmall: normalizeCoverUrl(g.cover.url, "cover_small"),
                aliases: [g.name],
                follows: Number(g.follows || 0),
                platforms: (g.platforms ?? []).map(p => p?.name).filter(Boolean),
                genres: (g.genres ?? []).map(x => x?.name).filter(Boolean),
            }));

        console.log(`✅ Pool créé avec ${pool.length} jeux valides`);

        if (pool.length === 0) {
            console.warn("⚠️ Le pool est vide! Vérifiez les credentials IGDB et les permissions de l'API");
        }

        popularPool = pool;
        popularPoolMap = new Map(pool.map(g => [g.id, g]));
        popularPoolExpiresAt = now + 12 * 60 * 60 * 1000;

        return popularPool;
    } catch (error) {
        console.error("❌ Erreur lors du chargement du pool:", error);

        if (popularPool.length > 0) {
            console.warn("⚠️ Réutilisation du pool en cache malgré l'expiration");
            popularPoolExpiresAt = now + 30 * 60 * 1000;
            return popularPool;
        }

        throw error;
    }
}

export function getPoolMap() {
    return popularPoolMap;
}

