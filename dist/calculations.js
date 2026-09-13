// All monetary inputs are EUR excluding recoverable VAT. Null means unknown.
export const UNITS = ["g", "kg", "ml", "l"];
export function number(value) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  )
    return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
const valid = (v, min = 0, max = Infinity, exclusiveMax = false) => {
  const n = number(v);
  return n !== null && n >= min && (exclusiveMax ? n < max : n <= max)
    ? n
    : null;
};
export function toKg(quantity, unit, density) {
  const n = valid(quantity);
  if (n === null || !UNITS.includes(unit)) return null;
  if (unit === "kg") return n;
  if (unit === "g") return n / 1000;
  const d = valid(density, Number.MIN_VALUE);
  return d === null ? null : n * (unit === "ml" ? 0.001 : 1) * d;
}
export function fromKg(kg, unit, density) {
  if (kg === null || !UNITS.includes(unit)) return null;
  if (unit === "kg") return kg;
  if (unit === "g") return kg * 1000;
  const d = valid(density, Number.MIN_VALUE);
  return d === null ? null : (kg / d) * (unit === "ml" ? 1000 : 1);
}
export function convert(quantity, from, to, density) {
  const n = valid(quantity);
  if (n === null || !UNITS.includes(from) || !UNITS.includes(to)) return null;
  if (from === to) return n;
  if (["g", "kg"].includes(from) && ["g", "kg"].includes(to))
    return n * (from === "g" ? 0.001 : 1000);
  if (["ml", "l"].includes(from) && ["ml", "l"].includes(to))
    return n * (from === "ml" ? 0.001 : 1000);
  return fromKg(toKg(n, from, density), to, density);
}
export function chickpeaWeights(ingredient, kg) {
  if (!ingredient.chickpea) return { inputKg: kg, purchaseKg: kg };
  const needsYield =
    ingredient.recipeForm === "dry" ||
    ingredient.purchaseForm !== ingredient.recipeForm;
  const yieldFactor = valid(ingredient.cookedYield, Number.MIN_VALUE);
  if (kg === null || (needsYield && yieldFactor === null))
    return { inputKg: null, purchaseKg: null };
  const inputKg = ingredient.recipeForm === "dry" ? kg * yieldFactor : kg;
  return {
    inputKg,
    purchaseKg:
      ingredient.purchaseForm === "dry" ? inputKg / yieldFactor : inputKg,
  };
}
export function packBatch(finishedKg, weightG) {
  const weight = valid(weightG, Number.MIN_VALUE);
  if (finishedKg === null || weight === null)
    return { tubs: null, leftoverKg: null };
  const ratio = (finishedKg * 1000) / weight;
  // Absorb only floating-point noise at an exact tub boundary.
  const tubs = Math.floor(ratio + Number.EPSILON * Math.max(1, ratio) * 4);
  return { tubs, leftoverKg: Math.max(0, finishedKg - (tubs * weight) / 1000) };
}
export function wholesaleFromRetail(retail, vatPct, marginPct) {
  const p = valid(retail),
    v = valid(vatPct, 0, 100),
    m = valid(marginPct, 0, 100, true);
  return p === null || v === null || m === null
    ? null
    : (p / (1 + v / 100)) * (1 - m / 100);
}
export function breakEven(fixed, contribution) {
  if (fixed === null || contribution === null) return null;
  return contribution <= 0 ? Infinity : Math.ceil(fixed / contribution);
}
export function calculate(recipe) {
  const issues = [];
  const warn = (area, text) => issues.push({ area, text });
  const read = (
    v,
    label,
    area,
    min = 0,
    max = Infinity,
    exclusiveMax = false,
  ) => {
    const n = valid(v, min, max, exclusiveMax);
    if (n === null)
      warn(
        area,
        `${label}: enter ${min > 0 ? "a number greater than zero" : "a non-negative number"}${max !== Infinity ? ` ${exclusiveMax ? "below" : "up to"} ${max}` : ""}.`,
      );
    return n;
  };
  const sum = (items) =>
    items.some((x) => x === null) ? null : items.reduce((a, b) => a + b, 0);
  const mul = (a, b) => (a === null || b === null ? null : a * b);
  const div = (a, b) => (a === null || b === null || b <= 0 ? null : a / b);
  const rows = recipe.ingredients.map((i, index) => {
    const name = i.name.trim() || `Ingredient ${index + 1}`;
    if (!i.name.trim()) warn("recipe", `Ingredient ${index + 1}: add a name.`);
    const quantity = read(i.quantity, `${name} quantity`, "recipe");
    const kg = toKg(quantity, i.unit, i.density);
    if (quantity !== null && kg === null)
      warn(
        "recipe",
        `${name}: enter a density in kg/L to convert volume to input weight.`,
      );
    const { inputKg, purchaseKg } = chickpeaWeights(i, kg);
    if (kg !== null && inputKg === null)
      warn("recipe", `${name}: enter a cooked-to-dry yield factor.`);
    const packQuantity = read(
      i.packQuantity,
      `${name} purchase size`,
      "ingredients",
      Number.MIN_VALUE,
    );
    const packPrice = read(
      i.packPrice,
      `${name} purchase price (zero is allowed)`,
      "ingredients",
    );
    let requirement = i.chickpea
      ? fromKg(
          purchaseKg,
          i.packUnit,
          i.recipeForm === i.purchaseForm ? i.density : i.purchaseDensity,
        )
      : convert(quantity, i.unit, i.packUnit, i.density);
    if (requirement === null)
      warn(
        "ingredients",
        `${name}: purchasing conversion needs a valid quantity, density or chickpea yield.`,
      );
    const referenceCost = mul(div(requirement, packQuantity), packPrice);
    const basePurchaseSize =
      packQuantity === null
        ? null
        : packQuantity * (["g", "ml"].includes(i.packUnit) ? 0.001 : 1);
    return {
      id: i.id,
      name,
      unit: i.unit,
      quantity,
      inputKg,
      purchaseKg,
      purchaseUnit: i.packUnit,
      requirement,
      referenceCost,
      unitPrice: div(packPrice, basePurchaseSize),
      unitPriceUnit: ["g", "kg"].includes(i.packUnit) ? "kg" : "L",
    };
  });
  let inputKg = sum(rows.map((r) => r.inputKg));
  if (inputKg !== null && inputKg <= 0) {
    warn(
      "recipe",
      "Add ingredient quantities with a total input weight greater than zero.",
    );
    inputKg = null;
  }
  const targetKg = read(
    recipe.targetKg,
    "Target finished batch",
    "recipe",
    Number.MIN_VALUE,
  );
  let finishedKg = null;
  if (recipe.yieldMode === "measured")
    finishedKg = read(
      recipe.finishedYieldKg,
      "Measured finished reference yield",
      "recipe",
      Number.MIN_VALUE,
    );
  else if (recipe.yieldMode === "loss") {
    const loss = read(
      recipe.lossPct,
      "Process loss percentage",
      "recipe",
      0,
      100,
      true,
    );
    finishedKg = mul(inputKg, loss === null ? null : 1 - loss / 100);
  } else
    warn(
      "recipe",
      "Select measured yield or an explicit process-loss assumption.",
    );
  const factor = div(targetKg, finishedKg);
  if (
    finishedKg !== null &&
    inputKg !== null &&
    finishedKg > inputKg * (1 + 1e-10)
  )
    warn(
      "recipe",
      "Measured finished yield exceeds recorded input. Check added water and ingredient quantities; your measured yield is retained.",
    );
  rows.forEach((r) =>
    Object.assign(r, {
      targetQuantity: mul(r.quantity, factor),
      targetInputKg: mul(r.inputKg, factor),
      targetRequirement: mul(r.requirement, factor),
      targetCost: mul(r.referenceCost, factor),
      percentage: mul(div(r.inputKg, inputKg), 100),
    }),
  );
  const referenceCost = rows.length
    ? sum(rows.map((r) => r.referenceCost))
    : null;
  const ingredientCost = mul(referenceCost, factor);
  rows.forEach(
    (r) => (r.costShare = mul(div(r.referenceCost, referenceCost), 100)),
  );
  const core = {
    inputKg,
    finishedKg,
    targetKg,
    factor,
    targetInputKg: mul(inputKg, factor),
    referenceCost,
    ingredientCost,
    ingredientCostPerKg: div(ingredientCost, targetKg),
    knownReferenceCost: rows.reduce((s, r) => s + (r.referenceCost ?? 0), 0),
    rows,
    issues,
  };
  const p = recipe.production;
  if (!p.enabled)
    return { ...core, production: null, pricing: null, monthly: null };
  const weightG = read(
    p.weightG,
    "Tub net weight",
    "production",
    Number.MIN_VALUE,
  );
  const { tubs, leftoverKg } = packBatch(
    factor === null || inputKg === null ? null : targetKg,
    weightG,
  );
  const unsold = read(
    p.unsoldPct,
    "Unsold / credited stock percentage",
    "production",
    0,
    100,
  );
  const paidRatio = unsold === null ? null : 1 - unsold / 100;
  const paidTubs = mul(tubs, paidRatio);
  const packagingPerTub = sum(
    ["container", "lid", "label", "seal", "carton"].map((k) =>
      read(
        p[k],
        `${k[0].toUpperCase() + k.slice(1)} cost per packed tub`,
        "production",
      ),
    ),
  );
  const packagingCost = mul(tubs, packagingPerTub);
  const laborCost =
    p.laborMode === "batch"
      ? mul(
          read(p.laborHours, "Batch labor hours", "production"),
          read(p.hourlyCost, "Hourly employer cost", "production"),
        )
      : 0;
  const overheadCost =
    p.overheadMode === "batch"
      ? sum(
          ["energy", "cleaning", "other"].map((k) =>
            read(p[k], `Batch ${k} cost`, "production"),
          ),
        )
      : 0;
  const total = sum([ingredientCost, packagingCost, laborCost, overheadCost]);
  const production = {
    tubs,
    leftoverKg,
    paidTubs,
    paidRatio,
    packagingPerTub,
    packagingCost,
    laborCost,
    overheadCost,
    total,
    costPerPacked: div(total, tubs),
    costPerPaid: div(total, paidTubs),
    ingredientPerPacked: div(ingredientCost, tubs),
    ingredientPerPaid: div(ingredientCost, paidTubs),
  };
  if (tubs === 0)
    warn(
      "production",
      "The batch is smaller than one tub. Increase the batch or reduce the tub weight.",
    );
  if (paidTubs === 0)
    warn(
      "production",
      "There are no expected paid tubs. Cost per paid tub and price break-even are undefined.",
    );
  const s = recipe.pricing;
  const ceiling = read(s.ceiling, "Consumer shelf-price ceiling", "pricing");
  const vat = read(s.vatPct, "VAT assumption", "pricing", 0, 100);
  const margin = read(
    s.marginPct,
    "Retailer gross margin",
    "pricing",
    0,
    100,
    true,
  );
  const retailExVat = div(ceiling, vat === null ? null : 1 + vat / 100);
  const maxWholesale = wholesaleFromRetail(ceiling, vat, margin);
  const wholesale =
    s.driver === "actual"
      ? read(s.actualWholesale, "Actual wholesale price", "pricing")
      : maxWholesale;
  const impliedMargin =
    wholesale === null || retailExVat === null || retailExVat <= 0
      ? null
      : (1 - wholesale / retailExVat) * 100;
  const contribution =
    wholesale === null || production.costPerPaid === null
      ? null
      : wholesale - production.costPerPaid;
  const breakEvenConsumer =
    production.costPerPaid === null || margin === null || vat === null
      ? null
      : (production.costPerPaid / (1 - margin / 100)) * (1 + vat / 100);
  const pricing = {
    retailExVat,
    maxWholesale,
    wholesale,
    impliedMargin,
    contribution,
    breakEvenWholesale: production.costPerPaid,
    breakEvenConsumer,
    revenue: mul(wholesale, paidTubs),
    covers:
      production.costPerPaid === null || maxWholesale === null
        ? null
        : maxWholesale >= production.costPerPaid,
  };
  const m = recipe.monthly;
  if (!m.enabled) return { ...core, production, pricing, monthly: null };
  const enteredVolume = read(
    m.driver === "batches" ? m.batches : m.packed,
    m.driver === "batches" ? "Monthly batch count" : "Monthly packed tubs",
    "monthly",
  );
  if (enteredVolume !== null && !Number.isInteger(enteredVolume))
    warn(
      "monthly",
      "Monthly batch count or packed tubs must be a whole number.",
    );
  const volume =
    enteredVolume !== null && Number.isInteger(enteredVolume)
      ? enteredVolume
      : null;
  const batchCount = m.driver === "batches" ? volume : div(volume, tubs);
  const packed = m.driver === "batches" ? mul(batchCount, tubs) : volume;
  const sold = mul(packed, paidRatio);
  const laborFixed =
    p.laborMode === "monthly"
      ? sum(
          ["salaries", "founder"].map((k) =>
            read(m[k], `Monthly ${k}`, "monthly"),
          ),
        )
      : 0;
  const overheadFixed =
    p.overheadMode === "monthly"
      ? read(
          m.fixedUtilities,
          "Monthly production utilities / cleaning",
          "monthly",
        )
      : 0;
  const fixed = sum([
    laborFixed,
    overheadFixed,
    ...[
      "rent",
      "insurance",
      "accounting",
      "marketing",
      "delivery",
      "otherFixed",
    ].map((k) => read(m[k], `Monthly ${k}`, "monthly")),
  ]);
  const variablePaid = read(
    m.variablePaid,
    "Other variable expense per paid tub",
    "monthly",
  );
  const depreciation = read(m.depreciation, "Monthly depreciation", "monthly");
  const revenue = mul(sold, wholesale);
  const batchExpenses = mul(batchCount, total);
  const variableExpenses = mul(sold, variablePaid);
  const cashExpenses = sum([batchExpenses, variableExpenses, fixed]);
  const cashSurplus =
    revenue === null || cashExpenses === null ? null : revenue - cashExpenses;
  const operatingProfit =
    cashSurplus === null || depreciation === null
      ? null
      : cashSurplus - depreciation;
  const contributionPerPacked =
    wholesale === null ||
    variablePaid === null ||
    paidRatio === null ||
    production.costPerPacked === null
      ? null
      : (wholesale - variablePaid) * paidRatio - production.costPerPacked;
  const cashBreakEven = breakEven(fixed, contributionPerPacked);
  const accountingBreakEven = breakEven(
    sum([fixed, depreciation]),
    contributionPerPacked,
  );
  const roundToBatch = (v) =>
    v === null || !Number.isFinite(v) || !tubs ? v : Math.ceil(v / tubs);
  const monthly = {
    batchCount,
    packed,
    sold,
    revenue,
    batchExpenses,
    variableExpenses,
    fixed,
    laborFixed,
    overheadFixed,
    cashExpenses,
    cashSurplus,
    depreciation,
    operatingProfit,
    contributionPerPacked,
    cashBreakEven,
    accountingBreakEven,
    cashBreakEvenBatches: roundToBatch(cashBreakEven),
    accountingBreakEvenBatches: roundToBatch(accountingBreakEven),
  };
  return { ...core, production, pricing, monthly };
}
