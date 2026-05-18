# LaBeouf

LaBeouf is a social platform and trust-audit app built around a React frontend, a NestJS API, and a Postgres database. It supports posts, replies, likes, reposts, bookmarks, follows, direct messages, media uploads, report review, admin moderation, and trust metadata for content analysis.

The current local stack is Docker-friendly and routes browser traffic through the frontend container. The frontend serves the app and proxies `/api` and `/uploads` to the backend, which keeps the browser from depending on a hardcoded backend port.

## Current Stack

- Frontend: React 18, Vite, Vitest, Nginx container
- Backend: NestJS, TypeORM, Postgres, Jest
- Database: Postgres 15
- Auth: username/password JWT, optional Google OAuth
- Media: local upload storage via the backend
- Moderation: heuristic/OpenAI text checks and optional Google Vision image checks
- Mobile/PWA assets: Capacitor Android/iOS projects and web manifest assets are included

## Repository Layout

```text
.
├── frontend/        # Active React/Vite application
├── backend/         # NestJS backend git submodule
├── docker-compose.yml
├── .env.example
├── public/          # Web/PWA static assets
├── android/         # Capacitor Android project
├── ios/             # Capacitor iOS project
└── src/             # Earlier Firebase/PWA frontend code kept for reference
```

`backend/` is a git submodule that tracks the `backend` branch of this same GitHub repository.

## Local Setup

Copy the example environment file:

```bash
cp .env.example .env
```

The Docker defaults are intentionally local-development friendly:

```env
FRONTEND_HOST_PORT=8080
BACKEND_HOST_PORT=3001
ALLOWED_ORIGIN=http://localhost:8080
FRONTEND_URL=http://localhost:8080
POSTGRES_PASSWORD=[REDACTED]
JWT_SECRET=[REDACTED]
TYPEORM_SYNCHRONIZE=true
```

For shared, staging, or production environments, replace the default secrets and prefer migrations over `TYPEORM_SYNCHRONIZE=true`.

## Running With Docker

Start the stack:

```bash
docker compose up --build
```

Open the app:

```text
http://localhost:8080
```

Useful service endpoints:

```text
Frontend: http://localhost:8080
Backend health: http://localhost:3001/health
API through proxy: http://localhost:8080/api
Uploads through proxy: http://localhost:8080/uploads
```

If Cursor, another assistant, or another container already owns a port, change `FRONTEND_HOST_PORT` or `BACKEND_HOST_PORT` in `.env` instead of editing application code.

## Running Without Docker

Frontend:

```bash
cd frontend
npm ci
npm run dev
```

Backend:

```bash
cd backend
npm ci
npm run start:dev
```

When running the backend outside Docker, set the `DATABASE_*`, `JWT_SECRET`, `ALLOWED_ORIGIN`, `FRONTEND_URL`, and `UPLOAD_PATH` values in your environment.

## Environment Variables

Core local variables:

- `FRONTEND_HOST_PORT`: host port exposed by the frontend container.
- `BACKEND_HOST_PORT`: host port exposed by the backend container.
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`: database container credentials.
- `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`: backend database connection values.
- `JWT_SECRET`: signing secret for application JWTs.
- `ALLOWED_ORIGIN`: CORS origin accepted by the backend.
- `FRONTEND_URL`: URL used by OAuth callbacks after successful login.
- `UPLOAD_PATH`: local upload directory when running outside Docker.
- `OPENAI_API_KEY`: optional text moderation support.
- `GOOGLE_VISION_API_KEY`: optional image moderation support.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`: optional Google OAuth support.
- `TYPEORM_SYNCHRONIZE`: enables automatic schema sync. Use only for disposable local development.
- `TYPEORM_MIGRATIONS_RUN`: runs TypeORM migrations at startup when set to `true`.

## Database Migrations

The backend supports TypeORM migrations. From `backend/`:

```bash
npm run migration:run
```

Create or generate migrations:

```bash
npm run migration:create
npm run migration:generate
```

Use migrations for durable databases. Keep `TYPEORM_SYNCHRONIZE=false` outside throwaway local development.

## Build And Test

Frontend:

```bash
cd frontend
npm run build
npm run test
```

Backend:

```bash
cd backend
npm run build
npm run test
```

If `npm run build` in `backend/` fails with an `EACCES` error under `backend/dist`, the generated files were likely created by a container user. Fix ownership from the repo root:

```bash
sudo chown -R "$USER:$USER" backend
```

If you only need a TypeScript validation without writing to `dist`, run:

```bash
cd backend
npx tsc -p tsconfig.build.json --noEmit --tsBuildInfoFile /tmp/labeouf-backend-tsconfig.build.tsbuildinfo
```

## OAuth Notes

The frontend starts Google login through:

```text
/api/auth/google
```

Nginx proxies that request to the backend. After Google returns to the backend callback, the backend redirects to `FRONTEND_URL`. For the default Docker setup that value should be:

```text
http://localhost:8080
```

If you change `BACKEND_HOST_PORT`, also update `GOOGLE_CALLBACK_URL` to match the backend URL registered with Google.

## Deployment Notes

The current Docker stack is designed for local and small-host deployment. Before exposing it publicly:

- Replace all default secrets.
- Disable `TYPEORM_SYNCHRONIZE`.
- Run migrations explicitly.
- Set a production `FRONTEND_URL` and `ALLOWED_ORIGIN`.
- Configure OAuth callback URLs for the deployed domain.
- Put uploaded media on durable storage or a mounted volume.
- Review moderation provider keys and quotas.

## Project Status

The active app is mostly built and currently focused on hardening: reliable Docker ports, clean OAuth routing, stable media upload storage, admin workflows, and repeatable build/test checks.
