# Highlight Corner maintenance guide

Verified against the repository on October 7, 2026. This guide describes the
current implementation; [roadmap.md](roadmap.md) describes proposed changes.
Source code and the deployment workflow are the authority for implementation
behavior. External schedules and account status require separate verification.

## Architecture and file map

The repository root is the static site. Only Tailwind utilities have a compilation step; HTML and JavaScript remain plain static files. Committed CSS allows immediate local preview. Run `npm ci` and `npm run build:css` when changing utility classes; commit `css/utilities.css`. Tailwind Preflight is deliberately omitted to preserve the existing stylesheet. Most pages
load `js/app.js`, then `js/ads.js`, then their page script at the end of the body.
`app.js` assigns a fresh `window.HC` object, so reordering it after consumers can
break the site. Shared navigation/header markup is repeated across HTML files. Navigation has Scores, Fantasy, and Recaps; highlights are available beside View game on completed score cards. The old highlights URL remains accessible for existing links. Place both desktop and mobile navigation before `js/app.js` so page initialization can set the active tab. The shared script creates the Settings dialog, install promotion, and offline notice before page scripts initialize theme/preferences.

| Page | Script | Responsibility |
| --- | --- | --- |
| `index.html` | `js/scoreboard.js` | Week selector, scores, favorites, watched filters, game and highlight links |
| `highlights.html` | `js/highlights.js` | Legacy standalone page: matched official videos, featured completed game, copied links |
| `fantasy.html` | `js/fantasy.js` | Weekly Sleeper leaders, scoring formats, position filters, sorting |
| `recaps.html` | `js/recaps.js` | Stored recaps grouped by descending season/week |
| `game.html` | `js/game.js` | Matchup, weekly navigation, recap, box score, stats, fantasy, injuries |
| `privacy.html` | Inline initialization | Privacy text and shared controls |
| `404.html` | Inline script | Missing-page recovery and theme |

`css/style.css` owns all site styles. `js/app.js` owns theme/navigation setup,
HTTP/ESPN helpers, game normalization, formatting, colors, escaping, preferences,
season/week context, clipboard feedback, skeletons, scroll-to-top, and worker registration.
`js/ads.js` initializes manual advertising and desktop rails; dynamic game content
calls `HC.renderAds()` after rendering.

On Scores, Highlights, and Recaps, the single in-flow ad is a static element
between lead and remaining content containers. Their page scripts divide rendered
items around that element so refreshes and filters keep the same AdSense DOM node
instead of creating another unit. Scores places it after five game cards,
Highlights after three game cards, and Recaps after the first recap. The game
page keeps its manual unit outside the rerendered game content so live updates
do not discard it. The privacy page does not initialize ad rails.

## Data and interfaces

Scores and fantasy requests happen in the visitor's browser. Highlight discovery
runs in GitHub Actions through the YouTube Data API using `YOUTUBE_API_KEY`; only
the generated public map reaches the browser. No application server is needed.
Provider availability and formats can change; verify responses when investigating
data failures.

- `HC.fetchJSON(url)` rejects non-success HTTP responses, parses JSON, and aborts after 12 seconds.
- `HC.startVisiblePolling(callback, interval)` schedules non-overlapping updates while a page is visible, pauses its timer in a background tab, and refreshes immediately when the tab returns. Scores, Highlights, and game pages use it with a 60-second interval; the game page stops after ESPN reports the final state. Scoreboard and Highlights retain their last successful rendering when a background update fails.
- `HC.scoreboard(week, season)` calls ESPN's NFL scoreboard. With a season,
  it sends `dates=<year>&seasontype=2&week=<n>` and rejects a response that
  explicitly reports a different year/type.
- `HC.gameSummary(id)` calls ESPN's summary endpoint with `?event=`.
- `HC.gameInfo(event)` normalizes competitors into away/home, status and scores.
  ESPN game IDs become strings.
- `HC.initSeasonWeek(seasonEl, weekEl)` discovers the default ESPN year/type/week,
  populates 2026-through-current regular-season years and available weeks, and
  honors valid URL `season`/`week` parameters. `HC.selectSeasonWeek` updates the
  shared context when the year changes; `HC.setContext` carries it through nav,
  brand, back and game links. Future week links clamp with a visible explanation.
  Postseason/offseason defaults to regular Week 18; preseason defaults to the
  preceding completed season when available. Failed or incomplete discovery
  falls back to a date-derived year and labeled unverified Week 1.
  `HC.weekOptions` remains for older callers; new page code uses the shared
  season/week helpers.
