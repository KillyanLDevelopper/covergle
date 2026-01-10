import { ensurePopularPool } from "./lib/pool.mjs";
import { norm } from "./lib/normalize.mjs";

export default async function handler(req, res) {
    try {
        const q = String(req.query.q ?? "").trim();
        if (!q) return res.json([]);

        const pool = await ensurePopularPool();

        if (pool.length === 0) {
            console.error("❌ Le pool est vide, impossible de rechercher");
            return res.status(503).json({ error: "Service temporairement indisponible - pool de jeux vide" });
        }

        const nq = norm(q);

        const items = pool
            .map(g => {
                const name = norm(g.title);
                let score = 0;

                if (name === nq) score += 1000;
                if (name.startsWith(nq)) score += 400;
                if (name.includes(nq)) score += 200;

                score += Math.min(120, Math.floor(Math.log10(g.follows + 1) * 30));

                return { g, score };
            })
            .filter(x => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 12)
            .map(x => ({
                id: x.g.id,
                title: x.g.title,
                year: x.g.year,
                cover: x.g.cover,
                aliases: x.g.aliases,
                platforms: x.g.platforms || [],
                genres: x.g.genres || []
            }));

        res.status(200).json(items);
    } catch (e) {
        console.error("❌ Erreur dans /api/search:", e);
        res.status(500).json({ error: String(e?.message ?? e) });
    }
}

