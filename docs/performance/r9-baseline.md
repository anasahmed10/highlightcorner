# R9 mobile performance baseline

Captured October 10, 2026 against the local static site before the R9 changes.
These are lab measurements, not field-user data.

## Method

- Chrome 155.0.8059.39, Lighthouse 13.5.0, desktop host using Lighthouse mobile emulation.
- Three cold-navigation runs per URL, each in a fresh Lighthouse Chrome session.
- Default Lighthouse mobile simulated network/CPU throttling; performance category only.
- Local server: `python3 -m http.server 8080` from the repository root.
- URLs: `/index.html` (Scores), `/game.html?id=401872980` (Game Center), and `/privacy.html` (Privacy).
- For each URL, run three times and take the median of FCP, LCP, TBT, and CLS. Count requests whose URL contains `googlesyndication.com/pagead/js/adsbygoogle.js` in Lighthouse's `network-requests` audit.
- The ESPN summary and AdSense responses are live third-party requests. Their timing/content can change between runs; compare medians and request counts under the same setup.

Example audit command (repeat three times per page, changing URL and output path):

```sh
npx --yes lighthouse 'http://localhost:8080/index.html' \
  --chrome-path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  --preset=perf --form-factor=mobile --throttling-method=simulate \
  --output=json --output-path=/tmp/hc-r9-report.json --quiet
```

## Before change

| Page | FCP runs (s) | LCP runs (s) | TBT runs (s) | CLS runs | Median CLS | AdSense requests (runs) |
|---|---|---|---|---|---:|---|
| Scores | 1.05, 1.05, 1.05 | 1.73, 1.73, 1.73 | 0.00, 0.00, 0.00 | 0.661, 0.524, 0.524 | 0.524 | 1, 1, 1 |
| Game Center | 1.05, 1.05, 1.05 | 2.19, 2.19, 2.19 | 0.01, 0.00, 0.00 | 0.497, 0.087, 0.087 | 0.087 | 1, 1, 1 |
| Privacy | 1.05, 1.05, 1.05 | 1.58, 1.58, 1.58 | 0.00, 0.00, 0.00 | 0.000, 0.000, 0.000 | 0.000 | 1, 1, 1 |

The raw JSON reports were written as `/tmp/hc-r9-before-{scores,game,privacy}-{1,2,3}.json`. Scores' leading shift came from `#games` expanding while its API data rendered (the audit attributed 0.524 CLS to `#games`). Game Center had one outlier CLS run (0.497); its other two runs were 0.087. Privacy consistently requested AdSense despite containing no ad unit.

## After change

Captured with the same Lighthouse version, Chrome, URLs, run count, and settings after the implementation. Scores was rerun after reverting a placeholder-count experiment that increased CLS.

| Page | FCP runs (s) | LCP runs (s) | TBT runs (s) | CLS runs | Median CLS | AdSense requests (runs) |
|---|---|---|---|---|---:|---|
| Scores | 1.05, 1.05, 1.05 | 1.73, 1.73, 1.73 | 0.00, 0.00, 0.00 | 0.524, 0.524, 0.661 | 0.524 | 1, 1, 1 |
| Game Center | 1.05, 1.05, 1.05 | 2.26, 2.26, 2.26 | 0.00, 0.00, 0.00 | 0.087, 0.087, 0.087 | 0.087 | 1, 1, 1 |
| Privacy | 1.05, 1.05, 1.05 | 1.65, 1.65, 1.65 | 0.00, 0.00, 0.00 | 0.000, 0.000, 0.000 | 0.000 | 0, 0, 0 |

The raw reports are `/tmp/hc-r9-after-{scores,game,privacy}-{1,2,3}.json` and `/tmp/hc-r9-after-scores-final-{1,2,3}.json` (the latter are the final Scores runs after reverting the experiment). The Privacy page no longer downloads AdSense's script (one request removed per navigation); ad-bearing pages still make one request. Scores' median CLS remains 0.524, attributed to the scoreboard results rendering into `#games`; this work records that measured follow-up rather than claiming it improved. FCP/TBT remained stable; Game Center LCP varied by 0.07s between the before/after medians.
