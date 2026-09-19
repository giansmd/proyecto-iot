# Monitor de Anaqueles IoT

Detección de espacios vacíos en anaqueles (góndolas) a partir de imágenes que
envía un **ESP32-CAM**. El backend recibe las capturas, decide **cuándo**
analizarlas con **IA (OpenAI Vision)** y notifica en **tiempo real** a un
dashboard web cuando falta producto.

- **Ingesta ESP32:** frecuencia configurable desde el dashboard (5 s, 30 s,
  1 min, 5 min, 10 min o personalizada). Por defecto **1 min**. El backend
  devuelve el intervalo vigente en la respuesta del `POST` y el ESP32 lo aplica.
- **Análisis IA:** cada intervalo configurable por dispositivo (1 min, 5 min,
  30 min, 1 h, 2 h o personalizado). Por defecto **30 min**.
- **Espacio analizado:** por dispositivo se elige el tipo (anaquel, escritorio,
  refrigerador, otro) y una descripción libre; el prompt de la IA se adapta.
  El modelo además indica si ese espacio aparece en la imagen (`subjectVisible`).
- **Notificación:** solo cuando se detecta vacío, en vivo por WebSocket.
- **Costo controlado:** solo se analiza el último frame, se omiten frames
  idénticos y hay un **guardián de presupuesto** (por defecto **$1 USD**).

## Arquitectura

```
ESP32-CAM ──HTTP POST /analizar-anaquel──► Backend (Fastify)
                                              │  guarda último frame (Redis)
                                              │  scheduler (BullMQ) cada 60s
                                              ▼
                                       Worker → OpenAI Vision (JSON)
                                              │
                            Postgres ◄────────┤
                                              ▼
                    Frontend (React) ◄──WebSocket── Redis pub/sub
```

- **Monorepo pnpm** con Clean Architecture y patrón Repository.
- `packages/shared`: tipos y esquemas Zod (contrato ESP32/API/eventos).
- `apps/backend`: Node 24 + Fastify + Drizzle + BullMQ + ioredis.
- `apps/frontend`: React 19 + Vite + Tailwind v4.

## Requisitos

- Node.js **24+** y **pnpm 11+** (`corepack enable`).
- Docker + Docker Compose (para el despliegue; también puedes correr local).
- Una **API key de OpenAI**.

## Quickstart (desarrollo local)

1. Habilita pnpm y clona el repositorio:

   ```bash
   corepack enable
   pnpm install
   ```

2. Copia el archivo de entorno y edítalo:

   ```bash
   cp .env.example .env
   ```

   Mínimo a configurar:
   - `DATABASE_URL` (por defecto apunta al host `postgres`, cámbialo a
     `localhost` para desarrollo local).
   - `REDIS_URL` → `redis://localhost:6379`.
   - `DEVICE_KEYS` → `esp32-anaquel-1:tu-clave`.
   - `OPENAI_API_KEY`.

3. Levanta PostgreSQL y Redis. Dos opciones:

   ```bash
   # Opción A: con Docker (solo infraestructura)
   docker compose up -d postgres redis

   # Opción B: servicios locales ya instalados
   ```

4. Genera y aplica migraciones (solo la primera vez o al cambiar el esquema):

   ```bash
   pnpm db:generate   # genera SQL en apps/backend/drizzle
   pnpm db:migrate    # aplica migraciones
   ```

5. Arranca backend y frontend:

   ```bash
   pnpm dev
   ```

   - Backend: http://localhost:5000 (`GET /health`).
   - Dashboard: http://localhost:5173 (el proxy de Vite reenvía `/api` y `/ws`).

6. Prueba una ingesta simulada (sin ESP32):

   ```bash
   curl -X POST http://localhost:5000/analizar-anaquel \
     -H "Content-Type: image/jpeg" \
     -H "X-Device-Key: tu-clave" \
     --data-binary @ruta/a/foto.jpg
   ```

   El dispositivo aparece en el dashboard. Usa **"Analizar ahora"** para
   forzar un análisis sin esperar el intervalo.

## Quickstart (Dokploy / Docker Compose)

1. En Dokploy crea una aplicación tipo **Docker Compose** apuntando a este
   repositorio.

2. Define las variables de entorno del compose (pestaña *Environment*):
   - `DEVICE_KEYS=esp32-anaquel-1:tu-clave-super-secreta`
   - `OPENAI_API_KEY=sk-...`
   - `OPENAI_MODEL=gpt-4o-mini`
   - `OPENAI_BUDGET_USD=1`
   - `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (recomendado cambiarlos)

3. Despliega. Servicios:
   - `frontend` → dashboard en el puerto **8080**.
   - `backend` → API + ingesta en el puerto **5000**.
   - `postgres` y `redis` internos (no expuestos).

4. Exponer dominios:
   - Dashboard: dominio → `frontend:80`.
   - ESP32: apunta a `http://<host-o-dominio>:5000/analizar-anaquel`
     (o al mismo dominio del frontend, que reenvía `/analizar-anaquel`).

