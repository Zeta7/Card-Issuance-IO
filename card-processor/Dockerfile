# El contexto de build es la raíz del monorepo (ver docker-compose.yml):
# "npm ci" necesita el package-lock.json del workspace raíz, que no existe
# dentro de card-processor/ por separado.
FROM node:20-alpine AS build
WORKDIR /app

# El registry de npm puede cortarse a mitad de una descarga; con los defaults
# de npm un solo timeout tira abajo todo el build. Esto le da más margen y
# más reintentos antes de rendirse.
ENV NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
    NPM_CONFIG_FETCH_TIMEOUT=300000

COPY package*.json ./
COPY card-issuer/package.json ./card-issuer/
COPY card-processor/package.json ./card-processor/
RUN npm ci

COPY card-processor/tsconfig.json ./card-processor/
COPY card-processor/src ./card-processor/src
RUN npm run build --workspace=card-processor

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production \
    NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
    NPM_CONFIG_FETCH_TIMEOUT=300000

COPY package*.json ./
COPY card-issuer/package.json ./card-issuer/
COPY card-processor/package.json ./card-processor/
RUN npm ci --omit=dev

COPY --from=build /app/card-processor/dist ./card-processor/dist

CMD ["npm", "run", "start", "--workspace=card-processor"]
