import { ensurePopularPool, getPoolMap } from "../lib/pool.mjs";
import { igdbGames, coverUrlFromImageId } from "../lib/igdb.mjs";

export default async function handler(req, res) {
    try {
        const id = String(req.query.id || "").trim();
        if (!/^\d+$/.test(id)) return res.status(400).json({ error: "bad id" });

        await ensurePopularPool();
        const popularPoolMap = getPoolMap();

        if (!popularPoolMap.has(id)) return res.status(404).json({ error: "not found" });

        const query = `
fields name, first_release_date, genres.name, platforms.name, cover.image_id;
where id = ${Number(id)};
limit 1;
`;
        const data = await igdbGames(query);
        const g = Array.isArray(data) ? data[0] : null;
        if (!g) return res.status(404).json({ error: "not found" });

        res.status(200).json({
            id: String(g.id),
            title: g.name,
            year: g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : null,
            platforms: (g.platforms ?? []).map(p => p?.name).filter(Boolean),
            genres: (g.genres ?? []).map(x => x?.name).filter(Boolean),
            cover: coverUrlFromImageId(g.cover?.image_id, "cover_big"),
            aliases: [g.name]
        });
    } catch (e) {
        console.error("❌ Erreur dans /api/game/:id:", e);
        res.status(500).json({ error: String(e?.message ?? e) });
    }
}

