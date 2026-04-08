# Vercel Deploy — Configuration

## Stack

Vite static SPA — Phaser 3 renders entirely client-side. No server functions.

## vercel.json

- `buildCommand`: `npm run build` (tsc + vite build → dist/)
- `outputDirectory`: `dist`
- `rewrites`: all routes → `/index.html` (SPA requirement — Phaser handles routing)
- Security headers: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- Asset cache: `/assets/**` → `public, max-age=31536000, immutable` (Vite fingerprints filenames)

## CSP Allowances

- `connect-src`: Supabase (`*.supabase.co`), Open Trivia DB, Anthropic API
- `script-src`: `unsafe-eval` required for Phaser's WebGL shader compilation
- `worker-src blob:`: required for Phaser's audio worklets

## Environment Variables (set in Vercel dashboard)

See `.env.example` for the 4 required vars.

## Deploy Steps

1. Push to `main` → Vercel auto-deploys (configured via Vercel Git Integration)
2. Set env vars in Vercel dashboard → Settings → Environment Variables
3. Preview deploys happen on every branch push
