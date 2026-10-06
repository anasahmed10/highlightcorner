# Highlight Corner — Feature Dashboard

Living tracker for the standalone site (`~/workspace/highlightcorner/`). Updated as work ships.
Target domain: `highlightcorner.com` (currently serves the older Codex build — cutover needs Anas's go-ahead).

## ✅ Shipped

| Feature | Notes |
|---|---|
| Weekly scoreboard | Live ESPN data, defaults to current week, viewer-local times |
| Game highlights | One-tap YouTube deep links per game; featured highest-scoring game |
| Fantasy leaders | PPR / half-PPR / standard, via Sleeper |
| Recap show more (game page) | Recap body clamps to 3 lines with Show more/less on mobile so the box score sits higher; full text on desktop |
| Comedic recaps | Kempski-style + League seasoning, ~150 words, verdicts (nail-biter, comfortable, garbage-time, blowout); Week 4 done |
| Game center pages | Scoring summary → tabbed box score → team stats → fantasy → tabbed injuries → recap; prev/next game nav |
| Spoiler-free mode | Persisted toggle |
| Favorites + watched | Team favorites w/ filter; watched/unwatched tracking w/ filter |
| Team colors | Logo-derived, matchup-aware, readable in light/dark |
| Mobile-first UI | Centered Watch-highlights CTA, 44px+ touch targets |
| AdSense | In-flow units + desktop side rails (≥1280px); privacy page; `ads.txt` |
| SEO basics | Meta/OG/canonical, sitemap.xml, robots.txt, favicon, 404 page |
| PWA | Manifest, icons, service worker, iOS meta — Add to Home Screen, no app store |
| Weekly recap automation | Cron `weekly-nfl-recaps`, Tuesdays ~8am ET; writes `data/recaps.json` |
| Dashboard artifact recap port | All 16 longer recaps installed; its weekly refresh now uses the same style |
| Copy-link buttons | Highlights cards (copies YouTube link) + game pages (copies game URL), with "Copied ✓" feedback |
| Sortable fantasy tables | Top 25 per position; sort by Player or Pts; position dropdown filter (instant, no reload) |
| UI polish | Skeleton shimmer loading, card entrance motion, tactile press states, pulsing LIVE dot, sticky filter bar, loser dimming, scroll-to-top, smooth theme transitions (all respect reduced-motion) |
| Collapsible game sections | Scoring Summary (hidden by default), Box Score, Team Stats, Fantasy, Injuries — dropdowns with counts |
| Site character | Team-color gradient bars on cards/hero, yard-line hero texture, playful microcopy ("Scores are facts. The jokes are opinions.") |

## 🔄 In progress

| Feature | Notes |
|---|---|
| — | Nothing currently building |

## 📋 Planned / waiting on Anas

| Feature | Notes |
|---|---|
| Permanent deploy + domain cutover | ✅ Migrated to GitHub Actions → GitHub Pages 2026-10-06 (repo `anasahmed10/highlightcorner`, live at `anasahmed10.github.io/highlightcorner`). Remaining: Anas points `highlightcorner.com` DNS at GitHub Pages (apex A records `185.199.108.153` / `.109` / `.110` / `.111`, or `www` CNAME to `anasahmed10.github.io`) — TLS is automatic |
| AdSense re-review | Needs: site live on domain → confirm `/ads.txt` → Anas adds payment info → request review |

## ⚠️ Standing decisions

- No self-hosted NFL video — outbound YouTube links only (rights).
- No Auto Ads — manual units only, one per page + desktop rails.
- Scores/stats are facts; ESPN endpoint + hotlinked logos carry ToS/licensing caveats, especially once ads serve.
