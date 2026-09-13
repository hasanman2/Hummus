import {
  number,
  toKg,
  fromKg,
  convert,
  chickpeaWeights,
  wholesaleFromRetail,
} from "./calculations.js";
import { tasks } from "./business-data.js";
export { number };
export const sum = (a) =>
  a.some((v) => v === null || !Number.isFinite(v))
    ? null
    : a.reduce((s, v) => s + v, 0);
export const mul = (a, b) => (a === null || b === null ? null : a * b);
export const div = (a, b) =>
  a === null || b === null || b <= 0 ? null : a / b;
const sub = (a, b) => (a === null || b === null ? null : a - b);
export const valid = (v, min = 0, max = Infinity) => {
  const n = number(v);
  return n !== null && n >= min && n <= max ? n : null;
};
const pos = (v) => valid(v, Number.MIN_VALUE);
const vatCost = (amount, rate, recoverable) =>
  mul(amount, rate === null ? null : recoverable ? 1 : 1 + rate / 100);

// Recipe costing deliberately does not read aggregate business assumptions.
export function calculateRecipe(r) {
  const issues = [];
  const rows = r.ingredients.map((i, index) => {
    const enabled = i.enabled !== false,
      quantity = valid(i.quantity),
      kg = toKg(quantity, i.unit, i.density);
    let { inputKg, purchaseKg } = chickpeaWeights(i, kg);
    let requirement = i.chickpea
      ? fromKg(
          purchaseKg,
          i.packUnit,
          i.recipeForm === i.purchaseForm ? i.density : i.purchaseDensity,
        )
      : convert(quantity, i.unit, i.packUnit, i.density);
    if (
      !i.chickpea &&
      i.preparedYield !== "" &&
      i.preparedYield !== undefined
    ) {
      const y = pos(i.preparedYield);
      purchaseKg = div(kg, y);
      requirement = fromKg(
        purchaseKg,
        i.packUnit,
        i.purchaseDensity || i.density,
      );
    }
    if (i.contributesMass === false) inputKg = 0;
    const price = vatCost(
      valid(i.packPrice),
      valid(i.vatPct ?? 0, 0, 100),
      i.recoverable !== false,
    );
    let referenceCost = mul(div(requirement, pos(i.packQuantity)), price);
    if (!enabled) {
      inputKg = 0;
      referenceCost = 0;
      requirement = 0;
      purchaseKg = 0;
    }
    if (enabled && inputKg === null)
      issues.push({
        area: "recipe",
        text: `${i.name || `Ingredient ${index + 1}`}: enter quantity, density or prepared yield.`,
      });
    if (enabled && referenceCost === null)
      issues.push({
        area: "ingredients",
        text: `${i.name || `Ingredient ${index + 1}`}: complete purchase quantity, price, VAT and conversion.`,
      });
    return {
      id: i.id,
      name: i.name,
      unit: i.unit,
      enabled,
      quantity,
      inputKg,
      purchaseKg,
      purchaseUnit: i.packUnit,
      requirement,
      referenceCost,
      unitPrice: div(
        price,
        mul(pos(i.packQuantity), ["g", "ml"].includes(i.packUnit) ? 0.001 : 1),
      ),
      unitPriceUnit: ["g", "kg"].includes(i.packUnit) ? "kg" : "L",
    };
  });
  const inputKg = sum(rows.map((i) => i.inputKg)),
    loss = valid(r.lossPct, 0, 99.999999999),
    finishedKg =
      r.yieldMode === "measured"
        ? pos(r.finishedYieldKg)
        : mul(inputKg, loss === null ? null : 1 - loss / 100),
    targetKg = pos(r.targetKg),
    factor = div(targetKg, finishedKg);
  if (finishedKg === null || finishedKg <= 0)
    issues.push({
      area: "recipe",
      text: "Enter a positive finished yield, or input mass and an explicit process loss.",
    });
  if (targetKg === null)
    issues.push({
      area: "recipe",
      text: "Enter a finished batch output to calculate batch requirements and workload.",
    });
  const referenceCost = sum(rows.map((i) => i.referenceCost)),
    ingredientCostPerKg = div(referenceCost, finishedKg);
  rows.forEach((i) =>
    Object.assign(i, {
      targetQuantity: i.enabled ? mul(i.quantity, factor) : 0,
      targetInputKg: mul(i.inputKg, factor),
      targetRequirement: mul(i.requirement, factor),
      targetCost: mul(i.referenceCost, factor),
      percentage: mul(div(i.inputKg, inputKg), 100),
      costShare: mul(div(i.referenceCost, referenceCost), 100),
    }),
  );
  return {
    rows,
    inputKg,
    finishedKg,
    targetKg,
    factor,
    targetInputKg: mul(inputKg, factor),
    referenceCost,
    ingredientCost: mul(referenceCost, factor),
    ingredientCostPerKg,
    knownReferenceCost: sum(rows.map((i) => i.referenceCost ?? 0)),
    issues,
  };
}

