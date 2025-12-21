import fs from "node:fs/promises";

const API_KEY = process.env.RAWG_KEY;

if (!API_KEY) {
    console.log("RAWG_KEY manquant. Exemple PowerShell: $env:RAWG_KEY='ton_cle'");
    process.exit(1);
}

const OUT_PATH = "src/data/games.json";

function pickCover(g) {
    return g.background_image || g.background_image_additional || null;
}

function toGame(g) {
    const title = g.name || "";
    const id = String(g.id);
    const released = g.released || "";
    const year = released ? Number(released.slice(0, 4)) : null;

    const platforms = Array.isArray(g.parent_platforms)
        ? g.parent_platforms.map(p => p.platform?.name).filter(Boolean)
        : [];

    const genres = Array.isArray(g.genres)
        ? g.genres.map(x => x.name).filter(Boolean)
        : [];

    const aliases = [
        title,
        title.replace(/[:'’]/g, ""),
        title.replace(/[-–—]/g, " "),
        title.replace(/[^A-Za-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim()
    ].filter(Boolean);

    return {
        id,
        title,
        aliases: Array.from(new Set(aliases)),
        year,
        platforms,
        genres,
        cover: pickCover(g)
    };
}

async function fetchPage(page, pageSize) {
    const url = new URL("https://api.rawg.io/api/games");
    url.searchParams.set("key", API_KEY);
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", String(pageSize));
    url.searchParams.set("ordering", "-added");
    url.searchParams.set("exclude_additions", "true");

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function main() {
    const pageSize = 40;
    const pages = 50;
    const map = new Map();

    for (let page = 1; page <= pages; page++) {
        const data = await fetchPage(page, pageSize);
        const results = Array.isArray(data.results) ? data.results : [];
        for (const g of results) {
            const game = toGame(g);
            if (!game.cover) continue;
            if (!game.title) continue;
            map.set(game.id, game);
        }
        console.log(`page ${page}/${pages} -> total ${map.size}`);
    }

    const games = Array.from(map.values());
    await fs.mkdir("src/data", { recursive: true });
    await fs.writeFile(OUT_PATH, JSON.stringify(games, null, 2), "utf-8");

    console.log(`OK -> ${OUT_PATH} (${games.length} jeux)`);
    console.log(`Attribution requise: RAWG (lien actif vers rawg.io)`);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
