# ThyAnime site

Next.js 14 + React + Tailwind + Framer Motion front-end. It is a static export that talks to the
ThyAnime Python server (search, episode lists, `/embed` player) at `NEXT_PUBLIC_API_BASE`
(default `https://api.thyanime.me`).

## Run locally
```bash
npm install
npm run dev        # http://localhost:3000
```

## Deploy on GitHub Pages
1. Push this folder to a GitHub repo (branch `main`).
2. Repo → **Settings → Pages → Source: GitHub Actions**.
3. (Optional) Repo → Settings → Secrets and variables → Actions → **Variables** → add `API_BASE`
   if your server address is not `https://api.thyanime.me`.
4. Every push to `main` builds and deploys. Site: `https://USER.github.io/REPO/`.

Custom domain: add a `public/CNAME` file containing the domain, then set it in Settings → Pages.

## Other hosts (Vercel / Netlify / Cloudflare Pages)
Build command `npm run build`, output directory `out`. Add the env var `NEXT_PUBLIC_API_BASE` if needed.

## Server side
The server already allows cross-origin requests. If you later restrict CORS, allow this site's origin.
Run the server with `SITE=0` if you only want the API (it otherwise also serves its own copy of the site at `/`).
