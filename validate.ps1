# Script de validation finale
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   VALIDATION FINALE - COVERGLE        " -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$allGood = $true

# 1. Vérifier la structure
Write-Host "1. Verification de la structure..." -ForegroundColor Yellow
$requiredFiles = @(
    "README.md",
    "package.json",
    "src\App.tsx",
    "server\index.mjs",
    "tests\README.md"
)

foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "   OK - $file" -ForegroundColor Green
    } else {
        Write-Host "   ERREUR - $file manquant" -ForegroundColor Red
        $allGood = $false
    }
}

# 2. Vérifier les tests
Write-Host "`n2. Verification des tests..." -ForegroundColor Yellow
$testFiles = Get-ChildItem tests\*.mjs -ErrorAction SilentlyContinue
$testCount = $testFiles.Count
if ($testCount -ge 4) {
    Write-Host "   OK - $testCount fichiers de test trouves" -ForegroundColor Green
} else {
    Write-Host "   ERREUR - Pas assez de tests" -ForegroundColor Red
    $allGood = $false
}

# 3. Vérifier le README principal
Write-Host "`n3. Verification du README principal..." -ForegroundColor Yellow
$readme = Get-Content README.md -Raw -ErrorAction SilentlyContinue
if ($readme -match "Covergle" -and $readme -match "Installation" -and $readme -match "Tests") {
    Write-Host "   OK - README complet" -ForegroundColor Green
} else {
    Write-Host "   ERREUR - README incomplet" -ForegroundColor Red
    $allGood = $false
}

# 4. Vérifier le README des tests
Write-Host "`n4. Verification du README des tests..." -ForegroundColor Yellow
$testReadme = Get-Content tests\README.md -Raw -ErrorAction SilentlyContinue
if ($testReadme -match "test-api" -and $testReadme -match "test-platforms") {
    Write-Host "   OK - README des tests complet" -ForegroundColor Green
} else {
    Write-Host "   ERREUR - README des tests incomplet" -ForegroundColor Red
    $allGood = $false
}

# 5. Vérifier le serveur
Write-Host "`n5. Verification du serveur..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:5174/api/health" -Method Get -TimeoutSec 3 -ErrorAction Stop
    Write-Host "   OK - Serveur actif" -ForegroundColor Green
} catch {
    Write-Host "   WARNING - Serveur non demarre (normal si pas lance)" -ForegroundColor Yellow
}

# 6. Test rapide si serveur actif
Write-Host "`n6. Test rapide..." -ForegroundColor Yellow
try {
    $testResult = Invoke-RestMethod -Uri "http://localhost:5174/api/search?q=mario" -TimeoutSec 3 -ErrorAction Stop
    $count = $testResult.Length
    if ($count -gt 0) {
        Write-Host "   OK - API fonctionnelle - $count jeux" -ForegroundColor Green
    }
} catch {
    Write-Host "   SKIP - Serveur non disponible" -ForegroundColor Gray
}

# 7. Vérifier les modifications clés dans App.tsx
Write-Host "`n7. Verification des fonctionnalites..." -ForegroundColor Yellow
$appContent = Get-Content src\App.tsx -Raw
if ($appContent -match "Indices de couleur") {
    Write-Host "   OK - Legende des couleurs presente" -ForegroundColor Green
} else {
    Write-Host "   ERREUR - Legende manquante" -ForegroundColor Red
    $allGood = $false
}

if ($appContent -match "hasCommonPlatform") {
    Write-Host "   OK - Systeme de plateforme presente" -ForegroundColor Green
} else {
    Write-Host "   ERREUR - Fonction de plateforme manquante" -ForegroundColor Red
    $allGood = $false
}

# Résultat final
Write-Host "`n========================================" -ForegroundColor Cyan
if ($allGood) {
    Write-Host "   VALIDATION REUSSIE !                " -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "`nLe projet est pret!" -ForegroundColor Green
    Write-Host "- Lisez README.md pour commencer" -ForegroundColor White
    Write-Host "- Lancez avec: .\start.ps1" -ForegroundColor White
    Write-Host "- Tests dans: tests/" -ForegroundColor White
} else {
    Write-Host "   VALIDATION ECHOUEE                  " -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "`nCorrigez les erreurs ci-dessus" -ForegroundColor Red
}

Write-Host ""

