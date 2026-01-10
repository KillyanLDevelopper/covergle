const clientId = process.env.TWITCH_CLIENT_ID || "";
}
    return withProtocol.replace("t_thumb", `t_${size}`);
    const withProtocol = u.startsWith("//") ? `https:${u}` : u;
    if (!u) return null;
    const u = String(url || "");
export function normalizeCoverUrl(url, size = "cover_big") {

}
    return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
    if (!imageId) return null;
export function coverUrlFromImageId(imageId, size = "cover_big") {

}
    }
        }
            if (attempt === retries) throw error;
        } catch (error) {
            return JSON.parse(text);

            }
                throw new Error(`IGDB HTTP ${res.status} ${text}`);
                console.error("❌ Erreur IGDB:", res.status, text);
            if (!res.ok) {

            }
                continue;
                await new Promise(resolve => setTimeout(resolve, waitTime));
                console.warn(`⚠️ Rate limit atteint, attente de ${waitTime}ms avant retry ${attempt + 1}/${retries}...`);
                const waitTime = Math.pow(2, attempt) * 1000;
            if (res.status === 429 && attempt < retries) {

            const text = await res.text();

            });
                body: query
                },
                    "Content-Type": "text/plain"
                    "Authorization": `Bearer ${token}`,
                    "Client-ID": clientId,
                headers: {
                method: "POST",
            const res = await fetch("https://api.igdb.com/v4/games", {
        try {
    for (let attempt = 0; attempt <= retries; attempt++) {

    const token = await getAppToken();
export async function igdbGames(query, retries = 3) {

}
    return token;

    };
        expiresAt: Date.now() + Math.max(0, expiresIn - 60) * 1000
        token,
    tokenCache = {
    console.log("✅ Token obtenu avec succès");

    }
        throw new Error(`Token invalide: ${text}`);
        console.error("❌ Token invalide dans la réponse");
    if (!token) {

    const expiresIn = Number(data.expires_in || 0);
    const token = data.access_token;
    const data = JSON.parse(text);

    }
        throw new Error(`Token HTTP ${res.status} ${text}`);
        console.error("❌ Erreur token:", res.status, text);
    if (!res.ok) {

    const text = await res.text();
    const res = await fetch(url, { method: "POST" });

    url.searchParams.set("grant_type", "client_credentials");
    url.searchParams.set("client_secret", clientSecret);
    url.searchParams.set("client_id", clientId);
    const url = new URL("https://id.twitch.tv/oauth2/token");
    console.log("🔑 Demande d'un nouveau token Twitch...");

    }
        return tokenCache.token;
    if (tokenCache.token && now < tokenCache.expiresAt) {
    const now = Date.now();
export async function getAppToken() {

let tokenCache = { token: null, expiresAt: 0 };

}
    throw new Error("TWITCH_CLIENT_ID ou TWITCH_CLIENT_SECRET manquant");
if (!clientId || !clientSecret) {

const clientSecret = process.env.TWITCH_CLIENT_SECRET || "";

