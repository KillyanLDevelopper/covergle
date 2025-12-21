Write-Host "Test de l'API..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri "http://localhost:5174/api/search?q=zelda" -Method Get -TimeoutSec 10
    Write-Host "Succes! Nombre de resultats: $($response.Length)" -ForegroundColor Green
    if ($response.Length -gt 0) {
        Write-Host "Premier jeu: $($response[0].title)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Erreur: $_" -ForegroundColor Red
    Write-Host "Details: $($_.Exception.Message)" -ForegroundColor Red
}

