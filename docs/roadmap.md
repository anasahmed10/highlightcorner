# Highlight Corner upgrade roadmap

Baseline: redesigned static site, October 6, 2026. All items below are **proposed**;
none is implemented by adding this document. Priorities reflect source inspection,
not traffic analytics or a promise of delivery dates. Follow the stages in order;
within each stage, use the listed order unless the user's priorities change.

The goal is a dependable weekly NFL destination that keeps its fast mobile
experience, original recaps, and simple hosting. Preserve static hosting wherever
practical. Accounts, a backend, hosted NFL video, paid data feeds, and a framework
migration are outside this roadmap unless separately requested.

## Stage 1: make the current experience dependable

| ID / upgrade | Why now and intended change | Acceptance criteria |
| --- | --- | --- |
| R1 — Coordinated season/week selection | Fantasy hardcodes 2026 while ESPN uses its default season, and week 4 fallbacks appear in several scripts. Introduce one shared season/week context, align provider requests, and handle unavailable weeks explicitly. Start with current regular-season behavior; do not claim postseason support until both providers are verified. | Scoreboard, highlights, fantasy and game links agree on selected season/week; rollover and offseason examples are checked; missing provider data is labeled honestly. Recap storage/readers distinguish seasons before retaining overlapping week archives. Existing game URLs still load. |
| R2 — Resilient loading and rendering | Week-selector initialization can reject outside page loading catches; fetches have no timeout; rapid switches can render an older response last. Add recoverable initialization, bounded requests, retry controls, and stale-response protection. Theme-only updates should avoid unnecessary refetches. | Blocked API/JSON, empty results, slow replies and rapid week/format/theme changes leave usable controls and resolve loading states. The most recent selection wins; optional recap/logo failures do not take down usable sports content. |
| R3 — Meaningful regression checks | There is currently no automated suite or CI validation. Add a small fixture-based suite for data normalization, context selection, preferences and the failure/race behavior introduced above, plus page-level smoke checks. | Checks run locally and in CI without live providers or ad services. Cases include missing competitors, pre/live/post states, storage failures, and out-of-order responses. A real regression fails a check; source/data checks run before deployment. Document the commands and any tooling added. |

R1 and R2 should include focused checks as they ship; R3 makes those checks
repeatable and expands page coverage. Do not defer verification until R3.

## Stage 2: improve trust and accessibility

| ID / upgrade | Intended change | Acceptance criteria |
| --- | --- | --- |
| R4 — Comprehensive spoiler protection | Expand the existing score blur into an explicit outcome-hiding experience across scores, winner cues, featured picks, verdicts, recaps and game stats. Keep matchup, kickoff, navigation and highlight access useful. | With protection on, outcomes are absent from visible content and accessible names/text until intentionally revealed. Navigation/reload preserves the preference; turning it off restores content. Check every sports page with completed and live fixtures. |
| R5 — Accessible controls and responsive polish | Audit keyboard order, game tabs, sortable headings, toggle states, focus visibility, touch targets and motion. Address mobile header/filter crowding and long content without altering the redesign's character. | Sorting and tabs work by keyboard with appropriate state announcements; new/current controls have usable names and focus; selected mobile/desktop layouts have no page overflow. Reduced-motion behavior includes scripted scrolling. Perform manual keyboard and screen-reader checks in addition to automated checks. |
| R6 — Reliable content refresh | Add a reproducible player-map refresh and a validated recap-preparation workflow; establish where the externally described scheduler actually runs. Keep publishing deliberate and original editorial review in the process. | Documented commands produce compatible player mappings and supporting recap data. Validate IDs, scores, season/week and verdicts; incomplete/upstream-delayed games are skipped or flagged. Retain other weeks, show source attribution, and document the verified scheduler or explicitly record that no scheduler exists. Never publish invented stats or raw supporting-tool output as recaps. |

## Stage 3: improve release and discovery quality

| ID / upgrade | Intended change | Acceptance criteria |
| --- | --- | --- |
| R7 — Controlled publishing and offline behavior | Publish an explicit site-asset artifact instead of the entire repository. Check worker response caching, cache ownership and failed/offline navigation behavior while preserving commit-based shell updates. | Public pages/assets and `ads.txt` remain available; agent docs, tools and development files are excluded from the deployment artifact. Failed responses do not poison caches; unrelated caches are preserved. Warm-cache offline and new-release updates pass browser checks. |
| R8 — Search and share quality | Review generic game-page metadata, canonical behavior, useful matchup links, sitemap entries and content discoverability. Decide whether static per-game pages are warranted before adding generation tooling. | Shared links identify the intended matchup in a crawler-visible response, not only a JavaScript-updated title. Canonicals and sitemap match valid public content; missing IDs do not masquerade as useful game content. Document the chosen approach and verify with fetched HTML plus browser checks. |
| R9 — Measured performance and ad quality | Establish mobile performance and layout-shift baselines, examine repeated data requests and ad initialization, then target measured bottlenecks. Keep manual advertising from obstructing sports content. | Record repeatable before/after measurements on representative pages. Repeated render/theme actions do not duplicate ad setup or requests unnecessarily; blocked/empty ads remain usable. Any new tracking or consent behavior has an explicit product decision and matching privacy documentation. |

R7 can follow Stage 1 sooner if publishing hygiene becomes a priority. R8 may
require build-time generation; evaluate that as a separate implementation decision
rather than committing this site to a new framework now.

## How agents use this roadmap

1. Work on the item the user requests; use priority order when asked to recommend
   the next upgrade. Do not treat this document as standing authorization to ship.
2. Recheck the source first. Convert the selected item into a bounded plan with
   affected behavior, compatibility needs and relevant acceptance checks.
3. Record status as `proposed`, `in progress`, `blocked` (with a concrete dependency),
   or `shipped`. Add implementation/review references when available.
4. Mark shipped only when its acceptance criteria are verified. Update the agent
   guide and feature dashboard so later agents see the actual implementation.
5. Revisit priorities using owner feedback and measured failures. Keep timelines
   unset until someone explicitly commits to them.

## October 6 mobile/PWA upgrade status

Implementation is available in the repository. These changes cover parts of the roadmap,
not every acceptance criterion:

- **R2 — in progress:** 12-second request bound, week-discovery recovery, retry
  on scores/highlights/fantasy, stale-response guards, and cached theme rendering.
  Broader failure/race fixtures remain.
- **R3 — in progress:** focused DOM and worker tests run locally and in Pages CI.
  Full normalization/context/provider fixtures and browser smoke automation remain.
- **R4 — in progress:** native hidden outcomes and safe matchup links replace
  blur across sports pages. Browser accessibility-tree checks performed; manual
  screen-reader checks and full live/pregame fixture coverage remain.
- **R5 — in progress:** bottom tabs, modal settings, touch targets, focus states,
  keyboard fantasy sorting, reduced-motion scrolling, safe areas, and layout
  checks added. Full screen-reader and game-tab audit remain.
- **R7 — in progress:** explicit public-asset artifact, successful-response-only
  caching, cache ownership, offline query-bearing game navigation. Production
  release/update and physical-device checks remain before marking shipped.
