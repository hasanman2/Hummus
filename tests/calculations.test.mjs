import test from "node:test";
import assert from "node:assert/strict";
import {
  number,
  toKg,
  fromKg,
  convert,
  chickpeaWeights,
  packBatch,
  wholesaleFromRetail,
  breakEven,
  calculate,
} from "../dist/calculations.js";
import {
  createRecipe,
  initialState,
  duplicateRecipe,
  validateBackup,
  saveState,
  loadState,
  makeCsv,
  csvCell,
} from "../dist/storage.js";
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
function fixture() {
  const r = createRecipe();
  r.ingredients = [
    {
      ...r.ingredients[0],
      name: "Chickpeas",
      quantity: 4,
      unit: "kg",
      recipeForm: "cooked",
      purchaseForm: "dry",
      cookedYield: 2,
      packQuantity: 5,
      packUnit: "kg",
      packPrice: 10,
    },
    {
      ...r.ingredients[1],
      name: "Tahini",
      quantity: 1,
      unit: "kg",
      packQuantity: 1,
      packUnit: "kg",
      packPrice: 6,
    },
  ];
  r.finishedYieldKg = 4;
  r.targetKg = 8;
  Object.assign(r.production, {
    enabled: true,
    weightG: 250,
    container: 0.1,
    lid: 0,
    label: 0,
    seal: 0,
    carton: 0,
    laborHours: 1,
    hourlyCost: 10,
    energy: 0,
    cleaning: 0,
    other: 0,
    unsoldPct: 25,
  });
  return r;
}
test("missing values remain unknown; a real zero remains zero", () => {
  for (const v of ["", null, undefined, " ", NaN, Infinity, false])
    assert.equal(number(v), null);
  assert.equal(number("0"), 0);
});
test("mass conversions and explicit density requirements", () => {
  near(toKg(1500, "g"), 1.5);
  near(toKg(500, "ml", 0.92), 0.46);
  assert.equal(toKg(1, "l", ""), null);
  assert.equal(toKg(1, "l", 0), null);
  assert.equal(toKg(-1, "kg"), null);
  near(fromKg(0.46, "ml", 0.92), 500);
  assert.equal(convert(1, "kg", "l", ""), null);
  near(convert(500, "ml", "l", ""), 0.5);
  near(convert(1, "l", "g", 1.03), 1030);
});
test("measured yield controls scaling without also applying loss", () => {
  const r = fixture();
  r.lossPct = 80;
  const c = calculate(r);
  near(c.inputKg, 5);
  near(c.finishedKg, 4);
  near(c.factor, 2);
  near(c.targetInputKg, 10);
  near(c.rows[0].targetQuantity, 8);
  near(c.rows[0].percentage, 80);
  near(c.ingredientCost, 20);
});
test("explicit process loss replaces measured yield", () => {
  const r = fixture();
  r.yieldMode = "loss";
  r.lossPct = 10;
  r.finishedYieldKg = 1;
  const c = calculate(r);
  near(c.finishedKg, 4.5);
  near(c.factor, 8 / 4.5);
  r.lossPct = "";
  assert.equal(calculate(r).factor, null);
  r.lossPct = 100;
  assert.equal(calculate(r).factor, null);
});
test("cooked chickpeas purchased dry use purchasing yield once", () => {
  const c = calculate(fixture());
  near(c.rows[0].purchaseKg, 2);
  near(c.rows[0].targetRequirement, 4);
  near(c.rows[0].referenceCost, 4);
  near(c.rows[0].inputKg, 4);
});
test("dry-basis recipe expands cooked input, not dry purchasing amount", () => {
  const r = fixture();
  r.ingredients[0].quantity = 2;
  r.ingredients[0].recipeForm = "dry";
  const c = calculate(r);
  near(c.inputKg, 5);
  near(c.rows[0].purchaseKg, 2);
  r.ingredients[0].purchaseForm = "cooked";
  near(calculate(r).rows[0].purchaseKg, 4);
});
test("cooked purchase and cooked recipe do not require cooking yield", () => {
  const i = {
    chickpea: true,
    recipeForm: "cooked",
    purchaseForm: "cooked",
    cookedYield: "",
  };
  assert.deepEqual(chickpeaWeights(i, 4), { inputKg: 4, purchaseKg: 4 });
  i.purchaseForm = "dry";
  assert.equal(chickpeaWeights(i, 4).inputKg, null);
});
test("whole tubs, floating point boundary and leftover mass", () => {
  assert.deepEqual(packBatch(1.1, 250), { tubs: 4, leftoverKg: 1.1 - 1 });
  assert.equal(packBatch(0.3, 100).tubs, 3);
  assert.equal(packBatch(0.1 + 0.2, 100).tubs, 3);
  assert.equal(packBatch(0.299999, 100).tubs, 2);
  assert.equal(packBatch(1, 0).tubs, null);
});
test("unsold stock changes paid tubs but retains all incurred costs", () => {
  const r = fixture(),
    c = calculate(r);
  assert.equal(c.production.tubs, 32);
  assert.equal(c.production.paidTubs, 24);
  near(c.production.packagingCost, 3.2);
  near(c.production.total, 33.2);
  near(c.production.costPerPaid, 33.2 / 24);
  r.production.unsoldPct = 0;
  const d = calculate(r);
  near(d.production.total, c.production.total);
  near(d.production.costPerPaid, 33.2 / 32);
});
test("leftovers incur ingredient costs and no extra packaging", () => {
  const r = fixture();
  r.targetKg = 8.1;
  const c = calculate(r);
  assert.equal(c.production.tubs, 32);
  near(c.production.leftoverKg, 0.1);
  near(c.production.packagingCost, 3.2);
  near(c.ingredientCost, 20.25);
});
test("all unsold or no full tubs leaves paid cost undefined", () => {
  const r = fixture();
  r.production.unsoldPct = 100;
  const c = calculate(r);
  assert.equal(c.production.paidTubs, 0);
  assert.equal(c.production.costPerPaid, null);
  assert.equal(c.pricing.breakEvenWholesale, null);
  r.targetKg = 0.1;
  assert.equal(calculate(r).production.tubs, 0);
});
test("VAT and retailer margin use margin on retail sales", () => {
  near(wholesaleFromRetail(2.3, 7, 35), (2.3 / 1.07) * 0.65);
  assert.equal(wholesaleFromRetail(2.3, 7, 100), null);
  assert.equal(wholesaleFromRetail("", 7, 35), null);
});
test("actual wholesale drives revenue; ceiling is still comparison", () => {
  const r = fixture();
  r.pricing.driver = "actual";
  r.pricing.actualWholesale = 1.2;
  const c = calculate(r);
  near(c.pricing.wholesale, 1.2);
  near(c.pricing.revenue, 28.8);
  near(c.pricing.impliedMargin, (1 - 1.2 / (2.3 / 1.07)) * 100);
  near(c.pricing.breakEvenConsumer, (c.production.costPerPaid / 0.65) * 1.07);
});
test("unknown prices block total cost but do not block recipe scaling", () => {
  const r = fixture();
  r.ingredients[1].packPrice = "";
  let c = calculate(r);
  assert.equal(c.ingredientCost, null);
  near(c.factor, 2);
  near(c.knownReferenceCost, 4);
  r.ingredients[1].packPrice = 0;
  c = calculate(r);
  near(c.ingredientCost, 8);
});
test("invalid recipe quantities do not silently become zero", () => {
  const r = fixture();
  r.ingredients[0].quantity = "";
  const c = calculate(r);
  assert.equal(c.inputKg, null);
  assert.equal(c.production.tubs, null);
  assert.ok(c.issues.some((i) => i.area === "recipe"));
});
test("monthly allocation excludes inactive salaries and overhead", () => {
  const r = fixture();
  r.monthly.enabled = true;
  r.monthly.batches = 10;
  Object.assign(r.monthly, {
    rent: 100,
    insurance: 0,
    accounting: 0,
    marketing: 0,
    delivery: 0,
    otherFixed: 0,
    variablePaid: 0.05,
    depreciation: 20,
    salaries: 1000,
    founder: 500,
    fixedUtilities: 200,
  });
  let c = calculate(r);
  near(c.monthly.fixed, 100);
  near(c.monthly.batchExpenses, 332);
  near(c.monthly.variableExpenses, 12);
  near(c.monthly.cashExpenses, 444);
  near(c.monthly.cashSurplus, c.monthly.revenue - 444);
  near(c.monthly.operatingProfit, c.monthly.cashSurplus - 20);
  r.production.laborMode = "monthly";
  r.production.overheadMode = "monthly";
  c = calculate(r);
  near(c.production.laborCost, 0);
  near(c.production.overheadCost, 0);
  near(c.monthly.fixed, 1800);
  near(c.monthly.batchExpenses, 232);
});
test("inactive cost fields may be blank without blocking calculation", () => {
  const r = fixture();
  r.monthly.enabled = true;
  r.monthly.salaries = "";
  r.monthly.founder = "";
  r.monthly.fixedUtilities = "";
  assert.notEqual(calculate(r).monthly.cashExpenses, null);
  r.production.laborMode = "monthly";
  assert.equal(calculate(r).monthly.cashExpenses, null);
});
test("one monthly driver; proportional packed-tub equivalents", () => {
  const r = fixture();
  r.monthly.enabled = true;
  r.monthly.batches = 10;
  r.monthly.packed = 16;
  r.monthly.driver = "packed";
  const c = calculate(r);
  near(c.monthly.batchCount, 0.5);
  near(c.monthly.batchExpenses, 16.6);
  near(c.monthly.sold, 12);
  r.monthly.driver = "batches";
  near(calculate(r).monthly.packed, 320);
  r.monthly.batches = 1.5;
  assert.equal(calculate(r).monthly.packed, null);
});
test("break-even includes zero and negative contribution", () => {
  assert.equal(breakEven(100, 2), 50);
  assert.equal(breakEven(101, 2), 51);
  assert.equal(breakEven(100, 0), Infinity);
  assert.equal(breakEven(0, 0), Infinity);
  assert.equal(breakEven(100, -1), Infinity);
  assert.equal(breakEven(null, 1), null);
  const r = fixture();
  r.monthly.enabled = true;
  r.pricing.driver = "actual";
  r.pricing.actualWholesale = 0;
  const c = calculate(r);
  assert.equal(c.monthly.cashBreakEven, Infinity);
  assert.equal(c.monthly.accountingBreakEven, Infinity);
});
test("break-even volume actually covers all selected fixed and variable costs", () => {
  const r = fixture();
  r.monthly.enabled = true;
  Object.assign(r.monthly, {
    rent: 100,
    insurance: 0,
    accounting: 0,
    marketing: 0,
    delivery: 0,
    otherFixed: 0,
    variablePaid: 0,
    depreciation: 20,
  });
  const c = calculate(r),
    k = c.monthly.contributionPerPacked;
  assert.ok(c.monthly.cashBreakEven * k >= 100);
  assert.ok((c.monthly.cashBreakEven - 1) * k < 100);
  assert.ok(c.monthly.accountingBreakEven * k >= 120);
  assert.equal(
    c.monthly.cashBreakEvenBatches,
    Math.ceil(c.monthly.cashBreakEven / 32),
  );
});
test("recipe-only workflow is independent of other layers", () => {
  const r = fixture();
  r.production.enabled = false;
  r.production.weightG = "";
  r.monthly.enabled = true;
  const c = calculate(r);
  near(c.ingredientCost, 20);
  assert.equal(c.production, null);
  assert.equal(c.monthly, null);
});
test("local save and reload round-trip settings and blank fields", () => {
  const store = new Map(),
    storage = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, v),
    },
    s = initialState();
  s.recipes.push(createRecipe(true));
  s.activeId = s.recipes[1].id;
  saveState(storage, s);
  assert.deepEqual(loadState(storage), s);
});
test("duplicate is independent and keeps scenario settings", () => {
  const r = fixture(),
    copy = duplicateRecipe(r);
  assert.notEqual(copy.id, r.id);
  assert.notEqual(copy.ingredients[0].id, r.ingredients[0].id);
  copy.production.unsoldPct = 77;
  assert.equal(r.production.unsoldPct, 25);
});
test("import rejects malformed versions, settings, units and duplicate IDs", () => {
  assert.throws(() => validateBackup({ schemaVersion: 2, recipes: [] }));
  const s = initialState();
  s.recipes[0].ingredients[0].unit = "gallons";
  assert.throws(() => validateBackup(s));
  const t = initialState();
  t.recipes.push(structuredClone(t.recipes[0]));
  assert.throws(() => validateBackup(t));
  const u = initialState();
  u.recipes[0].production.enabled = "false";
  assert.throws(() => validateBackup(u));
});
test("CSV preserves unknowns, quotes names and protects formula-like text", () => {
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell('Tahini, "hulled"'), '"Tahini, ""hulled"""');
  assert.equal(csvCell("=1+1"), '"\'=1+1"');
  const r = fixture(),
    csv = makeCsv(r, calculate(r));
  assert.ok(csv.includes("Target ingredient cost EUR"));
  assert.ok(csv.includes("Expected paid tubs"));
  assert.ok(csv.includes('"33.2"'));
});
test("different chickpea forms require their own purchasing volume density", () => {
  const r = fixture();
  r.ingredients[0].packUnit = "l";
  r.ingredients[0].density = 1;
  r.ingredients[0].purchaseDensity = "";
  assert.equal(calculate(r).rows[0].referenceCost, null);
  r.ingredients[0].purchaseDensity = 0.8;
  near(calculate(r).rows[0].requirement, 2.5);
});
test("an unfinished name survives backup and local reload", () => {
  const s = initialState();
  s.recipes[0].name = "";
  s.recipes[0].ingredients[0].name = "";
  assert.deepEqual(validateBackup(s), s);
});
