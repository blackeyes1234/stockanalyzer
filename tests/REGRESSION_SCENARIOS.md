# Regression test scenarios (checklist)

Use this when you add features or before releases. Automated coverage lives under `tests/` (`npm run test:run`). Items below include cases worth automating over time or validating manually.

## Server actions (`search-ticker`)

- Empty / whitespace-only input returns a clear validation error (no Yahoo call).
- Input longer than the configured max returns a validation error.
- Valid ticker-shaped strings use `quote()` only (no `search()`).
- Strings that are **not** ticker-shaped (spaces, unicode, symbols outside the allowed set) use `search()` then `quote()` on the first match.
- `quote()` success maps `longName` / `shortName` / `symbol` correctly.
- `quote()` failure returns the generic “not found” style message.
- `search()` with no usable Yahoo quotes returns the “no matches” message.
- `search()` throws are handled (no uncaught exceptions; user-safe error).
- `suggestTickers`: length &lt; 2 and &gt; max return empty suggestions without calling Yahoo.
- `suggestTickers`: maps EQUITY/ETF preference and falls back when the filtered list is empty.
- `suggestTickers`: Yahoo errors yield an empty list (autocomplete stays quiet).

## `TickerSearch` UI

- Placeholder, combobox role, and Search button are present and labeled for screen readers.
- Submitting with an empty field shows the validation alert and does not call `searchTicker`.
- Successful search shows ticker + company in the result card; failed search shows a red alert.
- Debounced autocomplete: no request before the delay; request fires with the current query after the delay.
- While a search is in flight, the submit control shows a pending state (e.g. “Searching…”) and is disabled.
- Suggestion list: open/close, mouse selection, keyboard (arrows, Enter, Escape) — add tests as behavior stabilizes.
- Global keyboard routing: typing when focus is outside the input still fills the search field (and does not steal keys from other inputs/textareas).
- Replace-after-search: after a completed search, the next printable key replaces the field immediately (no stale text lag).
- Dark mode / contrast: visual checks if you change `globals.css` or Tailwind tokens.

## Page shell

- Home page renders `TickerSearch` and expected headings.
- Root layout metadata (title, description) matches product naming.

## Cross-cutting / future E2E

- **End-to-end (Playwright/Cypress)**: optional smoke against `next start` — happy path AAPL, network failure, rate limits (flaky; prefer mocked API in CI).
- **Accessibility**: axe-core or Lighthouse on `/` after meaningful UI changes.
- **Performance**: bundle size or Core Web Vitals budgets if you add heavy charts or data grids.
- **Security**: ensure server actions never log secrets; validate/sanitize any new user inputs passed to external APIs.

## Data / backtesting features (when you add them)

- Historical range validation, timezone handling, and CSV/export correctness.
- Backtest results reproducibility (same inputs → same outputs) where deterministic.
- Large payloads: pagination or virtualization does not lock the main thread.