5. Cambia las credenciales por defecto de Postgres antes de producción.

## Contrato del ESP32

El firmware (`firmware/esp32cam_anaquel/esp32cam_anaquel.ino`) envía:

| Elemento | Valor |
| --- | --- |
| Método | `POST` |
| URL | `http://<host>:5000/analizar-anaquel` |
| Content-Type | `image/jpeg` (cuerpo binario crudo) |
| Header auth | `X-Device-Key: <clave>` |
| Periodicidad | Configurable desde el dashboard (`captureIntervalSeconds`) |

El backend responde `202 Accepted` inmediatamente (< 1 s) y encola el frame.
Esa respuesta incluye `captureIntervalSeconds`; el ESP32 ajusta su ritmo de
captura en el siguiente ciclo (mínimo 5 s, por defecto 60 s). Ajusta en el
sketch `WIFI_SSID`, `WIFI_PASSWORD`, `SERVER_URL` y `DEVICE_KEY`.

## API HTTP

| Método | Ruta | Descripción |
| --- | --- | --- |
| `POST` | `/analizar-anaquel` | Ingesta de imagen (auth por `X-Device-Key`) |
| `GET` | `/health` | Estado del servicio |
| `GET` | `/api/devices` | Dispositivos y su estado |
| `PATCH` | `/api/devices/:id/settings` | Cambia intervalo de análisis (`analysisIntervalMinutes`), captura (`captureIntervalSeconds`), espacio (`targetType`/`targetLabel`), nombre / ubicación / activo |
| `POST` | `/api/devices/:id/analyze-now` | Fuerza un análisis |
| `GET` | `/api/devices/:id/frame` | Última imagen JPEG recibida (se refresca cada 5 s en el dashboard) |
| `GET` | `/api/devices/:id/scans?limit=` | Historial de análisis |
| `GET` | `/api/alerts` | Alertas (`?status=open|ack|resolved`) |
| `POST` | `/api/alerts/:id/ack` | Acusar alerta |
| `POST` | `/api/alerts/:id/resolve` | Resolver alerta |
| `GET` | `/api/usage` | Gasto de IA vs. presupuesto |
| `WS` | `/ws` | Eventos en vivo |

Eventos WebSocket: `scan.updated`, `alert.created`, `alert.resolved`,
`device.updated`, `budget.warning`.

## Configuración (variables de entorno)

Ver `.env.example` para la lista completa. Las clave:

| Variable | Default | Descripción |
| --- | --- | --- |
| `DEVICE_KEYS` | — | `id:clave` separados por coma |
| `OPENAI_MODEL` | `gpt-4o-mini` | Modelo de visión |
| `OPENAI_IMAGE_DETAIL` | `low` | `low`/`high`/`auto` (costo) |
| `OPENAI_BUDGET_USD` | `1` | Presupuesto máximo acumulado |
| `DEFAULT_ANALYSIS_INTERVAL_MINUTES` | `30` | Intervalo de análisis inicial |
| `DEFAULT_CAPTURE_INTERVAL_SECONDS` | `60` | Ritmo de captura inicial del ESP32 |
| `FRAME_STALE_FACTOR` | `2` | Un frame es obsoleto si supera `intervalo * factor` |

## Estructura del repositorio

```
proyecto-iot/
├── apps/
│   ├── backend/          # API + worker (Clean Architecture)
│   └── frontend/         # Dashboard React + nginx
├── packages/shared/      # Tipos y esquemas compartidos
├── firmware/             # Sketch ESP32-CAM
├── docker-compose.yml
└── .env.example
```

### Capas del backend

- `domain/`: entidades, puertos (interfaces) y `analysis-policy`.
- `application/`: casos de uso (`ingest-image`, `analyze-device`, alertas…).
- `infrastructure/`: Fastify, Drizzle, Redis, BullMQ, OpenAI, WebSocket.

## Costos de IA

Con `gpt-4o-mini` y `detail=low`, cada análisis cuesta una fracción de centavo.
El backend aplica tres filtros antes de llamar a la IA:

1. Analiza solo el **último frame** al vencer el intervalo.
2. Omite si no llegó frame nuevo o el hash es idéntico al anterior.
3. Bloquea llamadas al alcanzar `OPENAI_BUDGET_USD` y avisa en el dashboard.

## Comandos útiles

```bash
pnpm dev            # backend + frontend en paralelo
pnpm build          # build de todos los paquetes
pnpm typecheck      # verificación de tipos
pnpm db:generate    # genera migraciones Drizzle
pnpm db:migrate     # aplica migraciones
docker compose up -d --build
```

## Solución de problemas

- **El dispositivo no aparece:** verifica `DEVICE_KEYS` y que el ESP32 envíe el
  header `X-Device-Key`. Revisa `/health`.
- **No hay análisis:** confirma `OPENAI_API_KEY` y el presupuesto en
  `GET /api/usage`. El primer análisis ocurre recién al cumplir el intervalo.
- **Dashboard sin datos en vivo:** revisa el proxy `/ws` (Vite o nginx).
