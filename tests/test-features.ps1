# Test de l'application avec les nouvelles fonctionnalites

Write-Host "Verification du serveur..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri "http://localhost:5174/api/search?q=zelda" -Method Get -TimeoutSec 5
    Write-Host "Serveur operationnel - $($response.Length) jeux trouves" -ForegroundColor Green

    if ($response.Length -gt 0) {
        $game = $response[0]
        Write-Host "`nExemple de jeu:" -ForegroundColor Yellow
        Write-Host "   Titre: $($game.title)"
        Write-Host "   Annee: $($game.year)"
        Write-Host "   Plateformes: $($game.platforms -join ', ')"
        Write-Host "   Genres: $($game.genres -join ', ')"
    }

    Write-Host "`nNouvelles fonctionnalites implementees:" -ForegroundColor Magenta
    Write-Host "   1. Indices tous les 2 essais (apres 2e et 4e essai)"
    Write-Host "   2. Reponses en jaune si bonne plateforme"
    Write-Host "`nLancez le frontend avec: npm run dev" -ForegroundColor Cyan

} catch {
    Write-Host "Erreur serveur: $_" -ForegroundColor Red
}

