# Verification — 13 September 2026

## Automated checks

- `npm.cmd run check`: JavaScript syntax checks and all 27 tests passed.
- `npm.cmd run build`: static entrypoint and referenced asset checks passed.
- Test coverage includes density-dependent conversions; separate dry/cooked densities; measured yield versus process loss; chickpea purchasing requirements; full tubs and leftovers; unsold stock; VAT and retailer sales margin; actual wholesale pricing; unknown versus zero prices; batch/monthly cost allocation; both monthly volume drivers; zero/negative-contribution break-even; local persistence; duplication; backup validation; and CSV escaping.

## Browser checks

Verified in the Codex in-app browser against the local application:

- Live target edits recalculated quantities and costs.
- A duplicated recipe retained its own settings after rename and reload.
- A 10.1 kg batch at 250 g produced 40 full tubs, 0.1 kg leftovers, and 38 expected paid tubs at 5% unsold stock.
- €2.30 including 7% VAT and 35% retailer margin produced maximum wholesale of €1.40 (display rounded).
- Switching to actual wholesale changed revenue and monthly operating results.
- Batch labor and overhead allocation disabled corresponding monthly inputs.
- All five sections were checked at 320 px; recipe and monthly layouts were also visually inspected at 390 px. No page-wide horizontal overflow remained. Wide data tables and section navigation scroll within their own containers.
- Desktop recipe and printable-summary layouts were visually inspected at 1440 px.
- Blank recipes preserved missing quantities and yield, and showed validation guidance.
- Adding, renaming and removing an ingredient worked.
- JSON import added a recipe with the expected name and target while preserving existing recipes.
- CSV export text included the active recipe and calculation columns; JSON export text parsed successfully and included all saved recipes.
- Optional WebMCP read and target-change tools registered. A positive target updated visible state; a negative target was rejected without changing the existing target.
- No application errors or warnings appeared in captured browser logs.

## Verification limits

The embedded browser did not report a completed native file download to the automation API. CSV/JSON contents were verified in the export dialog, which includes selectable text as a fallback. The printable summary was visually reviewed, but native print/PDF output was not captured. These native browser actions should be smoke-tested in the browser used for production.

There was no public deployment, DNS change, live supplier-price verification or confirmation of tax applicability. Example values remain illustrative. See README.md for operating assumptions and deployment/domain steps.
