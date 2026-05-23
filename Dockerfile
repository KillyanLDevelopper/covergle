# Build stage pour le frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts eslint.config.js index.html ./
COPY src ./src
COPY public ./public
RUN npm run build

# Stage final - backend + frontend
FROM node:20-alpine
WORKDIR /app

# Installer les dépendances de production
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Copier le code du serveur
COPY server ./server

# Copier le frontend compilé du stage de build
COPY --from=frontend-builder /app/dist ./public/dist

# Exposer le port
EXPOSE 5174

# Variable d'environnement par défaut
ENV PORT=5174
ENV NODE_ENV=production

# Démarrer le serveur
CMD ["node", "server/index.mjs"]
