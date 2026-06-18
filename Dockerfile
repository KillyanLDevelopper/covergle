# Build stage pour le frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts eslint.config.js index.html ./
COPY src ./src
COPY public ./public
RUN npm run build

# Stage final - backend + frontend
FROM node:22-alpine
WORKDIR /app

# Installer les dépendances de production
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Copier le code du serveur
COPY server ./server

# Copier le frontend compilé du stage de build (inclut déjà public/)
COPY --from=frontend-builder /app/dist ./dist

# Donner les droits à l'utilisateur node (non-root)
RUN chown -R node:node /app
USER node

# Exposer le port
EXPOSE 5174

# Variable d'environnement par défaut
ENV PORT=5174
ENV NODE_ENV=production

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:5174/api/health || exit 1

# Démarrer le serveur
CMD ["node", "server/index.mjs"]
