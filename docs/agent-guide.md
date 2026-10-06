# Highlight Corner maintenance guide

Verified against the repository on October 6, 2026. This guide describes the
current implementation; [roadmap.md](roadmap.md) describes proposed changes.
Source code and the deployment workflow are the authority for implementation
behavior. External schedules and account status require separate verification.

## Architecture and file map

The repository root is the static site. There is no compilation step. Most pages
load `js/app.js`, then `js/ads.js`, then their page script at the end of the body.
`app.js` assigns a fresh `window.HC` object, so reordering it after consumers can
break the site. Shared navigation/header markup is repeated across HTML files.

| Page | Script | Responsibility |
| --- | --- | --- |
| `index.html` | `js/scoreboard.js` | Week selector, scores, favorites, watched filters, game links |
| `highlights.html` | `js/highlights.js` | YouTube searches, featured completed game, copied links |
| `fantasy.html` | `js/fantasy.js` | Weekly Sleeper leaders, scoring formats, position filters, sorting |
| `recaps.html` | `js/recaps.js` | Stored recaps grouped by descending week |
| `game.html` | `js/game.js` | Matchup, weekly navigation, recap, box score, stats, fantasy, injuries |
| `privacy.html` | Inline initialization | Privacy text and shared controls |
| `404.html` | Inline script | Missing-page recovery and theme |

`css/style.css` owns all site styles. `js/app.js` owns theme/navigation setup,
HTTP/ESPN helpers, game normalization, formatting, colors, escaping, preferences,
week options, clipboard feedback, skeletons, scroll-to-top, and worker registration.
`js/ads.js` initializes manual advertising and desktop rails; dynamic game content
calls `HC.renderAds()` after rendering.

## Data and interfaces

All sports API requests happen in the visitor's browser. No API keys or server
are configured. Provider availability, CORS, and response formats can change;
verify current responses when investigating data failures.

- `HC.fetchJSON(url)` rejects non-success HTTP responses and parses JSON.
- `HC.scoreboard(week)` calls ESPN's NFL scoreboard, adding `?week=` when supplied.
  It currently does not specify season or season type.
- `HC.gameSummary(id)` calls ESPN's summary endpoint with `?event=`.
- `HC.gameInfo(event)` normalizes competitors into away/home, status and scores.
  ESPN game IDs become strings.
- `HC.weekOptions(selectEl, selectedWeek)` requests the current scoreboard and
  creates options from week 1 through the reported current week; its fallback is 4.
  This is not a historical-season or postseason selector.
- Fantasy requests `https://api.sleeper.app/v1/stats/nfl/regular/2026/{week}`.
  It reads `pts_ppr`, `pts_half_ppr`, or `pts_std`, keeps players with at least 8
  points, and displays up to 25 per position. `TEAM_` IDs identify defenses.
- Game-center fantasy is calculated separately from ESPN box-score groups:
  0.04/passing yard, 4/passing TD, -2/interception, 0.1/rushing or receiving yard,
  6/rushing or receiving TD, 1/reception, -2/lost fumble, 3/field goal, 1/extra point.
  It shows up to ten players scoring more than two points. It need not match
  Sleeper's rankings or distance-based kicker scoring.
- `game.html?id=<espnGameId>&week=<n>` identifies a game and its weekly context.
  `id` is required; missing IDs display a recovery link. The optional week informs
  sibling navigation and highlight searches. Preserve these links when editing.
- `HC.ytSearchURL` produces a YouTube search URL using week and team abbreviations;
  it does not select or guarantee a particular highlight video.

### Stored JSON

`data/players.json` is an object keyed by Sleeper player ID. Each value has `n`
(name), `p` (position), and `t` (team). Unknown IDs are skipped by fantasy rendering.
No player-map generator is checked in; do not claim one exists. If refreshing
this file, document the source and method, preserve this compact shape, and
check newly appearing IDs and traded players.

`data/recaps.json` is an array. Existing fields are:

| Field | Current format |
| --- | --- |
| `gameId` | ESPN game ID string, used to join recap and game |
| `week` | Numeric week |
| `away`, `home` | Team abbreviations |
| `awayScore`, `homeScore` | Numeric final scores |
| `headline`, `recap`, `keyStat` | Plain-text strings; double newlines separate paragraphs |
| `verdict` | `nail-biter`, `comfortable`, `garbage-time`, or `blowout` |

