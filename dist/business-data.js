import * as legacy from "./storage.js";
export const STORAGE_KEY = "hummus-workshop-v2";
export const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  `b-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const tasks = [
  "production",
  "packing",
  "cleaning",
  "purchasing",
  "administration",
  "sales",
  "delivery",
];
export const presets = [
  ["original", "Original 250 g"],
  ["workshop", "Workshop 200 g alternative"],
  ["actual", "Three founders · actual pay"],
  ["target", "Three founders · target pay"],
  ["historical", "Historical paid staff"],
];
const row = (name) => ({ id: uid(), name, enabled: true });
export function newIngredient(name) {
  return {
    ...legacy.newIngredient(name),
    enabled: true,
    contributesMass: true,
    preparedYield: "",
    vatPct: 0,
    recoverable: true,
  };
}
export function createRow(kind) {
  const common = row("New " + kind);
  switch (kind) {
    case "ingredient":
      return newIngredient();
    case "item":
      return { ...common, cost: "", vatPct: 0, recoverable: true };
    case "package":
      return {
        ...common,
        sizeG: 250,
        overfillG: 0,
        mixPct: 0,
        mode: "aggregate",
        aggregate: "",
        vatPct: 0,
        recoverable: true,
        priceMode: "ceiling",
        wholesale: "",
        shelf: 2.3,
        directShelf: 2.3,
        items: [
          "Container",
          "Lid",
          "Label",
          "Seal",
          "Carton allocation",
          "Pallet / wrap allocation",
          "Recycling fee",
        ].map((name) => ({ ...createRow("item"), name, cost: "" })),
      };
    case "expense":
      return {
        ...common,
        category: "Other",
        classification: "manufacturing",
        status: "quotation",
        behavior: "fixed",
        basis: "kg",
        base: 0,
        rate: "",
        consumption: 1,
        consumptionUnit: "unit",
        stepSize: "",
        vatPct: 0,
        recoverable: true,
        replaceShared: false,
        replaceContract: false,
      };
    case "fee":
      return {
        ...common,
        channel: "wholesale",
        basis: "gross",
        rate: "",
        status: "planning",
      };
    case "founder":
      return {
        ...common,
        availableHours: "",
        payMode: "cost",
        actual: 0,
        gross: 0,
        employerPct: 0,
        target: "",
        economicRate: "",
        allocations: Object.fromEntries(
          tasks.map((t) => [
            t,
            t === "production"
              ? 40
              : t === "packing"
                ? 20
                : t === "cleaning" || t === "administration" || t === "delivery"
                  ? 10
                  : 5,
          ]),
        ),
      };
    case "staff":
      return {
        ...common,
        payMode: "monthly",
        rate: "",
        hours: "",
        employerPct: 0,
        classification: "manufacturing",
      };
    case "workload":
      return { ...common, task: "production", rate: "", basis: "batch" };
    case "asset":
      return {
        ...common,
        enabled: false,
        quantity: 1,
        unitCost: "",
        priority: "essential",
        ownership: "purchase",
        lifeYears: "",
        residual: 0,
        leaseMonthly: "",
        capacityKg: "",
        vatPct: 0,
        recoverable: true,
      };
    case "capacity":
      return { ...common, amount: "", basis: "kg" };
    default:
      throw new Error("Unknown row type");
  }
}
function expenses() {
  const data = [
    ["Rent", 1800, 0, "manufacturing"],
    ["Production electricity", 120, 0.15, "manufacturing"],
    ["Gas / hot water", 0, 0.1, "manufacturing"],
    ["Process water and sewer", 30, 0.05, "manufacturing"],
    ["Refrigeration electricity", 300, 0, "manufacturing"],
    ["Waste disposal", 150, 0, "manufacturing"],
    ["Cleaning chemicals", 0, 0.05, "manufacturing"],
    ["Pest control", 70, 0, "manufacturing"],
    ["Insurance", 180, 0, "administration"],
    ["Hygiene / laboratory testing", 350, 0, "manufacturing"],
    ["Maintenance allowance", 200, 0, "manufacturing"],
    ["Gloves / hairnets / consumables", 0, 0.04, "manufacturing"],
    ["Accounting / payroll services", 200, 0, "administration"],
    ["Software", 100, 0, "administration"],
    ["Telephone / internet", 60, 0, "administration"],
    ["Marketing / samples", 300, 0, "sales"],
    ["Refrigerated van lease", 450, 0, "distribution"],
    ["Delivery fuel / vehicle running", 0, 0.25, "distribution"],
    ["Administration contingency", 150, 0, "administration"],
  ];
  return data.map(([name, fixed, variable, classification]) => {
    const e = {
      ...createRow("expense"),
      name,
      classification,
      category: classification,
      status: "planning",
      behavior: variable ? "variable" : "fixed",
      base: variable ? fixed : 0,
      rate: variable || fixed,
    };
    if (name === "Production electricity")
      Object.assign(e, { consumption: 0.5, rate: 0.3, consumptionUnit: "kWh" });
    if (name === "Gas / hot water")
      Object.assign(e, { consumption: 1, rate: 0.1, consumptionUnit: "kWh" });
    if (name === "Process water and sewer")
      Object.assign(e, {
        consumption: 0.01,
        rate: 5,
        consumptionUnit: "m³ (0.01 m³ = 10 L)",
      });
    if (name === "Refrigeration electricity")
      Object.assign(e, {
        consumption: 1000,
        rate: 0.3,
        consumptionUnit: "kWh",
      });
    return e;
  });
}
export function defaultBusiness() {
  const packages = [250, 200, 500].map((sizeG, i) => ({
    ...createRow("package"),
    name:
      sizeG === 200
        ? "200 g · workshop alternative"
        : `${sizeG} g${sizeG === 250 ? " · original" : ""}`,
    sizeG,
    aggregate: [0.24, 0.35, 0.33][i],
    mixPct: i === 0 ? 100 : 0,
  }));
  return {
    preset: "original",
    ingredientMode: "aggregate",
    aggregatePerKg: 2.2558,
    ingredientVatPct: 0,
    ingredientRecoverable: true,
    volume: {
      driver: "kg",
      amount: 3000,
      days: 20,
      mixMode: "single",
      packageId: packages[0].id,
      unsoldPct: 5,
      deliveries: 20,
    },
    packages,
    sales: { directEnabled: false, directPct: 0, fees: [] },
    founders: [1, 2, 3].map((n) => ({
      ...createRow("founder"),
      name: `Founder ${n}`,
    })),
    staff: [],
    workload: tasks.map((task) => ({
      ...createRow("workload"),
      name: task[0].toUpperCase() + task.slice(1),
      task,
      basis: ["administration", "purchasing", "sales"].includes(task)
        ? "month"
        : task === "delivery"
          ? "delivery"
          : "batch",
    })),
    expenses: expenses(),
    operatingMode: "own",
    sharedMonthly: "",
    contractPerKg: "",
    contractIncludesIngredients: false,
    contractIncludesPackaging: false,
    equipmentMode: "aggregate",
    equipmentBudget: 36500,
    equipmentLifeYears: "",
    equipmentResidual: 0,
    assets: [
      "Soaking equipment",
      "Cooker",
      "Grinder",
      "Mixer",
      "Filler",
      "Sealer",
      "Labeling equipment",
      "Refrigeration",
      "Rapid cooling",
      "Tables",
      "Scales",
      "Cleaning equipment",
      "Storage containers",
      "Sinks",
      "Monitoring instruments",
      "Racks",
      "Utensils",
      "Coding equipment",
      "Water treatment",
    ].map((name) => ({
      ...createRow("asset"),
      name,
      priority: name === "Water treatment" ? "optional" : "essential",
    })),
    depreciationMode: "historical",
    historicalDep: 708.333333,
    startup: {
      conversion: 20000,
      installation: 3000,
      deposits: 7000,
      launch: 5500,
      branding: 2500,
      openingStock: 6000,
      contingencyPct: 15,
      reserveMode: "simple",
      reserve: 60000,
      receivableDays: "",
      inventoryDays: "",
      supplierDays: "",
      loan: 0,
      equity: 0,
      interest: 0,
      principal: 0,
      taxPct: 0,
      investment: 0,
      wcChange: 0,
      drawings: 0,
    },
    capacity: ["Cooking", "Cooling", "Filling", "Storage", "Delivery"].map(
      (name) => ({
        ...createRow("capacity"),
        name,
        basis: name === "Filling" ? "tubs" : "kg",
      }),
    ),
    targets: {
      payView: "actual",
      profit: 0,
      marginPct: 0,
      retailers: "",
      paidPerRetailerWeek: "",
      searchKg: 100000,
    },
  };
}
export function createPreset(key = "original") {
  const r = legacy.createRecipe(true);
  r.name = presets.find((p) => p[0] === key)?.[1] || "Business scenario";
  r.example = false;
  r.ingredients = r.ingredients.map((i) => ({
    ...newIngredient(i.name),
    id: i.id,
  }));
  r.business = defaultBusiness();
  r.business.preset = key;
  r.pricing.marginPct = 30;
  // Workshop recipe quantities and batch yield were not supplied. Keep them blank.
  if (["workshop", "historical"].includes(key))
    r.business.volume.packageId = r.business.packages[1].id;
  if (key === "target") r.business.targets.payView = "target";
  if (key === "historical")
    r.business.staff = [
      {
        ...createRow("staff"),
        name: "Historical payroll comparison",
        rate: 10843.75,
        hours: 0,
      },
    ];
  return r;
}
export function createRecipe(blank = false) {
  if (blank) {
    const r = createPreset();
    r.name = "Untitled scenario";
    return r;
  }
  const r = legacy.createRecipe(false);
  return migrateRecipe(r);
}
function migrateRecipe(r) {
  const c = structuredClone(r),
    b = defaultBusiness();
  c.ingredients = c.ingredients.map((i) => ({
    ...newIngredient(i.name),
    ...i,
  }));
  c.business = b;
  b.preset = "migrated";
  b.ingredientMode = "detailed";
  const p = b.packages[0];
  p.name = `${r.production.weightG || "Custom"} g · saved package`;
  p.sizeG = r.production.weightG;
  p.mode = "items";
  p.items = ["container", "lid", "label", "seal", "carton"].map((k) => ({
    ...createRow("item"),
    name: k,
    cost: r.production[k],
  }));
  p.priceMode = r.pricing.driver;
  p.wholesale = r.pricing.actualWholesale;
  p.shelf = r.pricing.ceiling;
  p.directShelf = r.pricing.ceiling;
  b.volume.unsoldPct = r.production.unsoldPct;
  b.volume.driver = r.monthly.driver === "packed" ? "tubs" : "batches";
  b.volume.amount =
    r.monthly.driver === "packed" ? r.monthly.packed : r.monthly.batches;
  b.expenses = [];
  b.staff = [];
  b.equipmentBudget = "";
  b.historicalDep = r.monthly.enabled ? r.monthly.depreciation : 0;
  const add = (
    name,
    rate,
    classification = "administration",
    behavior = "fixed",
    basis = "month",
  ) =>
    b.expenses.push({
      ...createRow("expense"),
      name,
      category: "Saved scenario",
      status: "supplied",
      rate,
      classification,
      behavior,
      basis,
    });
  if (r.monthly.enabled) {
    for (const key of [
      "rent",
      "insurance",
      "accounting",
      "marketing",
      "delivery",
      "otherFixed",
    ])
      add(
        key,
        r.monthly[key],
        key === "rent"
          ? "manufacturing"
          : key === "delivery"
            ? "distribution"
            : "administration",
      );
    if (r.production.overheadMode === "monthly")
      add(
        "Saved monthly utilities / cleaning",
        r.monthly.fixedUtilities,
        "manufacturing",
      );
    add(
      "Saved variable cost per paid tub",
      r.monthly.variablePaid,
      "sales",
      "variable",
      "paid_tub",
    );
    b.founders[0].actual =
      r.production.laborMode === "monthly" ? r.monthly.founder : 0;
    if (r.production.laborMode === "monthly")
      b.staff = [
        {
          ...createRow("staff"),
          name: "Saved monthly salaries",
          rate: r.monthly.salaries,
          hours: 0,
        },
      ];
  }
  if (r.production.enabled) {
    if (r.production.overheadMode === "batch")
      for (const key of ["energy", "cleaning", "other"])
        add(
          `Saved ${key}`,
          r.production[key],
          "manufacturing",
          r.production.overheadMode === "batch" ? "variable" : "fixed",
          r.production.overheadMode === "batch" ? "batch" : "month",
        );
    if (r.production.laborMode === "batch") {
      add(
        "Saved batch labor",
        r.production.hourlyCost,
        "manufacturing",
        "variable",
        "batch",
      );
      b.expenses.at(-1).consumption = r.production.laborHours;
    }
  }
  return c;
}
export function initialState() {
  const r = createPreset();
  return { schemaVersion: 2, activeId: r.id, recipes: [r] };
}
export function duplicateRecipe(r) {
  const c = structuredClone(r);
  c.id = uid();
  c.name = `${r.name} (copy)`;
  return c;
}
const enums = {
  ingredientMode: ["aggregate", "detailed"],
  mixMode: ["single", "kg", "tubs"],
  mode: ["aggregate", "items"],
  priceMode: ["ceiling", "actual"],
  channel: ["wholesale", "direct", "all"],
  classification: ["manufacturing", "administration", "sales", "distribution"],
  status: ["supplied", "planning", "target", "quotation"],
  behavior: ["fixed", "variable", "step"],
  operatingMode: ["own", "shared", "contract"],
  equipmentMode: ["aggregate", "items"],
  priority: ["essential", "optional", "manual"],
  ownership: ["owned", "purchase", "lease"],
  depreciationMode: ["historical", "assets"],
  reserveMode: ["simple", "calculated"],
  payView: ["before", "actual", "target"],
  task: tasks,
};
const arrayKinds = {
  packages: "package",
  items: "item",
  fees: "fee",
  founders: "founder",
  staff: "staff",
  workload: "workload",
  expenses: "expense",
  assets: "asset",
  capacity: "capacity",
};
const textKeys = new Set([
  "id",
  "name",
  "category",
  "consumptionUnit",
  "preset",
]);
function validateTree(input, template, path = "business") {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error(`${path}: expected an object`);
  if (
    Object.keys(input).some((k) =>
      ["__proto__", "constructor", "prototype"].includes(k),
    )
  )
    throw new Error("Unsafe backup key");
  const out = {};
  for (const [key, expected] of Object.entries(template)) {
    if (!(key in input)) throw new Error(`${path}.${key} is missing`);
    const value = input[key],
      at = `${path}.${key}`;
    if (Array.isArray(expected)) {
      if (!Array.isArray(value) || value.length > 100)
        throw new Error(`${at}: maximum 100 rows`);
      out[key] = value.map((v) =>
        validateTree(v, createRow(arrayKinds[key]), at),
      );
      continue;
    }
    if (expected && typeof expected === "object") {
      out[key] = validateTree(value, expected, at);
      continue;
    }
    if (typeof expected === "boolean") {
      if (typeof value !== "boolean")
        throw new Error(`${at}: expected true or false`);
      out[key] = value;
      continue;
    }
    let options = enums[key];
    if (key === "driver") options = ["kg", "tubs", "batches"];
    if (key === "payMode")
      options = path.endsWith("staff")
        ? ["monthly", "hourly"]
        : ["cost", "salary", "drawings"];
    if (key === "basis")
      options = path.endsWith("fees")
        ? ["gross", "paid_tub"]
        : path.endsWith("capacity")
          ? ["kg", "tubs"]
          : ["kg", "packed_tub", "paid_tub", "batch", "delivery", "month"];
    if (options) {
      if (!options.includes(value)) throw new Error(`${at}: invalid option`);
      out[key] = value;
      continue;
    }
    if (textKeys.has(key) || key === "packageId") {
      if (typeof value !== "string" || value.length > 500)
        throw new Error(`${at}: invalid text`);
      out[key] = value;
      continue;
    }
    if (
      value !== "" &&
      ((typeof value !== "number" && typeof value !== "string") ||
        !Number.isFinite(Number(value)) ||
        (typeof value === "string" && !value.trim()))
    )
      throw new Error(`${at}: invalid number`);
    out[key] = value;
  }
  return out;
}
export function validateBackup(data) {
  if (data?.schemaVersion === 1) {
    const old = legacy.validateBackup(data);
    return {
      ...old,
      schemaVersion: 2,
      recipes: old.recipes.map(migrateRecipe),
    };
  }
  if (data?.schemaVersion !== 2) throw new Error("Unsupported backup schema");
  const base = legacy.validateBackup({ ...data, schemaVersion: 1 });
  base.schemaVersion = 2;
  base.recipes = base.recipes.map((r, i) => {
    r.business = validateTree(data.recipes[i].business, defaultBusiness());
    r.ingredients = r.ingredients.map((ing, j) => ({
      ...ing,
      ...validateTree(
        data.recipes[i].ingredients[j],
        {
          enabled: true,
          contributesMass: true,
          preparedYield: "",
          vatPct: 0,
          recoverable: true,
        },
        "ingredient",
      ),
    }));
    const ids = r.business.packages.map((p) => p.id);
    if (
      new Set(ids).size !== ids.length ||
      !ids.includes(r.business.volume.packageId)
    )
      throw new Error("Package selection or IDs are invalid");
    return r;
  });
  return base;
}
export function loadState(storage) {
  const current = storage.getItem(STORAGE_KEY);
  if (current) return validateBackup(JSON.parse(current));
  const old = storage.getItem(legacy.STORAGE_KEY);
  return old ? validateBackup(JSON.parse(old)) : initialState();
}
export function saveState(storage, state) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}
export function makeCsv(recipe, result) {
  const rows = [["kind", "path / metric", "value"]];
  const walk = (obj, path, kind) => {
    for (const [k, v] of Object.entries(obj || {})) {
      const p = path ? `${path}.${k}` : k;
      if (v && typeof v === "object") walk(v, p, kind);
      else
        rows.push([
          kind,
          p,
          v === null ? "INCOMPLETE" : v === Infinity ? "NO FINITE VOLUME" : v,
        ]);
    }
  };
  walk(recipe, "scenario", "input");
  walk(result, "business", "result");
  return (
    "\uFEFF" +
    rows
      .map((r) =>
        r
          .map((v) => {
            let value = String(v ?? "");
            if (typeof v === "string" && !Number.isFinite(Number(v)) && /^[=+@\-\t\r]/.test(v)) value = "'" + value;
            return '"' + value.replaceAll('"', '""') + '"';
          })
          .join(","),
      )
      .join("\r\n")
  );
}
