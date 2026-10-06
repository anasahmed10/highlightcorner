# Highlight Corner

A mobile-first NFL hub for scores, outbound YouTube highlights, weekly fantasy
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

Open `http://localhost:8080`. No build step or package installation is required
for the website. Preview over HTTP rather than opening HTML files directly.
If the service worker keeps showing old local files, unregister it and clear the
preview origin's cache in browser developer tools.

## Pages

| Page | Purpose |
| --- | --- |
| `index.html` | Weekly scores, favorites, watched filters and game links |
| `highlights.html` | Per-game YouTube searches and copied highlight links |
| `fantasy.html` | Weekly leaders by position, scoring format and sortable tables |
| `recaps.html` | Original recaps grouped by week |
| `game.html?id=<espnGameId>&week=<n>` | Game center and previous/next weekly navigation |
| `privacy.html` | Privacy disclosures |
| `404.html` | Missing-page recovery |

Theme, spoiler preference, favorite teams and watched games are stored in the
visitor's browser. Spoiler mode currently blurs selected scores; it does not hide
all outcome clues. Comprehensive protection is a proposed upgrade.

## Data and content

The static site loads scores/game summaries from ESPN and fantasy stats from
Sleeper in the browser. `data/players.json` maps Sleeper IDs to player names,
positions and teams; `data/recaps.json` stores editorial recaps.

Sports data is requested on page load or selection changes, not continuously
polled. Fantasy currently selects the 2026 regular season explicitly. Shared
season handling and more resilient loading are roadmap priorities.

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

There is currently no automated test suite or CI test step. Run relevant checks
from the maintenance guide before publication. The workflow uploads the root,
so committed documentation should contain only public information.

## Advertising, privacy and offline use

AdSense uses manual in-flow units and desktop rails at widths of at least 1280px.
Keep `ads.txt`, privacy links, and publisher configuration intact. Approval and
payment status must be verified in the owner's external account; old rejection
notes are not evidence of current status.

The manifest, icons and service worker support installation and a cached offline
shell. Local JSON uses network first with cached fallback. Sports API requests
and listed ad/video hosts bypass worker caching, so offline shell support does
not guarantee offline scores or fantasy data.
