# El contexto de build es la raíz del monorepo (ver docker-compose.yml):
# "npm ci" necesita el package-lock.json del workspace raíz, que no existe
# dentro de card-processor/ por separado.
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY card-issuer/package.json ./card-issuer/
COPY card-processor/package.json ./card-processor/
RUN npm ci

COPY card-processor/tsconfig.json ./card-processor/
COPY card-processor/src ./card-processor/src
RUN npm run build --workspace=card-processor

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY card-issuer/package.json ./card-issuer/
COPY card-processor/package.json ./card-processor/
RUN npm ci --omit=dev

COPY --from=build /app/card-processor/dist ./card-processor/dist

CMD ["npm", "run", "start", "--workspace=card-processor"]