There is no season field today. Avoid overlapping multi-season archives without
first changing the readers and data contract. Keep IDs unique within the stored
collection and preserve previous recaps unless replacement is explicitly requested.

### Browser state

| Local storage key | Value |
| --- | --- |
| `hc-theme` | Plain string `light` or `dark` |
| `hc:spoilers` | JSON string `show` or `hide` |
| `hc:favorites` | JSON array of team abbreviations |
| `hc:watched` | JSON array of game ID strings |

`HC.prefs` reads/writes the JSON-backed settings; theme storage is separate.
Theme changes dispatch `hc:theme`; page listeners may rerender or refetch.
Spoiler changes update `data-spoilers` on the document. Current protection is
CSS blur on selected scores, not comprehensive outcome hiding: winners, verdicts,
recap prose, stats, and featured-game labels can reveal outcomes. Treat stronger
protection as a roadmap upgrade, not an existing guarantee.

## Redesign conventions

- Use theme variables (`--bg`, `--card`, `--text`, `--muted`, `--border`,
  `--accent`, and related tokens) rather than independent page palettes.
- Preserve the centered 860px content area, responsive tables, sticky header,
  and prominent Watch highlights buttons. Existing key breakpoints are 700px
  for desktop content/recap expansion and 1280px for advertising rails.
- Derive matchup colors through `HC.teamTextColors`; it adjusts contrast and
  distinguishes similar team palettes. Preserve recognizable team colors.
- New interactive controls should have clear names, visible keyboard focus,
  accessible state, and comfortable touch targets (aim for at least 44px).
  Existing controls are not uniformly audited; do not call the site fully accessible.
- Keep skeletons, empty states, and readable error messages. A loading state must
  eventually resolve or offer recovery. Respect reduced-motion preferences when
  adding animation or scrolling behavior.
- Display dates with `HC.fmtDate`/`HC.fmtDateShort`: viewer-local timezone with
  a timezone label, never a fixed editorial timezone.
- Keep the original sports humor in recaps and microcopy. Facts must come from
  checked source data; humor is original commentary, not copied source prose.
- Game recaps clamp to three lines on mobile with an expansion control; desktop
  shows full text. Box Score starts expanded; other stat sections start collapsed.

## Common maintenance tasks

### Change shared UI or add a page

Update every affected header/nav consumer because there is no template system.
Preserve script order and DOM IDs/data attributes used by handlers. For a new
public page, review title/description, canonical/Open Graph tags, sitemap, relevant
navigation, manifest needs, and the worker shell list. Test both relative paths
and direct page loads. Do not add a build system merely to deduplicate markup.

### Update season/week behavior

Search for `2026`, week fallbacks, scoreboard URL construction, and highlight
queries across page scripts. Verify ESPN and Sleeper select the same season/week.
Do not simply change the fantasy year and assume postseason or historical support
works. Follow the roadmap for a coordinated selection/data-contract upgrade.

### Refresh recaps

1. Identify the intended season/week and completed games from ESPN. Check final
   scores, game IDs, chronology, and supporting box-score/scoring information.
2. If advanced-stat context is needed, the optional Python tool requires Python 3,
   `curl`, and the third-party `duckdb` package. Use a virtual environment when
   installing it. From the repository root:

   ```sh
   python3 tools/nflverse_week.py --season 2026 --week 5 --out /tmp/hc-week5-stats.json
   ```

   This downloads nflverse play-by-play parquet to `~/.cache/nflverse`, refreshes
   files older than 12 hours, and emits statistics for regular-season games. Its
   output is supporting evidence, not `data/recaps.json`. nflverse game IDs differ
   from ESPN IDs; map by season/week/matchup. Upstream data may not yet be available.
3. Write original, multi-paragraph recaps grounded in verified facts, a headline,
   supported verdict, and a sourced key statistic. Current entries are longer
   narratives; do not enforce the obsolete 150-word note in earlier documentation.
4. Preserve the array contract and other weeks. Check numeric scores/week, unique
   string IDs, supported verdicts, and rendering on Recaps and game pages.
5. Preserve visible nflverse attribution when using its data. The tool identifies
   the dataset as CC-BY-4.0; verify current upstream terms for new uses.

