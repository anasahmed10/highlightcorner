# Highlight Corner — Feature Dashboard

Living tracker for the redesigned static site. Updated as work ships.
Live domain: [highlightcorner.com](https://highlightcorner.com), served through GitHub Pages
(verified October 6, 2026).

Agent entry point: [AGENTS.md](AGENTS.md). Detailed maintenance instructions:
[agent guide](docs/agent-guide.md). Prioritized proposed upgrades and acceptance
criteria: [upgrade roadmap](docs/roadmap.md).

## ✅ Shipped

| Feature | Notes |
|---|---|
| Weekly scoreboard | ESPN data, current-week selection, day grouping, pregame labels without implied 0–0 results, Refresh and labeled updated time; stale responses are ignored; visible pages refresh live scores every minute and pause in the background |
| Coordinated season/week (R1) | ESPN-discovered regular-season context shared by scores, highlights and fantasy; explicit season/week game and navigation links, rollover/fallback labels, season-tagged recap archive |
| Game highlights | Colored View Highlights links beside View game on score cards when verified videos are available; three navigation tabs; official YouTube mapping refreshed at deployment and after the usual NFL game windows |
| Regression checks (R3) | Offline provider fixtures; smoke checks for all seven pages; normalization/context/preferences/failure/race coverage; stored-data and source checks in PR and pre-deployment CI |
| Fantasy leaders | PPR / half-PPR / standard, via Sleeper |
| Recap show more (game page) | Recap body clamps to 3 lines with Show more/less on mobile so the box score sits higher; full text on desktop |
| Comedic recaps | Original multi-paragraph narratives with verdicts (nail-biter, comfortable, garbage-time, blowout); Week 4 stored in JSON |
| Recap score panels | Prominent away/home teams in readable team colors and final scores above headlines on Recaps and game pages; respects themes and Hide spoilers |
| Game center pages | Matchup/highlights → recap → scoring summary → tabbed box score → team stats → fantasy → tabbed injuries; prev/next game nav; live game details refresh every minute while visible and stop after the final status |
| Spoiler preference | Settings toggle hides scores, records, verdicts, featured picks, recaps and stats from visible/accessibility content; device screen-reader review pending |
| Favorites + watched | Team favorites w/ filter; watched/unwatched tracking w/ filter |
| Team colors | Logo-derived, matchup-aware, readable in light/dark |
| Mobile-first UI | Centered Watch-highlights CTA, responsive layouts; control sizing/accessibility audit proposed |
| AdSense | Manual in-flow units use the existing Board/Game IDs; desktop rails (≥1280px) use a dedicated Rail ID. Privacy page and `ads.txt` remain in place. |
| In-flow ad placement | The existing unit appears after five score cards, three highlight cards, or the first recap; these pages keep one stable unit across renders. Revenue impact requires AdSense reporting after ads serve. |
| SEO basics | Meta/OG/canonical, sitemap.xml, robots.txt, favicon, 404 page |
| Matchup sharing | Build-time regular-season game pages from 2026 through the current year expose matchup-specific HTML metadata and canonical URLs; sitemap lists only generated valid matchups, while legacy query links remain usable and noindex |
| PWA | Manifest, icons, offline shell, iOS/Android install guidance, native prompt when supported, dismissed/standalone promotion handling; physical-device installation pending |
| Recap supporting statistics | `tools/nflverse_week.py` emits nflverse evidence for regular-season recaps; does not write recap prose |
| Recap content port | Longer Week 4 recaps stored in `data/recaps.json`; external dashboard/refresh status is unverified |
| Content refresh preparation | Sleeper player-map refresh and ESPN recap evidence/validation commands; editorial prose remains manual |
| Copy-link buttons | Highlights cards (copies the matched video URL) + game pages (copies game URL), with "Copied ✓" feedback |
| Sortable fantasy tables | Top 25 per position; sort by Player or Pts; position dropdown filter (instant, no reload) |
| UI polish | Skeletons, motion-aware scroll-to-top, light/dark themes, three mobile tabs, Settings, focus styles, larger controls and safe-area spacing; full accessibility audit pending |
| Collapsible game sections | Scoring Summary (hidden by default), Box Score, Team Stats, Fantasy, Injuries — dropdowns with counts |
| Site character | Team-color gradient bars on cards/hero, yard-line hero texture, playful microcopy ("Scores are facts. The jokes are opinions.") |

## 🔄 In progress

| Feature | Notes |
|---|---|
| Automatic highlight discovery | YouTube API matcher verifies official channel, both teams, season/week, and public visibility. YouTube-only key configured in Actions; October 7 live run mapped 61 of 64 completed games. Pages refreshes the map at deployment and after the Thursday, three Sunday, and Monday NFL game windows. |
| Mobile/PWA upgrade — implemented; device checks pending | Compiled Tailwind utilities and Lucide icons; content before ads; focused regression tests and public-asset deployment. Physical-device install and screen-reader checks remain. |

## 📋 Proposed upgrades and external follow-ups

Implementation priorities live in [docs/roadmap.md](docs/roadmap.md):

1. Reliability: broader failure recovery.
2. Trust and usability: device/screen-reader verification, accessibility, reproducible content refresh.
3. Release quality: deployed update verification and measured performance; matchup search/share metadata shipped.

| Follow-up | Current evidence / next action |
|---|---|
| GitHub Pages and domain | Deployment workflow and `CNAME` are present; apex HTTPS and `www` redirect verified October 6, 2026. Domain cutover is no longer listed as pending. |
| Weekly recap scheduler | No scheduler found in repository workflows or local Codex automation definitions on October 7, 2026; any external scheduler remains unverified. Editorial publishing remains manual. |
| AdSense review | On October 7, 2026, the dashboard showed `highlightcorner.com` as “Getting ready” with review requested and Auto ads off. It showed `ads.txt` as “Not found,” though the live `/ads.txt` returned HTTP 200 with the correct publisher line; recheck after AdSense crawls the site. The payment warning conflicts with the “profile complete” tile, so verify payment readiness in the account before expecting earnings. |

## ⚠️ Standing decisions

- No self-hosted NFL video — outbound links to official NFL videos only.
- No Auto Ads — manual units only, one per page + desktop rails.
- Scores/stats are facts; ESPN endpoint + hotlinked logos carry ToS/licensing caveats, especially once ads serve.
