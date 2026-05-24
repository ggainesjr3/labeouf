# Production QA — superb-patience-production-3fab.up.railway.app

Tested 2026-05-20 against frontend `https://superb-patience-production-3fab.up.railway.app` (API: `https://labeouf-production.up.railway.app`).

## Working

| Feature | Result |
|---------|--------|
| Registration / login | Pass — created user `qatest1747700000` |
| Posts | Pass — text post with sentiment metadata |
| Likes | Pass — count incremented |
| Follows | Pass — Follow → Following via user search |
| Replies | Pass — inline reply on post |
| Reposts | Pass — repost count incremented |
| Bookmarks | Pass — saved post appears on Bookmarks page |
| Hashtags | Pass — `#labeouf` page lists tagged posts |
| Messages UI | Pass — inbox loads; user search API returns 200 |
| Trending / public feed | Pass — loads without auth |
| Push (API) | Partial — `GET /push/vapid-public-key` returns 200; browser subscription not verified in automation |

## Not verified / blocked

| Feature | Notes |
|---------|--------|
| Video upload | Not exercised (requires file picker in browser) |
| Push delivery | VAPID configured; end-to-end notification not confirmed |
| Admin dashboard | Requires `role=admin` user — not tested |
| Google OAuth | Not tested (needs live OAuth redirect + credentials) |

## Bugs / issues found

1. **Hardcoded backend URL in frontend** — `App.jsx` on `main` pointed at `labeouf-production.up.railway.app` instead of `VITE_API_URL` env. Fixed in subsequent commit.
2. **Admin dashboard API base** — `AdminDashboard.jsx` used `/api` while NestJS has no global prefix; admin charts would 404 in production. Fixed to use shared `VITE_API_URL`.
3. **Split Railway services** — Frontend and backend on different hostnames rely on CORS + hardcoded URL; custom domain / env-based config recommended (addressed in custom-domain commit).

## Recommendations

- Set Railway env: `TYPEORM_SYNCHRONIZE=false`, `TYPEORM_MIGRATIONS_RUN=true`, rotate `JWT_SECRET` and DB password after removing hardcoded dev values.
- Add an admin user in DB (`UPDATE users SET role='admin' WHERE username='...'`) to verify admin dashboard in production.
- Configure `VITE_API_URL`, `ALLOWED_ORIGIN`, and `GOOGLE_CALLBACK_URL` when attaching a custom domain.
