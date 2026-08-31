# Deploying

**One Vercel project, not two.** The React app is served as static files and the
same Express app runs behind `/api` as a serverless function.

Two projects would mean two domains, a CORS configuration, and cookies that have
to work cross-site. One project means the API is same-origin: no CORS, and the
session cookie just works.

```
leadboard/
  api/index.js      ← Vercel function; re-exports the Express app
  be/               ← the API (also runs standalone for local dev)
  fe/               ← the React app, built to fe/dist
  vercel.json       ← static output + /api rewrite
  package.json      ← backend deps, so the function can resolve them
```

## Deploy

```bash
npx vercel            # first run links the project
npx vercel --prod
```

Vercel runs `npm install && npm install --prefix fe`, then `npm run build`,
publishes `fe/dist`, and turns `api/index.js` into a function. `vercel.json`
rewrites `/api/*` to it and everything else to `index.html` for the SPA router.

## Environment variables

Set these in **Project → Settings → Environment Variables**:

| Variable | Required | What |
|---|---|---|
| `MONGODB_URI` | **yes** | Your Atlas connection string, with `/leadboard` before the `?` |
| `APP_PASSWORD` | **yes in production** | The shared passphrase for the board |
| `AUTH_SECRET` | recommended | Any long random string; signs the session cookie |
| `RESOURCE_KEY` | only for credentials | Encrypts stored project credentials. **Back it up** — lose it and existing secrets are unrecoverable |
| `PARSER` | no | `heuristic` (default, free) · `ollama` · `claude` |
| `STT_PROVIDER` | no | `client` (default, free) · `whisper` · `deepgram` |

Atlas also needs **Network Access → 0.0.0.0/0**, because serverless functions
have no fixed egress IP.

## Why `APP_PASSWORD` is not optional

Without it, anyone who finds the URL gets a page ranking your team by
performance, with names attached. The API refuses to serve any data route in
production when it is unset — it fails loudly rather than leaking quietly.

It is one shared passphrase, signed into an HttpOnly cookie for 30 days. That is
proportionate for one lead's private board; it is not per-user auth, and it is
not what you would ship to customers.

## What changed to make it serverless-safe

- **Connection caching.** Serverless runs the app per request, so `connectDb`
  caches its promise on `globalThis`. A warm container reuses one socket instead
  of opening a new connection per invocation and exhausting the Atlas limit.
- **Uploads in memory.** `multer` uses `memoryStorage`. A serverless filesystem
  is read-only outside `/tmp` and wiped between invocations, and the audio is
  only needed for the length of one request anyway.
- **One app, two entry points.** `be/src/app.js` exports the configured Express
  app; `be/src/server.js` adds `listen()` for local dev and `api/index.js`
  re-exports it for Vercel. There is no second implementation to drift.

## Voice in production

Chrome's speech recognition requires a secure context. Vercel is HTTPS, so it
works on the deployed URL exactly as it does on localhost — no key, no model
download, nothing to configure.

## Local development

Unchanged:

```bash
cd be && npm run dev     # :4000
cd fe && npm run dev     # :5180
```

With no `APP_PASSWORD` set locally, the gate stays open.

## Stored credentials

Project resources can hold a login. The password is sealed with AES-256-GCM
before it is written, using a key derived from `RESOURCE_KEY` (falling back to
`AUTH_SECRET`). Each secret gets its own IV, and the auth tag is stored with it,
so a tampered row fails to decrypt rather than returning plausible rubbish.

Three properties worth stating plainly:

- **Secrets are never in a list response.** A row only reports whether one
  exists. Revealing fetches it on its own, one at a time, and the reveal is
  timestamped.
- **With no key set, the API refuses to store a secret** rather than writing it
  in plaintext. A credential store that silently is not one is worse than none.
- **Changing the key does not migrate anything.** Existing secrets stop
  decrypting and say so. Back the key up somewhere that is not this repository.

What this protects against: a leaked database, a stolen backup, an Atlas
snapshot in the wrong hands. What it does not: anyone holding the board's
passphrase — the whole point is that they can read these. It is encryption at
rest, not a vault with its own lock.
