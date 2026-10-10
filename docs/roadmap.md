# Highlight Corner upgrade roadmap

Checked against `main` and GitHub roadmap issues on October 9, 2026. This is a
status and acceptance tracker, not standing authorization to implement proposals.
Priorities reflect source inspection and outstanding checks, not traffic analytics
or delivery dates. Complete the remaining Stage 2 checks, then Stage 3; R10 is
separate product discovery and does not require a backend migration now.

The goal is a dependable weekly NFL destination with a fast mobile experience,
original recaps and simple hosting. Keep the current static architecture for
maintenance. Accounts, community and paid access are proposed in R10; hosted NFL
video and a framework migration remain outside the agreed implementation scope.

## Current status

| Upgrade | Status | Evidence and remaining work |
| --- | --- | --- |
| R1 — Season/week context | Shipped | [PR #21](https://github.com/anasahmed10/highlightcorner/pull/21), [issue #2](https://github.com/anasahmed10/highlightcorner/issues/2) closed; explicit regular-season requests, rollover/fallback fixtures and season-tagged recaps. Postseason data is unsupported. |
| R2 — Resilient loading | Shipped | [PR #26](https://github.com/anasahmed10/highlightcorner/pull/26), [issue #3](https://github.com/anasahmed10/highlightcorner/issues/3) closed; retries, bounded requests, stale-response guards, optional-data isolation and labeled retained live updates. Failure/race fixtures and browser recovery checks recorded. |
| R3 — Regression checks | Shipped | [PR #20](https://github.com/anasahmed10/highlightcorner/pull/20), [issue #4](https://github.com/anasahmed10/highlightcorner/issues/4) closed; fixture page smoke, data/source, race, storage and worker checks run in CI. Later changes extend the suite; jsdom does not verify layout or spoken output. |
| R4 — Spoiler protection | In progress | [Issue #5](https://github.com/anasahmed10/highlightcorner/issues/5); hidden outcomes/placeholders now cover fantasy rankings and missing-highlight completion cues. Fixture checks and browser accessibility-tree checks cover pre/live/final states and saved preference. A spoken screen-reader pass remains before closing the issue. |
| R5 — Accessible controls | In progress | [PR #27](https://github.com/anasahmed10/highlightcorner/pull/27), [issue #6](https://github.com/anasahmed10/highlightcorner/issues/6); game tabs, focus restoration, pressed states and sort announcements implemented. Browser keyboard/layout checks recorded at 320/390/768/1440px. VoiceOver spoken output could not be observed; human screen-reader verification remains. |
| R6 — Content refresh | Shipped | [PR #22](https://github.com/anasahmed10/highlightcorner/pull/22), hardened/reverified in [PR #28](https://github.com/anasahmed10/highlightcorner/pull/28); [issue #7](https://github.com/anasahmed10/highlightcorner/issues/7) closed. Player refresh and sourced recap preparation are reproducible; prose/publishing remain editorial and manual. No recap scheduler found in repository/local Codex definitions on October 9. |
| R7 — Publishing/offline | Shipped | [PR #43](https://github.com/anasahmed10/highlightcorner/pull/43), [issue #8](https://github.com/anasahmed10/highlightcorner/issues/8); explicit public artifact, cache ownership, successful-response caching and offline fallbacks verified. Local browser checks found and fixed stale shell preloading. The October 10 Pages release and live assets were checked; the owner confirmed home-screen installation and offline launch on a physical phone. |
| R8 — Search/share | Shipped | [PR #25](https://github.com/anasahmed10/highlightcorner/pull/25), [issue #9](https://github.com/anasahmed10/highlightcorner/issues/9) closed; scheduled regular-season matchup HTML, canonicals and sitemap; noindex legacy fallback. Published recaps are added to initial matchup HTML and a crawlable recap index on the next build. |
| R9 — Performance/ad quality | Shipped | [Issue #10](https://github.com/anasahmed10/highlightcorner/issues/10); repeatable mobile Lighthouse before/after runs and ad lifecycle checks are documented in [`performance/r9-baseline.md`](performance/r9-baseline.md). Privacy/404 skip the provider script; a measured scoreboard CLS follow-up is recorded. Revenue evidence remains external and requires ads to serve. |
| R10 — Accounts/community/paid access | Proposed discovery | [Issue #14](https://github.com/anasahmed10/highlightcorner/issues/14); define product, rights, privacy, moderation, architecture and costs before implementation. |

Shipped implementation does not imply broader device coverage, full
screen-reader coverage, provider uptime, or external account approval. Keep those
limits visible in the feature dashboard and maintenance guide.

## Stage 1: make the current experience dependable

| ID / upgrade | Why now and intended change | Acceptance criteria |
| --- | --- | --- |
| R1 — Coordinated season/week selection | Shared ESPN-discovered regular-season context now drives the score, highlight and fantasy pages. Season and week travel in navigation/game links, and recaps carry season IDs. Postseason and offseason stay on the latest regular week; preseason starts from the last completed season. | Scoreboard, highlights, fantasy and game links agree on selected season/week; rollover and offseason examples are checked; missing provider data is labeled honestly. Recap storage/readers distinguish seasons before retaining overlapping week archives. Existing game URLs still load. |
| R2 — Resilient loading and rendering | Implemented: bounded fetches, recoverable discovery, retries on every data page, stale-response guards, pending fantasy-filter protection and optional recap/highlight isolation. Failed live updates retain a labeled last-successful view; themes reuse loaded data. | Blocked API/JSON, empty results, slow replies and rapid week/format/theme changes leave usable controls and resolve loading states. The most recent selection wins; optional recap/logo failures do not take down usable sports content. |
| R3 — Meaningful regression checks | Implemented: provider fixtures, all seven source-page smoke checks, normalization/context/preferences, failure/race behavior and source/data contracts. Strict TypeScript compilation and generated-JavaScript comparison run before the JavaScript and Python checks in `npm test`; browser/device checks remain separate. | Checks run locally and in CI without live providers or ad services. Cases include missing competitors, pre/live/post states, storage failures, and out-of-order responses. A real regression fails a check; source/data checks run before deployment. Document the commands and any tooling added. |

R1–R3 are shipped. Maintain their focused checks when changing providers,
selection or loading behavior; do not replace browser verification with jsdom.

## Stage 2: improve trust and accessibility

| ID / upgrade | Intended change | Acceptance criteria |
| --- | --- | --- |
| R4 — Comprehensive spoiler protection | The site now uses native hidden outcome elements and safe placeholders across sports pages. Finish coverage for any remaining outcome cues while keeping matchup, kickoff, navigation and highlight access useful. | With protection on, outcomes are absent from visible content and accessible names/text until intentionally revealed. Navigation/reload preserves the preference; turning it off restores content. Check every sports page with completed and live fixtures. |
| R5 — Accessible controls and responsive polish | Audit keyboard order, game tabs, sortable headings, toggle states, focus visibility, touch targets and motion. Address mobile header/filter crowding and long content without altering the redesign's character. | Sorting and tabs work by keyboard with appropriate state announcements; new/current controls have usable names and focus; selected mobile/desktop layouts have no page overflow. Reduced-motion behavior includes scripted scrolling. Perform manual keyboard and screen-reader checks in addition to automated checks. |
| R6 — Reliable content refresh | Reproducible player-map refresh and validated recap-preparation workflow. Reverified and hardened October 9, 2026: final summary teams/status, global recap IDs, player values and protected editorial output paths. No recap scheduler found in repository or local Codex automations; editorial publishing remains manual. | Documented commands produce compatible player mappings and supporting recap data. Validate IDs, scores, season/week and verdicts; incomplete/upstream-delayed games are skipped or flagged. Retain other weeks, show source attribution, and document the verified scheduler or explicitly record that no scheduler exists. Never publish invented stats or raw supporting-tool output as recaps. |

## Stage 3: improve release and discovery quality

| ID / upgrade | Intended change | Acceptance criteria |
| --- | --- | --- |
| R7 — Controlled publishing and offline behavior | Shipped. The explicit public artifact, cache ownership, successful-response-only caching and release-specific shell preloading are implemented. Local browser checks covered warm-cache offline pages, generated game fallback, unknown-page recovery and fresh shell content after update. The October 10 Pages release and live assets passed verification; the owner confirmed installation and offline launch on a physical phone. | Public pages/assets and `ads.txt` remain available; agent docs, tools and development files are excluded from the deployment artifact. Failed responses do not poison caches; unrelated caches are preserved. Warm-cache offline and new-release updates pass browser checks. |
| R8 — Search and share quality | Scheduled Pages builds generate regular-season matchup HTML from 2026 through the current year and probe the next season, with canonical URLs and sitemap entries. Published recaps also appear in initial game HTML and the recap index; legacy query links remain usable and noindex. | Shared links identify the intended matchup and any published recap in a crawler-visible response. Future games appear automatically once ESPN lists them; canonicals and sitemap match valid public content. Verify fetched HTML and browser behavior. |
| R9 — Measured performance and ad quality | Shipped October 10, 2026. Repeatable mobile Lighthouse baselines cover Scores, Game Center and Privacy. AdSense is loaded once only when an eligible manual unit exists; blocked and unfilled units collapse without affecting content. The Privacy page removed one unnecessary provider request per navigation. No tracking or consent behavior changed. | Before/after runs and the remaining scoreboard CLS follow-up are documented in [`performance/r9-baseline.md`](performance/r9-baseline.md). Automated checks cover idempotent setup, blocked units and pages without ads. |

## Stage 4: scope accounts, community and paid access

R10 is a discovery proposal from [issue #14](https://github.com/anasahmed10/highlightcorner/issues/14).
No accounts, comments, billing or paid entitlements are implemented.

| ID / upgrade | Intended change | Acceptance criteria |
| --- | --- | --- |
| R10 — Accounts, community comments and paid data access | Define a narrow account/community product for recap and game discussions, and identify the original or licensed data/features offered for payment. Choose authentication, backend/storage, account recovery, moderation and billing only after the product decisions. | A product brief defines free/paid value and resolves what “sell data” means. Verify commercial/redistribution rights before pricing or launch. Document account/billing security, retention/export/deletion, privacy, spoiler-aware comments, reporting/moderation, rate limits, costs and phased launch criteria. Product and data-rights decisions must be approved before implementation is considered shipped. |

The proposed phases are product/rights decisions, architecture/operations,
community MVP, then paid entitlements. Selling personal data is not an assumed
part of the proposal; any such direction requires an explicit owner decision,
disclosure/consent and legal review as specified in the issue.

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
