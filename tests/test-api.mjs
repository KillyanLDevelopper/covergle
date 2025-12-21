// Script de test pour l'API

const baseUrl = "http://localhost:5174";

console.log("🧪 Test de l'API...\n");

// Test 1: Health check
console.log("1️⃣ Test /api/health");
try {
    const res = await fetch(`${baseUrl}/api/health`);
    const data = await res.json();
    console.log("✅ Health:", data);
} catch (e) {
    console.error("❌ Health error:", e.message);
}

// Test 2: Search
console.log("\n2️⃣ Test /api/search?q=zelda");
try {
    const res = await fetch(`${baseUrl}/api/search?q=zelda`);
    console.log(`Status: ${res.status} ${res.statusText}`);
    const text = await res.text();
    console.log(`Raw response: ${text}`);
    try {
        const data = JSON.parse(text);
        console.log(`✅ Search: ${Array.isArray(data) ? data.length : 'non-array'} résultats`);
        if (Array.isArray(data) && data.length > 0) {
            console.log("Premier résultat:", data[0].title);
        } else if (data.error) {
            console.log("❌ Erreur API:", data.error);
        }
    } catch (parseError) {
        console.error("❌ JSON parse error:", parseError.message);
    }
} catch (e) {
    console.error("❌ Search error:", e.message);
}

console.log("\n✅ Tests terminés");
process.exit(0);

