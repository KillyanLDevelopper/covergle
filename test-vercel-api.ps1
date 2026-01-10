# Script de test de l'API Vercel
# Usage: .\test-vercel-api.ps1 [url]
# Exemple: .\test-vercel-api.ps1 https://covergle.vercel.app

param(
    [string]$BaseUrl = "https://covergle.vercel.app"
)

Write-Host "🧪 Test de l'API Vercel sur: $BaseUrl" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health check
Write-Host "1️⃣ Test /api/health..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/api/health" -UseBasicParsing
    $content = $response.Content | ConvertFrom-Json
    if ($content.ok -eq $true) {
        Write-Host "   ✅ API est en ligne!" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Réponse inattendue: $($response.Content)" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ Erreur: $_" -ForegroundColor Red
}

Write-Host ""

# Test 2: Search
Write-Host "2️⃣ Test /api/search?q=zelda..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/api/search?q=zelda" -UseBasicParsing
    $games = $response.Content | ConvertFrom-Json
    if ($games.Count -gt 0) {
        Write-Host "   ✅ Trouvé $($games.Count) jeu(x)" -ForegroundColor Green
        Write-Host "   📦 Exemple: $($games[0].title) ($($games[0].year))" -ForegroundColor White
    } else {
        Write-Host "   ⚠️ Aucun jeu trouvé (le pool est peut-être vide)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Erreur: $_" -ForegroundColor Red
}

Write-Host ""

# Test 3: Popular
Write-Host "3️⃣ Test /api/popular?page=1&limit=5..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/api/popular?page=1&limit=5" -UseBasicParsing
    $games = $response.Content | ConvertFrom-Json
    if ($games.Count -gt 0) {
        Write-Host "   ✅ Trouvé $($games.Count) jeu(x) populaire(s)" -ForegroundColor Green
        foreach ($game in $games[0..([Math]::Min(2, $games.Count - 1))]) {
            Write-Host "   📦 $($game.title) ($($game.year)) - $($game.follows) follows" -ForegroundColor White
        }
    } else {
        Write-Host "   ⚠️ Aucun jeu trouvé (le pool est peut-être en cours de chargement)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Erreur: $_" -ForegroundColor Red
}

Write-Host ""

# Test 4: Game details (si on a un ID du test précédent)
if ($games -and $games.Count -gt 0) {
    $gameId = $games[0].id
    Write-Host "4️⃣ Test /api/game/$gameId..." -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri "$BaseUrl/api/game/$gameId" -UseBasicParsing
        $game = $response.Content | ConvertFrom-Json
        Write-Host "   ✅ Détails du jeu récupérés" -ForegroundColor Green
        Write-Host "   📦 $($game.title) ($($game.year))" -ForegroundColor White
        Write-Host "   🎮 Plateformes: $($game.platforms -join ', ')" -ForegroundColor White
    } catch {
        Write-Host "   ❌ Erreur: $_" -ForegroundColor Red
    }
} else {
    Write-Host "4️⃣ Test /api/game/:id ignoré (pas d'ID disponible)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "✅ Tests terminés!" -ForegroundColor Green

