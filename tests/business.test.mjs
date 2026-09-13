import test from "node:test";
import assert from "node:assert/strict";
import {
  createPreset,
  createRow,
  newIngredient,
  validateBackup,
  loadState,
  saveState,
  STORAGE_KEY,
  makeCsv,
} from "../dist/business-data.js";
import * as legacy from "../dist/storage.js";
import { calculate as oldCalculate } from "../dist/calculations.js";
import {
  calculateBusiness as calc,
  calculateRecipe,
  solveVolume,
} from "../dist/business-calculations.js";
const near = (a, b, t = 1e-7) =>
  assert.ok(a !== null && Math.abs(a - b) < t, `${a} != ${b}`);
const fixture = () => createPreset("workshop");
test("workshop reconciliation, fixed/variable split and startup reference", () => {
  const c = calc(fixture());
  near(c.tubs, 15000);
  near(c.paidTubs, 14250);
  near(c.realizedPerPaid, 1.5046728971962615);
  near(c.revenue, 21441.58878504672);
  near(c.ingredientCost, 6767.4);
  near(c.packagingCost, 5250);
  near(c.overhead, 6380);
  near(c.fixedOverhead, 4460);
  near(c.variableOverhead, 1920);
  near(c.view.cashCost, 18397.4);
  near(c.view.ebit, 2335.85545204672);
  near(c.startup.funding, 149425);
  assert.deepEqual(c.issues, []);
});
test("historical staff stays in a separate preset", () => {
  near(calc(createPreset("historical")).view.ebit, -8507.89454795328);
  assert.equal(fixture().business.staff.length, 0);
});
test("zero output retains fixed costs, no undefined per-unit allocations", () => {
  const r = fixture();
  r.business.volume.amount = 0;
  const c = calc(r);
  near(c.tubs, 0);
  near(c.revenue, 0);
  near(c.ingredientCost, 0);
  near(c.packagingCost, 0);
  near(c.overhead, 4460);
  assert.equal(c.realizedPerPaid, null);
  assert.equal(c.costRows[0].perPaidTub, null);
});
test("100% unsold retains production costs; no finite break-even", () => {
  const r = fixture();
  r.business.volume.unsoldPct = 100;
  const c = calc(r);
  near(c.revenue, 0);
  near(c.view.cashCost, 18397.4);
  assert.equal(solveVolume(r).kg, Infinity);
});
test("zero selling price and invalid margins never create misleading profits", () => {
  const r = fixture(),
    p = r.business.packages[1];
  p.priceMode = "actual";
  p.wholesale = 0;
  near(calc(r).revenue, 0);
  assert.equal(solveVolume(r).kg, Infinity);
  for (const margin of ["", -1, 100, 200]) {
    r.pricing.marginPct = margin;
    p.priceMode = "ceiling";
    assert.equal(calc(r).revenue, null);
    assert.equal(calc(r).incomplete, true);
  }
});
test("aggregate vs itemized packaging and detailed vs aggregate ingredients are exclusive", () => {
  const r = fixture(),
    p = r.business.packages[1];
  p.items.forEach((i) => (i.cost = 100));
  near(calc(r).packagingCost, 5250);
  p.mode = "items";
  p.items = p.items.slice(0, 1);
  p.items[0].cost = 0.1;
  near(calc(r).packagingCost, 1500);
  r.business.ingredientMode = "detailed";
  assert.equal(calc(r).ingredientCost, null);
  r.business.ingredientMode = "aggregate";
  near(calc(r).ingredientCost, 6767.4);
});
test("overfill changes tub count, not kg ingredient cost", () => {
  const r = fixture();
  r.business.packages[1].overfillG = 10;
  const c = calc(r);
  near(c.tubs, 3000 / 0.21);
  near(c.ingredientCost, 6767.4);
  near(c.labeledKg, (3000 / 0.21) * 0.2);
  r.business.volume.driver = "tubs";
  r.business.volume.amount = 1000;
  near(calc(r).kg, 210);
});
test("explicit package changes use independent packaging assumptions", () => {
  const r = fixture();
  r.business.volume.packageId = r.business.packages[0].id;
  const c = calc(r);
  near(c.tubs, 12000);
  near(c.packagingCost, 2880);
});
test("mixed kg and tub allocations reconcile and reject incomplete totals", () => {
  const r = fixture(),
    b = r.business;
  b.volume.mixMode = "kg";
  b.packages[0].mixPct = 50;
  b.packages[1].mixPct = 50;
  b.packages[2].mixPct = 0;
  near(calc(r).tubs, 13500);
  b.volume.mixMode = "tubs";
  near(calc(r).tubs, 3000 / 0.225);
  b.packages[0].mixPct = 49;
  assert.equal(calc(r).kg, null);
});
test("recoverable purchase VAT and sales VAT remain separate", () => {
  const r = fixture();
  r.business.ingredientVatPct = 19;
  near(calc(r).ingredientCost, 6767.4);
  r.business.ingredientRecoverable = false;
  near(calc(r).ingredientCost, 6767.4 * 1.19);
  const c = calc(r);
  near(c.vatCollected, c.revenue * 0.07);
  r.pricing.vatPct = 0;
  near(calc(r).realizedPerPaid, 2.3 * 0.7);
});
test("wholesale/direct channels and fee bases produce one bridge", () => {
  const r = fixture(),
    b = r.business;
  b.sales.directEnabled = true;
  b.sales.directPct = 20;
  b.sales.fees = [
    { ...createRow("fee"), name: "Wholesale rebate", rate: 10 },
    {
      ...createRow("fee"),
      name: "Direct discount",
      channel: "direct",
      basis: "paid_tub",
      rate: 0.1,
    },
  ];
  const c = calc(r),
    gross = (2.3 / 1.07) * (0.7 * 0.8 + 0.2),
    deduction = (2.3 / 1.07) * 0.7 * 0.8 * 0.1 + 0.02;
  near(c.grossRevenue, 14250 * gross);
  near(c.fees, 14250 * deduction);
  near(c.revenue, 14250 * (gross - deduction));
});
test("measured output ignores stored process loss; aids cost but do not add mass", () => {
  const r = fixture();
  r.finishedYieldKg = 8;
  r.targetKg = 16;
  r.lossPct = 40;
  r.ingredients = [
    {
      ...newIngredient("base"),
      quantity: 10,
      unit: "kg",
      packQuantity: 1,
      packUnit: "kg",
      packPrice: 2,
    },
    {
      ...newIngredient("discarded aid"),
      quantity: 1,
      unit: "kg",
      packQuantity: 1,
      packUnit: "kg",
      packPrice: 5,
      contributesMass: false,
    },
  ];
  let c = calculateRecipe(r);
  near(c.finishedKg, 8);
  near(c.inputKg, 10);
  near(c.referenceCost, 25);
  near(c.ingredientCostPerKg, 25 / 8);
  r.yieldMode = "loss";
  c = calculateRecipe(r);
  near(c.finishedKg, 6);
  r.ingredients[1].enabled = false;
  near(calculateRecipe(r).referenceCost, 20);
});
test("generic prepared yield and volume density are explicit", () => {
  const r = fixture();
  r.finishedYieldKg = 8;
  r.ingredients = [
    {
      ...newIngredient("prepared beans"),
      quantity: 8,
      unit: "kg",
      preparedYield: 2,
      packQuantity: 1,
      packUnit: "kg",
      packPrice: 3,
    },
  ];
  near(calculateRecipe(r).referenceCost, 12);
  r.ingredients[0] = {
    ...newIngredient("oil"),
    quantity: 1,
    unit: "l",
    packQuantity: 1,
    packUnit: "kg",
    packPrice: 3,
  };
  assert.equal(calculateRecipe(r).referenceCost, null);
  r.ingredients[0].density = 0.9;
  near(calculateRecipe(r).referenceCost, 2.7);
});
test("founder salaries, target costs and drawings remain distinct", () => {
  const r = fixture(),
    f = r.business.founders[0];
  f.payMode = "salary";
  f.gross = 1000;
  f.employerPct = 20;
  r.business.founders.forEach((x) => (x.target = 2000));
  let c = calc(r);
  near(c.views.before.ebit - c.views.actual.ebit, 1200);
  near(c.views.before.ebit - c.views.target.ebit, 6000);
  f.payMode = "drawings";
  f.actual = 1000;
  c = calc(r);
  near(c.views.before.ebit, c.views.actual.ebit);
  near(c.views.actual.cashSurplus - c.views.actual.cashRemaining, 1000);
});
test("missing actual pay differs from supplied zero; disabled rows are excluded", () => {
  const r = fixture();
  r.business.founders[0].actual = "";
  assert.equal(calc(r).views.actual.ebit, null);
  assert.notEqual(calc(r).views.before.ebit, null);
  r.business.founders[0].enabled = false;
  assert.notEqual(calc(r).views.actual.ebit, null);
  r.business.expenses[0].rate = "";
  assert.equal(calc(r).overhead, null);
  r.business.expenses[0].enabled = false;
  assert.notEqual(calc(r).overhead, null);
});
test("asset purchases, depreciation and leases do not overlap aggregate budgeting", () => {
  const r = fixture(),
    b = r.business;
  b.assets = [
    {
      ...createRow("asset"),
      enabled: true,
      quantity: 2,
      unitCost: 1200,
      lifeYears: 5,
      residual: 0,
    },
    {
      ...createRow("asset"),
      enabled: true,
      ownership: "lease",
      quantity: 1,
      leaseMonthly: 100,
    },
  ];
  near(calc(r).startup.equipment, 36500);
  near(calc(r).overhead, 6480);
  b.equipmentMode = "items";
  b.depreciationMode = "assets";
  const c = calc(r);
  near(c.startup.equipment, 2400);
  near(c.view.depreciation, 40);
  near(c.overhead, 6480);
});
test("outsourcing explicitly replaces selected rows and included ingredient/packaging categories", () => {
  const r = fixture(),
    b = r.business;
  b.operatingMode = "contract";
  b.contractPerKg = 4;
  b.contractIncludesIngredients = true;
  b.contractIncludesPackaging = true;
  b.expenses.forEach((e) => (e.replaceContract = true));
  const c = calc(r);
  near(c.ingredientCost, 0);
  near(c.packagingCost, 0);
  near(c.overhead, 12000);
  assert.ok(c.expenseRows[0].replaced);
});
test("calculated working capital replaces reserve and subtracts opening inventory once", () => {
  const r = fixture(),
    s = r.business.startup;
  s.reserveMode = "calculated";
  s.receivableDays = 30;
  s.inventoryDays = 30;
  s.supplierDays = 0;
  const c = calc(r);
  near(
    c.startup.workingCapital,
    c.revenue + c.ingredientCost + c.packagingCost,
  );
  near(c.startup.reserve, c.startup.workingCapital - 6000);
  near(c.startup.funding, 149425 - 60000 + c.startup.reserve);
});
test("tax has no loss credit and loan principal changes cash only", () => {
  const r = createPreset("historical");
  r.business.startup.taxPct = 25;
  r.business.startup.interest = 100;
  r.business.startup.principal = 500;
  const c = calc(r);
  near(c.view.tax, 0);
  near(c.view.pbt, c.view.ebit - 100);
  near(c.view.cashRemaining, c.view.cashSurplus - 600);
});
test("linear break-even hits zero operating profit at full precision", () => {
  const r = fixture(),
    be = solveVolume(r);
  near(calc(r, be.kg).views.actual.ebit, 0, 1e-6);
  near(be.tubs, be.kg / 0.2);
  assert.ok(solveVolume(r, { accounting: false }).kg < be.kg);
});
test("capacity steps solve the actual function, including profitable threshold boundary", () => {
  const r = fixture(),
    b = r.business;
  b.aggregatePerKg = 0;
  b.packages[1].aggregate = 0;
  b.packages[1].priceMode = "actual";
  b.packages[1].wholesale = 0.2;
  b.volume.unsoldPct = 0;
  b.historicalDep = 0;
  b.expenses = [
    {
      ...createRow("expense"),
      rate: 80,
      base: 0,
      behavior: "step",
      basis: "kg",
      stepSize: 100,
    },
  ];
  const be = solveVolume(r);
  near(be.kg, 80);
  near(calc(r, be.kg).view.ebit, 0);
  b.expenses[0].rate = 100;
  near(solveVolume(r).kg, 100);
});
test("step expenses with a large first block do not falsely imply no finite solution", () => {
  const r = fixture(),
    b = r.business;
  b.expenses.push({
    ...createRow("expense"),
    behavior: "step",
    basis: "kg",
    stepSize: 10000,
    rate: 1000,
  });
  const be = solveVolume(r);
  assert.ok(Number.isFinite(be.kg));
  near(calc(r, be.kg).view.ebit, 0, 1e-6);
});
test("profit and margin targets are simultaneous constraints rather than additive", () => {
  const r = fixture();
  const be = solveVolume(r, { profit: 1000, marginPct: 10 });
  const c = calc(r, be.kg);
  assert.ok(c.view.ebit >= 1000 - 1e-6);
  assert.ok(c.view.operatingMargin >= 10 - 1e-6);
  near(c.view.ebit, Math.max(1000, c.revenue * 0.1), 1e-6);
});
test("known capacity and task allocation limit feasible output; unsupported capacity remains unknown", () => {
  const r = fixture(),
    b = r.business;
  assert.equal(calc(r).capacityKg, null);
  b.capacity[0].amount = 1000;
  assert.equal(solveVolume(r).status, "Unattainable with current capacity");
  b.founders.forEach((f) => (f.availableHours = 100));
  b.workload.forEach((w) => {
    w.rate = 0;
    w.basis = "month";
  });
  b.workload[0].rate = 0.1;
  b.workload[0].basis = "kg";
  near(calc(r).teamTasks[0].capacity, 1200);
  assert.equal(calc(r).teamTasks[0].overloaded, true);
});
test("schema migration retains recipe input, margin, IDs and v1 storage untouched", () => {
  const old = legacy.initialState();
  old.recipes[0].production.enabled = true;
  old.recipes[0].monthly.enabled = true;
  const data = new Map([[legacy.STORAGE_KEY, JSON.stringify(old)]]),
    storage = {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => data.set(k, v),
    };
  const migrated = loadState(storage);
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.activeId, old.activeId);
  assert.equal(migrated.recipes[0].pricing.marginPct, 35);
  assert.equal(
    migrated.recipes[0].ingredients[0].quantity,
    old.recipes[0].ingredients[0].quantity,
  );
  near(
    calculateRecipe(migrated.recipes[0]).ingredientCost,
    oldCalculate(old.recipes[0]).ingredientCost,
  );
  saveState(storage, migrated);
  assert.equal(data.get(legacy.STORAGE_KEY), JSON.stringify(old));
  assert.deepEqual(loadState(storage), validateBackup(migrated));
  assert.ok(data.has(STORAGE_KEY));
});
test("schema2 round trip validates all presets; malformed numbers and enums are rejected", () => {
  for (const key of [
    "original",
    "workshop",
    "actual",
    "target",
    "historical",
  ]) {
    const r = createPreset(key);
    const s = { schemaVersion: 2, activeId: r.id, recipes: [r] };
    assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(s))), s);
  }
  const r = fixture(),
    s = { schemaVersion: 2, activeId: r.id, recipes: [r] };
  r.business.volume.amount = "oops";
  assert.throws(() => validateBackup(s), /invalid number/);
  r.business.volume.amount = 3000;
  r.business.ingredientMode = "both";
  assert.throws(() => validateBackup(s), /invalid option/);
});
test("CSV includes editable inputs and results and prevents formula execution", () => {
  const r = fixture();
  r.name = "=1+1";
  const csv = makeCsv(r, calc(r));
  assert.ok(csv.includes("business.aggregatePerKg"));
  assert.ok(csv.includes("business.views.actual.ebit"));
  assert.ok(csv.includes("'=1+1"));
});

test("migration keeps inactive monthly labor and utilities out of batch-cost scenarios", () => {
  for (const laborMode of ["batch", "monthly"])
    for (const overheadMode of ["batch", "monthly"]) {
      const old = legacy.initialState(),
        r = old.recipes[0];
      r.production.enabled = true;
      r.monthly.enabled = true;
      r.production.laborMode = laborMode;
      r.production.overheadMode = overheadMode;
      const migrated = validateBackup(old).recipes[0],
        actual = calc(migrated),
        expected = oldCalculate(r);
      near(actual.view.ebit, expected.monthly.operatingProfit);
    }
});

test("outsourced packaging ignores incomplete inactive package costs", () => {
  const r = fixture();
  r.business.operatingMode = "contract";
  r.business.contractPerKg = 4;
  r.business.contractIncludesPackaging = true;
  r.business.packages[1].aggregate = "";
  near(calc(r).packagingCost, 0);
  assert.ok(!calc(r).issues.some((i) => i.includes("aggregate packaging")));
});
