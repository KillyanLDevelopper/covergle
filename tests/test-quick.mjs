const baseUrl = "http://localhost:5174";

console.log("🧪 Test rapide de l'API\n");

async function testSearch() {
    console.log("📞 Appel de /api/search?q=mario");
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 secondes timeout

        const res = await fetch(`${baseUrl}/api/search?q=mario`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        console.log(`📡 Status: ${res.status} ${res.statusText}`);
        const text = await res.text();
        console.log(`📦 Response (${text.length} chars):`, text.substring(0, 200));

        if (res.status === 200) {
            const data = JSON.parse(text);
            console.log(`✅ ${data.length} jeux trouvés`);
            if (data.length > 0) {
                console.log(`🎮 Premier: ${data[0].title}`);
            }
        } else {
            console.log(`❌ Erreur ${res.status}`);
        }
    } catch (err) {
        if (err.name === 'AbortError') {
            console.error("⏱️ Timeout - la requête a pris trop de temps");
        } else {
            console.error("❌ Erreur:", err.message);
        }
    }
}

await testSearch();
process.exit(0);

