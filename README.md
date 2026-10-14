# Card Issuance — Emisión de tarjetas basada en eventos

Este es mi reto técnico de Backend Engineer para IO (neobanco). Construí dos microservicios en Node.js/TypeScript (NestJS) que emiten tarjetas para nuevos clientes usando una arquitectura basada en eventos sobre Apache Kafka, cada uno con arquitectura hexagonal por dentro de sus módulos.

- **card-issuer**: REST API (Nest + Express). Recibe la solicitud, la valida, la guarda y publica el evento `io.card.requested.v1`.
- **card-processor**: consumer (Nest como contexto de aplicación, sin HTTP). Procesa la emisión, simula éxito/fallo, reintenta con backoff exponencial y, si se agotan los intentos, publica a la DLQ.

---

## Levantar todo con un solo comando

Requisitos: Docker Desktop (con Docker Compose v2).

```bash
docker compose up --build
```

Esto levanta Zookeeper, Kafka, Kafka UI, `card-issuer` y `card-processor`, ya conectados entre sí por la red interna de Docker. `card-issuer` espera a que Kafka esté `healthy` antes de arrancar.

Queda disponible en:

| Servicio | URL |
|---|---|
| card-issuer (API) | http://localhost:3000 |
| Swagger (docs de la API) | http://localhost:3000/docs |
| Health check | http://localhost:3000/health |
| Kafka UI | http://localhost:8080 |

Para apagar todo: `docker compose down`.

### Modo desarrollo (hot-reload, sin reconstruir imágenes)

Si vas a tocar código y querés recarga automática, levantá solo la infraestructura con Docker y corré los servicios con `ts-node-dev` en local:

```bash
docker compose up -d zookeeper kafka kafka-ui
npm install
npm run dev:issuer      # en una terminal
npm run dev:processor   # en otra terminal
```

En este modo cada servicio toma su configuración de `card-issuer/.env` / `card-processor/.env` (copiá el `.env.example` de cada uno); por defecto apuntan a `localhost:9092`, que es el listener que Kafka expone al host.

---

## Arquitectura

Elegí NestJS para los dos servicios (no solo Express a secas) porque me da, listo para usar, un contenedor de inyección de dependencias, módulos, y los cuatro ganchos del ciclo de vida de una request (middlewares, guards, pipes, filtros) sin tener que armarlos a mano. Adentro de cada módulo mantengo la misma separación hexagonal:

```
src/
├── domain/          entidades, value objects, interfaces de repositorio/servicios de dominio
├── application/      casos de uso, DTOs, puertos (interfaces) hacia infraestructura
├── infrastructure/    adaptadores: HTTP (controllers/pipes/filters), Kafka (KafkaJS), persistencia, logging
├── shared/            config, errores de dominio, utilidades, constantes, tokens de DI
├── app.module.ts      arma el grafo de dependencias (qué implementación usa cada puerto)
└── main.ts            bootstrap: Nest, Swagger, Helmet/CORS, shutdown hooks

test/
├── unit/              casos de uso y piezas de dominio, aislados con fakes
└── integration/        el AppModule real de Nest, con overrides solo donde toca Kafka
```

