# Highlight Corner — highlightcorner.com

A multi-page, mobile-first NFL hub: live scores, one-tap YouTube highlights,
weekly fantasy leaders, comedic game recaps, and per-game centers with box score,
advanced stats, fantasy scorers, and injuries.

## Pages

- `index.html` — NFL scoreboard (week selector; every game links to its game page)
- `highlights.html` — per-game YouTube highlight deep links
- `fantasy.html` — weekly fantasy leaders by position (PPR / Half-PPR / Standard)
- `recaps.html` — comedic, play-by-play-based game recaps with verdicts
- `game.html?id=<espnGameId>&week=<n>` — game center: tabbed box score by team,
  scoring summary, advanced team stats, top fantasy scorers (computed PPR),
  injuries, recap, highlights
- Spoiler-free mode (header toggle, all pages, persisted), favorite teams and
  watchlist with board filters, saved in the browser

## How data works (no backend needed)

Everything loads in the visitor's browser from free, keyless APIs:

- Scores / box scores / injuries: ESPN `site.api.espn.com` (CORS-enabled)
- Fantasy stats: Sleeper `api.sleeper.app` (CORS-enabled)
- `data/players.json`: compact Sleeper player-name map (generated once, ~43 KB)
- `data/recaps.json`: comedic recaps, generated weekly from ESPN play-by-play

Because scores, fantasy, and highlights are fetched live on every visit, the site
is always current — no rebuild needed week to week. Only `data/recaps.json`
needs regenerating each week (see below).

## Local preview

```bash
cd ~/workspace/highlightcorner
python3 -m http.server 8080
# open http://localhost:8080
```

## Deploying to highlightcorner.com

The site is 100% static and deploys via **GitHub Actions → GitHub Pages**:

- Repo: `github.com/anasahmed10/highlightcorner` (public, branch `main`)
- Workflow: `.github/workflows/deploy.yml` — every push to `main` builds and
  deploys to Pages automatically. Live at
  `https://anasahmed10.github.io/highlightcorner/` until the domain cutover.
- `CNAME` file at the repo root already declares `highlightcorner.com`.

Domain cutover (one-time, in your DNS provider): point `highlightcorner.com`
at GitHub Pages — apex A records to `185.199.108.153`, `185.199.109.153`,
`185.199.110.153`, `185.199.111.153` (or a `www` CNAME to
`anasahmed10.github.io`). GitHub then provisions the TLS certificate
automatically. The old Vercel/Codex deployment can be retired afterwards.

## Weekly recap refresh

Automated: cron job `weekly-nfl-recaps` runs Tuesdays ~8am ET. It determines the
just-completed week, writes Kempski-style recaps (humor throughout, League
seasoning) for each final game into `data/recaps.json`, commits, and pushes —
the push triggers the GitHub Actions deploy automatically.

## Shipping checklist

- `FEATURES.md` is the living feature dashboard — update it as work ships.
- Permanent deploy: Vercel CLI here has no login, so Anas runs `vercel login`
  once, then `vercel deploy --prod` from `~/workspace/highlightcorner/`
  (or imports the folder in the Vercel dashboard); then moves
  `highlightcorner.com` to the new project to replace the Codex build.
  (Superseded 2026-10-06: migrated to GitHub Actions → GitHub Pages.)
- Confirm `/ads.txt` and `/privacy.html` live on the domain, then request the
  AdSense re-review (owner adds payment info first).

## AdSense

- Publisher ID: `ca-pub-1549898506474594` (AdSense account: nasworks.development@gmail.com)
- `ads.txt` at the site root authorizes Google to sell the inventory — required; keep it deployed.
- The AdSense script is in every page's `<head>`; responsive ad units sit on all
  five pages plus game pages (rendered via `js/ads.js`). Slots stay empty until
  Google approves the site — no layout breakage.
- Desktop side rails: on viewports ≥1280px, `js/ads.js` injects fixed 160px
  skyscraper rails left/right of the content; hidden on smaller screens.
- `privacy.html` is linked in the nav (required by AdSense policies).
- PWA: `manifest.webmanifest` + `sw.js` + icons (`icons/`) make the site
  installable via Add to Home Screen (no app store); app shell cached offline,
  `data/*.json` network-first, ESPN/Sleeper/ads never cached.
- Game pages have prev/next navigation (kickoff order, spoiler-safe) and set
  `document.title` to the matchup.
- Account state (2026-10-06): profile complete; site highlightcorner.com flagged
  "Low value content" + ads.txt "Not found". After the new version (original
  recaps, privacy page) is live on the domain with ads.txt, request a review in
  AdSense; payment info must be added in the AdSense dashboard by the owner.

## Notes

- Game times are shown in the *viewer's* local timezone, labeled (e.g. EDT).
- Team text colors come from ESPN's official team colors, adjusted for
  readability in light/dark mode and de-conflicted for similar matchups.
