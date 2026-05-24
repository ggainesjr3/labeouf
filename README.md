# LaBeouf

LaBeouf is a full-stack social platform with posts, follows, direct messages, hashtags, video/image uploads, push notifications, Google OAuth, email/password auth, an admin dashboard, PWA support, and an Android app.

**Live app:** [https://superb-patience-production-3fab.up.railway.app](https://superb-patience-production-3fab.up.railway.app)

## Tech stack

| Layer | Technology |
|-------|------------|
| API | [NestJS](https://nestjs.com/), TypeORM, PostgreSQL |
| Web UI | [React](https://react.dev/) 18, [Vite](https://vitejs.dev/) |
| Hosting | [Railway](https://railway.app/) |
| Media storage | [Cloudflare R2](https://developers.cloudflare.com/r2/) (S3-compatible) |
| Mobile | [Capacitor](https://capacitorjs.com/) (Android) |

Locally, Docker Compose runs Postgres, the NestJS backend, and an Nginx frontend that proxies `/api` and `/uploads` to the API.

## Repository layout

```text
.
├── backend/           # NestJS API
├── frontend/          # React/Vite app (+ Capacitor Android under frontend/android/)
├── docker-compose.yml # Local Postgres + backend + frontend
├── .env.example       # Environment variable template
├── build-mobile.sh    # Build web assets and open Android Studio
├── docs/              # Ops notes (e.g. git history cleanup)
└── public/            # PWA static assets
```

## Local development (Docker Compose)

1. Copy environment defaults:

   ```bash
   cp .env.example .env
   ```

2. Set required secrets in `.env` (at minimum `POSTGRES_PASSWORD`, `DATABASE_PASSWORD`, and `JWT_SECRET`). Use strong random values; do not reuse production credentials.

3. Start the stack:

   ```bash
   docker compose up --build
   ```

4. Open the app at [http://localhost:8080](http://localhost:8080).

| Service | URL |
|---------|-----|
| Frontend | http://localhost:8080 |
| Backend health | http://localhost:3001/health |
| API (via proxy) | http://localhost:8080/api |

Without R2 configured, uploads are stored on disk under `backend/uploads` and served at `/uploads/…`.

### Running without Docker

**Backend** (`backend/`):

```bash
npm ci
npm run start:dev
```

**Frontend** (`frontend/`):

```bash
npm ci
npm run dev
```

Point the frontend at the API with `VITE_API_URL=http://localhost:3001` (or use the Vite dev proxy if configured).

## Environment variables

Copy `.env.example` to `.env` for local use, or set variables in the Railway service dashboard for production.

### Core

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | Secret for signing JWT access tokens |
| `DATABASE_HOST` | Yes | Postgres host (`db` in Docker, Railway host in prod) |
| `DATABASE_PORT` | Yes | Postgres port (default `5432`) |
| `DATABASE_USER` | Yes | Postgres user |
| `DATABASE_PASSWORD` | Yes | Postgres password |
| `DATABASE_NAME` | Yes | Postgres database name |
| `ALLOWED_ORIGIN` | Yes | Comma-separated CORS origins |
| `FRONTEND_URL` | Yes | Public web app URL (OAuth redirect target) |
| `TYPEORM_SYNCHRONIZE` | No | `true` only for throwaway local DBs |
| `TYPEORM_MIGRATIONS_RUN` | No | Run migrations on startup (`true` in production) |

### Docker Compose (local)

| Variable | Description |
|----------|-------------|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Database container credentials |
| `FRONTEND_HOST_PORT` | Host port for frontend (default `8080`) |
| `BACKEND_HOST_PORT` | Host port for backend (default `3001`) |
| `BACKEND_URL` | Internal URL nginx uses to reach the API |
| `VITE_API_URL` | Build-time API URL baked into the frontend |
| `SERVER_NAME` | nginx `server_name` (`_` accepts any host) |

### Cloudflare R2 (production uploads)

When all of the following are set, uploads go to R2 and the backend does **not** serve `/uploads/` statically. Omit them for local disk storage.

| Variable | Description |
|----------|-------------|
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret |
| `R2_BUCKET_NAME` | Bucket name |
| `R2_PUBLIC_URL` | Public base URL for objects (custom domain or r2.dev) |

### Auth & admin

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | OAuth callback (e.g. `https://api.example.com/auth/google/callback`) |
| `ADMIN_PROMOTE_SECRET` | Protects `POST /admin/promote` and `GET /push/test` |

### Optional integrations

| Variable | Description |
|----------|-------------|
| `UPLOAD_PATH` | Local upload directory when R2 is not configured |
| `OPENAI_API_KEY` | Text moderation |
| `GOOGLE_VISION_API_KEY` | Image safe-search moderation |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web push notifications |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Password-reset email |
| `WEBHOOK_URL` | Outbound webhook for events |
| `NGROK_BACKEND_URL` | Capacitor dev: load API from a tunnel URL |

## Android APK

**Prerequisites:** Android Studio, JDK 21, Android SDK 35.

1. Install Capacitor Android in the frontend (once):

   ```bash
   cd frontend && npm install @capacitor/android
   ```

2. For a production or tunneled API, set in `.env`:

   ```env
   VITE_API_URL=https://your-api.example.com
   # optional dev tunnel:
   NGROK_BACKEND_URL=https://your-tunnel.ngrok-free.app
   ```

3. From the repo root, build web assets, sync native project, and open Android Studio:

   ```bash
   ./build-mobile.sh
   ```

   Or manually:

   ```bash
   cd frontend
   npm run build
   npx cap sync android
   npx cap open android
   ```

4. In Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)** (debug), or configure signing and run **Generate Signed Bundle / APK** for release.

   CLI release build (from `frontend/android/`):

   ```bash
   ./gradlew assembleRelease
   ```

   APK output: `frontend/android/app/build/outputs/apk/`.

## Deploy to Railway

1. Create a Railway project and connect this GitHub repository.
2. Add a **PostgreSQL** plugin (or external Postgres) and wire `DATABASE_*` variables on the backend service.
3. Deploy the **backend** from `backend/` (Dockerfile provided). Set all required env vars, R2 credentials, `TYPEORM_MIGRATIONS_RUN=true`, and `TYPEORM_SYNCHRONIZE=false`.
4. Deploy the **frontend** from `frontend/` with build arg `VITE_API_URL` pointing at the public backend URL. Set `BACKEND_URL` for nginx proxying and `ALLOWED_ORIGIN` / `FRONTEND_URL` on the backend to match the frontend hostname.
5. Configure Google OAuth callback URLs for your production API domain.
6. Enable a public custom domain or use the generated `*.up.railway.app` URLs.

Example production URLs (adjust to your services):

- Frontend: `https://superb-patience-production-3fab.up.railway.app`
- Backend: `https://labeouf-production.up.railway.app`

## API overview

Base path: `/` on the backend (proxied as `/api/…` through the frontend in Docker/production).

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | — | Liveness check |

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Register with email, username, password |
| POST | `/auth/login` | — | Login with email or username + password |
| POST | `/auth/forgot-password` | — | Request password reset email |
| POST | `/auth/reset-password` | — | Reset password with token |
| GET | `/auth/google` | — | Start Google OAuth |
| GET | `/auth/google/callback` | — | OAuth callback (redirects to frontend) |

### Users

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users/me` | JWT | Current profile |
| PATCH | `/users/me` | JWT | Update profile |
| GET | `/users/search?q=` | JWT | Search users |
| GET | `/users/:username` | — | Public profile |
| GET | `/users/:username/posts` | — | User posts |
| GET | `/users/:username/followers` | — | Followers list |
| GET | `/users/:username/following` | — | Following list |

### Posts & social

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/posts` | JWT | Create post (optional image/video URL) |
| GET | `/posts/feed` | JWT | Home feed |
| GET | `/posts/public` | — | Public feed |
| GET | `/posts/hashtag/:tag` | — | Posts by hashtag |
| GET | `/posts/trending` | — | Trending posts |
| POST | `/posts/:id/like` | JWT | Like post |
| POST | `/posts/:id/repost` | JWT | Repost |
| GET | `/posts/:id/replies` | — | List replies |
| POST | `/posts/:id/replies` | JWT | Reply to post |
| POST | `/posts/follow/:id` | JWT | Follow user |
| DELETE | `/posts/:id` | Admin | Delete post |
| DELETE | `/posts/replies/:replyId` | Admin | Delete reply |

### Messages, bookmarks, notifications

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/messages/inbox` | JWT | Conversation list |
| GET | `/messages/unread` | JWT | Unread count |
| GET | `/messages/:userId` | JWT | Thread with user |
| POST | `/messages/:userId` | JWT | Send message |
| POST | `/bookmarks/:postId` | JWT | Bookmark post |
| GET | `/bookmarks` | JWT | List bookmarks |
| GET | `/notifications` | JWT | Notifications |

### Uploads & search

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/upload` | JWT | Upload image or video (multipart `file`) |
| GET | `/search?q=` | — | Search users and posts |

### Push

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/push/vapid-public-key` | — | VAPID public key |
| POST | `/push/subscribe` | JWT | Register push subscription |
| POST | `/push/send` | JWT | Send push (admin/testing) |
| GET | `/push/test?secret=` | Secret | Test notification |

### Admin & moderation

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/admin/promote` | Secret | Promote user to admin |
| POST | `/reports` | JWT | Report content |
| GET | `/admin/reports` | Admin | List reports |
| GET | `/admin/reports/stats` | Admin | Report statistics |
| GET | `/admin/reports/trends` | Admin | Report trends |
| PATCH | `/admin/reports/:id` | Admin | Update report status |
| GET | `/admin/moderation-logs` | Admin | Moderation log entries |
| GET | `/admin/moderation-logs/stats` | Admin | Moderation stats |
| GET | `/admin/moderation-logs/charts` | Admin | Chart data |

### Trust audit (legacy)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/audit` | — | Content trust analysis |

## Database migrations

From `backend/`:

```bash
npm run migration:run
```

Use migrations in production; keep `TYPEORM_SYNCHRONIZE=false`.

## Git history

If you need to scrub secrets from history, see [docs/git-history-cleanup.md](docs/git-history-cleanup.md).

## License

Private / unlicensed — see repository owner for terms.
