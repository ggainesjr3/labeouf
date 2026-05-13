# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

LaBeouf is a React 18 social-media clone / "Tactical Trust-Audit Terminal" with a brutalist UI. Firebase provides authentication (Google OAuth), Firestore for real-time posts, and hosting. A client-side heuristic trust engine scores posts for misinformation.

### Dev server

The project uses **Vite** (not Create React App, despite `react-scripts` still being in `package.json`). Start the dev server with:

```sh
npx vite --host 0.0.0.0 --port 5173
```

### Linting

```sh
npx eslint src/
```

ESLint 9 flat config is in `eslint.config.js`. There are 3 pre-existing `no-unused-vars` errors in the codebase.

### Building

```sh
npx vite build
```

Output goes to `dist/`.

### Key gotchas

- **Vite vs CRA**: `package.json` scripts (`npm start`, `npm run build`) use `react-scripts`, but the app actually runs on Vite (`index.html` at root, `vite.config.js`, `src/main.jsx` entry point). Always use `npx vite` commands instead of `npm start`.
- **PostCSS config location**: Vite reads `postcss.config.js` from the project root, not from `src/`. A root-level config was added during setup.
- **Tailwind config**: `tailwind.config.js` was missing and was added at the project root for Tailwind CSS v3 to work with PostCSS.
- **Firebase config**: Two Firebase init files exist: `src/firebase.js` (hardcoded keys, used by the app) and `src/firebaseConfig.js` (env-var based, not imported by `App.jsx`). The hardcoded one is the active config.
- **Environment variables**: Vite env vars (`VITE_FIREBASE_*`) are in the root `.env` file. They're also duplicated in `src/.env` but Vite only reads from the project root.
- **`package.json` has no `"type": "module"`**: ESLint and PostCSS configs use ES module syntax, which triggers Node.js warnings. These are harmless.
- **Google Auth requires user interaction**: `signInWithPopup` needs a real browser and Google account. In headless/cloud environments, auth-gated features (the Feed) won't be testable without a real login session.
- **No automated test suite**: `react-scripts test` is the configured test command but there are no test files. Focus testing on lint, build, and manual verification.
