FROM node:22-slim AS development
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
# Nest watch uses ps to stop the previous API process before restarting.
RUN apt-get update && apt-get install -y --no-install-recommends procps && rm -rf /var/lib/apt/lists/*
COPY . .
EXPOSE 8001
CMD ["npm", "run", "start:dev"]

FROM development AS build
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/seed ./seed
EXPOSE 8001
# Antes de subir a API: migrations pendentes do Nest e seed (so com o banco sem destinos).
CMD ["sh", "-c", "node dist/cli/migrate-and-seed.js && exec node dist/main.js"]
