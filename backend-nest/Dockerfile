# API NestJS do docker-compose: build com devDependencies; a imagem final reaproveita o node_modules
# podado (sem baixar os pacotes de novo).
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 8001
CMD ["node", "dist/main.js"]
