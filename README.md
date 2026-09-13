# Hummus Workshop

A working, local-first recipe, production-cost and profitability calculator. No accounts, backend, database, runtime packages, or API keys are required. The interface uses plain JavaScript modules, semantic HTML and CSS; calculation and persistence code are separate from the interface.

## Run locally

Use Node.js 22 or later. From this folder:

```powershell
npm.cmd start
```

Open http://localhost:4173 in a browser. On macOS/Linux use `npm start`. No installation step is needed. Keep the terminal running; stop with Ctrl+C. Use an HTTP server instead of double-clicking index.html because the app uses JavaScript modules. Keep using the same hostname, since `localhost` and `127.0.0.1` have separate browser storage.

```powershell
npm.cmd run check
npm.cmd run build
```

`check` performs JavaScript syntax checks and 27 focused Node tests. `build` validates the authored static files and their entrypoint references; there is no compilation or bundling step. The complete deployable application is the `dist` directory. No secrets or saved recipes are included in those files.

## Use the calculator

1. Start with the clearly marked example or choose **Blank recipe**. Blank recipes include editable starter ingredient names, but no ingredient quantities, densities, prices, yield or expense assumptions. VAT (7%), retailer margin (35%), shelf ceiling (€2.30) and tub size (250 g) remain visible editable initial settings.
2. Enter the reference recipe and either its measured finished usable yield or an explicit process-loss percentage. Enter the target finished weight in kg. Ingredient input weight is shown separately.
3. Enter supplier pack sizes, units and prices. A blank price remains unknown; enter zero for an actual free ingredient. Keep costs on a consistent basis, excluding recoverable VAT by default.
4. Enable **Production** when packaging, labor, unsold stock and per-tub economics are useful. Open **Pricing** to use either the consumer ceiling or an actual wholesale quote as the active revenue driver.
5. Enable **Monthly business** independently. Choose one volume driver and enter the business expenses. Select labor and production overhead allocation in Production; the corresponding monthly or batch fields are disabled to prevent double counting.

Edits autosave. **Save recipe** also explicitly saves the current scenario. All settings belong to their recipe, and duplication creates an independent scenario. Example-derived recipes retain their example label; begin from Blank recipe for a formulation based entirely on your own measurements.

## Calculation conventions

- Input mass is calculated in kg. Volumes require an explicit kg/L density when mass is needed; converting ml to L alone does not require a density.
- Measured scaling factor = target finished kg / measured finished reference kg. Saved process loss is inactive in this mode.
- Loss-mode reference yield = input kg × (1 − loss fraction). Saved measured yield is inactive in this mode. No implicit 3% loss exists.
- Chickpeas entered dry are cooked before blending. Their input mass expands by the entered cooked/drained-to-dry factor. Cooked quantities purchased dry are divided by that factor for purchasing. Absorbed cooking water is already in cooked mass; the water ingredient is additional blending water. Different recipe/purchase forms use a separate purchase density when the purchase is volumetric.
- Full tubs are rounded down. Leftovers receive no revenue, keep their ingredient/production costs, and receive no packaging allocation. Carton expense is entered as a cost allocation per packed tub.
- Unsold/credited stock reduces paid tubs once, independently of process loss. All incurred production and packaging costs remain. Expected paid quantities may be fractional.
- Wholesale = consumer price including VAT / (1 + VAT rate) × (1 − retailer sales margin). Actual-wholesale mode overrides revenue, while the ceiling remains the comparison point. VAT applicability must be confirmed for the actual transaction and jurisdiction.
- Per-tub production results include ingredients, packaging and the selected batch labor/overhead. When labor or overhead is allocated monthly, these per-tub results exclude the deferred costs, which are included in the monthly operating statement. Contribution is not net profit.
- Monthly packed-tub mode uses proportional batch equivalents at the current packing efficiency. Whole-batch mode is an alternative. Batch expense inputs apply to the target batch you enter; changing batch size does not automatically change labor hours or overhead.
- Cash operating surplus = revenue − batch production expenses − other variable costs − fixed cash expenses. Operating profit also deducts depreciation, and is before interest and tax.
- Break-even is rounded up in packed tubs, with an additional whole-batch estimate. Non-positive unit contribution has no finite break-even, including when fixed costs are zero. Estimates depend on entered staffing and capacity; they do not imply unlimited production at unchanged fixed costs.
- Internal results use JavaScript full-precision numbers; only display formatting rounds them. Unknown or invalid inputs propagate to affected results instead of becoming zero. A zero total ingredient cost makes cost-share percentages undefined.

