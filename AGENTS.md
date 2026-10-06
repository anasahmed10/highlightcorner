# Highlight Corner: agent instructions

Highlight Corner is a mobile-first NFL site for scores, outbound YouTube
highlights, fantasy leaders, original humorous recaps, and game centers.
These instructions apply throughout this repository, regardless of agent model.

## Start here

1. Read [README.md](README.md) for setup and current capabilities.
2. Read [docs/agent-guide.md](docs/agent-guide.md) for the subsystem you will change.
3. Consult [FEATURES.md](FEATURES.md) for shipped work and
   [docs/roadmap.md](docs/roadmap.md) for proposed upgrades. Roadmap items are
   proposals, not instructions to implement everything.
4. Inspect the relevant source and working-tree changes before editing. Preserve
   unrelated work and keep the change focused on the user's request.

## Architecture and local preview

- Plain static HTML, shared `css/style.css`, and browser JavaScript. No bundler,
  package manifest, application backend, or automated test suite exists today.
- Run `python3 -m http.server 8080` from the repository root; open
  `http://localhost:8080`. Do not preview through `file://`.
- `js/app.js` defines `window.HC`; load it before `js/ads.js` and page scripts.
  Page scripts use strict-mode IIFEs, shared helpers, and existing DOM hooks.
- ESPN provides scores/game summaries; Sleeper provides weekly fantasy stats.
  Recaps and the player-name map live in `data/`. Requests run in the browser.

## Rules for changes

- Preserve the existing static architecture for routine work. Add dependencies,
  a framework, or a backend only when the requested work justifies them.
- Preserve mobile usability, light/dark themes, keyboard access, reduced motion,
  viewer-local labeled times, and persisted favorites/watched/spoiler settings.
- Use shared CSS variables and `HC` helpers. Escape external text with `HC.esc`
  when interpolating HTML; do not treat provider or recap text as trusted markup.
- Highlights are outbound YouTube search links, not hosted videos. Advertising
  uses manual units, not Auto Ads. Preserve privacy links, `ads.txt`, and SEO/PWA assets.
- Season handling is not automatic everywhere: fantasy hardcodes 2026, and
  several week fallbacks are 4. Check these when changing time/data selection.
- Keep `__BUILD_ID__` in the source service worker. The Pages workflow substitutes
  the commit SHA at deployment. New shell assets may need `APP_SHELL` updates.

## Verify and report

- Follow the guide's task-based checks. Check affected pages in the browser;
  shared UI/core changes require checking all consumers.
- Use `git diff --check`; parse changed JSON; syntax-check changed JavaScript
  with `node --check` when Node is available. These do not replace browser checks.
- Update the guide when architecture/workflows change, `FEATURES.md` when work
  ships, and roadmap status when an upgrade's acceptance criteria are met.
- Report what changed, what was checked, and any checks unavailable or failing.
  Do not claim tests passed when they were not run.
- A push to `main` triggers production deployment. Commit, push, or publish only
  within the user's authorized scope. Do not change DNS or external account
  settings as part of an ordinary code edit.