- Fantasy requests `https://api.sleeper.app/v1/stats/nfl/regular/{season}/{week}`.
  It reads `pts_ppr`, `pts_half_ppr`, or `pts_std`, keeps players with at least 8
  points, and displays up to 25 per position. `TEAM_` IDs identify defenses.
  The committed player-name map is not season-specific; past-year team labels
  may need a refreshed historical map.
- Game-center fantasy is calculated separately from ESPN box-score groups:
  0.04/passing yard, 4/passing TD, -2/interception, 0.1/rushing or receiving yard,
  6/rushing or receiving TD, 1/reception, -2/lost fumble, 3/field goal, 1/extra point.
  It shows up to ten players scoring more than two points. It need not match
  Sleeper's rankings or distance-based kicker scoring.
- `game.html?id=<espnGameId>&season=<year>&week=<n>` identifies a game and its
  regular-season context. `id` is required; missing IDs display a recovery link.
  Older ID/week URLs still load by deriving the year from the summary/date.
  Preserve season/week in sibling navigation.
- `game-<espnGameId>.html` is the canonical generated game page. Static HTML
  contains the matchup, description, canonical and share tags; `js/game.js`
  fills live details using embedded game ID, season and week. `HC.gameURL`
  chooses that page when the published ID index matches the requested season,
  otherwise it uses the legacy query URL. The generic `game.html` is `noindex`.
- `HC.highlightLink(map, id)` resolves a verified game-specific link. It accepts
  direct NFL.com video pages or official NFL-channel YouTube watch URLs, rejects
  collection/search pages and unsafe destinations, and expires links after 30 days.
- `HC.highlightPending(map, completed)` labels future games, missing videos, or
  unavailable discovery separately. Unmatched games never get a guessed URL.

### Stored JSON

`data/highlights.json` has `version: 1`, a `status`, UTC `updatedAt`, and `games`
keyed by string ESPN event ID. A generated entry has `url`, `source`, `channelId`,
`season`, `week`, `away`, `home`, and UTC `verifiedAt`. `source` is `YouTube` for
automatic discovery. Only NFL channel `UCDVYQ4Zhbm3S2dlz7P1GBDg` is eligible.
The October 7, 2026 snapshot contains 61 verified videos for 64 completed games.
The YouTube-only API key is configured as the repository Actions secret.

`tools/refresh_highlights.py` reads ESPN's current regular-season year/week,
loads completed games, paginates the official channel's uploads via the YouTube
Data API, and verifies candidate ownership/public visibility with `videos.list`.
Matching requires a whole-game highlights title, both exact team aliases, year,
and week. API metadata is re-read on every successful run. Pagination is bounded;
failed refreshes leave the previous map intact. Request errors are sanitized so
the API key cannot appear in logs. NFL.com HTML is not collected automatically.

Set up a Google Cloud key with YouTube Data API v3 enabled and store it in the
repository Actions secret `YOUTUBE_API_KEY`. The Pages workflow refreshes staged
`_site/data/highlights.json` on deployment and after each usual NFL game window:
Thursday night, Sunday early, Sunday late afternoon, Sunday night, and Monday
night. UTC cron runs about 4–5 hours after kickoff to allow games and video uploads
to finish; local wall-clock times shift with daylight saving. It preserves the
last successful public map from the live site's `/data/highlights.json` when
available and never commits generated data or secrets. Scheduled discovery runs
from the workflow on `main`.
The matcher supports regular-season numeric weeks only; postseason titles need
a separately verified matching contract. Run `python3 tools/refresh_highlights.py`
for local refresh with an environment key, and `python3 -m unittest discover -s
tests -p 'test_highlights.py'` for the offline matcher checks.

`tools/build_game_pages.py` fetches all 18 regular-season weeks from 2026
through ESPN's current year during Pages deployment. It skips empty, unpublished
weeks only in the newest season, rejects contradictory season/week metadata and incomplete
matchups, then writes flat `game-<id>.html` files,
`js/game-pages.js`, and matching sitemap entries into `_site`. The source
`js/game-pages.js` has no IDs, so a source-root preview uses legacy query links;
preview `_site` to check generated pages. The generic `game.html` is `noindex`
and omitted from the sitemap. Generated HTML has no scores or result text.
The service worker falls back to its cached generic game shell for an unvisited
generated URL while offline; `js/game.js` recovers its ID from the URL path.

