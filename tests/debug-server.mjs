// Script de débogage pour tester le serveur
import { spawn } from 'child_process';

console.log("🚀 Démarrage du serveur de test...\n");

const serverProcess = spawn('node', ['index.mjs'], {
    cwd: process.cwd(),
    stdio: 'pipe'
});

serverProcess.stdout.on('data', (data) => {
    process.stdout.write(`[SERVEUR] ${data}`);
});

serverProcess.stderr.on('data', (data) => {
    process.stderr.write(`[ERREUR SERVEUR] ${data}`);
});

serverProcess.on('error', (error) => {
    console.error('❌ Erreur de démarrage du serveur:', error);
    process.exit(1);
});

// Attendre que le serveur démarre
await new Promise(resolve => setTimeout(resolve, 3000));

console.log("\n🧪 Test de l'API...\n");

// Test de recherche
try {
    console.log("📞 Appel de /api/search?q=mario");
    const res = await fetch("http://localhost:5174/api/search?q=mario");
    console.log(`📡 Status: ${res.status}`);
    const data = await res.json();

    if (Array.isArray(data)) {
        console.log(`✅ ${data.length} jeux trouvés`);
        if (data.length > 0) {
            console.log(`🎮 Premier jeu: ${data[0].title}`);
        }
    } else if (data.error) {
        console.log(`❌ Erreur: ${data.error}`);
    }
} catch (err) {
    console.error("❌ Erreur de test:", err.message);
}

console.log("\n⏹️ Arrêt du serveur...");
serverProcess.kill();
await new Promise(resolve => setTimeout(resolve, 500));
process.exit(0);

