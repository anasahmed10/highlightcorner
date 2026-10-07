# Highlight Corner

A mobile-first NFL hub for scores, outbound official game highlights, weekly fantasy
leaders, original humorous recaps, and game centers with box scores, team stats,
fantasy scorers, and injuries.

Live site: [highlightcorner.com](https://highlightcorner.com).
`www.highlightcorner.com` redirects to the canonical apex domain (checked October 6, 2026).

## Documentation

- [AGENTS.md](AGENTS.md): starting instructions for Codex agents of any model.
- [Maintenance guide](docs/agent-guide.md): architecture, data contracts, UI
  conventions, validation, recap maintenance, deployment, and caching.
- [Upgrade roadmap](docs/roadmap.md): prioritized proposals with acceptance criteria.
- [Feature dashboard](FEATURES.md): shipped capabilities and operational follow-ups.

## Local preview

From the repository root:

```sh
python3 -m http.server 8080
```

Open `http://localhost:8080`. Committed styles work immediately without installing
anything. When editing Tailwind utility classes, use Node 24+ and run `npm ci`
then `npm run build:css`; commit the generated `css/utilities.css`.
`npm test` runs focused DOM and service-worker regression checks. Preview over HTTP rather than opening HTML files directly.
If the service worker keeps showing old local files, unregister it and clear the
preview origin's cache in browser developer tools.

## Pages

| Page | Purpose |
| --- | --- |
| `index.html` | Weekly scores, favorites, watched filters, game links and available direct highlights |
| `highlights.html` | Legacy standalone page for matched official game videos and copied links |
| `fantasy.html` | Weekly leaders by position, scoring format and sortable tables |
| `recaps.html` | Original recaps grouped by week |
| `game.html?id=<espnGameId>&week=<n>` | Game center and previous/next weekly navigation |
| `privacy.html` | Privacy disclosures |
| `404.html` | Missing-page recovery |

Theme, spoiler preference, favorite teams and watched games are stored in the
visitor's browser. Hide spoilers removes scores, team records, outcome labels, featured picks,
recap prose, and stats from visible and accessible page content. Reveal them
through Settings. Mobile navigation uses three persistent bottom tabs: Scores, Fantasy, and Recaps.

## Data and content

The static site loads scores/game summaries from ESPN and fantasy stats from
Sleeper in the browser. `data/players.json` maps Sleeper IDs to player names,
positions and teams; `data/recaps.json` stores editorial recaps.

Sports data is requested on page load or selection changes, not continuously
polled. Fantasy currently selects the 2026 regular season explicitly. Shared
season handling and more resilient loading are roadmap priorities.

Highlight buttons use `data/highlights.json` to open the official video matched
to that ESPN game ID. `tools/refresh_highlights.py` discovers NFL-channel uploads
through the YouTube Data API and matches both teams, season, and week. It rejects
previews, player clips, full-game replays, private videos, and other channels.
Upcoming games and games without a verified video show a pending state.

Automatic discovery requires YouTube Data API v3 to be enabled for a Google
Cloud API key. Store it as the repository Actions secret `YOUTUBE_API_KEY`.
The Pages workflow refreshes the map on publication and every two hours once
the workflow is on `main`.
The key stays in Actions; visitors only download the generated link map.
For a local refresh with the key already in your environment, run:

```sh
python3 tools/refresh_highlights.py
```

The checked-in map was populated through a live API run on October 7, 2026.
The YouTube-only key is configured in the repository Actions secret. API failures preserve the
last deployed map when it can be fetched; links expire after 30 days without
verification. The automatic matcher currently supports the regular season.
NFL.com game-specific links are also supported by the map, but NFL.com pages
are not harvested automatically because of their terms for commercial use.

Recaps require content updates. `tools/nflverse_week.py` can provide supporting
regular-season EPA and win-probability statistics; it requires Python 3, `curl`
and `duckdb`. It does not write finished recaps. See the maintenance guide for
usage, data mapping, attribution and checks. Earlier docs described an external
weekly recap automation; no scheduler or recap generator is checked into this repo.

## Deployment

Repository: [anasahmed10/highlightcorner](https://github.com/anasahmed10/highlightcorner).
The production branch is `main`.

`.github/workflows/deploy.yml` deploys the static root through GitHub Actions to
GitHub Pages on pushes to `main` or manual dispatch. It stamps the commit SHA into
the service-worker cache name. Keep `__BUILD_ID__` in the source `sw.js`.
`CNAME` declares `highlightcorner.com`; GitHub hosting was verified October 6, 2026.
The ignored `.vercel/` folder is historical deployment output.

The Pages workflow runs regression checks, syntax checks, and the Tailwind build,
then uploads an explicit public asset directory. Development dependencies, tests,
tools, and agent documentation are excluded. Run the browser checks in the
maintenance guide before publication.

## Advertising, privacy and offline use

AdSense uses manual in-flow units and desktop rails at widths of at least 1280px.
Keep `ads.txt`, privacy links, and publisher configuration intact. Approval and
payment status must be verified in the owner's external account; old rejection
notes are not evidence of current status.

Settings provides iOS/Android home-screen instructions and the browser install
prompt when supported. A dismissible suggestion appears after three scoreboard
cards and stays dismissed for 30 days. Installed windows hide install controls.
The manifest, icons and service worker support installation and a cached offline
shell, including game URLs with query parameters. Local JSON uses network first with cached fallback. Sports API requests
and listed ad/video hosts bypass worker caching, so offline shell support does
not guarantee offline scores or fantasy data.
