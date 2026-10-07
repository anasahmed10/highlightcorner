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
| Weekly scoreboard | ESPN data, current-week selection, day grouping, pregame labels without implied 0–0 results, Refresh and labeled updated time; stale responses are ignored |
| Game highlights | One-tap YouTube deep links per game; featured highest-scoring game |
| Fantasy leaders | PPR / half-PPR / standard, via Sleeper |
| Recap show more (game page) | Recap body clamps to 3 lines with Show more/less on mobile so the box score sits higher; full text on desktop |
| Comedic recaps | Original multi-paragraph narratives with verdicts (nail-biter, comfortable, garbage-time, blowout); Week 4 stored in JSON |
| Game center pages | Matchup/highlights → recap → scoring summary → tabbed box score → team stats → fantasy → tabbed injuries; prev/next game nav |
| Spoiler preference | Settings toggle hides scores, records, verdicts, featured picks, recaps and stats from visible/accessibility content; device screen-reader review pending |
| Favorites + watched | Team favorites w/ filter; watched/unwatched tracking w/ filter |
| Team colors | Logo-derived, matchup-aware, readable in light/dark |
| Mobile-first UI | Centered Watch-highlights CTA, responsive layouts; control sizing/accessibility audit proposed |
| AdSense | In-flow units + desktop side rails (≥1280px); privacy page; `ads.txt` |
| SEO basics | Meta/OG/canonical, sitemap.xml, robots.txt, favicon, 404 page |
| PWA | Manifest, icons, offline shell, iOS/Android install guidance, native prompt when supported, dismissed/standalone promotion handling; physical-device installation pending |
| Recap supporting statistics | `tools/nflverse_week.py` emits nflverse evidence for regular-season recaps; does not write recap prose |
| Recap content port | Longer Week 4 recaps stored in `data/recaps.json`; external dashboard/refresh status is unverified |
| Copy-link buttons | Highlights cards (copies YouTube link) + game pages (copies game URL), with "Copied ✓" feedback |
| Sortable fantasy tables | Top 25 per position; sort by Player or Pts; position dropdown filter (instant, no reload) |
| UI polish | Skeletons, motion-aware scroll-to-top, light/dark themes, four mobile tabs, Settings, focus styles, larger controls and safe-area spacing; full accessibility audit pending |
| Collapsible game sections | Scoring Summary (hidden by default), Box Score, Team Stats, Fantasy, Injuries — dropdowns with counts |
| Site character | Team-color gradient bars on cards/hero, yard-line hero texture, playful microcopy ("Scores are facts. The jokes are opinions.") |

## 🔄 In progress

| Feature | Notes |
|---|---|
| Mobile/PWA upgrade — implemented; device checks pending | Compiled Tailwind utilities and Lucide icons; content before ads; focused regression tests and public-asset deployment. Physical-device install and screen-reader checks remain. |

## 📋 Proposed upgrades and external follow-ups

Implementation priorities live in [docs/roadmap.md](docs/roadmap.md):

1. Reliability: coordinated season handling and broader data-fixture regression coverage.
2. Trust and usability: device/screen-reader verification, accessibility, reproducible content refresh.
3. Release quality: deployed update verification, search/share metadata, measured performance.

| Follow-up | Current evidence / next action |
|---|---|
| GitHub Pages and domain | Deployment workflow and `CNAME` are present; apex HTTPS and `www` redirect verified October 6, 2026. Domain cutover is no longer listed as pending. |
| Weekly recap scheduler | Earlier docs described `weekly-nfl-recaps` on Tuesdays; no scheduler exists in this repository. Locate and verify the external automation before changing or relying on it. |
| AdSense review | Earlier docs recorded a rejection/payment follow-up. Current account status is unverified; owner checks dashboard and live `/ads.txt`/privacy content before deciding next steps. |

## ⚠️ Standing decisions

- No self-hosted NFL video — outbound YouTube links only (rights).
- No Auto Ads — manual units only, one per page + desktop rails.
- Scores/stats are facts; ESPN endpoint + hotlinked logos carry ToS/licensing caveats, especially once ads serve.