export function calculateBusiness(r, overrideKg, options = {}) {
  const b = r.business,
    v = b.volume,
    issues = [],
    capacityIssues = [],
    startupIssues = [];
  const required = (value, label, min = 0, max = Infinity, list = issues) => {
    const n = valid(value, min, max);
    if (n === null)
      list.push(
        `${label}: enter ${min > 0 ? "a positive" : "a non-negative"} value${max < Infinity ? ` (maximum ${max})` : ""}.`,
      );
    return n;
  };
  const vat = required(r.pricing.vatPct, "Sales VAT", 0, 100),
    margin = required(r.pricing.marginPct, "Retailer margin", 0, 99.999999999),
    cap = required(r.pricing.ceiling, "Retail cap");
  const unsold = required(v.unsoldPct, "Unsold / credited output", 0, 100),
    paidFraction = unsold === null ? null : 1 - unsold / 100;
  const direct = b.sales.directEnabled
    ? required(b.sales.directPct, "Direct channel share", 0, 100)
    : 0;
  let selected = b.packages.filter(
    (p) => p.enabled && (v.mixMode !== "single" || p.id === v.packageId),
  );
  if (!selected.length) issues.push("Select at least one enabled package.");
  let mixValid = true;
  if (v.mixMode !== "single") {
    const total = sum(selected.map((p) => valid(p.mixPct, 0, 100)));
    mixValid = total !== null && Math.abs(total - 100) < 1e-8;
    if (!mixValid) issues.push("Enabled package allocations must total 100%.");
    selected = selected.filter((p) => number(p.mixPct) !== 0);
  }
  const packages = selected.map((p) => {
    const size = required(p.sizeG, `${p.name} labeled size`, Number.MIN_VALUE),
      overfill = required(p.overfillG, `${p.name} overfill`),
      fillKg = div(sum([size, overfill]), 1000);
    const packaging =
      b.operatingMode === "contract" && b.contractIncludesPackaging
        ? 0
        : p.mode === "aggregate"
          ? vatCost(
              required(p.aggregate, `${p.name} aggregate packaging`),
              required(p.vatPct, `${p.name} purchase VAT`, 0, 100),
              p.recoverable,
            )
          : sum(
              p.items
                .filter((i) => i.enabled)
                .map((i) =>
                  vatCost(
                    required(i.cost, `${p.name}: ${i.name}`),
                    required(i.vatPct, `${i.name} VAT`, 0, 100),
                    i.recoverable,
                  ),
                ),
            );
    const shelf = required(p.shelf, `${p.name} shelf price`),
      retailNet = div(shelf, vat === null ? null : 1 + vat / 100);
    const maximumWholesale = wholesaleFromRetail(cap, vat, margin),
      wholesale =
        p.priceMode === "ceiling"
          ? mul(retailNet, margin === null ? null : 1 - margin / 100)
          : required(p.wholesale, `${p.name} wholesale price`);
    const directNet =
      direct > 0
        ? div(
            required(p.directShelf, `${p.name} direct shelf price`),
            vat === null ? null : 1 + vat / 100,
          )
        : 0;
    const wholesaleShare = direct === null ? null : 1 - direct / 100,
      directShare = direct === null ? null : direct / 100;
    const gross =
      direct === 100
        ? directNet
        : sum([mul(wholesale, wholesaleShare), mul(directNet, directShare)]);
    const feeRows = b.sales.fees
      .filter((f) => f.enabled)
      .map((f) => {
        const share =
          f.channel === "all"
            ? 1
            : f.channel === "wholesale"
              ? wholesaleShare
              : directShare;
        const channelPrice =
          f.channel === "all"
            ? gross
            : f.channel === "wholesale"
              ? wholesale
              : directNet;
        const rate = required(
          f.rate,
          `${f.name} deduction`,
          0,
          f.basis === "gross" ? 100 : Infinity,
        );
        return {
          id: f.id,
          name: f.name,
          amount:
            f.basis === "gross"
              ? mul(mul(channelPrice, share), rate === null ? null : rate / 100)
              : mul(rate, share),
        };
      });
    const fees = sum(feeRows.map((f) => f.amount)),
      realized = sub(gross, fees);
    if (realized !== null && realized < 0)
      issues.push(`${p.name}: deductions exceed gross revenue.`);
    const impliedShelf =
      vat === null
        ? null
        : mul(
            div(wholesale, margin === null ? null : 1 - margin / 100),
            1 + vat / 100,
          );
    return {
      id: p.id,
      name: p.name,
      fillKg,
      sizeG: size,
      overfillG: overfill,
      share: v.mixMode === "single" ? 1 : div(valid(p.mixPct, 0, 100), 100),
      packaging,
      wholesale,
      maximumWholesale,
      retailNet,
      directNet,
      gross,
      fees,
      feeRows,
      realized,
      impliedShelf,
      retailerProfit: sub(retailNet, wholesale),
      impliedMargin: mul(div(sub(retailNet, wholesale), retailNet), 100),
      capExcess:
        impliedShelf === null || cap === null
          ? null
          : Math.max(0, impliedShelf - cap),
      shelf,
    };
  });
  const averageFill =
    v.mixMode === "tubs"
      ? sum(packages.map((p) => mul(p.share, p.fillKg)))
      : div(1, sum(packages.map((p) => div(p.share, p.fillKg))));
  let kg =
    overrideKg === undefined
      ? required(v.amount, "Monthly production")
      : valid(overrideKg);
  const batchKg = pos(r.targetKg),
    days = pos(v.days);
  if (overrideKg === undefined && v.driver === "tubs")
    kg = mul(kg, averageFill);
  if (overrideKg === undefined && v.driver === "batches") kg = mul(kg, batchKg);
  if (!mixValid || !selected.length) kg = null;
  const tubs = div(kg, averageFill),
    paidTubs = mul(tubs, paidFraction),
    paidKg = mul(kg, paidFraction),
    batches = div(kg, batchKg),
    deliveries = valid(v.deliveries);
  packages.forEach((p) => {
    p.tubs =
      v.mixMode === "tubs"
        ? mul(tubs, p.share)
        : div(mul(kg, p.share), p.fillKg);
    p.kg = mul(p.tubs, p.fillKg);
    p.paidTubs = mul(p.tubs, paidFraction);
    p.paidKg = mul(p.kg, paidFraction);
    p.revenue = mul(p.paidTubs, p.realized);
    p.packagingTotal = mul(p.tubs, p.packaging);
  });
  const recipe = calculateRecipe(r),
    contract = b.operatingMode === "contract";
  const ingredientRate =
    contract && b.contractIncludesIngredients
      ? 0
      : b.ingredientMode === "aggregate"
        ? vatCost(
            required(b.aggregatePerKg, "Aggregate ingredient cost"),
            required(b.ingredientVatPct, "Ingredient VAT", 0, 100),
            b.ingredientRecoverable,
          )
        : recipe.ingredientCostPerKg;
  if (
    b.ingredientMode === "detailed" &&
    !(contract && b.contractIncludesIngredients) &&
    ingredientRate === null
  )
    issues.push(
      "Detailed recipe costing is incomplete. Complete recipe quantities, yield and supplier prices, or explicitly select aggregate costing.",
    );
  const ingredientCost = mul(kg, ingredientRate),
    packagingCost =
      contract && b.contractIncludesPackaging
        ? 0
        : sum(packages.map((p) => p.packagingTotal)),
    revenue = sum(packages.map((p) => p.revenue));
  const grossRevenue = sum(packages.map((p) => mul(p.paidTubs, p.gross))),
    fees = sum(packages.map((p) => mul(p.paidTubs, p.fees))),
    vatCollected = mul(revenue, vat === null ? null : vat / 100);
  const basisAmount = (basis) =>
    ({
      kg,
      packed_tub: tubs,
      paid_tub: paidTubs,
      batch: batches,
      delivery: deliveries,
      month: 1,
    })[basis] ?? null;
  const expenseRows = b.expenses.map((e) => {
    const replaced =
      e.enabled &&
      ((b.operatingMode === "shared" && e.replaceShared) ||
        (contract && e.replaceContract));
    if (!e.enabled || replaced)
      return {
        id: e.id,
        name: e.name,
        category: e.category,
        classification: e.classification,
        amount: 0,
        fixed: 0,
        variable: 0,
        disabled: !e.enabled,
        replaced,
      };
    const base = required(e.base, `${e.name} base`),
      rate = required(e.rate, `${e.name} rate`),
      consumption = required(e.consumption, `${e.name} consumption`),
      tax = required(e.vatPct, `${e.name} VAT`, 0, 100);
    const units = e.behavior === "fixed" ? 1 : basisAmount(e.basis);
    const step =
      e.behavior === "step"
        ? required(e.stepSize, `${e.name} step size`, Number.MIN_VALUE)
        : null;
    const counted =
      e.behavior === "step"
        ? units === null || step === null
          ? null
          : Math.ceil(Math.max(0, units / step - 1e-12))
        : units;
    const amount = vatCost(
      sum([base, mul(mul(rate, consumption), counted)]),
      tax,
      e.recoverable,
    );
    const fixed = vatCost(
      e.behavior === "fixed" || e.basis === "month" || e.basis === "delivery"
        ? sum([base, mul(mul(rate, consumption), counted)])
        : base,
      tax,
      e.recoverable,
    );
    return {
      id: e.id,
      name: e.name,
      category: e.category,
      classification: e.classification,
      status: e.status,
      behavior: e.behavior,
      amount,
      fixed,
      variable: sub(amount, fixed),
      step: e.behavior === "step",
      disabled: false,
      replaced: false,
    };
  });
  if (b.operatingMode !== "own") {
    const amount = contract
      ? mul(kg, required(b.contractPerKg, "Contract manufacturing rate"))
      : required(b.sharedMonthly, "Shared kitchen monthly charge");
    expenseRows.push({
      name: contract ? "Contract manufacturing" : "Shared kitchen",
      category: "Outsourcing",
      classification: "manufacturing",
      amount,
      fixed: contract ? 0 : amount,
      variable: contract ? amount : 0,
    });
  }
  const equipment =
    b.equipmentMode === "aggregate"
      ? required(
          b.equipmentBudget,
          "Equipment budget",
          0,
          Infinity,
          startupIssues,
        )
      : sum(
          b.assets
            .filter((a) => a.enabled && a.ownership === "purchase")
            .map((a) =>
              vatCost(
                mul(
                  required(
                    a.quantity,
                    `${a.name} quantity`,
                    0,
                    Infinity,
                    startupIssues,
                  ),
                  required(
                    a.unitCost,
                    `${a.name} purchase price`,
                    0,
                    Infinity,
                    startupIssues,
                  ),
                ),
                required(a.vatPct, `${a.name} VAT`, 0, 100, startupIssues),
                a.recoverable,
              ),
            ),
        );
  let assetDep = 0;
  if (b.depreciationMode === "assets") {
    assetDep =
      b.equipmentMode === "aggregate"
        ? div(
            sub(
              equipment,
              required(
                b.equipmentResidual,
                "Equipment residual",
                0,
                Infinity,
                startupIssues,
              ),
            ),
            mul(
              required(
                b.equipmentLifeYears,
                "Equipment useful life",
                Number.MIN_VALUE,
                Infinity,
                startupIssues,
              ),
              12,
            ),
          )
        : sum(
            b.assets
              .filter((a) => a.enabled && a.ownership === "purchase")
              .map((a) => {
                const cost = vatCost(
                    mul(valid(a.quantity), valid(a.unitCost)),
                    valid(a.vatPct, 0, 100),
                    a.recoverable,
                  ),
                  residual = mul(valid(a.quantity), valid(a.residual));
                if (cost !== null && residual !== null && residual > cost) {
                  startupIssues.push(
                    `${a.name}: residual exceeds purchase cost.`,
                  );
                  return null;
                }
                return div(sub(cost, residual), mul(pos(a.lifeYears), 12));
              }),
          );
    if (assetDep !== null && assetDep < 0) {
      assetDep = null;
      startupIssues.push("Equipment residual exceeds cost.");
    }
  }
  const depreciation =
    b.depreciationMode === "historical"
      ? required(b.historicalDep, "Historical depreciation")
      : assetDep;
  if (depreciation === null)
    issues.push(
      "Asset depreciation is incomplete. Enter cost, useful life and residual for purchased assets.",
    );
  // Budget modes are exclusive; selected leases are separate operating commitments.
  const leaseRows = b.assets
    .filter((a) => a.enabled && a.ownership === "lease")
    .map((a) => ({
      name: `Lease: ${a.name}`,
      category: "Equipment leases",
      classification: "manufacturing",
      amount: vatCost(
        mul(
          required(a.quantity, `${a.name} lease quantity`),
          required(a.leaseMonthly, `${a.name} monthly lease`),
        ),
        required(a.vatPct, `${a.name} VAT`, 0, 100),
        a.recoverable,
      ),
    }));
  leaseRows.forEach((e) =>
    expenseRows.push({ ...e, fixed: e.amount, variable: 0 }),
  );
  const overhead = sum(expenseRows.map((e) => e.amount)),
    fixedOverhead = sum(expenseRows.map((e) => e.fixed)),
    variableOverhead = sum(expenseRows.map((e) => e.variable));
  const staffRows = b.staff
    .filter((f) => f.enabled)
    .map((f) => {
      const wage = required(f.rate, `${f.name} pay rate`),
        employer = required(f.employerPct, `${f.name} employer costs`),
        hours =
          f.payMode === "hourly"
            ? required(f.hours, `${f.name} paid hours`)
            : 1;
      return {
        name: f.name,
        classification: f.classification,
        amount: mul(
          mul(wage, hours),
          employer === null ? null : 1 + employer / 100,
        ),
      };
    });
  const staff = sum(staffRows.map((f) => f.amount));
  const founderRows = b.founders
    .filter((f) => f.enabled)
    .map((f) => {
      const actual =
        f.payMode === "salary"
          ? mul(
              required(f.gross, `${f.name} gross salary`),
              number(f.employerPct) === null
                ? null
                : 1 + required(f.employerPct, `${f.name} employer costs`) / 100,
            )
          : required(f.actual, `${f.name} actual compensation`);
      return {
        name: f.name,
        actual: f.payMode === "drawings" ? 0 : actual,
        drawings: f.payMode === "drawings" ? actual : 0,
        target: valid(f.target),
        hours: valid(f.availableHours),
        economicRate: valid(f.economicRate),
        allocations: f.allocations,
      };
    });
  const founderActual = sum(founderRows.map((f) => f.actual)),
    founderTarget = sum(founderRows.map((f) => f.target)),
    founderDrawings = sum(founderRows.map((f) => f.drawings));
  const variableCost = sum([ingredientCost, packagingCost, variableOverhead]),
    contribution = sub(revenue, variableCost);
  const startup = b.startup,
    interest = required(startup.interest, "Monthly interest"),
    taxPct = required(startup.taxPct, "Illustrative profit tax", 0, 100);
  const views = {};
  for (const [key, pay] of [
    ["before", 0],
    ["actual", founderActual],
    ["target", founderTarget],
  ]) {
    const labor = sum([staff, pay]),
      cashCost = sum([ingredientCost, packagingCost, overhead, labor]),
      cashSurplus = sub(revenue, cashCost),
      ebit = sub(cashSurplus, depreciation),
      pbt = sub(ebit, interest),
      tax =
        pbt === null || taxPct === null
          ? null
          : (Math.max(0, pbt) * taxPct) / 100,
      afterTax = sub(pbt, tax);
    const founderManufacturing =
      key === "before"
        ? 0
        : sum(
            b.founders
              .filter((f) => f.enabled)
              .map((f, index) => {
                const allocation = sum(
                  ["production", "packing", "cleaning"].map((t) =>
                    valid(f.allocations[t], 0, 100),
                  ),
                );
                return mul(
                  key === "actual"
                    ? founderRows[index].actual
                    : founderRows[index].target,
                  div(allocation, 100),
                );
              }),
          );
    const manufacturing = sum([
      ingredientCost,
      packagingCost,
      sum(
        expenseRows
          .filter((e) => e.classification === "manufacturing")
          .map((e) => e.amount),
      ),
      sum(
        staffRows
          .filter((f) => f.classification === "manufacturing")
          .map((f) => f.amount),
      ),
      founderManufacturing,
      depreciation,
    ]);
    const cashRemaining = sub(
      cashSurplus,
      sum([
        interest,
        tax,
        required(startup.principal, "Loan principal"),
        required(startup.investment, "Investment this month"),
        required(startup.wcChange, "Working-capital change", -Infinity),
        required(startup.drawings, "Other drawings"),
        key === "before" ? 0 : founderDrawings,
      ]),
    );
    views[key] = {
      pay,
      labor,
      cashCost,
      cashSurplus,
      depreciation,
      ebit,
      pbt,
      tax,
      afterTax,
      cashRemaining,
      manufacturing,
      manufacturingProfit: sub(revenue, manufacturing),
      manufacturingMargin: mul(div(sub(revenue, manufacturing), revenue), 100),
      fullCost: sum([cashCost, depreciation]),
      operatingMargin: mul(div(ebit, revenue), 100),
      fixedCost: sum([fixedOverhead, staff, pay]),
    };
  }
  const view = views[b.targets.payView];
  const workloadRows = b.workload
    .filter((w) => w.enabled)
    .map((w) => ({
      name: w.name,
      task: w.task,
      hours: mul(valid(w.rate), basisAmount(w.basis)),
      rate: valid(w.rate),
      basis: w.basis,
    }));
  const teamTasks = tasks.map((task) => {
    const hours = sum(
        workloadRows.filter((w) => w.task === task).map((w) => w.hours),
      ),
      available = sum(
        founderRows.map((f) =>
          mul(f.hours, div(valid(f.allocations[task], 0, 100), 100)),
        ),
      );
    const fixedHours = sum(
      workloadRows
        .filter(
          (w) => w.task === task && ["month", "delivery"].includes(w.basis),
        )
        .map((w) => w.hours),
    );
    const perKg = sum(
      workloadRows
        .filter(
          (w) => w.task === task && !["month", "delivery"].includes(w.basis),
        )
        .map((w) =>
          mul(
            w.rate,
            w.basis === "kg"
              ? 1
              : w.basis === "batch"
                ? div(1, batchKg)
                : w.basis === "paid_tub"
                  ? div(paidFraction, averageFill)
                  : div(1, averageFill),
          ),
        ),
    );
    const capacity =
      available === null || fixedHours === null || perKg === null
        ? null
        : available < fixedHours
          ? 0
          : perKg > 0
            ? (available - fixedHours) / perKg
            : Infinity;
    return {
      task,
      hours,
      available,
      capacity,
      overloaded: hours !== null && available !== null && hours > available,
    };
  });
  founderRows.forEach((f) => {
    const total = sum(tasks.map((t) => valid(f.allocations[t], 0, 100)));
    if (total === null || Math.abs(total - 100) > 1e-8)
      capacityIssues.push(`${f.name}: work allocations must sum to 100%.`);
  });
  const requiredHours = sum(workloadRows.map((w) => w.hours)),
    availableHours = sum(founderRows.map((f) => f.hours));
  if (requiredHours === null)
    capacityIssues.push(
      "Task rates are incomplete, including cleaning and administration.",
    );
  if (availableHours === null)
    capacityIssues.push(
      "Enter available monthly hours for each active founder.",
    );
  const capacityRows = b.capacity
    .filter((c) => c.enabled)
    .map((c) => ({
      name: c.name,
      kg:
        c.basis === "kg" ? valid(c.amount) : mul(valid(c.amount), averageFill),
    }));
  b.assets
    .filter((a) => a.enabled)
    .forEach((a) =>
      capacityRows.push({
        name: a.name,
        kg: mul(valid(a.capacityKg), valid(a.quantity)),
      }),
    );
  capacityRows.push({
    name: "Team by task allocation",
    kg: capacityIssues.length
      ? null
      : teamTasks.some((t) => t.capacity === null)
        ? null
        : Math.min(...teamTasks.map((t) => t.capacity)),
  });
  const knownCapacities = capacityRows.filter((c) => c.kg !== null),
    capacityKg = knownCapacities.length
      ? Math.min(...knownCapacities.map((c) => c.kg))
      : null;
  capacityRows
    .filter((c) => c.kg === null)
    .forEach((c) => capacityIssues.push(`${c.name} capacity is unknown.`));
  const unpaidHours = sum(
    b.founders
      .filter((f) => f.enabled)
      .map((f, i) =>
        founderRows[i].actual === 0
          ? sum(
              teamTasks.map((t) => {
                const contribution = mul(
                  founderRows[i].hours,
                  div(valid(f.allocations[t.task], 0, 100), 100),
                );
                return mul(t.hours, div(contribution, t.available));
              }),
            )
          : 0,
      ),
  );
  const economicValue = sum(
    b.founders
      .filter((f) => f.enabled)
      .map((f, i) =>
        founderRows[i].actual === 0
          ? mul(
              sum(
                teamTasks.map((t) =>
                  mul(
                    t.hours,
                    div(
                      mul(
                        founderRows[i].hours,
                        div(valid(f.allocations[t.task], 0, 100), 100),
                      ),
                      t.available,
                    ),
                  ),
                ),
              ),
              valid(f.economicRate),
            )
          : 0,
      ),
  );
  const capital = sum([
      equipment,
      required(
        startup.conversion,
        "Conversion budget",
        0,
        Infinity,
        startupIssues,
      ),
      required(
        startup.installation,
        "Installation budget",
        0,
        Infinity,
        startupIssues,
      ),
    ]),
    contingency = mul(
      capital,
      div(
        required(
          startup.contingencyPct,
          "Capital contingency",
          0,
          100,
          startupIssues,
        ),
        100,
      ),
    );
  const openingStock = required(
    startup.openingStock,
    "Opening inventory",
    0,
    Infinity,
    startupIssues,
  );
  const receivables = mul(div(revenue, 30), valid(startup.receivableDays)),
    inventory = mul(
      div(sum([ingredientCost, packagingCost]), 30),
      valid(startup.inventoryDays),
    ),
    payables = mul(
      div(sum([ingredientCost, packagingCost]), 30),
      valid(startup.supplierDays),
    );
  const workingCapital = sub(sum([receivables, inventory]), payables);
  const reserve =
    startup.reserveMode === "simple"
      ? required(startup.reserve, "Cash reserve", 0, Infinity, startupIssues)
      : workingCapital === null || openingStock === null
        ? null
        : Math.max(0, workingCapital - openingStock);
  if (reserve === null)
    startupIssues.push(
      "Enter receivable, inventory and supplier credit days for calculated working capital.",
    );
  const startupExpenses = sum([
      required(
        startup.launch,
        "Food safety / launch",
        0,
        Infinity,
        startupIssues,
      ),
      required(startup.branding, "Branding", 0, Infinity, startupIssues),
    ]),
    deposits = required(
      startup.deposits,
      "Deposits",
      0,
      Infinity,
      startupIssues,
    );
  const funding = sum([
      capital,
      contingency,
      startupExpenses,
      deposits,
      openingStock,
      reserve,
    ]),
    fundingGap = sub(
      funding,
      sum([
        required(startup.loan, "Startup loan", 0, Infinity, startupIssues),
        required(startup.equity, "Startup equity", 0, Infinity, startupIssues),
      ]),
    );
  if (kg === null || tubs === null)
    issues.push(
      "Production cannot be calculated. Check the driving volume, batch output and package mix.",
    );
  const costRows = [
    { name: "Ingredients", amount: ingredientCost },
    { name: "Packaging", amount: packagingCost },
    { name: "Hired labor", amount: staff },
    { name: "Founder compensation", amount: view.pay },
    ...expenseRows.map((e) => ({ name: e.name, amount: e.amount })),
    { name: "Depreciation", amount: depreciation },
  ].map((e) => ({
    ...e,
    perPackedTub: div(e.amount, tubs),
    perPaidTub: div(e.amount, paidTubs),
    perPackedKg: div(e.amount, kg),
    perPaidKg: div(e.amount, paidKg),
    perBatch: div(e.amount, batches),
  }));
  const output = {
    kg,
    tubs,
    paidTubs,
    paidKg,
    labeledKg: sum(packages.map((p) => mul(p.tubs, div(p.sizeG, 1000)))),
    averageFill,
    paidFraction,
    batchKg,
    batches,
    wholeBatches: batches === null ? null : Math.ceil(batches),
    dailyKg: div(kg, days),
    dailyTubs: div(tubs, days),
    packages,
    ingredientRate,
    ingredientCost,
    packagingCost,
    overhead,
    fixedOverhead,
    variableOverhead,
    staff,
    founderActual,
    founderTarget,
    founderDrawings,
    grossRevenue,
    fees,
    revenue,
    vatCollected,
    realizedPerPaid: div(revenue, paidTubs),
    revenuePerPaidKg: div(revenue, paidKg),
    variableCost,
    contribution,
    contributionMargin: mul(div(contribution, revenue), 100),
    contributionPerPacked: div(contribution, tubs),
    views,
    view,
    costRows,
    expenseRows,
    staffRows,
    founderRows,
    requiredHours,
    availableHours,
    unpaidHours,
    economicValue,
    teamTasks,
    capacityRows,
    capacityKg,
    capacityComplete: capacityIssues.length === 0,
    overCapacity: kg !== null && capacityKg !== null && kg > capacityKg,
    capacityIssues: [...new Set(capacityIssues)],
    startup: {
      equipment,
      capital,
      contingency,
      startupExpenses,
      deposits,
      openingStock,
      receivables,
      inventory,
      payables,
      workingCapital,
      reserve,
      funding,
      fundingGap,
    },
    startupIssues: [...new Set(startupIssues)],
    issues: [...new Set(issues)],
    incomplete:
      issues.length > 0 ||
      revenue === null ||
      view.ebit === null ||
      kg === null,
    planningIssues: [
      ...(batchKg === null
        ? [
            "Finished batch output is unknown; batch counts and allocations are incomplete.",
          ]
        : []),
      ...(days === null
        ? ["Enter positive production days for daily output."]
        : []),
      ...(b.targets.payView === "target" && founderTarget === null
        ? [
            "Enter sustainable compensation for each enabled founder to complete the target-pay estimate.",
          ]
        : []),
    ],
  };
  if (!options.noRecipeRows)
    output.ingredientRows = recipe.rows.map((i) => ({
      name: i.name,
      enabled: i.enabled,
      reference: i.referenceCost,
      perKg: div(i.referenceCost, recipe.finishedKg),
      perTub: mul(div(i.referenceCost, recipe.finishedKg), averageFill),
      batch: i.targetCost,
      month: mul(div(i.referenceCost, recipe.finishedKg), kg),
    }));
  return output;
}

