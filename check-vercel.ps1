# Script de vérification avant déploiement Vercel

Write-Host "🔍 Vérification de la configuration Vercel..." -ForegroundColor Cyan

# Vérifier que les fichiers nécessaires existent
$requiredFiles = @(
    "vercel.json",
    "api/health.mjs",
    "api/search.mjs",
    "api/popular.mjs",
    "api/game/[id].mjs",
    "api/lib/igdb.mjs",
    "api/lib/pool.mjs",
    "api/lib/normalize.mjs"
)

$allFilesExist = $true
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "✅ $file" -ForegroundColor Green
    } else {
        Write-Host "❌ $file manquant" -ForegroundColor Red
        $allFilesExist = $false
    }
}

if (-not $allFilesExist) {
    Write-Host "`n❌ Certains fichiers sont manquants!" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Tous les fichiers requis sont présents!" -ForegroundColor Green

# Vérifier le fichier vercel.json
Write-Host "`n🔍 Vérification du vercel.json..." -ForegroundColor Cyan
try {
    $vercelConfig = Get-Content "vercel.json" -Raw | ConvertFrom-Json
    Write-Host "✅ vercel.json est valide" -ForegroundColor Green
} catch {
    Write-Host "❌ vercel.json invalide: $_" -ForegroundColor Red
    exit 1
}

# Rappel des variables d'environnement
Write-Host "`n📝 N'oublie pas de configurer ces variables sur Vercel:" -ForegroundColor Yellow
Write-Host "   - TWITCH_CLIENT_ID" -ForegroundColor Yellow
Write-Host "   - TWITCH_CLIENT_SECRET" -ForegroundColor Yellow

Write-Host "`n🚀 Prêt pour le déploiement!" -ForegroundColor Green
Write-Host "`nCommandes suivantes:" -ForegroundColor Cyan
Write-Host "   git add ." -ForegroundColor White
Write-Host "   git commit -m 'Migration API vers Vercel Serverless'" -ForegroundColor White
Write-Host "   git push" -ForegroundColor White