`data/players.json` is an object keyed by Sleeper player ID. Each value has `n`
(name), `p` (position), and `t` (team). Existing defense entries use team IDs and
`p: DEF`; fantasy also handles `TEAM_` defense IDs separately. Unknown IDs are
skipped by fantasy rendering. `tools/refresh_players.py` fetches Sleeper's public
NFL player catalog, updates active QB/RB/WR/TE/K entries with valid teams, and
retains previous IDs for historical weeks. Review added IDs, names and trades
before committing; the tool does not publish the site.

`data/recaps.json` is an array. Existing fields are:

| Field | Current format |
| --- | --- |
| `gameId` | ESPN game ID string, used to join recap and game |
| `season` | Numeric NFL regular-season year; required for archive grouping and game matching |
| `week` | Numeric week |
| `away`, `home` | Team abbreviations |
| `awayScore`, `homeScore` | Numeric final scores |
| `headline`, `recap`, `keyStat` | Plain-text strings; double newlines separate paragraphs |
| `verdict` | `nail-biter`, `comfortable`, `garbage-time`, or `blowout` |

Keep IDs unique within the stored collection and preserve previous recaps unless
replacement is explicitly requested. Readers group by season and week; recap
preparation must include the season when adding future entries.

### Browser state

| Local storage key | Value |
| --- | --- |
| `hc-theme` | Plain string `light` or `dark` |
| `hc:spoilers` | JSON string `show` or `hide` |
| `hc:favorites` | JSON array of team abbreviations |
| `hc:watched` | JSON array of game ID strings |
| `hc:install-dismissed` | JSON timestamp; suppress suggestion for 30 days |

`HC.prefs` reads/writes the JSON-backed settings, with session-only fallback when storage is blocked; theme storage is separate.
Theme changes dispatch `hc:theme`; page listeners may rerender or refetch.
Spoiler changes update `data-spoilers` on the document. Outcome elements use `data-outcome`; `HC.applySpoilers()` toggles their native
`hidden` attribute, including accessible content. Add `data-spoiler-placeholder`
for safe replacement text. Every dynamic renderer must call `HC.contentReady(box)`
after inserting markup. Scoreboard accessible names contain only matchups; records,
scores, verdicts, featured picks, recaps, and stats are hidden. Complete manual
screen-reader coverage remains an accessibility follow-up.

## Redesign conventions

- Use theme variables (`--bg`, `--card`, `--text`, `--muted`, `--border`,
  `--accent`, and related tokens) rather than independent page palettes.
- Preserve the centered 860px content area, responsive tables, sticky header,
  and prominent Watch highlights buttons. Existing key breakpoints are 700px
  for desktop content/recap expansion, 800px for switching bottom tabs to desktop
  navigation, and 1280px for advertising rails. Safe-area insets pad headers,
  bottom tabs, and page bottoms. Settings uses a native modal dialog with Escape
  dismissal and focus return.
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

Change the shared `HC.initSeasonWeek`/`HC.setContext` path, not one page's
provider URL in isolation. Verify ESPN and Sleeper select the same regular-season
year/week; check postseason, offseason, preseason rollover and URL clamping.
Keep recap `season` values and game links aligned. The generated highlight map
is game-ID based and has its own season/week matching workflow. Postseason stats
are not supported by the regular-season selectors.

### Refresh recaps

1. Refresh the Sleeper name map when needed with
   `python3 tools/refresh_players.py --out data/players.json`. This merges active
   player details into the existing map, retaining older IDs. Review its diff.
   Source: `https://api.sleeper.app/v1/players/nfl`.
2. Prepare the intended regular-season week with
   `python3 tools/prepare_recaps.py --season 2026 --week 5 --out /tmp/hc-week5.json`.
   This uses ESPN scoreboard and game-summary endpoints. Its output names those
   sources and separates verified finals (`ready`) from incomplete or delayed
   games (`flagged`). It validates every stored recap's season, week, ID,
   verdict, required prose and scores, and compares the selected week with ESPN.
   It never writes `data/recaps.json`.
3. Review the preparation file and ESPN game pages. Check chronology and
   supporting box-score/scoring information; do not infer missing facts.
