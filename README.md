# ThyAnime site (standalone)

Next.js 14 + React + Tailwind + Framer Motion, exported as a **fully static site**. There is **no backend**:
the browser talks straight to public APIs, so it runs on GitHub Pages and keeps working when your own server is off.

| Job | Source (automatic fallback order) |
| --- | --- |
| Home rails, search, details | **AniList** → **Kitsu** → *YumeList (slot, off by default)* → **Jikan** (MyAnimeList) |
| Episode titles / thumbnails | **Kitsu** → **Jikan** → AniList `streamingEpisodes` → plain "Episode N" |
| Video player | iframe servers: **MegaPlay** · **FilmU** · **ThyAnime** (your server, optional) |

Viewers pick a server under the player (choice is remembered). If your ThyAnime server is unreachable its
button is greyed out automatically — nothing else depends on it.

## Run locally
```bash
npm install
npm run dev        # http://localhost:3000
```

## Deploy on GitHub Pages
1. Push to `main`.
2. Repo → **Settings → Pages → Source: GitHub Actions**.
3. Every push to `main` builds and deploys → `https://USER.github.io/REPO/`.

Custom domain: add `public/CNAME` containing the domain, then set it in Settings → Pages.

### Optional repo Variables
Settings → Secrets and variables → Actions → **Variables**: `THY_SERVER` (use `off` to drop your server),
`FILMU_ANI`, `FILMU_MAL`, `YUMELIST_API`. All have defaults — see `.env.example`.

## Things to know
- **FilmU URL is unverified.** `embed.filmu.in` now redirects to `vidly.pro`. Open it, go to the *Anime* tab, copy the
  example URL and put it in `lib/servers.js` (`{id}` `{ep}` `{lang}` placeholders). MegaPlay's URLs are verified.
- **YumeList** has no public docs I could find; `lib/yumelist.js` is a clearly-marked stub.
- Don't add `sandbox` to the player iframe — MegaPlay refuses sandboxed embeds.
- Rate limits: AniList ~90 req/min, Jikan 3 req/s & 60/min. Results are cached in memory + sessionStorage and
  Jikan calls are queued, so normal browsing stays well inside them.
- Episode numbers follow AniList's per-season numbering, which is what MegaPlay's `/stream/ani/` route expects.
