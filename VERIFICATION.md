# Verification — 13 September 2026

## Business expansion

The application now has eight connected business-planning sections. Calculation modules and persistence are separate from UI rendering. The existing numeric input retention behavior remains in place.

## Automated checks

- `npm run check`: all JavaScript syntax checks, static asset checks and **56 tests** passed (29 business tests plus 27 retained recipe tests).
- `npm run build`: production static files validated successfully.
- Reconciliation: 15,000 packed tubs; 14,250 paid; EUR 1.5046728971962615 realized wholesale per paid tub; EUR 21,441.58878504672 revenue; EUR 6,767.40 ingredients; EUR 5,250 packaging; EUR 18,397.40 cash operating cost; EUR 2,335.85545204672 EBIT.
- Historical payroll comparison: EUR -8,507.89454795328 EBIT. Full-precision rounding explains the sub-cent difference from the prompt's approximate profit examples.
- Startup reference reconciles to EUR 149,425.
- Tests cover zero production, zero sales, 100% unsold, invalid margins, measured/loss exclusivity, discarded process aids, prepared yield and density, aggregate/itemized modes, overfill, explicit package changes, kg/tub mixes, sales and purchase VAT, channel deductions, actual/target compensation and drawings, missing versus disabled fields, assets/leases, outsourcing replacement, working capital, tax/financing, linear and capacity-step break-even, simultaneous profit/margin targets, capacity and task allocations, schema validation and CSV escaping.
- Migration tests verify all four combinations of old monthly/batch labor and overhead modes. Previously inactive costs stay inactive, original quantities and margin remain, and the v1 browser entry is untouched. Every named v2 preset passes validated JSON round-trip.

## Browser checks

Used the isolated 127.0.0.1 test origin; the user's localhost workspace was not replaced.

- Existing v1 test recipes migrated, retained their names and inputs, and remained alongside the newly added workshop scenario.
- All eight sections rendered without application errors. Workshop financial figures matched the automated reconciliation.
- Sequential number entry of 1234.56 in monthly volume and 123.45 in an expanded expense card retained the exact order, active input focus and expanded card state.
- Changing the target batch to 100 kg and production back to 3,000 kg showed 30 planned batches, survived reload and appeared in JSON export.
- Added an expense, edited its rate, duplicated it, disabled it and deleted the two test rows. Live results and row states updated correctly.
- Inspected desktop production and overview layouts, a 390 px mobile overview, and all eight sections at 320 px. Every section's document scroll width equaled its viewport content width; wide result tables scroll inside their own containers.
- JSON export parsed as schema 2 with the expected saved scenarios and active batch value. CSV contained both business input paths and result paths. The print/PDF summary was visually reviewed at desktop width.
- No application errors appeared in captured browser logs.

## Verification limits and real-world inputs

Native file-download completion and a generated PDF were not captured by the embedded browser; the export text and printable preview were verified. Downloads also provide a copyable fallback.

Supplier quotations, the scope of the 200 g packaging estimate, applicable VAT, real batch quantities/yield, founder hours and target compensation, and sustainable equipment/delivery capacities require business inputs. Unknowns remain explicit rather than becoming zero. The model uses proportional monthly packing and batches, and net-of-recoverable-VAT working capital without VAT settlement timing.

## Deployment workflow

The existing repository uses GitHub production branch master and the committed Vercel static configuration. This release uses that workflow; no DNS, account or team changes are part of the update.