4. If advanced-stat context is needed, the optional Python tool requires Python 3,
   `curl`, and the third-party `duckdb` package. Use a virtual environment when
   installing it. From the repository root:

   ```sh
   python3 tools/nflverse_week.py --season 2026 --week 5 --out /tmp/hc-week5-stats.json
   ```

   This downloads nflverse play-by-play parquet to `~/.cache/nflverse`, refreshes
   files older than 12 hours, and emits statistics for regular-season games. Its
   output is supporting evidence, not `data/recaps.json`. nflverse game IDs differ
   from ESPN IDs; map by season/week/matchup. Upstream data may not yet be available.
5. Write original, multi-paragraph recaps grounded in verified facts, a headline,
   supported verdict, and a sourced key statistic. Current entries are longer
   narratives; do not enforce the obsolete 150-word note in earlier documentation.
6. Preserve the array contract and other weeks. Include numeric `season` on every
   entry. Re-run preparation for that week, then check rendering on Recaps and
   game pages. Run `python3 -m unittest discover -s tests -p 'test_*.py'`;
   this offline suite also runs in pull-request and Pages workflows.
7. Preserve visible nflverse attribution when using its data. The tool identifies
   the dataset as CC-BY-4.0; verify current upstream terms for new uses.

Earlier documentation described an external `weekly-nfl-recaps` Tuesday schedule.
On October 7, 2026, no recap scheduler was found in this repository's workflows
or the local Codex automation definitions. Its existence elsewhere remains
unverified. Recap preparation and publishing are manual; do not promise automatic
weekly updates.

## Local validation

From the repository root:

```sh
python3 -m http.server 8080
```

Open `http://localhost:8080`. A real HTTP origin is needed for JSON loading and
service-worker behavior. Run `npm test` for fixture-based page, data-contract, DOM and worker regressions and `npm run build:css`
for Tailwind. Pull requests run these checks before merging; Pages runs them
again before deployment. Page smoke checks use jsdom rather than a browser engine. Use tools available in your session; if browser checks cannot
be performed, report that limit explicitly.

For changed JavaScript, run `node --check path/to/changed-file.js` if Node is
available. For changed JSON, run `python3 -m json.tool data/recaps.json > /dev/null`
(or the other changed JSON file). Run `git diff --check` for all changes.

### Automated regression checks (R3)

Use Node 24+ and the existing dev dependencies (`npm ci`), then run `npm test`.
For a focused run, use `node --test tests/sports.test.cjs tests/pages.test.cjs`
or `node --test tests/source.test.cjs`. No new dependencies are required.

- `tests/fixtures/sports.json` contains synthetic ESPN pre/live/final events,
  a game summary, verified highlight links, Sleeper scoring formats, player mappings and editorial recaps.
  These are test examples, not verified NFL results or publishable content.
- `tests/helpers/page.cjs` loads real HTML and its declared local/inline scripts
  in order. Resource loading is disabled, so ads/logos do not contact providers.
  Fetch uses a fixture router; unexpected URLs and uncaught page errors fail the
  test. Deferred responses exercise races without real network latency; bounded
  state waits and window cleanup prevent unresolved tests and polling leaks.
- `tests/sports.test.cjs` covers normalization with missing competitors,
  provider/current/earlier/unavailable week selection, persisted/blocked/corrupt
  storage, week and scoring-format races, retries, malformed JSON and timeout aborts.
- `tests/pages.test.cjs` smokes all seven public pages and checks rendered game
  states, week-bearing links, filters, escaping, spoiler restoration, empty data,
  optional-data failures and theme rendering without new data requests.
- `tests/source.test.cjs` validates committed recap/player contracts, unique recap
  IDs, JavaScript/inline-script syntax, local HTML asset references and manifest assets.
  Both PR checks and Pages deployment already run `npm test`; these validations
  therefore run before the public deployment artifact is prepared.

On October 7, 2026, all 80 checks passed locally. Removing stale-response guards
in temporary copies of scoreboard, highlights and fantasy made each corresponding
race check fail. This proves regression detection without modifying site source.
`tests/context.test.cjs` additionally checks shared season/week requests, links,
rollover, offseason, unavailable weeks, provider mismatch and recap grouping.
jsdom does not verify CSS layout, screen readers, service-worker browser lifecycle,
physical-device installation, or provider availability. Keep the manual browser
checks below; the worker unit tests execute separately in a simulated worker context.

### Browser checks by change type

