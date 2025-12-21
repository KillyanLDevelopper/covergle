# 🎮 Covergle - Devinez le jeu vidéo par sa couverture !

Un jeu de devinettes inspiré de Wordle où vous devez identifier un jeu vidéo à partir de sa couverture pixelisée. Plus vous faites de tentatives, plus l'image devient claire !

## 🌟 Fonctionnalités

### 🎯 Deux modes de jeu
- **Mode Daily** : Un jeu par jour, le même pour tous les joueurs
- **Mode Infinite** : Jeux aléatoires illimités pour s'entraîner

### 💡 Système d'indices intelligents
- **Indices tous les 2 essais** : Après votre 2ème et 4ème tentative, recevez des indices sur :
  - 📅 L'année de sortie
  - 🎮 Les plateformes (jusqu'à 3)
  - 🎯 Les genres (jusqu'à 2)

### 🟨 Feedback de plateforme
- **✅ Vert** : Vous avez trouvé le bon jeu !
- **🟨 Jaune** : Votre jeu partage au moins une plateforme avec le jeu à trouver (+ texte "Plateforme commune trouvée !")
- **❌ Gris** : Aucune plateforme en commun

### 📊 Statistiques
- Nombre de parties jouées
- Nombre de victoires
- Série actuelle et meilleure série
- Distribution des victoires par nombre d'essais

### 🖼️ Révélation progressive
- L'image de couverture se dévoile progressivement à chaque essai (6 essais maximum)
- Effet de pixelisation qui diminue au fil des tentatives

## 🚀 Installation et démarrage

### Prérequis
- Node.js (v18 ou supérieur)
- npm ou yarn
- Credentials IGDB (Twitch Client ID & Secret)

### Configuration

1. **Cloner le projet**
```bash
git clone <votre-repo>
cd covergle
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configurer les credentials IGDB**

Créez un fichier `server/.env` avec vos credentials Twitch/IGDB :
```env
TWITCH_CLIENT_ID=votre_client_id
TWITCH_CLIENT_SECRET=votre_client_secret
PORT=5174
```

> 💡 Pour obtenir vos credentials : https://api-docs.igdb.com/#account-creation

### Démarrage rapide

**Option 1 : Script automatique (Windows)**
```powershell
.\start.ps1
```

**Option 2 : Démarrage manuel**
```bash
# Terminal 1 : Backend
cd server
node index.mjs

# Terminal 2 : Frontend
npm run dev
```

Ouvrez ensuite votre navigateur sur **http://localhost:5173**

## 📁 Structure du projet

```
covergle/
├── src/                      # Code source frontend (React + TypeScript)
│   ├── App.tsx              # Composant principal de l'application
│   ├── main.tsx             # Point d'entrée React
│   ├── lib/                 # Bibliothèques et utilitaires
│   │   ├── daily.ts         # Logique du mode daily
│   │   ├── igdb.ts          # API IGDB
│   │   ├── normalize.ts     # Normalisation de texte
│   │   └── storage.ts       # LocalStorage
│   └── ui/                  # Composants UI
│       ├── CanvasPixelCover.tsx  # Affichage pixelisé
│       └── GuessBox.tsx          # Zone de saisie avec autocomplétion
│
├── server/                  # Backend API (Express)
│   ├── index.mjs           # Serveur Express + IGDB
│   └── .env                # Configuration (à créer)
│
├── tests/                   # Scripts de test
│   ├── test-api.mjs        # Test complet de l'API
│   ├── test-platforms.mjs  # Test des plateformes
│   ├── test-quick.mjs      # Test rapide
│   └── debug-server.mjs    # Débogage serveur
│
├── public/                  # Assets statiques
├── package.json            # Dépendances npm
├── vite.config.ts          # Configuration Vite
├── tsconfig.json           # Configuration TypeScript
└── README.md               # Ce fichier
```

## 🎮 Comment jouer ?

1. **Regardez la couverture pixelisée** du jeu à deviner
2. **Tapez le nom d'un jeu** dans la zone de recherche (autocomplétion disponible)
3. **Validez votre réponse** et observez la couleur :
   - 🟨 **Jaune** : Bonne plateforme ! Vous êtes sur la bonne piste
   - ❌ **Gris** : Mauvaise plateforme, essayez autre chose
   - ✅ **Vert** : C'est gagné !
4. **Utilisez les indices** qui apparaissent après 2 et 4 essais
5. **Trouvez le jeu en 6 essais maximum** !

### Exemple de partie

```
Essai 1: "Halo 5" → ❌ (Xbox uniquement)
Essai 2: "Mario Kart 8" → 🟨 (Wii U en commun)
  💡 Indice : Année: 2017, Plateformes: Wii U, Switch, Genres: Puzzle, Adventure
Essai 3: "Super Mario Odyssey" → 🟨 (Switch en commun)
Essai 4: "God of War" → ❌ (PlayStation uniquement)
  💡 Indice : [Nouvel indice]
Essai 5: "The Legend of Zelda: Breath of the Wild" → ✅ GAGNÉ !
```

## 🔧 Technologies utilisées

### Frontend
- **React 19** - Framework UI
- **TypeScript** - Typage statique
- **Vite** - Build tool et dev server
- **Canvas API** - Effet de pixelisation

### Backend
- **Node.js** - Runtime
- **Express 5** - Serveur HTTP
- **IGDB API** - Base de données de jeux vidéo
- **dotenv** - Gestion des variables d'environnement

## 🧪 Tests

Des scripts de test sont disponibles dans le dossier `tests/` :

```bash
# Test complet de l'API
node tests/test-api.mjs

# Test des plateformes et genres
node tests/test-platforms.mjs

# Test rapide
node tests/test-quick.mjs

# Débogage avec serveur intégré
node tests/debug-server.mjs
```

## 📊 API Backend

Le serveur expose 3 endpoints :

### `GET /api/health`
Vérification de l'état du serveur
```json
{ "ok": true }
```

### `GET /api/search?q=<query>`
Recherche de jeux par nom
```json
[
  {
    "id": "1234",
    "title": "The Legend of Zelda: Breath of the Wild",
    "year": 2017,
    "cover": "https://...",
    "aliases": ["BotW", "Zelda BotW"],
    "platforms": ["Nintendo Switch", "Wii U"],
    "genres": ["Puzzle", "Adventure"]
  }
]
```

### `GET /api/game/:id`
Récupération des détails d'un jeu spécifique
```json
{
  "id": "1234",
  "title": "The Legend of Zelda: Breath of the Wild",
  "year": 2017,
  "cover": "https://...",
  "platforms": ["Nintendo Switch", "Wii U"],
  "genres": ["Puzzle", "Adventure"]
}
```

## 🎨 Personnalisation

### Modifier le nombre maximum d'essais
Dans `src/App.tsx`, changez la constante :
```typescript
const MAX_TRIES = 6; // Changez cette valeur
```

### Modifier la fréquence des indices
Dans `src/App.tsx`, ligne ~402 :
```typescript
const showHint = (i + 1) % 2 === 0; // Actuellement tous les 2 essais
```

### Modifier le nombre de jeux dans le pool
Dans `server/index.mjs`, ligne ~99 :
```typescript
limit 500; // Changez cette valeur (max 500 pour l'API IGDB)
```

## 🐛 Dépannage

### Le serveur ne démarre pas
- Vérifiez que le port 5174 est libre
- Vérifiez vos credentials dans `server/.env`
- Vérifiez les logs dans le terminal

### Les jeux ne se chargent pas
- Vérifiez la connexion internet
- Vérifiez que l'API IGDB est accessible
- Essayez de recharger le pool avec le bouton "Recharger le pool"

### Les plateformes ne s'affichent pas
- Rechargez le pool de jeux
- Vérifiez la console du navigateur (F12)
- Vérifiez que le serveur retourne bien les champs `platforms` et `genres`

### Erreur "pool vide"
- Vérifiez vos credentials IGDB
- Vérifiez que la requête IGDB ne dépasse pas la limite de 500 jeux
- Consultez les logs du serveur pour plus de détails

## 📝 Changelog

### Version actuelle (2025-12-21)

#### ✨ Nouvelles fonctionnalités
- 💡 Indices tous les 2 essais (année, plateformes, genres)
- 🟨 Indication visuelle des plateformes communes
- 📋 Légende des couleurs toujours visible
- 💬 Texte de confirmation "Plateforme commune trouvée !"

#### 🔧 Améliorations techniques
- Ajout des champs `platforms` et `genres` dans l'API
- Optimisation de la requête IGDB (limite 500 au lieu de 800)
- Meilleure gestion des erreurs
- Logs de débogage améliorés

#### 🐛 Corrections
- Fix du problème de "pool vide" (filtres IGDB trop restrictifs)
- Fix de la limite IGDB dépassée

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
- 🐛 Signaler des bugs
- 💡 Proposer de nouvelles fonctionnalités
- 🔧 Soumettre des pull requests
- 📚 Améliorer la documentation

## 📄 Licence

Ce projet est sous licence MIT.

## 🙏 Remerciements

- [IGDB](https://www.igdb.com/) pour la base de données de jeux
- [Wordle](https://www.nytimes.com/games/wordle/) pour l'inspiration
- La communauté React et TypeScript

## 📞 Support

Pour toute question ou problème :
1. Consultez la section [Dépannage](#-dépannage)
2. Vérifiez les [Issues](https://github.com/votre-repo/issues) existantes
3. Créez une nouvelle issue si nécessaire

---

**Bon jeu ! 🎮✨**

