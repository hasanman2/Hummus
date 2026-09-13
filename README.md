# Hummus Workshop

A local-first recipe and business calculator, built with the existing plain JavaScript modules, HTML and CSS. No backend, accounts, runtime dependencies, API keys or saved business data are shipped with the app.

Live application: https://hummus-mauve.vercel.app/
Repository: https://github.com/hasanman2/Hummus

## Run and verify

Use Node.js 22 or later. Run `npm start` and open http://localhost:4173. Keep using the same hostname: localhost, 127.0.0.1 and the hosted site have separate browser storage. No installation is needed.

- `npm run check`: syntax/asset checks and 56 financial, recipe and persistence tests.
- `npm run build`: validate the authored static application in `dist`; there is no bundling step.

## Eight sections

1. **Overview**: monthly profit and cash, three founder-pay views, full cost/revenue allocations per packed and paid tub/kg and per batch.
2. **Recipe and batch yield**: existing recipe quantities and supplier conversions, measured or estimated loss, prepared yields, density, discarded process aids, ingredient VAT, aggregate or detailed costing.
3. **Packaging and production**: explicit 250/200/500/custom packages, aggregate or itemized packaging, overfill, kg/tub/batch driving volume, unsold stock and reconciled kg/tub mixes.
4. **Pricing and sales**: shelf-backwards or direct wholesale pricing, retailer margin and cap, separate direct consumer share, explicit fee bases and gross-to-realized revenue bridge.
5. **Our team and workload**: three founders, actual and target compensation, salary plus employer costs, owner drawings, optional hired staff, task allocations and required hours.
6. **Monthly expenses**: editable fixed/variable/capacity-step expenses, utility consumption drivers, categories and classifications, shared-kitchen and contract replacements.
7. **Equipment and startup funding**: aggregate/itemized purchases, assets/leases, depreciation, startup uses, payment terms, calculated or simple reserve, debt/equity, interest, principal, tax and cash movements.
8. **Break-even and scenarios**: cash/accounting break-even for every pay view, profit and margin targets, retailer plans, bottlenecks, profit chart and saved scenario/package comparisons.

Custom ingredient, packaging item, expense, fee, founder, staff, task, equipment and capacity rows can be added, duplicated, disabled or deleted. Changes recalculate immediately. Numeric editing retains the active DOM input so decimal entry and the caret are not disrupted.

## Starting assumptions

New scenarios use the workshop aggregate ingredient fallback of EUR 2.2558 per finished kg. Workshop recipe quantities, actual batch output, founder hours, target compensation and equipment capacities were not supplied and remain unknown. Existing recipe inputs are retained.

The original 250 g package uses the older EUR 0.24 packaging assumption. The explicit 200 g alternative uses EUR 0.35 (scope needs confirmation), and 500 g uses EUR 0.33. New scenarios use a EUR 2.30 shelf cap, 7% VAT assumption and 30% retailer gross margin. Migrated recipes retain their prior margin and price settings, including 35% where saved.

The workshop operating reference is EUR 4,460 fixed plus EUR 0.64 per packed kg, or EUR 6,380 at 3,000 kg. Startup funding totals EUR 149,425 with the supplied aggregate budget and simple reserve. Actual founder pay starts at zero. The EUR 10,843.75 payroll is used only in the historical staff preset.

## Calculation conventions