Earlier documentation described an external `weekly-nfl-recaps` Tuesday schedule.
Only the Pages deployment workflow is present in this repository; no scheduler or
recap-writing generator is checked in. Inspect the external automation before
changing its schedule or promising that weekly updates are automatic.

## Local validation

From the repository root:

```sh
python3 -m http.server 8080
```

Open `http://localhost:8080`. A real HTTP origin is needed for JSON loading and
service-worker behavior. There is no `npm test`, build command, or checked-in
browser test suite. Use tools available in your session; if browser checks cannot
be performed, report that limit explicitly.

For changed JavaScript, run `node --check path/to/changed-file.js` if Node is
available. For changed JSON, run `python3 -m json.tool data/recaps.json > /dev/null`
(or the other changed JSON file). Run `git diff --check` for all changes.

### Browser checks by change type

| Change | Checks |
| --- | --- |
| Shared core/header/CSS | All main pages, light/dark themes, repeated toggles, narrow/wide layouts, console errors |
| Scoreboard | Current/earlier week, empty week, favorites, watched/unwatched filters, keyboard card activation |
| Highlights | Search URL, copied link, no completed games, featured game, game links |
| Fantasy | All three formats, position filter, both sort directions, missing players, no stats |
| Game center | Missing/invalid ID, pregame/live/final examples, team tabs, collapsed sections, copied URL, previous/next boundaries |
| Recaps | Multiple weeks, matching game ID, paragraph rendering, verdict style, mobile expand/collapse and desktop full text |
| Preferences | Persistence across navigation/reload, fresh storage, blocked storage, spoiler blur without layout breakage |
| Accessibility/layout | Keyboard focus, control names/states, reduced motion, long names, horizontal table scrolling, no page overflow |
| Failure recovery | Block ESPN/Sleeper/JSON requests, inspect errors and unresolved skeletons; rapidly change weeks and themes |
| PWA/ads | Warm-cache offline shell, uncached/live-data limits, new-release shell, empty/blocked ads, rails at/above 1280px |

A practical layout sample is 390px, 768px, and 1440px, plus either side of the
700px and 1280px breakpoints when relevant. Check changed content with JavaScript
and provider failures as well as the happy path. Existing defects discovered
outside the task should be reported or added to the roadmap, not silently folded
into unrelated work.

## Deployment, caching, and operational limits

- Remote: `https://github.com/anasahmed10/highlightcorner`; production branch `main`.
- `.github/workflows/deploy.yml` runs on pushes to `main` and manual dispatch,
  substitutes the commit SHA for `__BUILD_ID__` in `sw.js`, and uploads the root
  directory to GitHub Pages. It does not compile code or run tests.
- Root `CNAME` declares `highlightcorner.com`. On October 6, 2026, an HTTPS check
  showed `www.highlightcorner.com` redirecting to the apex, which returned HTTP 200
  with GitHub hosting headers. Verify live hosting again for future migrations.
- `.vercel/` is ignored historical deployment output, not current editable source.
- `sw.js` caches listed shell assets at install; activation removes other caches
  on this origin. Shell requests use cache first; `data/` requests use network
  first with cached fallback. Listed ESPN/Sleeper/YouTube/Google ad hosts bypass
  worker caching. Offline shell support does not imply offline live sports data.
- Keep the literal `__BUILD_ID__` in source. Local runs lack deploy stamping, so
  unregister the worker/clear this preview origin's cache in browser tools when
  changes appear stale. Do not erase production browser storage for debugging.
- When publication is authorized, confirm the Pages run succeeded and check
  affected live pages and cache updates. Check `/ads.txt`, `/privacy.html`, the
  manifest and SEO assets when changes touch them. Do not deploy just to validate
  a local documentation or styling change.
- AdSense publisher configuration exists, but approval/payment/account status is
  external. Earlier rejection notes are historical, not a current verified status.
  Preserve manual units and privacy disclosures; check current requirements before
  introducing tracking, consent changes, or new advertising behavior.
- The workflow uploads the repository root. Treat committed documents as public;
  never include credentials or private operational material. A narrower publishing
  artifact is proposed in the roadmap.

## Keep these documents useful

Update this guide when actual interfaces, source layout, tooling or workflows
change. Record shipped behavior in [../FEATURES.md](../FEATURES.md). Update
[roadmap.md](roadmap.md) when an item starts or meets its acceptance criteria.
Keep proposed behavior separate from current behavior and explain checks actually
performed in the completion report.
