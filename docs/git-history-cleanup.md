# Git history secret scrubbing

Sensitive values were removed from **all commits** using [git-filter-repo](https://github.com/newren/git-filter-repo) with a replace-text rules file.

## Patterns redacted

| Pattern | Replacement |
|---------|-------------|
| `password123` | `[REDACTED]` |
| `labeouf-secret-change-in-prod` | `[REDACTED]` |
| `GOCSPX-…` (Google OAuth client secrets) | `[REDACTED]` |
| `AIzaSy…` (Firebase / Google API keys) | `[REDACTED]` |

Rules live in [`git-replacements.txt`](./git-replacements.txt).

## Commands used

Install git-filter-repo (once):

```bash
pip3 install git-filter-repo
```

From the repository root, with a clean working tree (stash or commit local changes first):

```bash
git filter-repo --replace-text docs/git-replacements.txt --force
```

Re-attach the remote (filter-repo removes remotes by default):

```bash
git remote add origin https://github.com/ggainesjr3/labeouf.git
git push --force origin main
```

## After rewriting history

- Everyone with a clone must re-clone or reset hard to the new `main`.
- Rotate any credentials that were ever committed, even after scrubbing (GitHub may retain objects briefly; assume exposure).
- Do not commit real secrets; use Railway/host env vars and `.env` (gitignored).