- Blank means unknown; 0 is an explicit zero; disabled rows are excluded. Unknown values propagate to affected results. Financial, production, workload and startup completeness are reported separately.
- Mass/volume conversion requires density. Measured finished yield already includes process loss. Generic prepared yield means prepared kg per purchased kg; chickpea dry/cooked conversion remains available.
- Aggregate ingredients replace detailed recipe costs. Aggregate packaging replaces itemized packaging. Contract inclusions replace the corresponding ingredient/packaging category. Replaced expense rows are excluded, not duplicated.
- Monthly quantities are proportional planning estimates and can be fractional. Batch count is also shown rounded up for scheduling; surplus from a rounded-up batch is not silently added to costs. Actual fill includes overfill; paid fraction is applied after packing. All packed output incurs ingredient and packaging costs.
- Wholesale = shelf including VAT / (1 + VAT) × (1 − retailer margin). Margin is on sales, not markup. Each package has its own shelf/wholesale settings. The common retail cap is a comparison, not a guarantee of the retailer's price.
- Fees apply independently to gross revenue of the selected channel, or per paid channel tub. They are modeled as reductions in taxable consideration. Separately invoiced channel services belong in expenses. Returns are already included in the unsold/credited allowance.
- Purchase prices are entered before VAT. Nonrecoverable purchase VAT increases cost; recoverable VAT does not. Sales VAT is shown separately from profit. Working capital uses net-of-recoverable-VAT values and does not model VAT settlement timing.
- Contribution deducts variable costs, including current capacity-step charges. Manufacturing cost includes manufacturing costs of all packed output, manufacturing payroll/allocated founder pay, and depreciation. Full cost adds administration, sales and distribution. Shared fixed-cost allocations are averages, not marginal costs.
- Actual founder compensation can be a total cost, gross salary plus employer costs, or drawings. Drawings affect cash only. Target pay replaces actual founder expense; unpaid work value is informational. Hired staff costs do not silently increase founder capacity; adjust task ownership and measured capacity explicitly.
- Purchased equipment depreciates over its useful life, net of residual value. Aggregate and itemized purchase budgets are exclusive; selected lease commitments remain operating expenses. Asset depreciation covers equipment; add capitalized fit-out as an asset and remove the duplicate startup amount if needed. The historical EUR 708.333333 monthly depreciation override is explicitly labeled for reconciliation.
- Opening inventory is a startup funding use; its consumption is already included in monthly costs. Calculated reserve = max(0, receivables + inventory − supplier credit − opening stock already budgeted), replacing the simple reserve.
- EBIT excludes financing. Profit before tax deducts interest. Illustrative tax never creates a benefit on losses. Cash remaining deducts tax, interest, principal, monthly investment, working-capital increases and drawings. Startup loan/equity amounts are funding sources, not monthly revenue.
- Linear break-even uses paid fraction × realized price minus variable cost per packed tub. Capacity-step break-even solves each affine interval against the actual cost function, within the editable search maximum. The solver bounds the number of intervals to keep editing responsive. Required volumes above known capacity are labeled unattainable; missing capacity measurements remain unknown.
- Profit and margin targets must both be met, so required EBIT is the larger of target profit and target margin × revenue. Retailer plans use wholesale paid tubs and 52/12 weeks per month.
- Only display values are rounded. The reconciliation EBIT is EUR 2,335.855452..., displayed as EUR 2,335.86. With historical payroll it is EUR -8,507.894548..., displayed as EUR -8,507.89. These differ by less than one cent from the prompt's approximate figures.

## Saving, migration and exports

The version-2 workspace saves to `hummus-workshop-v2`. On first use, a version-1 workspace is validated and migrated, preserving IDs, names, recipe quantities, purchase inputs, pricing and active cost selections. The original `hummus-workshop-v1` browser entry remains untouched. Inactive old monthly salary/utility values are not activated over batch costs; legacy fields remain in each migrated scenario for recovery.

Named presets create new scenarios. Duplicate makes an independent copy. Reset business assumptions first saves an archival copy and retains recipe quantities. JSON import validates the schema and appends independent copies, preserving existing scenarios. Both v1 and v2 backups are accepted, with limits of 100 scenarios, 100 rows per collection and 20 MB per imported file. Unknown schema versions or malformed input are rejected.

JSON is the complete backup format. CSV includes all saved input paths and business output paths; unknown values are labeled INCOMPLETE and formula-like text is escaped. Both exports provide a download link and copyable text. Print summary opens a readable review, then Print / Save PDF opens the browser's print dialog. Data remains local; optional Google Fonts requests provide typography only.

## Deployment

The existing GitHub-to-Vercel workflow uses production branch `master`. `vercel.json` selects the Other framework preset, skips dependency installation, runs `npm run check && npm run build`, and publishes `dist`. No environment variables, server runtime, rewrites or DNS changes are needed for this update. Subsequent authorized pushes use the same workflow.