Los casos de uso no conocen Express ni KafkaJS: dependen únicamente de los puertos (`EventPublisherPort`, `CardRepository`), interfaces de TypeScript sin rastro en tiempo de ejecución. Como Nest necesita *algo* concreto para inyectar una interfaz, los puertos se bindean con tokens (`CARD_REPOSITORY`, `EVENT_PUBLISHER` en `shared/tokens.ts`) a sus implementaciones reales en `app.module.ts`. Eso es lo que me permite testear `IssueCardUseCase` y `ProcessCardIssueUseCase` con un publisher en memoria sin levantar Kafka, y en los tests de integración, levantar el `AppModule` real reemplazando solo esos tokens (ver [Tests](#tests)).

`card-issuer` y `card-processor` duplican a propósito un puñado de piezas chicas (el envelope de CloudEvents, los nombres de los tópicos, el publisher de Kafka). No los saqué a un paquete `shared` porque en una arquitectura de microservicios compartir una librería entre servicios acopla sus despliegues (cualquier cambio obliga a versionar y releasear ambos a la vez). Para un contrato tan chico, preferí duplicar antes que acoplar.

---

## Flujo

1. `POST /cards/issue` valida el payload (Zod, en un `PipeTransform` propio), genera un `requestId`, guarda la solicitud como `PENDING` y publica `io.card.requested.v1`.
2. `card-processor` consume ese evento, simula una llamada externa (200–500ms) con una probabilidad de éxito/fallo aleatoria (o fallo forzado con `forceError: true`).
3. **Éxito** → construye la tarjeta (id, número, vencimiento, cvv) y publica `io.cards.issued.v1`.
4. **Error** → reintenta hasta 3 veces con backoff `1s → 2s → 4s`. Si se agotan los reintentos, publica a `io.card.requested.v1.dlq` con la razón, la cantidad de intentos y el payload original.
5. `card-issuer` escucha `io.cards.issued.v1` y `io.card.requested.v1.dlq` para actualizar el estado de la solicitud (`ISSUED` / `FAILED`) en su propio almacenamiento. El estado de la solicitud vive solo en `card-issuer`; `card-processor` no tiene base de datos a propósito (choreography en vez de orchestration): cada servicio es dueño de un solo dato.

### Regla de negocio: una tarjeta por cliente

Un cliente no puede tener más de una solicitud activa (`PENDING` o `ISSUED`) para el mismo documento. Si su solicitud anterior terminó en `FAILED` (agotó reintentos y cayó a la DLQ), sí puede volver a solicitar.

Esa validación vive en `InMemoryCardRepository.reserve()`: chequeo y guardo en una sola operación sin ningún `await` de por medio, para que dos solicitudes concurrentes del mismo documento no se puedan intercalar entre el "¿existe?" y el "guardar" (lo dejé comentado en el archivo con el detalle).

---

## Estructuras de datos

### Payload de `POST /cards/issue`

```json
{
  "customer": {
    "documentType": "DNI",
    "documentNumber": "73425419",
    "fullName": "Edson Meza",
    "age": 25,
    "email": "edson@gmail.com"
  },
  "product": { "type": "VISA", "currency": "PEN" },
  "forceError": false
}
```

Validaciones: `documentType` solo `DNI`, `documentNumber` de 8 dígitos, `email` con formato válido, `age >= 18`, `product.type` solo `VISA`, `currency` en `PEN` o `USD`.

### CloudEvents

Todos los eventos siguen esta forma:

```json
{
  "id": 1,
  "source": "7bcdd0ff-367a-4e5e-aab5-eed9cad1f604",
  "type": "io.card.requested.v1",
  "time": "2026-05-26T04:00:00.000Z",
  "data": { "...": "..." }
}
```

- `source` es el `requestId`: identifica el flujo de principio a fin (lo uso también como **key de partición de Kafka**, para que los eventos de una misma solicitud queden en orden).
- `id` es autoincremental **por flujo** (por `source`), no un contador global del proceso — así eventos de flujos concurrentes no comparten numeración. Vive en memoria y no persiste entre reinicios ni se comparte entre los dos servicios; en un sistema real lo resolvería con un identificador distribuido (ULID) o una secuencia respaldada por el broker.

| Topic | Evento | `data` |
|---|---|---|
| `io.card.requested.v1` | Solicitud creada / reintento | `{ requestId, customer, product, forceError?, status, retryCount }` |
| `io.cards.issued.v1` | Tarjeta emitida | `{ requestId, customer, product, card, status: "ISSUED" }` |
| `io.card.requested.v1.dlq` | Reintentos agotados | `{ reason, attempts, originalPayload }` |

### Estados

| Estado | Descripción |
|---|---|
| `PENDING` | Solicitud creada, esperando procesamiento |
| `ISSUED` | Tarjeta emitida con éxito |
| `FAILED` | Agotó los reintentos y cayó a la DLQ |

---

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/cards/issue` | Solicita la emisión de una tarjeta (devuelve `202` con `{ requestId, status }`) |
| `GET` | `/cards/all` | Lista todas las solicitudes registradas |
| `GET` | `/health` | Estado del servicio y de la conexión a Kafka |
| `GET` | `/docs` | Swagger UI |

---

## Tests

```bash
npm run test          # corre los tests de card-issuer y card-processor (con cobertura)
```

Uso Jest + ts-jest, con los tests en `test/unit` y `test/integration` (no mezclados con `src/`). Traté de que cubran lo que más riesgo real tiene, no "tests por cobertura":

**Unitarios**
- Un cliente no puede tener dos solicitudes activas, pero sí puede reintentar si la anterior quedó `FAILED`.
- Dos reservas concurrentes del mismo documento: solo una se queda con el cupo (condición de carrera).
- Camino feliz del procesamiento, agotar los 3 reintentos y terminar en la DLQ con la razón/intentos correctos.
- Un evento duplicado (redelivery de Kafka) no emite la tarjeta dos veces.
- El número de tarjeta generado es un PAN válido según Luhn.
- La política de reintentos real (delays 1s/2s/4s), el pipe de validación Zod y el filtro de errores de `card-issuer`.

**Integración**
- `card-issuer`: levanto el `AppModule` real de Nest con `Test.createTestingModule` y le pego con `supertest` (validación → caso de uso → repositorio → filtro de errores), sustituyendo con `overrideProvider` solo el publisher de Kafka y el consumer de estados — los dos puntos que tocan un sistema externo.
- `card-processor`: un test integra el simulador, el generador de tarjetas y la política de reintentos reales (con sus delays reales, usando fake timers para que no tarde lo mismo); otro valida que el `AppModule` resuelva todo el grafo de dependencias de Nest. En ambos sustituyo nada más el publisher/consumer de Kafka.

Esto fue posible sin tocar Kafka de verdad gracias a que los puertos están bindeados por token en el módulo: en los tests hago `overrideProvider(EVENT_PUBLISHER).useValue(fakePublisher)` en vez de instanciar la clase real. El rate limiting de `/cards/issue` lo armé con `@nestjs/throttler`, cuyo estado vive atado a la instancia de la app (no a un módulo global), así que cada test levanta su propio contador sin pisarse con otros.

Cada servicio tiene un umbral de cobertura mínimo del **80%** (branches, functions, lines y statements) configurado en su `jest.config.js`. Quedé en 92.59% de branches en `card-issuer` y 86.36% en `card-processor`. Dejé afuera de la medición el bootstrap del proceso (`main.ts`) y los adaptadores finos de Kafka/logger/config: son wiring sin lógica propia, y mockear KafkaJS solo para subir un número no suma nada real.

## Calidad de código

```bash
npm run lint     # ESLint (typescript-eslint)
npm run format   # Prettier
```

---

## Variables de entorno

Cada servicio tiene su propio `.env.example`. En Docker Compose ya vienen seteadas (apuntando a `kafka:29092`, el listener interno de la red de contenedores); para correr en local copiá el `.env.example` a `.env` dentro de cada carpeta.

**card-issuer**

| Variable | Default | Descripción |
|---|---|---|
| `PORT` | `3000` | Puerto HTTP |
| `CORS_ORIGIN` | `*` | Origen permitido por CORS |
| `LOG_LEVEL` | `info` | Nivel de log (pino) |
| `KAFKA_CLIENT_ID` | `card-issuer` | clientId de KafkaJS |
| `KAFKA_BROKERS` | `localhost:9092` | Brokers separados por coma |

**card-processor**

| Variable | Default | Descripción |
|---|---|---|
| `LOG_LEVEL` | `info` | Nivel de log (pino) |
| `KAFKA_CLIENT_ID` | `card-processor` | clientId de KafkaJS |
| `KAFKA_BROKERS` | `localhost:9092` | Brokers separados por coma |

---

## Decisiones de diseño y trade-offs

Las dejo anotadas acá para poder sustentarlas en la entrevista, no solo para que "funcione":

- **NestJS en vez de Express a secas**: me da DI, módulos y los cuatro ganchos de request (middleware/guard/pipe/filter) ya armados, y un `Test.createTestingModule` pensado para overridear proveedores en los tests. El trade-off es más ceremonia (decoradores, tokens de inyección) para una API chica como esta.
- **Nest v11, no v12**: v12 pasó a ser ESM-only (`"type": "module"` en sus paquetes), lo que hubiera obligado a migrar todo el proyecto a ESM solo por el framework. v11 sigue siendo CommonJS, totalmente soportada, y no me ata a un cambio que no tenía que ver con el pedido.
- **Filtro de errores como `APP_FILTER` en el módulo, no `app.useGlobalFilters()` en `main.ts`**: registrarlo en el módulo hace que también esté activo en los tests de integración, que levantan el `AppModule` con `Test.createTestingModule` y nunca pasan por `main.ts`.
- **Reserva atómica en el repositorio** (`reserve()`) en vez de `findByDocument` + `save()` por separado: cierra una condición de carrera real (dos requests concurrentes del mismo documento podían colarse las dos).
- **Retry no bloqueante**: agendo el backoff con `setTimeout` en vez de un `await` dentro de `eachMessage`, para no frenar el resto de la partición mientras un mensaje espera su reintento.
- **Idempotencia básica por intento** (`source` + `retryCount`) en `card-processor`, para no duplicar la emisión si Kafka reentrega un mensaje ya procesado. Vive en memoria — en producción la respaldaría con Redis o una tabla con TTL.
- **Política de reintentos inyectable** (`RetryPolicy`): me permite testear el flujo de reintentos sin esperar los delays reales, y en los tests de integración reuso la política real para validar los tiempos de verdad.
- **Conexión a Kafka en el lifecycle hook `onModuleInit`** (no en el constructor ni a mano en el bootstrap): si Kafka no está disponible al arrancar, Nest deja que el error rompa el arranque de la app en vez de terminar en una promesa sin manejar. `onModuleDestroy` + `app.enableShutdownHooks()` hacen el cierre ordenado sin manejar señales a mano.
- **Número de tarjeta con dígito verificador Luhn válido**, no 16 dígitos puramente aleatorios.
- **Kafka partitioning por `requestId`**: todos los eventos de un mismo flujo quedan en la misma partición, preservando su orden.

## Qué le faltaría para producción

- Persistencia real (Postgres/Mongo) en vez de almacenamiento en memoria — hoy el estado se pierde al reiniciar `card-issuer`.
- Idempotencia respaldada por un store externo en vez de un `Set` en memoria.
- Un test de integración contra un Kafka real/embebido (los que tengo integran los colaboradores internos, pero el publisher de Kafka sigue siendo un fake).
- Métricas (Prometheus) y trazas distribuidas, además de los logs estructurados actuales.
- Pipeline de CI que corra `lint`, `test` y `build` en cada PR.