## Saving, transfer and export

Local saves are specific to the browser, device, and exact website origin (scheme, hostname and port). Clearing site data or using a private window may remove them. Moving from a local URL to a hosted URL or custom domain does not transfer browser storage: export JSON first and import it at the new address.

**Export JSON backup** includes every recipe and its settings. **Import JSON** validates the schema and adds independent recipes without overwriting existing ones. The app accepts up to 100 recipes, 100 ingredients per recipe and 2 MB per imported file. Incomplete names and empty numeric inputs survive saving. Invalid files are rejected without changing existing recipes. If stored data cannot be read, the app leaves the original storage untouched and runs in session-only mode.

**Export CSV** exports the active recipe's reference/target quantities, input percentages, purchase requirements, unit prices, ingredient costs/shares, and selected production/pricing/monthly results. Missing values are empty and validation messages are included. Potential spreadsheet-formula text is escaped. Exports provide both a download and selectable text, supporting embedded browsers that restrict downloads.

**Print summary** opens a reviewable summary of the active recipe, conversion assumptions, production/pricing and enabled monthly results. **Print / Save PDF** then opens the browser print dialog. Choose Save as PDF for a PDF copy. Browser print headers/footers can be disabled in that dialog. No saved recipes are sent to a server. Google Fonts is an optional typography request; system fonts are used if unavailable.

## Deploy when ready

No deployment, hosting registration, domain association or DNS change has been performed. Any HTTPS static host can serve the contents of `dist`; use the directory itself as the web root. No server-side runtime, environment variables or SPA rewrites are required. Choose a stable hostname before entering significant data, or transfer via JSON afterward.

One option is Cloudflare Pages Direct Upload:

1. Run the checks above.
2. Create a Pages Direct Upload project in your Cloudflare account.
3. Upload the `dist` folder, deploy, and test the assigned `pages.dev` URL.
4. For later releases, upload the updated `dist` folder to the same project.

Direct Upload can use the dashboard or Wrangler. It cannot later switch to Git integration within the same project; choose Git integration initially if automatic deployments from a repository are desired. See [Cloudflare's Direct Upload documentation](https://developers.cloudflare.com/pages/get-started/direct-upload/).

## Connect the existing domain

The information needed is:

- Your domain name and preferred address: apex (`example.com`), `www`, or a subdomain such as `hummus.example.com`.
- The registrar and current DNS provider, plus which account hosts the app.
- The assigned deployment hostname and any existing website/email services that must continue working.
- Authorization for the exact DNS or nameserver changes after the proposed records are reviewed. Credentials should be entered through the provider's sign-in UI, not pasted into a recipe or source file.

For Cloudflare Pages, associate the chosen domain in the project's **Custom domains** settings first. An externally managed subdomain can then use a CNAME to the assigned `pages.dev` hostname. An apex domain requires a Cloudflare zone and nameservers; review existing records before considering that change. Confirm DNS and HTTPS activation, then import your JSON backup at the new address. See [Cloudflare's custom-domain instructions](https://developers.cloudflare.com/pages/configuration/custom-domains/). No DNS changes should be made until you authorize the specific change.

## Project layout

- `dist/calculations.js`: unit conversion, yield, ingredient purchasing, packing, pricing and monthly economics.
- `dist/storage.js`: starter/blank recipes, schema validation, local persistence, duplication and CSV generation.
- `dist/app.js`: editable views, result summaries, exports and optional feature-detected WebMCP tools.
- `dist/styles.css`: responsive theme and print layout.
- `tests/calculations.test.mjs`: 27 focused calculation and persistence tests.
- `scripts/serve.mjs`: loopback-only local static server; not a production server.
- `scripts/check.mjs`: deployable static-file verification.

## Limits

This version has no cross-device sync, multi-user collaboration, inventory carry-forward or financial ledger. It plans one active recipe at a time, rather than a mixed monthly product portfolio. Leftover reuse is not modeled. Labor and overhead can be counted at batch or monthly level but not split across both in this version. Free-form expense descriptions still require human review for duplicate entries. Capacity step changes, capital expenditure, financing, tax payments and working-capital timing are outside the operating model.
