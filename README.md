# Covergle - Devinez le jeu vidéo par sa couverture !

Un jeu de devinettes inspiré de Wordle où vous devez identifier un jeu vidéo à partir de sa couverture pixelisée. Plus vous faites de tentatives, plus l'image devient claire !

## Fonctionnalités

### Deux modes de jeu
- **Mode Daily** : Un jeu par jour, le même pour tous les joueurs (fuseau Europe/Paris)
- **Mode Infinite** : Jeux aléatoires illimités pour s'entraîner

### Indices après chaque essai
À chaque tentative, trois indicateurs s'affichent sur le jeu deviné :

- **📅 Année** : année de sortie du jeu deviné, avec une flèche ▲ si le jeu cible est sorti après, ▼ si avant
- **🎮 Plateforme** : toutes les plateformes du jeu deviné — en **vert** si elles sont aussi sur le jeu cible, en **gris** sinon
- **🎯 Genre** : tous les genres du jeu deviné — en **vert** si communs avec le jeu cible, en **gris** sinon

### Système de couleurs
- **Vert** : correspond exactement au jeu cible (année identique, plateforme ou genre en commun)
- **Jaune** : correspondance partielle (certaines plateformes ou genres en commun)
- **Gris** : aucune correspondance

### Pool de jeux
- 3000 jeux populaires issus de l'API IGDB
- Sans limite de date — des jeux rétro peuvent apparaître
- Triés par popularité (total_rating_count)

### Anti-triche
- La pixelisation est effectuée côté serveur (Sharp) — l'image originale n'est jamais exposée dans la console réseau

### Statistiques
- Nombre de parties jouées / victoires
- Série actuelle et meilleure série
- Distribution des victoires par nombre d'essais

---

## Installation

### Prérequis
- Docker & Docker Compose
- Credentials IGDB (Twitch Client ID & Secret) — [api-docs.igdb.com](https://api-docs.igdb.com/)

### Développement local

```bash
git clone <votre-repo>
cd covergle
npm install
```

Créez `server/.env` :
```env
TWITCH_CLIENT_ID=votre_client_id
TWITCH_CLIENT_SECRET=votre_client_secret
PORT=5174
```

Lancez le backend :
```bash
node server/index.mjs
```

Lancez le frontend (nouveau terminal) :
```bash
npm run dev
```

Ouvrez **http://localhost:5173**

### Docker (dev)

```bash
cp docker.env.example docker.env
# Remplir docker.env avec vos credentials
docker compose -f docker-compose.dev.yml up
```

### Production

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Structure du projet

```
covergle/
├── src/                          # Frontend React + TypeScript
│   ├── App.tsx                  # Composant principal
│   ├── main.tsx                 # Point d'entrée (PostHog init)
│   ├── lib/                     # Utilitaires
│   │   ├── daily.ts             # Logique du mode daily
│   │   ├── igdb.ts              # Client API IGDB
│   │   ├── normalize.ts         # Normalisation de texte
│   │   └── storage.ts           # LocalStorage (stats, état daily)
│   └── ui/                      # Composants UI
│       ├── CanvasPixelCover.tsx  # Affichage pixelisé (proxy serveur)
│       └── GuessBox.tsx          # Champ de recherche avec autocomplétion
│
├── server/                      # Backend Express
│   └── index.mjs               # API + pixelisation Sharp
│
├── public/                      # Assets statiques (logo, favicon)
├── Dockerfile                   # Build multi-stage
├── docker-compose.dev.yml
├── docker-compose.prod.yml
├── vite.config.ts
└── package.json
```

---

## API

| Endpoint | Description |
|---|---|
| `GET /api/health` | État du serveur |
| `GET /api/pool` | Pool complet des 3000 jeux |
| `GET /api/search?q=` | Recherche dans le pool |
| `GET /api/game/:id` | Détails d'un jeu |
| `GET /api/cover/:imageId?step=N` | Image pixelisée (step 0-5) ou originale (step -1) |

---

## Technologies

- **React 19** + **TypeScript** + **Vite**
- **Express 5** + **Sharp** (pixelisation serveur)
- **IGDB API** (base de données jeux)
- **PostHog** (analytics)
- **Docker** + **Nginx Proxy Manager** (production)

---

## Liens

- Site : [covergle.fr](https://covergle.fr)
- Discord : [discord.gg/KaS62Tueu](https://discord.gg/KaS62Tueu)
- Données : [IGDB](https://www.igdb.com/)