// Between capacity-step thresholds every supported cash-flow driver is affine.
// Solve each interval against the actual cost function, including the point at a threshold.
export function solveVolume(
  r,
  { view = "actual", accounting = true, profit = 0, marginPct = 0 } = {},
) {
  const limit = pos(r.business.targets.searchKg),
    target = valid(profit),
    margin = valid(marginPct, 0, 99.999999999);
  if (limit === null || target === null || margin === null)
    return { kg: null, status: "Incomplete target inputs" };
  const base = calculateBusiness(r, 0, { noRecipeRows: true }),
    unit = calculateBusiness(r, 1, { noRecipeRows: true });
  const value = (c) => {
    const threshold = mul(c.revenue, margin / 100);
    return threshold === null
      ? null
      : sub(
          accounting ? c.views[view].ebit : c.views[view].cashSurplus,
          Math.max(target, threshold),
        );
  };
  if (value(base) === null || value(unit) === null)
    return { kg: null, status: "Incomplete estimate" };
  const boundaries = [0, limit];
  let tooMany = false;
  const kink = div(target, mul(unit.revenue, margin / 100));
  if (kink !== null && kink > 0 && kink < limit) boundaries.push(kink);
  const hasSteps = r.business.expenses.some(
    (e) => e.enabled && e.behavior === "step",
  );
  if (!hasSteps && unit.contribution !== null && unit.contribution <= 0)
    return {
      kg: Infinity,
      status: "No finite break-even under these assumptions.",
    };
  for (const e of r.business.expenses.filter(
    (e) =>
      e.enabled &&
      e.behavior === "step" &&
      !(r.business.operatingMode === "shared" && e.replaceShared) &&
      !(r.business.operatingMode === "contract" && e.replaceContract),
  )) {
    const step = pos(e.stepSize),
      perKg = {
        kg: 1,
        packed_tub: div(1, unit.averageFill),
        paid_tub: div(unit.paidFraction, unit.averageFill),
        batch: div(1, unit.batchKg),
        month: 0,
        delivery: 0,
      }[e.basis];
    if (step === null || perKg === null)
      return { kg: null, status: "Incomplete step inputs" };
    if (perKg === 0) continue;
    const gap = step / perKg;
    if (limit / gap > 2000 || boundaries.length + limit / gap > 4000) {
      tooMany = true;
      break;
    }
    for (let x = gap; x < limit; x += gap) boundaries.push(x);
  }
  if (tooMany)
    return {
      kg: null,
      status: "Search too large for these step sizes; reduce search limit",
    };
  const points = [...new Set(boundaries)].sort((a, b) => a - b);
  let found = null;
  for (let i = 0; i < points.length - 1; i++) {
    const lo = points[i],
      hi = points[i + 1],
      at = value(calculateBusiness(r, lo, { noRecipeRows: true }));
    if (at >= -1e-8 && !(lo === 0 && hasSteps && value(unit) < 0)) {
      found = lo;
      break;
    }
    const x1 = lo + (hi - lo) / 3,
      x2 = lo + (2 * (hi - lo)) / 3;
    const y1 = value(calculateBusiness(r, x1, { noRecipeRows: true })),
      y2 = value(calculateBusiness(r, x2, { noRecipeRows: true }));
    if (y1 === null || y2 === null)
      return { kg: null, status: "Incomplete estimate" };
    const slope = (y2 - y1) / (x2 - x1);
    if (slope > 1e-12) {
      const root = x1 - y1 / slope;
      if (
        root > lo &&
        root <= hi + 1e-8 &&
        value(
          calculateBusiness(r, Math.min(root, hi), { noRecipeRows: true }),
        ) >= -1e-6
      ) {
        found = Math.min(root, hi);
        break;
      }
    }
  }
  if (
    found === null &&
    value(calculateBusiness(r, limit, { noRecipeRows: true })) >= -1e-8
  )
    found = limit;
  if (found === null) {
    const last = value(calculateBusiness(r, limit, { noRecipeRows: true })),
      previous = value(
        calculateBusiness(r, limit * 0.999999, { noRecipeRows: true }),
      );
    return {
      kg: Infinity,
      status:
        last <= previous
          ? "No finite break-even under these assumptions."
          : "No solution within search limit; increase maximum kg.",
    };
  }
  const c = calculateBusiness(r, found, { noRecipeRows: true }),
    retailerTubs = mul(
      c.paidTubs,
      r.business.sales.directEnabled
        ? 1 - Number(r.business.sales.directPct) / 100
        : 1,
    ),
    retailerRate = pos(r.business.targets.paidPerRetailerWeek),
    retailers = pos(r.business.targets.retailers);
  return {
    kg: found,
    tubs: c.tubs,
    paidTubs: c.paidTubs,
    paidKg: c.paidKg,
    dailyKg: c.dailyKg,
    retailers: div(retailerTubs, mul(retailerRate, 52 / 12)),
    paidPerRetailerWeek: div(retailerTubs, mul(retailers, 52 / 12)),
    status: c.overCapacity
      ? "Unattainable with current capacity"
      : c.capacityComplete
        ? "Within entered capacity"
        : "Capacity not fully verified",
  };
}
