import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
app.use(cors({ origin: process.env.ALLOWED_ORIGIN }));
app.use(express.json());

const publicPath = path.join(__dirname, "..", "dist");
const distPath = path.join(__dirname, "..", "dist");
if (process.env.NODE_ENV === "production") {
    // Servir tous les fichiers statiques depuis le dossier dist
    app.use(express.static(distPath));
}

const clientId = process.env.TWITCH_CLIENT_ID || "";
const clientSecret = process.env.TWITCH_CLIENT_SECRET || "";
const port = Number(process.env.PORT || 5174);

if (!clientId || !clientSecret) {
    throw new Error("TWITCH_CLIENT_ID ou TWITCH_CLIENT_SECRET manquant dans server/.env");
}

let tokenCache = { token: null, expiresAt: 0 };

async function getAppToken() {
    const now = Date.now();
    if (tokenCache.token && now < tokenCache.expiresAt) {
        return tokenCache.token;
    }

    console.log("🔑 Demande d'un nouveau token Twitch...");
    const url = new URL("https://id.twitch.tv/oauth2/token");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("client_secret", clientSecret);
    url.searchParams.set("grant_type", "client_credentials");

    const res = await fetch(url, { method: "POST" });
    const text = await res.text();

    if (!res.ok) {
        console.error("❌ Erreur token:", res.status, text);
        throw new Error(`Token HTTP ${res.status} ${text}`);
    }

    const data = JSON.parse(text);
    const token = data.access_token;
    const expiresIn = Number(data.expires_in || 0);

    if (!token) {
        console.error("❌ Token invalide dans la réponse");
        throw new Error(`Token invalide: ${text}`);
    }

    console.log("✅ Token obtenu avec succès");
    tokenCache = {
        token,
        expiresAt: Date.now() + Math.max(0, expiresIn - 60) * 1000
    };

    return token;
}

async function igdbGames(query, retries = 3) {
    const token = await getAppToken();

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
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

            if (res.status === 429 && attempt < retries) {
                const waitTime = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
                console.warn(`⚠️ Rate limit atteint, attente de ${waitTime}ms avant retry ${attempt + 1}/${retries}...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }

            if (!res.ok) {
                console.error("❌ Erreur IGDB:", res.status, text);
                throw new Error(`IGDB HTTP ${res.status} ${text}`);
            }

            return JSON.parse(text);
        } catch (error) {
            if (attempt === retries) throw error;
        }
    }
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

    console.log("🔄 Chargement du pool de jeux populaires...");

    const PAGE_SIZE = 500;
    const PAGES = 6; // 6 × 500 = 3000 jeux max
    const allData = [];

    try {
        for (let page = 0; page < PAGES; page++) {
            const query = `
fields id,name,first_release_date,follows,total_rating_count,cover.url,platforms.name,genres.name;
where cover != null & total_rating_count > 5;
sort total_rating_count desc;
limit ${PAGE_SIZE};
offset ${page * PAGE_SIZE};
`;
            const data = await igdbGames(query);
            if (!Array.isArray(data) || data.length === 0) break;
            allData.push(...data);
            console.log(`📦 Page ${page + 1}: ${data.length} jeux (total: ${allData.length})`);
            if (data.length < PAGE_SIZE) break;
        }

        const pool = allData
            .filter(g => g?.id && g?.name && g?.cover?.url)
            .map(g => ({
                id: String(g.id),
                title: g.name,
                year: g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : null,
                cover: normalizeCoverUrl(g.cover.url, "cover_big"),
                coverSmall: normalizeCoverUrl(g.cover.url, "cover_small"),
                aliases: [g.name],
                follows: Number(g.follows || 0),
                total_rating_count: Number(g.total_rating_count || 0),
                platforms: (g.platforms ?? []).map(p => p?.name).filter(Boolean),
                genres: (g.genres ?? []).map(x => x?.name).filter(Boolean),
            }))
            .filter(g => g.platforms.length > 0 && g.genres.length > 0);

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

app.get("/api/pool", async (req, res) => {
    try {
        const pool = await ensurePopularPool();
        res.set("Cache-Control", "public, max-age=3600");
        res.json(pool);
    } catch (e) {
        res.status(500).json({ error: String(e?.message ?? e) });
    }
});

app.get("/api/search", async (req, res) => {
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
            .slice(0, 30)
            .map(x => ({
                id: x.g.id,
                title: x.g.title,
                year: x.g.year,
                cover: x.g.cover,
                aliases: x.g.aliases,
                platforms: x.g.platforms || [],
                genres: x.g.genres || []
            }));

        res.json(items);
    } catch (e) {
        console.error("❌ Erreur dans /api/search:", e);
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

// Cache: imageId:step -> Buffer
const coverCache = new Map();
const BLOCK_STEPS = [48, 32, 24, 16, 10, 6];

app.get("/api/cover/:imageId", async (req, res) => {
    try {
        const imageId = req.params.imageId;
        if (!imageId || imageId.length > 100 || imageId.includes("..") || imageId.includes("/")) {
            return res.status(400).end();
        }

        const stepParam = Number(req.query.step ?? 0);
        const cacheKey = `${imageId}:${stepParam}`;

        let buffer = coverCache.get(cacheKey);
        if (!buffer) {
            const igdbUrl = `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`;
            const fetchRes = await fetch(igdbUrl);
            if (!fetchRes.ok) return res.status(502).end();
            const src = Buffer.from(await fetchRes.arrayBuffer());

            if (stepParam < 0) {
                // Révélation complète (fin de partie)
                buffer = src;
            } else {
                const step = Math.min(Math.max(stepParam, 0), BLOCK_STEPS.length - 1);
                const block = BLOCK_STEPS[step];
                const meta = await sharp(src).metadata();
                const sw = Math.max(1, Math.floor(meta.width / block));
                const sh = Math.max(1, Math.floor(meta.height / block));
                // Renvoyer la mini-image — le canvas frontend la scale avec imageSmoothingEnabled=false
                buffer = await sharp(src).resize(sw, sh, { kernel: "nearest" }).jpeg({ quality: 80 }).toBuffer();
            }
            coverCache.set(cacheKey, buffer);
        }

        res.set("Content-Type", "image/jpeg");
        res.set("Cache-Control", "public, max-age=3600");
        res.send(buffer);
    } catch (e) {
        console.error("❌ /api/cover:", e.message);
        res.status(500).end();
    }
});

// Fallback SPA : uniquement si le fichier statique n'existe pas
if (process.env.NODE_ENV === "production") {
    app.use((req, res, next) => {
        if (req.path.startsWith('/api')) return next();
        const filePath = path.join(distPath, req.path);
        res.sendFile(filePath, (err) => {
            if (err) res.sendFile(path.join(distPath, "index.html"));
        });
    });
}

app.listen(port, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${port}`);
    console.log(`📝 Endpoints disponibles:`);
    console.log(`   - GET /api/health`);
    console.log(`   - GET /api/search?q=<query>`);
    console.log(`   - GET /api/game/:id`);
    if (process.env.NODE_ENV === "production") {
        console.log(`   - Frontend servi sur http://localhost:${port}`);
    }
});
