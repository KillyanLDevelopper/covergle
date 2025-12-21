import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
app.use(cors());
app.use(express.json());

const clientId = process.env.TWITCH_CLIENT_ID || "";
const clientSecret = process.env.TWITCH_CLIENT_SECRET || "";
const port = Number(process.env.PORT || 5174);

if (!clientId || !clientSecret) {
    throw new Error("TWITCH_CLIENT_ID ou TWITCH_CLIENT_SECRET manquant dans server/.env");
}

let tokenCache = { token: null, expiresAt: 0 };

async function getAppToken() {
    const now = Date.now();
    if (tokenCache.token && now < tokenCache.expiresAt) return tokenCache.token;

    const url = new URL("https://id.twitch.tv/oauth2/token");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("client_secret", clientSecret);
    url.searchParams.set("grant_type", "client_credentials");

    const res = await fetch(url, { method: "POST" });
    const text = await res.text();

    if (!res.ok) {
        throw new Error(`Token HTTP ${res.status} ${text}`);
    }

    const data = JSON.parse(text);
    const token = data.access_token;
    const expiresIn = Number(data.expires_in || 0);

    if (!token) {
        throw new Error(`Token invalide: ${text}`);
    }

    tokenCache = {
        token,
        expiresAt: Date.now() + Math.max(0, expiresIn - 60) * 1000
    };

    return token;
}

async function igdbGames(query) {
    const token = await getAppToken();
    const res = await fetch("https://api.igdb.com/v4/games", {
        method: "POST",
        headers: {
            "Client-ID": clientId,
            "Authorization": `Bearer ${token}`,
            "Content-Type": "text/plain"
        },
        body: query
    });

    const text = await res.text();
    if (!res.ok) {
        throw new Error(`IGDB HTTP ${res.status} ${text}`);
    }
    return JSON.parse(text);
}

function coverUrlFromImageId(imageId, size = "cover_big") {
    if (!imageId) return null;
    return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
}

function normalizeCoverUrl(url, size = "cover_big") {
    const u = String(url || "");
    if (!u) return null;
    const withProtocol = u.startsWith("//") ? `https:${u}` : u;
    return withProtocol.replace("t_thumb", `t_${size}`);
}

let popularPool = [];
let popularPoolMap = new Map();
let popularPoolExpiresAt = 0;

async function ensurePopularPool() {
    const now = Date.now();
    if (popularPool.length && now < popularPoolExpiresAt) return popularPool;

    const query = `
fields id,name,first_release_date,follows,hypes,total_rating,total_rating_count,cover.url;
where category=0 & cover != null & first_release_date != null & follows != null;
sort follows desc;
limit 800;
`;
    const data = await igdbGames(query);
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
        }));

    popularPool = pool;
    popularPoolMap = new Map(pool.map(g => [g.id, g]));
    popularPoolExpiresAt = now + 6 * 60 * 60 * 1000;

    return popularPool;
}

function norm(s) {
    return String(s || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
});

app.get("/api/search", async (req, res) => {
    try {
        const q = String(req.query.q ?? "").trim();
        if (!q) return res.json([]);

        const pool = await ensurePopularPool();
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
                aliases: x.g.aliases
            }));

        res.json(items);
    } catch (e) {
        res.status(500).json({ error: String(e?.message ?? e) });
    }
});

app.get("/api/game/:id", async (req, res) => {
    try {
        const id = String(req.params.id || "").trim();
        if (!/^\d+$/.test(id)) return res.status(400).json({ error: "bad id" });

        await ensurePopularPool();
        if (!popularPoolMap.has(id)) return res.status(404).json({ error: "not found" });

        const query = `
fields name, first_release_date, genres.name, platforms.name, cover.image_id;
where id = ${Number(id)};
limit 1;
`;
        const data = await igdbGames(query);
        const g = Array.isArray(data) ? data[0] : null;
        if (!g) return res.status(404).json({ error: "not found" });

        res.json({
            id: String(g.id),
            title: g.name,
            year: g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : null,
            platforms: (g.platforms ?? []).map(p => p?.name).filter(Boolean),
            genres: (g.genres ?? []).map(x => x?.name).filter(Boolean),
            cover: coverUrlFromImageId(g.cover?.image_id, "cover_big"),
            aliases: [g.name]
        });
    } catch (e) {
        res.status(500).json({ error: String(e?.message ?? e) });
    }
});

app.listen(port, () => {});
