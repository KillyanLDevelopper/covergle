# Script de demarrage de Covergle
# Lance le serveur backend et le frontend

Write-Host "`n=== COVERGLE - Demarrage ===" -ForegroundColor Cyan
Write-Host ""

# Verification que le serveur n'est pas deja lance
$serverRunning = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like "*index.mjs*" }
if ($serverRunning) {
    Write-Host "Un serveur Node.js est deja en cours d'execution" -ForegroundColor Yellow
} else {
    Write-Host "1. Demarrage du serveur backend..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\server'; node index.mjs" -WindowStyle Normal
    Start-Sleep -Seconds 2
}

Write-Host "2. Test du serveur..." -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "http://localhost:5174/api/health" -Method Get -TimeoutSec 5
    Write-Host "   Serveur OK!" -ForegroundColor Green
} catch {
    Write-Host "   Erreur serveur: $_" -ForegroundColor Red
    Write-Host "   Verifiez que le serveur demarre correctement" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "3. Demarrage du frontend..." -ForegroundColor Green
Write-Host "   Le navigateur va s'ouvrir automatiquement..." -ForegroundColor Cyan
Write-Host ""
Write-Host "=== Nouvelles fonctionnalites ===" -ForegroundColor Magenta
Write-Host "  - Indices tous les 2 essais (annee, plateformes, genres)" -ForegroundColor White
Write-Host "  - Tentatives en jaune si bonne plateforme" -ForegroundColor Yellow
Write-Host ""

# Lancer le frontend
cd $PSScriptRoot
npm run dev

