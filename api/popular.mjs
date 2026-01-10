import { ensurePopularPool } from "./lib/pool.mjs";

export default async function handler(req, res) {
    try {
        const page = Math.max(1, parseInt(req.query.page || "1", 10));
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || "20", 10)));

        const pool = await ensurePopularPool();

        if (pool.length === 0) {
            console.error("❌ Le pool est vide");
            return res.status(503).json({ error: "Service temporairement indisponible - pool de jeux vide" });
        }

        const start = (page - 1) * limit;
        const end = start + limit;
        const items = pool.slice(start, end);

        res.status(200).json(items);
    } catch (e) {
        console.error("❌ Erreur dans /api/popular:", e);
        res.status(500).json({ error: String(e?.message ?? e) });
    }
}