| Change | Checks |
| --- | --- |
| Shared core/header/CSS | All main pages, light/dark themes, repeated toggles, narrow/wide layouts, console errors |
| Scoreboard | Current/earlier week, empty week, favorites, watched/unwatched filters, keyboard card activation |
| Highlights | Game-specific destination and copied URL, unmatched/future games, failed map request, featured game, game links, live refresh and background-tab pause |
| Fantasy | All three formats, position filter, both sort directions, missing players, no stats |
| Game center | Missing/invalid ID, pregame/live/final examples, live refresh preserves open sections and selected team tabs, polling stops after final status, copied URL, previous/next boundaries |
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
  substitutes the commit SHA for `__BUILD_ID__` in `sw.js`, after compiling utilities and running tests/syntax checks, then uploads an
  explicit `_site/` directory of public assets to GitHub Pages. Dependencies,
  CSS input, tests, tools, and documentation stay out of the deployment.
- Root `CNAME` declares `highlightcorner.com`. On October 6, 2026, an HTTPS check
  showed `www.highlightcorner.com` redirecting to the apex, which returned HTTP 200
  with GitHub hosting headers. Verify live hosting again for future migrations.
- `.vercel/` is ignored historical deployment output, not current editable source.
- `sw.js` caches listed shell assets at install; activation removes only previous `hc-` caches
  on this origin. Shell requests use cache first; `data/` requests use network
  first with cached fallback. All cross-origin requests bypass worker caching. Only successful responses
  are stored. Query-bearing navigation uses the matching cached HTML shell;
  failed navigation falls back to the cached recovery page. Offline shell support does not imply offline live sports data.
- Keep the literal `__BUILD_ID__` in source. Local runs lack deploy stamping, so
  unregister the worker/clear this preview origin's cache in browser tools when
  changes appear stale. Do not erase production browser storage for debugging.
- When publication is authorized, confirm the Pages run succeeded and check
  affected live pages and cache updates. Check `/ads.txt`, `/privacy.html`, the
  manifest and SEO assets when changes touch them. Do not deploy just to validate
  a local documentation or styling change.
- AdSense publisher configuration and manual ad-unit IDs exist. On October 7,
  2026, the account showed site review requested and `highlightcorner.com` as
  “Getting ready”; Auto ads were off. The dashboard showed `ads.txt` as “Not
  found” while the live file returned HTTP 200 with the publisher line. Recheck
  review, crawl, and payment status in the external account before expecting
  revenue. Earlier rejection notes are historical.
  Preserve manual units and privacy disclosures; check current requirements before
  introducing tracking, consent changes, or new advertising behavior.
- The workflow copies only public assets into `_site/`; development files are
  excluded. Keep committed documents free of credentials and private operational
  material regardless of the deployment boundary.

## Keep these documents useful

Update this guide when actual interfaces, source layout, tooling or workflows
change. Record shipped behavior in [../FEATURES.md](../FEATURES.md). Update
[roadmap.md](roadmap.md) when an item starts or meets its acceptance criteria.
Keep proposed behavior separate from current behavior and explain checks actually
performed in the completion report.

## Mobile app UI and install checks

Settings exposes theme, Hide spoilers, privacy, and home-screen help. Installation
uses `beforeinstallprompt` only after a user tap when supported; instructions
remain available elsewhere. `appinstalled`, standalone display mode, and the iOS
standalone flag hide install controls. Check actual Safari/iOS and Chrome/Android
installation on devices before calling device behavior verified. The stable
manifest ID is `/index.html`, matching the previous start URL identity.

Scores, Highlights, and open game centers refresh every 60 seconds while the
page is visible, pause polling in background tabs, and refresh immediately when
the page returns. Game-center polling stops after ESPN reports the final state.
Fantasy fetches on page/week selection. Scores and Highlights ignore stale
responses; Fantasy guards stale selections. Theme changes reuse loaded data.
Static in-flow ads appear within
the Scores, Highlights, and Recaps content lists; Fantasy follows its tables and
game ads follow the recap/stats. Each manual unit is queued once, including
units added after a game loads; repeated render calls skip existing units. Unfilled AdSense units collapse via status
attributes; do not hide a pending unit before its first AdSense measurement.

Use `npm test` for install-event lifecycle, nav state, week recovery, hidden
outcomes, offline game-shell resolution, cache ownership, and failed-response
caching. Test real data, touch/keyboard controls, layouts, provider failure, and
service-worker releases separately in the browser. Local `__BUILD_ID__` remains
unstamped: use a fresh preview origin or clear only the local preview cache
when old assets appear; do not erase production preferences.
