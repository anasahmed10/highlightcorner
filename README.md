# Highlight Corner

A mobile-first NFL hub for scores, outbound official game highlights, weekly fantasy
leaders, original humorous recaps, and game centers with box scores, team stats,
fantasy scorers, and injuries.

Documentation checked against `main` on October 9, 2026. Roadmap statuses and
remaining verification are tracked in [docs/roadmap.md](docs/roadmap.md).

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
`npm test` runs fixture-based JavaScript page, data-contract, DOM and worker
checks, followed by Python content-refresh tests. It requires Node 24+, Python 3
and `npm ci`. Run `python3 -m unittest discover -s tests -p 'test_*.py'` for
all Python tools, including highlight matching and matchup-page generation.
These checks use fixtures without live providers or advertising services.
Preview over HTTP rather than opening HTML files directly.
If the service worker keeps showing old local files, unregister it and clear the
preview origin's cache in browser developer tools.

## Pages

| Page | Purpose |
| --- | --- |
| `index.html` | Weekly scores, favorites, watched filters, game links and available direct highlights |
| `highlights.html` | Legacy standalone page for matched official game videos and copied links |
| `fantasy.html` | Weekly leaders by position, scoring format and sortable tables |
| `recaps.html` | Original recaps grouped by season and week |
| `game-<espnGameId>.html` (generated at deployment) | Matchup-specific game center and share metadata |
| `game.html?id=<espnGameId>&season=<year>&week=<n>` | Legacy game links and fallback for IDs without a generated page |
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

Scores, highlights and open game centers refresh every minute while their page is
visible; polling pauses in background tabs, and game-center polling stops after
the game is final. Scores, highlights and fantasy share a selectable regular-season
year and week discovered from ESPN; fantasy requests Sleeper for that year. The
year and week travel in navigation and game links. Missing discovery data and
unavailable weeks are labeled. Every data page offers retry controls; failed live
updates retain their last successful view with a notice. Optional recap/highlight
data failures do not prevent usable scores or game summaries.

Highlight buttons use `data/highlights.json` to open the official video matched
to that ESPN game ID. `tools/refresh_highlights.py` discovers NFL-channel uploads
through the YouTube Data API and matches both teams, season, and week. It rejects
previews, player clips, full-game replays, private videos, and other channels.
Upcoming games and games without a verified video show a pending state.

Automatic discovery requires YouTube Data API v3 to be enabled for a Google
Cloud API key. Store it as the repository Actions secret `YOUTUBE_API_KEY`.
The Pages workflow refreshes the map on publication and after the usual NFL
Thursday-night, Sunday early, Sunday late-afternoon, Sunday-night, and Monday-night
game windows. Its UTC schedule runs about 4–5 hours after kickoff to allow games
and video uploads to finish; local wall-clock times shift with daylight saving.
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

Content updates remain editorial. Refresh the compact Sleeper player map and
prepare sourced ESPN game evidence with:

```sh
python3 tools/refresh_players.py --out data/players.json
python3 tools/prepare_recaps.py --season 2026 --week 5 --out /tmp/hc-week5.json
```

The preparation tool validates existing recaps, checks final summary teams/scores,
and records source URLs and fetch time. It rejects duplicate game IDs and refuses
to overwrite editorial recap archives. It never writes recap prose.
`tools/nflverse_week.py` can add advanced-stat context; it requires Python 3,
`curl`, and `duckdb`. See the maintenance guide for review and attribution.
No Highlight Corner recap scheduler was found in this repo or the local Codex
automation definitions on October 9, 2026.

## Deployment

Repository: [anasahmed10/highlightcorner](https://github.com/anasahmed10/highlightcorner).
The production branch is `main`.

`.github/workflows/deploy.yml` deploys the static root through GitHub Actions to
GitHub Pages on pushes to `main`, manual dispatch and scheduled highlight
refreshes. It stamps the commit SHA into the service-worker cache name. Keep `__BUILD_ID__` in the source `sw.js`.
`CNAME` declares `highlightcorner.com`; GitHub hosting was verified October 6, 2026.

The workflow builds matchup pages from ESPN's regular-season schedules with
`python3 tools/build_game_pages.py --out _site`. It generates seasons from 2026
through ESPN's current year, and writes `game-<id>.html` pages, a game-ID index,
and matching sitemap entries. The build skips an unpublished future schedule
and fails if ESPN returns inconsistent season/week data. To preview generated
links locally, prepare `_site` as the
workflow does, run that command, and serve `_site` over HTTP. A source-root
preview uses legacy query links.

The ignored `.vercel/` folder is historical deployment output.

The Pages workflow runs regression and syntax checks, all Python tool tests and
the Tailwind build. It generates matchup pages, refreshes highlight links,
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
