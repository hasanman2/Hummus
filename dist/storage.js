export const STORAGE_KEY = "hummus-workshop-v1";
const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  `r-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function newIngredient(name = "New ingredient") {
  return {
    id: uid(),
    name,
    quantity: "",
    unit: "g",
    density: "",
    purchaseDensity: "",
    chickpea: false,
    recipeForm: "cooked",
    purchaseForm: "dry",
    cookedYield: "",
    packQuantity: "",
    packUnit: "kg",
    packPrice: "",
  };
}
export function createRecipe(blank = false) {
  const recipe = {
    id: uid(),
    name: blank ? "Untitled recipe" : "Classic hummus",
    example: !blank,
    yieldMode: "measured",
    finishedYieldKg: blank ? "" : 9.8,
    lossPct: "",
    targetKg: blank ? "" : 20,
    production: {
      enabled: false,
      weightG: 250,
      container: 0.08,
      lid: 0.03,
      label: 0.025,
      seal: 0.01,
      carton: 0.015,
      laborMode: "batch",
      laborHours: 1.5,
      hourlyCost: 20,
      overheadMode: "batch",
      energy: 2,
      cleaning: 1,
      other: 0,
      unsoldPct: 5,
    },
    pricing: {
      driver: "ceiling",
      ceiling: 2.3,
      vatPct: 7,
      marginPct: 35,
      actualWholesale: "",
    },
    monthly: {
      enabled: false,
      driver: "batches",
      batches: 40,
      packed: 3200,
      rent: 600,
      fixedUtilities: 150,
      salaries: 2500,
      founder: 1000,
      insurance: 60,
      accounting: 100,
      marketing: 100,
      delivery: 200,
      otherFixed: 0,
      variablePaid: 0,
      depreciation: 100,
    },
    ingredients: [],
  };
  const starter = [
    ["Chickpeas", 6.4, "kg", "", 5, "kg", 12, true],
    ["Tahini", 1.8, "kg", 1.1, 5, "kg", 35],
    ["Lemon juice", 650, "g", 1.03, 1, "l", 2.5],
    ["Oil", 350, "g", 0.92, 5, "l", 22],
    ["Garlic", 60, "g", "", 1, "kg", 4],
    ["Salt", 90, "g", "", 1, "kg", 0.8],
    ["Water", 600, "g", 1, 1, "l", 0],
    ["Spices", 50, "g", "", 0.5, "kg", 6],
  ];
  recipe.ingredients = starter.map(
    ([
      name,
      quantity,
      unit,
      density,
      packQuantity,
      packUnit,
      packPrice,
      chickpea,
    ]) => ({
      ...newIngredient(name),
      quantity: blank ? "" : quantity,
      unit,
      density: blank ? "" : density,
      packQuantity: blank ? "" : packQuantity,
      packUnit,
      packPrice: blank ? "" : packPrice,
      chickpea: !!chickpea,
      cookedYield: blank ? "" : 2.4,
    }),
  );
  if (blank) {
    for (const key of [
      "container",
      "lid",
      "label",
      "seal",
      "carton",
      "laborHours",
      "hourlyCost",
      "energy",
      "cleaning",
      "other",
      "unsoldPct",
    ])
      recipe.production[key] = "";
    for (const key of [
      "batches",
      "packed",
      "rent",
      "fixedUtilities",
      "salaries",
      "founder",
      "insurance",
      "accounting",
      "marketing",
      "delivery",
      "otherFixed",
      "variablePaid",
      "depreciation",
    ])
      recipe.monthly[key] = "";
  }
  return recipe;
}
export function initialState() {
  const r = createRecipe();
  return { schemaVersion: 1, activeId: r.id, recipes: [r] };
}
export function duplicateRecipe(recipe) {
  const r = structuredClone(recipe);
  r.id = uid();
  r.name = `${r.name} (copy)`;
  r.ingredients.forEach((i) => (i.id = uid()));
  return r;
}
// Rebuild trusted fields rather than merging arbitrary imported properties.
export function validateBackup(value) {
  if (
    !value ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.recipes) ||
    !value.recipes.length ||
    value.recipes.length > 100
  )
    throw new Error(
      "Choose a version 1 Hummus Workshop backup with 1–100 recipes.",
    );
  const text = (v, label, max = 200, allowBlank = false) => {
    if (typeof v !== "string" || (!allowBlank && !v.trim()) || v.length > max)
      throw new Error(`Invalid ${label}.`);
    return v;
  };
  const scalar = (v, label) => {
    if (v === "") return "";
    if (
      (typeof v !== "number" && typeof v !== "string") ||
      !Number.isFinite(Number(v)) ||
      String(v).trim() === ""
    )
      throw new Error(`Invalid ${label}.`);
    return v;
  };
  const choice = (v, choices, label) => {
    if (!choices.includes(v)) throw new Error(`Invalid ${label}.`);
    return v;
  };
  const boolean = (v, label) => {
    if (typeof v !== "boolean") throw new Error(`Invalid ${label}.`);
    return v;
  };
  const group = (src, template, choices = {}) => {
    if (!src || typeof src !== "object")
      throw new Error("Missing settings in backup.");
    const result = {};
    for (const k of Object.keys(template)) {
      result[k] = choices[k]
        ? choice(src[k], choices[k], k)
        : typeof template[k] === "boolean"
          ? boolean(src[k], k)
          : scalar(src[k], k);
    }
    return result;
  };
  const ids = new Set();
  const recipes = value.recipes.map((r) => {
    const base = createRecipe();
    const id = text(r.id, "recipe ID");
    if (ids.has(id)) throw new Error("Duplicate recipe IDs in backup.");
    ids.add(id);
    if (!Array.isArray(r.ingredients) || r.ingredients.length > 100)
      throw new Error("Each recipe can contain up to 100 ingredients.");
    const ingredientIds = new Set();
    const ingredients = r.ingredients.map((i) => {
      const id = text(i.id, "ingredient ID");
      if (ingredientIds.has(id)) throw new Error("Duplicate ingredient IDs.");
      ingredientIds.add(id);
      return {
        id,
        name: text(i.name, "ingredient name", 200, true),
        quantity: scalar(i.quantity, "quantity"),
        unit: choice(i.unit, ["g", "kg", "ml", "l"], "recipe unit"),
        density: scalar(i.density, "density"),
        purchaseDensity: scalar(i.purchaseDensity ?? "", "purchase density"),
        chickpea: boolean(i.chickpea, "chickpea setting"),
        recipeForm: choice(
          i.recipeForm,
          ["dry", "cooked"],
          "recipe chickpea form",
        ),
        purchaseForm: choice(
          i.purchaseForm,
          ["dry", "cooked"],
          "purchase chickpea form",
        ),
        cookedYield: scalar(i.cookedYield, "chickpea yield"),
        packQuantity: scalar(i.packQuantity, "purchase quantity"),
        packUnit: choice(i.packUnit, ["g", "kg", "ml", "l"], "purchase unit"),
        packPrice: scalar(i.packPrice, "purchase price"),
      };
    });
    return {
      id,
      name: text(r.name, "recipe name", 200, true),
      example: boolean(r.example, "example flag"),
      yieldMode: choice(r.yieldMode, ["measured", "loss"], "yield method"),
      finishedYieldKg: scalar(r.finishedYieldKg, "finished yield"),
      lossPct: scalar(r.lossPct, "process loss"),
      targetKg: scalar(r.targetKg, "target batch"),
      ingredients,
      production: group(r.production, base.production, {
        laborMode: ["batch", "monthly"],
        overheadMode: ["batch", "monthly"],
      }),
      pricing: group(r.pricing, base.pricing, {
        driver: ["ceiling", "actual"],
      }),
      monthly: group(r.monthly, base.monthly, {
        driver: ["batches", "packed"],
      }),
    };
  });
  return {
    schemaVersion: 1,
    activeId: recipes.some((r) => r.id === value.activeId)
      ? value.activeId
      : recipes[0].id,
    recipes,
  };
}
export function loadState(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  return raw ? validateBackup(JSON.parse(raw)) : initialState();
}
export function saveState(storage, state) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}
export function csvCell(value) {
  let str = value === null || value === undefined ? "" : String(value);
  if (/^[=+@\-\t\r]/.test(str)) str = "'" + str;
  return '"' + str.replaceAll('"', '""') + '"';
}
export function makeCsv(recipe, result) {
  const records = [
    ["Recipe", recipe.name],
    ["Yield method", recipe.yieldMode],
    ["Finished reference yield (kg)", result.finishedKg],
    ["Target finished weight (kg)", result.targetKg],
    [],
    [
      "Ingredient",
      "Reference quantity",
      "Recipe unit",
      "Reference input kg",
      "Recipe % by input mass",
      "Target quantity",
      "Target input kg",
      "Target purchase quantity",
      "Purchase unit",
      "Price per kg or L EUR",
      "Price unit",
      "Reference ingredient cost EUR",
      "Target ingredient cost EUR",
      "Cost share %",
    ],
  ];
  for (const r of result.rows)
    records.push([
      r.name,
      r.quantity,
      r.unit,
      r.inputKg,
      r.percentage,
      r.targetQuantity,
      r.targetInputKg,
      r.targetRequirement,
      r.purchaseUnit,
      r.unitPrice,
      r.unitPriceUnit,
      r.referenceCost,
      r.targetCost,
      r.costShare,
    ]);
  records.push(
    [],
    ["Total ingredient cost EUR", result.ingredientCost],
    ["Ingredient cost per finished kg EUR", result.ingredientCostPerKg],
  );
  if (result.production)
    records.push(
      ["Full packed tubs", result.production.tubs],
      ["Leftover kg (no revenue)", result.production.leftoverKg],
      ["Expected paid tubs", result.production.paidTubs],
      ["Packaging EUR", result.production.packagingCost],
      ["Selected batch production cost EUR", result.production.total],
      ["Cost per packed tub EUR", result.production.costPerPacked],
      ["Cost per paid tub EUR", result.production.costPerPaid],
    );
  if (result.pricing)
    records.push(
      ["Price driver", recipe.pricing.driver],
      ["Wholesale EUR excluding VAT", result.pricing.wholesale],
      [
        "Contribution per paid tub before monthly expenses EUR",
        result.pricing.contribution,
      ],
    );
  if (result.monthly)
    records.push(
      ["Monthly cash operating surplus EUR", result.monthly.cashSurplus],
      [
        "Monthly operating profit before interest and tax EUR",
        result.monthly.operatingProfit,
      ],
    );
  if (result.issues.length)
    records.push(
      [],
      ["Incomplete inputs / warnings"],
      ...result.issues.map((i) => [i.area, i.text]),
    );
  return "\ufeff" + records.map((r) => r.map(csvCell).join(",")).join("\r\n");
}
