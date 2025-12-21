// Test des plateformes et genres
console.log("🧪 Test des plateformes et genres\n");

try {
    const res = await fetch("http://localhost:5174/api/search?q=mario");
    const data = await res.json();

    if (Array.isArray(data) && data.length > 0) {
        console.log(`✅ ${data.length} jeux trouvés\n`);
        const first = data[0];
        console.log(`🎮 Jeu: ${first.title}`);
        console.log(`📅 Année: ${first.year || "N/A"}`);
        console.log(`🎮 Plateformes: ${first.platforms ? first.platforms.join(", ") : "N/A"}`);
        console.log(`🎯 Genres: ${first.genres ? first.genres.join(", ") : "N/A"}`);
    } else {
        console.log("❌ Aucun résultat");
    }
} catch (err) {
    console.error("❌ Erreur:", err.message);
}

process.exit(0);

