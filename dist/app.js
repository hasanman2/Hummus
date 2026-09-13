import { calculate, number } from "./calculations.js";
import {
  initialState,
  createRecipe,
  newIngredient,
  duplicateRecipe,
  validateBackup,
  loadState,
  saveState,
  makeCsv,
} from "./storage.js";
const app = document.querySelector("#app");
let state,
  storageAvailable = true,
  storageError = "",
  tab = "recipe",
  result;
try {
  state = loadState(localStorage);
} catch {
  state = initialState();
  storageAvailable = false;
  storageError =
    "Stored data could not be read. Existing browser data has been left untouched. Export this session before closing.";
}
const tabs = [
  ["recipe", "Recipe & batch"],
  ["ingredients", "Ingredient prices"],
  ["production", "Production"],
  ["pricing", "Pricing"],
  ["monthly", "Monthly business"],
];
const money = (v) =>
  v === null || v === undefined
    ? "—"
    : new Intl.NumberFormat("en-IE", {
        style: "currency",
        currency: "EUR",
      }).format(v);
const fmt = (v, d = 2) =>
  v === null || v === undefined
    ? "—"
    : Number.isFinite(v)
      ? new Intl.NumberFormat("en-IE", { maximumFractionDigits: d }).format(v)
      : "No finite volume";
const qty = (v, u) =>
  v === null ? "—" : `${fmt(v, ["g", "ml"].includes(u) ? 1 : 3)} ${u}`;
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const active = () => state.recipes.find((r) => r.id === state.activeId);
const get = (path) => path.split(".").reduce((v, k) => v?.[k], active());
function toast(message) {
  const el = document.querySelector("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 4500);
}
function persist() {
  if (!storageAvailable) return;
  try {
    saveState(localStorage, state);
  } catch {
    storageAvailable = false;
    storageError =
      "Browser storage is unavailable or full. Export JSON to keep your recipes.";
    toast(storageError);
  }
}
function field(
  label,
  path,
  {
    unit = "",
    help = "",
    type = "number",
    min = 0,
    max,
    step = "any",
    disabled = false,
    optional = false,
  } = {},
) {
  const value = get(path),
    n = number(value),
    invalid =
      type === "number" &&
      !disabled &&
      !(optional && value === "") &&
      (n === null || n < min || (max !== undefined && n > max));
  return `<label class="field"><span class="field-label">${label}</span><div class="unit-field"><input data-path="${path}" aria-label="${esc(label)}" type="${type}" value="${esc(value)}" ${type === "number" ? `min="${min}" ${max !== undefined ? `max="${max}"` : ""} step="${step}"` : 'maxlength="200"'} ${disabled ? "disabled" : ""} ${invalid ? 'aria-invalid="true"' : ""} ${help ? `aria-describedby="help-${path.replaceAll(".", "-")}"` : ""}>${unit ? `<span>${unit}</span>` : ""}</div>${help ? `<span class="field-help" id="help-${path.replaceAll(".", "-")}">${help}</span>` : ""}</label>`;
}
function select(label, path, options, help = "") {
  return `<label class="field"><span class="field-label">${label}</span><select data-path="${path}" aria-label="${esc(label)}">${options.map(([v, t]) => `<option value="${esc(v)}" ${get(path) === v ? "selected" : ""}>${t}</option>`).join("")}</select>${help ? `<span class="field-help">${help}</span>` : ""}</label>`;
}
const check = (label, path) =>
  `<label class="check"><input type="checkbox" data-path="${path}" ${get(path) ? "checked" : ""}>${label}</label>`;
const stat = (label, value) =>
  `<div class="stat"><span>${label}</span><strong>${value}</strong></div>`;
const metric = (label, value) =>
  `<div class="metric"><div class="label">${label}</div><div class="value">${value}</div></div>`;
const metrics = (items) =>
  `<div class="metrics-grid">${items.map(([l, v]) => metric(l, v)).join("")}</div>`;
const table = (items) =>
  `<div class="table-wrap"><table class="result-table"><tbody>${items.map(([l, v]) => `<tr><td>${l}</td><td>${v}</td></tr>`).join("")}</tbody></table></div>`;
const panel = (title, body, tag = "") =>
  `<section class="panel"><div class="panel-header"><h2>${title}</h2>${tag ? `<span class="tag">${tag}</span>` : ""}</div>${body}</section>`;
const grid = (body, three = false) =>
  `<div class="field-grid ${three ? "three" : ""} section-gap">${body}</div>`;
const note = (body) => `<p class="note">${body}</p>`;
function warnings(area) {
  const items = result.issues.filter((i) => i.area === area);
  return items.length
    ? `<div class="warnings"><strong>Check these inputs</strong><ul>${items
        .slice(0, 6)
        .map((i) => `<li>${esc(i.text)}</li>`)
        .join("")}</ul>${
        items.length > 6
          ? `<details><summary>${items.length - 6} more items</summary><ul>${items
              .slice(6)
              .map((i) => `<li>${esc(i.text)}</li>`)
              .join("")}</ul></details>`
          : ""
      }</div>`
    : "";
}
const ingredientField = (i, key, label, opts = {}) =>
  field(label, `ingredients.${i}.${key}`, opts);
function recipePanel() {
  const r = active();
  return (
    panel(
      "Recipe & batch",
      grid(
        field("Recipe name", "name", { type: "text" }) +
          field("Target finished batch", "targetKg", {
            unit: "kg",
            min: 0.000001,
          }) +
          select("Yield calculation", "yieldMode", [
            ["measured", "Measured finished yield"],
            ["loss", "Explicit process-loss assumption"],
          ]) +
          (r.yieldMode === "measured"
            ? field("Measured reference yield", "finishedYieldKg", {
                unit: "kg",
                min: 0.000001,
                help: "Usable hummus weighed after processing.",
              })
            : field("Process loss on ingredient input", "lossPct", {
                unit: "%",
                max: 99.999999,
                help: "Enter 0 for no loss. This replaces measured yield.",
              })),
      ) +
        note(
          `<strong>${r.yieldMode === "measured" ? "Measured-yield scaling" : "Input weight minus explicit process loss"}</strong><br>${r.yieldMode === "measured" ? "Target finished weight ÷ measured reference yield. No additional process loss is applied." : "Target finished weight ÷ [reference input weight × (1 − process loss)]. The saved measured yield is inactive."} Percentages use input mass after cooking chickpeas.`,
        ) +
        warnings("recipe"),
      r.example ? "EXAMPLE DATA" : "",
    ) +
    panel(
      "Ingredients",
      `<div class="ingredient-head"><span>Ingredient</span><span>Reference quantity</span><span class="cell-number">Target</span><span class="cell-number">Recipe %</span><span></span></div>${r.ingredients
        .map((i, n) => {
          const c = result.rows[n];
          return `<div class="ingredient-row"><input class="ingredient-name" aria-label="Ingredient ${n + 1} name" data-path="ingredients.${n}.name" value="${esc(i.name)}" maxlength="200"><div class="quantity-group"><input type="number" min="0" step="any" data-path="ingredients.${n}.quantity" aria-label="${esc(i.name)} reference quantity" value="${esc(i.quantity)}" ${number(i.quantity) === null || number(i.quantity) < 0 ? 'aria-invalid="true"' : ""}><select data-path="ingredients.${n}.unit" aria-label="${esc(i.name)} recipe unit">${["g", "kg", "ml", "l"].map((u) => `<option ${i.unit === u ? "selected" : ""}>${u}</option>`).join("")}</select></div><span class="cell-number scaled">${qty(c.targetQuantity, i.unit)}</span><span class="cell-number percentage">${fmt(c.percentage, 1)}${c.percentage === null ? "" : "%"}</span><button class="delete" data-action="remove" data-id="${esc(i.id)}" aria-label="Remove ${esc(i.name)}">×</button><div class="density-row"><details data-detail="ingredient-${i.id}"><summary>${i.chickpea ? `Chickpea conversion · ${i.recipeForm} recipe / ${i.purchaseForm} purchase` : "Density & ingredient options"}</summary><div class="detail-grid">${ingredientField(n, "density", `${esc(i.name)} density`, { unit: "kg/L", min: 0.000001, optional: !["ml", "l"].includes(i.unit), help: "Required for mass ↔ volume. Confirm example densities." })}<div>${check("This is a chickpea ingredient", `ingredients.${n}.chickpea`)}</div>${
            i.chickpea
              ? select("Recipe chickpea form", `ingredients.${n}.recipeForm`, [
                  ["cooked", "Cooked / drained"],
                  ["dry", "Dry, then cooked"],
                ]) +
                select(
                  "Purchased chickpea form",
                  `ingredients.${n}.purchaseForm`,
                  [
                    ["dry", "Dry"],
                    ["cooked", "Cooked / drained"],
                  ],
                ) +
                ingredientField(
                  n,
                  "cookedYield",
                  "Cooked-to-dry yield factor",
                  {
                    unit: "×",
                    min: 0.000001,
                    help: "kg cooked and drained per kg dry.",
                  },
                )
              : ""
          }</div>${i.chickpea ? note("Dry recipe quantities are cooked before blending. Input mass includes absorbed cooking water through this yield factor. The water ingredient is additional blending water only.") : ""}</details></div></div>`;
        })
        .join(
          "",
        )}<button class="quiet add-ingredient" data-action="add">+ Add ingredient</button><div class="total-line"><span>Total reference input</span><span>${qty(result.inputKg, "kg")}</span></div><p class="subtext">Input weight and usable finished weight are kept separate.</p>`,
    )
  );
}
function pricesPanel() {
  const r = active();
  return (
    panel(
      "Ingredient purchasing prices",
      `<p class="subtext">Enter supplier pack sizes and prices excluding recoverable VAT. If you cannot recover VAT, include that VAT consistently in costs. Empty prices are unknown; enter 0 only for a free ingredient.</p>${r.ingredients
        .map((i, n) => {
          const c = result.rows[n];
          return `<div class="cost-card"><div class="cost-title"><h3>${esc(i.name)}</h3><span class="subtext">${money(c.unitPrice)} / ${c.unitPriceUnit}${i.chickpea ? ` · ${i.purchaseForm}` : ""}</span></div>${grid(
            ingredientField(n, "packQuantity", `${esc(i.name)} purchase size`, {
              min: 0.000001,
            }) +
              select(
                `${esc(i.name)} purchase unit`,
                `ingredients.${n}.packUnit`,
                [
                  ["g", "g"],
                  ["kg", "kg"],
                  ["ml", "ml"],
                  ["l", "L"],
                ],
              ) +
              ingredientField(n, "packPrice", `${esc(i.name)} pack price`, {
                unit: "€",
              }),
            true,
          )}<div class="detail-grid">${ingredientField(n, "density", `${esc(i.name)} density`, { unit: "kg/L", min: 0.000001, optional: true, help: "Needed only when converting mass and volume." })}${
            i.chickpea
              ? select(
                  "Purchased chickpea form",
                  `ingredients.${n}.purchaseForm`,
                  [
                    ["dry", "Dry"],
                    ["cooked", "Cooked / drained"],
                  ],
                ) +
                ingredientField(
                  n,
                  "cookedYield",
                  "Cooked-to-dry yield factor",
                  { unit: "×", min: 0.000001 },
                ) +
                (i.recipeForm !== i.purchaseForm
                  ? ingredientField(
                      n,
                      "purchaseDensity",
                      "Purchased chickpea density",
                      {
                        unit: "kg/L",
                        min: 0.000001,
                        optional: !["ml", "l"].includes(i.packUnit),
                        help: "Density in the purchased form; required for volume purchases when the recipe form differs.",
                      },
                    )
                  : "")
              : ""
          }</div><p class="subtext">Reference: ${money(c.referenceCost)} · Target: ${money(c.targetCost)} · Purchase requirement: ${qty(c.targetRequirement, i.packUnit)}</p></div>`;
        })
        .join("")}${warnings("ingredients")}`,
      "EUR · EXCL. VAT",
    ) +
    panel(
      "Where the ingredient cost goes",
      `<div class="table-wrap"><table class="result-table"><thead><tr><th>Ingredient</th><th>Reference</th><th>Target batch</th><th>Cost share</th></tr></thead><tbody>${result.rows.map((c) => `<tr><td>${esc(c.name)}<div class="bar"><i style="width:${c.costShare ?? 0}%"></i></div></td><td>${money(c.referenceCost)}</td><td>${money(c.targetCost)}</td><td>${fmt(c.costShare, 1)}${c.costShare === null ? "" : "%"}</td></tr>`).join("")}</tbody></table></div><div class="total-line"><span>Total ingredient cost</span><span>${money(result.ingredientCost)}</span></div>${result.referenceCost === null ? note(`Known reference costs total ${money(result.knownReferenceCost)}. Complete missing prices or conversions to calculate a total.`) : ""}`,
    )
  );
}
function productionPanel() {
  const r = active(),
    p = r.production,
    c = result.production;
  return (
    panel(
      "Packaging & production",
      check("Include packaging and production costs", "production.enabled") +
        `<p class="subtext">Add this layer when you are ready to cost packed tubs. ${r.example ? "Amounts below are illustrative examples." : "Enter 0 explicitly for costs that do not apply."}</p>`,
    ) +
    (!p.enabled
      ? panel(
          "Your recipe works on its own",
          '<p class="subtext">Turn on production to add packaging, labor and expenses, then explore pricing.</p>',
        )
      : panel(
          "Pack the batch",
          grid(
            `<label class="field"><span class="field-label">Tub size preset</span><select id="tub-preset" aria-label="Tub size preset">${[200, 250, 500].map((n) => `<option value="${n}" ${Number(p.weightG) === n ? "selected" : ""}>${n} g</option>`).join("")}<option value="custom" ${![200, 250, 500].includes(Number(p.weightG)) ? "selected" : ""}>Custom</option></select></label>` +
              field("Tub net weight", "production.weightG", {
                unit: "g",
                min: 0.000001,
              }),
          ) +
            metrics([
              ["Full tubs packed", fmt(c.tubs, 0)],
              ["Unpacked hummus", qty(c.leftoverKg, "kg")],
            ]) +
            note(
              "Only full tubs are packed. Leftovers earn no revenue in this model; their ingredient and production costs stay in the batch. No packaging is charged for leftovers.",
            ) +
            '<h3 class="section-gap">Packaging cost per packed tub</h3><p class="subtext">Costs exclude recoverable VAT. Divide a carton price by the number of tubs it holds.</p>' +
            grid(
              [
                ["container", "Container"],
                ["lid", "Lid"],
                ["label", "Label"],
                ["seal", "Seal"],
                ["carton", "Carton allocation"],
              ]
                .map(([k, l]) => field(l, `production.${k}`, { unit: "€" }))
                .join(""),
              true,
            ),
        ) +
        panel(
          "Production expenses",
          grid(
            select("Labor is accounted for", "production.laborMode", [
              ["batch", "Per batch: hours × employer cost"],
              ["monthly", "Monthly: salaries + founder pay"],
            ]) +
              select(
                "Production overhead is accounted for",
                "production.overheadMode",
                [
                  ["batch", "Per batch: energy, cleaning, other"],
                  ["monthly", "Monthly: production overhead"],
                ],
              ),
          ) +
            grid(
              field("Batch labor hours", "production.laborHours", {
                unit: "h",
                disabled: p.laborMode !== "batch",
              }) +
                field("Hourly employer cost", "production.hourlyCost", {
                  unit: "€/h",
                  disabled: p.laborMode !== "batch",
                }),
            ) +
            grid(
              ["energy", "cleaning", "other"]
                .map((k) =>
                  field(`Batch ${k}`, `production.${k}`, {
                    unit: "€",
                    disabled: p.overheadMode !== "batch",
                  }),
                )
                .join(""),
              true,
            ) +
            note(
              `${p.laborMode === "batch" ? "Batch labor is included. Monthly salaries and founder compensation are excluded." : "Batch labor is excluded. Enter salaries and founder compensation in Monthly business."} ${p.overheadMode === "batch" ? "Batch overhead is included. Monthly production overhead is excluded." : "Batch overhead is excluded. Enter it in Monthly business."} ${!r.monthly.enabled && (p.laborMode === "monthly" || p.overheadMode === "monthly") ? "<strong>Enable Monthly business to include those deferred costs.</strong>" : ""}`,
            ) +
            grid(
              field(
                "Expected unsold / credited stock",
                "production.unsoldPct",
                {
                  unit: "%",
                  max: 100,
                  help: "Applied once to packed tubs. All production costs are retained.",
                },
              ),
            ) +
            warnings("production") +
            metrics([
              ["Ingredients only / batch", money(result.ingredientCost)],
              ["Packaging materials", money(c.packagingCost)],
              ["Selected production cost / batch", money(c.total)],
              ["Expected paid tubs", fmt(c.paidTubs)],
            ]),
        ))
  );
}
function coverage() {
  const c = result.pricing;
  return !c
    ? ""
    : `<div class="status-box ${c.covers === null ? "" : c.covers ? "good" : "bad"}"><strong>${c.covers === null ? "Complete the inputs to check the ceiling." : c.covers ? "The shelf-price ceiling covers selected production costs." : "The shelf-price ceiling does not cover selected production costs."}</strong>${c.contribution !== null && active().pricing.driver === "actual" ? `<br>The actual wholesale price ${c.contribution >= 0 ? "covers" : "does not cover"} those costs.` : ""}</div>`;
}
const enableProduction = (title) =>
  panel(
    title,
    '<p class="subtext">Enable production and set a tub weight to calculate prices and business results.</p><button class="primary section-gap" data-action="enable-production">Add production costs</button>',
  );
function pricingPanel() {
  const r = active(),
    s = r.pricing,
    c = result.pricing;
  if (!c) return enableProduction("Pricing & profitability");
  return (
    panel(
      "From shelf price to your revenue",
      grid(
        field("Consumer shelf-price ceiling, incl. VAT", "pricing.ceiling", {
          unit: "€",
        }) +
          field("VAT assumption — confirm before use", "pricing.vatPct", {
            unit: "%",
            max: 100,
            help: "7% is an editable modeling assumption; confirm applicability.",
          }) +
          field("Retailer gross margin on sales", "pricing.marginPct", {
            unit: "%",
            max: 99.999999,
          }) +
          select("Active price driver", "pricing.driver", [
            ["ceiling", "Shelf-price ceiling → maximum wholesale"],
            ["actual", "Actual wholesale price"],
          ]) +
          (s.driver === "actual"
            ? field(
                "Actual wholesale price, excl. VAT",
                "pricing.actualWholesale",
                {
                  unit: "€",
                  help: "Drives producer revenue. The shelf ceiling remains the comparison price.",
                },
              )
            : ""),
      ) +
        '<div class="formula">Wholesale = shelf price ÷ (1 + VAT) × (1 − retailer margin)</div>' +
        note(
          "Retailer margin is a share of the selling price excluding VAT. It is not a markup on the retailer’s purchase cost. Delivery expenses belong in Monthly business.",
        ) +
        warnings("pricing") +
        metrics([
          ["Retail price excluding VAT", money(c.retailExVat)],
          ["Maximum wholesale at ceiling", money(c.maxWholesale)],
          ["Active revenue / paid tub", money(c.wholesale)],
          [
            "Implied margin at shelf ceiling",
            c.impliedMargin === null ? "—" : `${fmt(c.impliedMargin, 1)}%`,
          ],
        ]),
      "DIRECT TO RETAILER",
    ) +
    panel(
      "Does the price cover your costs?",
      table([
        [
          "Ingredient-only cost per paid tub",
          money(result.production.ingredientPerPaid),
        ],
        [
          "Selected production cost per paid tub",
          money(result.production.costPerPaid),
        ],
        [
          "Contribution per paid tub, before monthly costs",
          money(c.contribution),
        ],
        ["Break-even wholesale, excluding VAT", money(c.breakEvenWholesale)],
        [
          "Corresponding consumer price, including VAT",
          money(c.breakEvenConsumer),
        ],
      ]) +
        coverage() +
        note(
          "Price break-even covers selected production costs, including expected unsold tubs. The corresponding consumer price uses the entered retailer margin. Contribution is before monthly expenses, depreciation, interest and tax. Use Monthly business to evaluate operating profit.",
        ),
    )
  );
}
function monthlyPanel() {
  const r = active(),
    m = r.monthly,
    p = r.production,
    c = result.monthly;
  if (!p.enabled) return enableProduction("Monthly business costs");
  return (
    panel(
      "Monthly business",
      check("Include monthly business expenses", "monthly.enabled") +
        '<p class="subtext">A separate view of volume, cash operating surplus and operating profit.</p>',
      "EXCL. RECOVERABLE VAT",
    ) +
    (!m.enabled
      ? ""
      : panel(
          "Monthly production",
          grid(
            select("Active production driver", "monthly.driver", [
              ["batches", "Whole batches per month"],
              ["packed", "Packed tubs per month"],
            ]) +
              (m.driver === "batches"
                ? field("Monthly batch count", "monthly.batches", { step: "1" })
                : field("Monthly packed production", "monthly.packed", {
                    unit: "tubs",
                    step: "1",
                  })),
          ) +
            note(
              `${m.driver === "packed" ? "Packed volume uses proportional batch equivalents at this recipe’s packing efficiency, including its share of leftovers. This assumes production can be scheduled proportionally; batch-based break-even is also shown." : "Only the entered batch count drives volume. Each batch uses the current target weight and full-tub count."} Paid tubs = packed tubs × (1 − unsold stock). Paid tubs can be fractional as a planning expectation.`,
            ) +
            metrics([
              ["Packed tubs", fmt(c.packed, 0)],
              ["Expected paid tubs", fmt(c.sold)],
            ]),
        ) +
        panel(
          "Fixed costs & compensation",
          grid(
            field("Rent", "monthly.rent", { unit: "€" }) +
              field(
                "Production utilities, cleaning & overhead",
                "monthly.fixedUtilities",
                { unit: "€", disabled: p.overheadMode !== "monthly" },
              ) +
              field("Salaries, full employer cost", "monthly.salaries", {
                unit: "€",
                disabled: p.laborMode !== "monthly",
              }) +
              field("Founder compensation", "monthly.founder", {
                unit: "€",
                disabled: p.laborMode !== "monthly",
              }) +
              [
                ["insurance", "Insurance"],
                ["accounting", "Accounting"],
                ["marketing", "Marketing"],
                ["delivery", "Fixed monthly delivery"],
                ["otherFixed", "Other fixed expenses"],
              ]
                .map(([k, l]) => field(l, `monthly.${k}`, { unit: "€" }))
                .join("") +
              field(
                "Other variable expense per paid tub",
                "monthly.variablePaid",
                {
                  unit: "€",
                  help: "For example variable delivery. Do not repeat batch expenses.",
                },
              ) +
              field("Monthly depreciation", "monthly.depreciation", {
                unit: "€",
                help: "Non-cash; deducted only from operating profit.",
              }),
          ) +
            note(
              `<strong>Active allocation:</strong> labor is ${p.laborMode === "batch" ? "charged per batch; salaries and founder pay are disabled" : "charged monthly; batch labor is disabled"}. Production overhead is ${p.overheadMode === "batch" ? "charged per batch; monthly production overhead is disabled" : "charged monthly; batch overhead is disabled"}. Rent and other distinct costs are always monthly. Use one location for each expense; free-form “other” costs cannot be deduplicated automatically.`,
            ) +
            warnings("monthly"),
        ) +
        panel(
          "Monthly operating statement",
          table([
            ["Revenue", money(c.revenue)],
            ["Batch production expenses", money(c.batchExpenses)],
            ["Other variable expenses", money(c.variableExpenses)],
            ["Fixed cash expenses", money(c.fixed)],
            ["Total cash operating expenses", money(c.cashExpenses)],
            [
              "Cash operating surplus before depreciation",
              money(c.cashSurplus),
            ],
            ["Depreciation", money(c.depreciation)],
            [
              "Operating profit before interest and tax",
              money(c.operatingProfit),
            ],
          ]) +
            metrics([
              ["Cash break-even · packed tubs", fmt(c.cashBreakEven, 0)],
              [
                "Accounting break-even · packed tubs",
                fmt(c.accountingBreakEven, 0),
              ],
            ]) +
            note(
              `${c.contributionPerPacked !== null && c.contributionPerPacked <= 0 ? "<strong>No finite break-even volume exists under the current assumptions because contribution is zero or negative.</strong>" : `Rounded up to whole batches: cash ${fmt(c.cashBreakEvenBatches, 0)}, accounting ${fmt(c.accountingBreakEvenBatches, 0)} batches.`} Estimates depend on entered staffing and capacity. Higher volume may require additional people, equipment or space. Cash operating surplus excludes capital expenditure, financing, income tax and working-capital timing.`,
            ),
        ))
  );
}
function summary() {
  const r = active(),
    c = result,
    p = c.production,
    s = c.pricing,
    m = c.monthly;
  let title = "Batch summary",
    big = fmt(c.targetKg),
    unit = "kg finished",
    caption =
      r.yieldMode === "measured"
        ? "Measured-yield scaling"
        : "Explicit process-loss scaling",
    items = [
      ["Reference input", qty(c.inputKg, "kg")],
      ["Usable reference yield", qty(c.finishedKg, "kg")],
      ["Scale factor", `${fmt(c.factor, 3)}${c.factor === null ? "" : "×"}`],
      ["Target ingredient input", qty(c.targetInputKg, "kg")],
      ["Ingredients / batch", money(c.ingredientCost)],
      ["Ingredients / finished kg", money(c.ingredientCostPerKg)],
    ],
    foot =
      "Ingredient costs only. Add packaging and business costs when you need them.";
  if (tab === "ingredients") {
    title = "Ingredient costs";
    big = money(c.ingredientCost);
    unit = "/ batch";
    caption = "Target batch · " + qty(c.targetKg, "kg");
    items = [
      ["Reference recipe cost", money(c.referenceCost)],
      ["Per finished kg", money(c.ingredientCostPerKg)],
      ["Ingredients", r.ingredients.length],
    ];
  }
  if ((tab === "production" || tab === "pricing") && p) {
    title = tab === "pricing" ? "Price & contribution" : "Production summary";
    big = tab === "pricing" ? money(s.wholesale) : money(p.costPerPaid);
    unit = "/ paid tub";
    caption =
      tab === "pricing"
        ? r.pricing.driver === "ceiling"
          ? "Driven by shelf-price ceiling"
          : "Driven by actual wholesale price"
        : "Selected production cost";
    items = [
      ["Full tubs packed", fmt(p.tubs, 0)],
      ["Expected paid tubs", fmt(p.paidTubs)],
      ["Unpacked hummus", qty(p.leftoverKg, "kg")],
      ["Ingredients / batch", money(c.ingredientCost)],
      ["Packaging / batch", money(p.packagingCost)],
      ["Production / batch", money(p.total)],
      ["Cost / packed tub", money(p.costPerPacked)],
    ];
    if (tab === "pricing")
      items.push(["Contribution / paid tub", money(s.contribution)]);
    foot =
      "Costs of unsold tubs and leftovers are retained. Deferred monthly expenses are excluded here.";
  }
  if (tab === "monthly" && m) {
    title = "Monthly outlook";
    big = money(m.operatingProfit);
    unit = "";
    caption = "Operating profit · before interest & tax";
    items = [
      ["Packed tubs", fmt(m.packed, 0)],
      ["Expected paid tubs", fmt(m.sold)],
      ["Revenue", money(m.revenue)],
      ["Cash operating expenses", money(m.cashExpenses)],
      ["Cash operating surplus", money(m.cashSurplus)],
      ["Depreciation", money(m.depreciation)],
    ];
    foot =
      "Based on your active volume driver and current staffing / capacity assumptions.";
  }
  const relevant = c.issues.filter(
    (i) =>
      i.area === tab ||
      i.area === "recipe" ||
      (tab !== "recipe" && i.area === "ingredients"),
  );
  return `<aside class="summary" id="summary" tabindex="-1"><div class="summary-card"><p class="eyebrow">YOUR NUMBERS, IN VIEW</p><h2>${title}</h2><div class="big-value ${big.length > 12 ? "compact" : ""}">${big}<small>${unit}</small></div><p class="summary-caption">${caption}</p><div class="summary-stats">${items.map(([l, v]) => stat(l, v)).join("")}</div><p class="summary-foot">${foot}</p></div>${tab === "pricing" ? coverage() : ""}${relevant.length ? `<div class="status-box bad"><strong>${relevant.length} input${relevant.length === 1 ? " needs" : "s need"} attention</strong><br>Unavailable results appear as —. Check the relevant input sections.</div>` : ""}<div class="side-note"><h3>${r.example ? "Make this recipe yours" : "Your model, your measurements"}</h3><p>${r.example ? "Recipe quantities, densities, purchasing prices and expenses are illustrative. Replace them with measurements and supplier quotes." : "Use your measured yield and purchasing data. Empty fields remain unknown until you fill them in."}</p></div><div class="side-note"><h3>Saved on this device</h3><p>Recipes and settings stay in this browser. Export JSON to move them to another device or keep a backup.</p></div></aside>`;
}
function printSummary() {
  const r = active(),
    c = result,
    p = c.production,
    s = c.pricing,
    m = c.monthly;
  return `<article class="print-only"><h1>${esc(r.name)}</h1><p>${r.example ? "Illustrative example · " : ""}Hummus Workshop · ${new Date().toLocaleDateString("en-GB")} · EUR excluding recoverable VAT</p><div class="print-block"><h2>Recipe & finished yield</h2><p>Method: ${r.yieldMode === "measured" ? "measured finished yield (no additional loss)" : `explicit ${esc(r.lossPct)}% process loss`}. Input ${qty(c.inputKg, "kg")}; reference finished ${qty(c.finishedKg, "kg")}; target ${qty(c.targetKg, "kg")}; scale ${fmt(c.factor, 4)}×.</p><table class="result-table"><thead><tr><th>Ingredient</th><th>Reference</th><th>Target</th><th>Input %</th><th>Purchase</th><th>Cost</th></tr></thead><tbody>${c.rows.map((i) => `<tr><td>${esc(i.name)}</td><td>${qty(i.quantity, i.unit)}</td><td>${qty(i.targetQuantity, i.unit)}</td><td>${fmt(i.percentage, 1)}%</td><td>${qty(i.targetRequirement, i.purchaseUnit)}</td><td>${money(i.targetCost)}</td></tr>`).join("")}</tbody></table><p>Ingredients: ${money(c.ingredientCost)} per batch; ${money(c.ingredientCostPerKg)} per finished kg.</p></div><div class="print-block"><h2>Conversion assumptions</h2>${r.ingredients
    .filter((i) => i.chickpea || i.density !== "")
    .map(
      (i) =>
        `<p>${esc(i.name)}: ${i.density !== "" ? `recipe density ${esc(i.density)} kg/L; ` : ""}${i.chickpea && i.purchaseDensity !== "" ? `purchase density ${esc(i.purchaseDensity)} kg/L; ` : ""}${i.chickpea ? `${i.recipeForm} recipe, ${i.purchaseForm} purchased; cooked-to-dry yield ${esc(i.cookedYield) || "unknown"}×. Recipe water is additional blending water.` : ""}</p>`,
    )
    .join(
      "",
    )}</div>${p ? `<div class="print-block"><h2>Production & pricing</h2><p>Tub ${esc(r.production.weightG)} g; ${fmt(p.tubs, 0)} packed; ${fmt(p.paidTubs)} expected paid at ${esc(r.production.unsoldPct)}% unsold. Leftovers ${qty(p.leftoverKg, "kg")} earn no revenue; costs are retained. Packaging is charged only for packed tubs.</p><p>Packaging ${money(p.packagingCost)}; batch labor ${money(p.laborCost)}; batch overhead ${money(p.overheadCost)}; selected production ${money(p.total)}. Labor allocation: ${r.production.laborMode}; overhead allocation: ${r.production.overheadMode}.</p><p>Cost per packed tub ${money(p.costPerPacked)}; per paid tub ${money(p.costPerPaid)}. Shelf ceiling ${money(number(r.pricing.ceiling))}; VAT assumption ${esc(r.pricing.vatPct)}% (confirm); retailer sales margin ${esc(r.pricing.marginPct)}%.</p><p>Driver: ${r.pricing.driver === "actual" ? "actual wholesale" : "shelf ceiling"}. Wholesale ${money(s.wholesale)}; contribution before monthly costs ${money(s.contribution)} per paid tub. Break-even wholesale ${money(s.breakEvenWholesale)}; consumer ${money(s.breakEvenConsumer)}.</p></div>` : ""}${m ? `<div class="print-block"><h2>Monthly business</h2><p>Driver: ${r.monthly.driver}. Packed ${fmt(m.packed, 0)}; paid ${fmt(m.sold)}. Revenue ${money(m.revenue)}; cash operating expenses ${money(m.cashExpenses)}; cash surplus before depreciation ${money(m.cashSurplus)}. Depreciation ${money(m.depreciation)}; operating profit before interest and tax ${money(m.operatingProfit)}.</p><p>Cash break-even: ${fmt(m.cashBreakEven, 0)} packed tubs (${fmt(m.cashBreakEvenBatches, 0)} batches). Accounting break-even: ${fmt(m.accountingBreakEven, 0)} packed tubs (${fmt(m.accountingBreakEvenBatches, 0)} batches). Estimates depend on entered staffing and capacity. No finite break-even exists when contribution is zero or negative.</p></div>` : ""}${c.issues.length ? `<h2>Incomplete inputs & warnings</h2><ul>${c.issues.map((i) => `<li>${esc(i.text)}</li>`).join("")}</ul>` : ""}</article>`;
}
function showPrintableSummary() {
  const dialog = document.createElement("dialog");
  dialog.className = "export-dialog print-preview-dialog";
  dialog.setAttribute("aria-label", "Printable recipe summary");
  dialog.innerHTML = `<div class="actions print-preview-actions"><button class="primary" data-print>Print / Save PDF</button><button data-close>Close summary</button></div>${printSummary().replace('class="print-only"', 'class="print-preview-content"')}`;
  dialog.querySelector("[data-print]").addEventListener("click", () => window.print());
  dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => dialog.remove(), {once:true});
  document.body.append(dialog);
  dialog.showModal();
}
// Keep the edited input and its ancestors connected to the document. Replacing
// a number input loses its native caret and partially typed decimal, and number
// inputs do not support setSelectionRange to restore them afterward.
function refreshAroundInput(current, next, input, nextInput) {
  if (current === input) {
    for (const attribute of [...input.attributes]) {
      if (attribute.name !== "value" && !nextInput.hasAttribute(attribute.name))
        input.removeAttribute(attribute.name);
    }
    for (const attribute of nextInput.attributes) {
      if (
        attribute.name !== "value" &&
        input.getAttribute(attribute.name) !== attribute.value
      )
        input.setAttribute(attribute.name, attribute.value);
    }
    return;
  }
  const kept = [...current.childNodes].find((node) => node.contains(input));
  const nextKept = [...next.childNodes].find((node) => node.contains(nextInput));
  for (const child of [...current.childNodes]) {
    if (child !== kept) child.remove();
  }
  let beforeInput = true;
  for (const child of [...next.childNodes]) {
    if (child === nextKept) {
      refreshAroundInput(kept, nextKept, input, nextInput);
      beforeInput = false;
    } else current.insertBefore(child, beforeInput ? kept : null);
  }
}
function render(preserveFocus = false, editingInput = null) {
  const focused = document.activeElement,
    focusPath = preserveFocus ? focused?.dataset?.path : null,
    start = focused?.selectionStart,
    end = focused?.selectionEnd,
    open = [...document.querySelectorAll("details[open][data-detail]")].map(
      (el) => el.dataset.detail,
    );
  result = calculate(active());
  const r = active();
  const html = `<div class="page-heading"><div><p class="eyebrow">FROM RECIPE TO RETAIL</p><h1>A better batch starts here.</h1><p class="subtext">Know your recipe. Understand your costs.</p></div><div class="actions"><button data-action="csv">Export CSV</button><button data-action="print">Print summary</button></div></div><div class="recipe-bar"><div class="recipe-select"><label for="recipe-picker">Your recipes</label><select id="recipe-picker">${state.recipes.map((i) => `<option value="${esc(i.id)}" ${i.id === r.id ? "selected" : ""}>${esc(i.name)}</option>`).join("")}</select><span class="save-state">${storageAvailable ? "Autosaved in this browser" : "Session only · export a backup"}</span></div><div class="actions"><button class="quiet small" data-action="new">+ Blank recipe</button><button class="quiet small" data-action="duplicate">Duplicate</button><button class="primary small" data-action="save">Save recipe</button></div></div>${storageError ? `<div class="warnings">${esc(storageError)}</div>` : ""}<nav class="tabs" aria-label="Calculator sections">${tabs.map(([key, label], n) => `<button class="tab ${tab === key ? "active" : ""}" data-tab="${key}" ${tab === key ? 'aria-current="page"' : ""}><span>${n + 1}</span>${label}</button>`).join("")}</nav><a class="mobile-summary-link" href="#summary">View live results ↓</a><div class="workspace" id="workspace"><div id="inputs">${{ recipe: recipePanel, ingredients: pricesPanel, production: productionPanel, pricing: pricingPanel, monthly: monthlyPanel }[tab]()}</div>${summary()}</div><footer class="footer"><span>Hummus Workshop · Local-first, no account needed.</span><div class="actions"><button class="quiet small" data-action="export">Export JSON backup</button><button class="quiet small" data-action="import">Import JSON</button><input type="file" id="import-file" accept=".json,application/json" hidden><button class="quiet small" data-action="example">Add example</button></div></footer>${printSummary()}`;
  if (editingInput === focused && focusPath) {
    const nextView = document.createElement("div");
    nextView.innerHTML = html;
    const nextInput = [...nextView.querySelectorAll("input[data-path]")].find(
      (el) => el.dataset.path === focusPath,
    );
    if (nextInput) refreshAroundInput(app, nextView, editingInput, nextInput);
    else app.innerHTML = html;
  } else app.innerHTML = html;
  for (const el of document.querySelectorAll("details[data-detail]"))
    if (open.includes(el.dataset.detail)) el.open = true;
  if (focusPath && document.activeElement !== focused) {
    const el = [...document.querySelectorAll("[data-path]")].find(
      (el) => el.dataset.path === focusPath,
    );
    el?.focus({ preventScroll: true });
    if (start !== null && start !== undefined && el?.type === "text")
      el.setSelectionRange(start, end);
  }
}
function updatePath(path, value, editingInput = null) {
  const parts = path.split(".");
  let obj = active();
  for (const key of parts.slice(0, -1)) obj = obj[key];
  obj[parts.at(-1)] = value;
  persist();
  render(true, editingInput);
}
function download(content, type, name) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const dialog = document.createElement("dialog");
  dialog.className = "export-dialog";
  dialog.setAttribute("aria-labelledby", "export-heading");
  dialog.innerHTML = `<div class="panel-header"><h2 id="export-heading">Your export is ready</h2><button type="button" aria-label="Close export">×</button></div><p class="subtext">Download the file, or copy the text below if your browser does not allow downloads.</p><p class="section-gap"><a class="file-button" id="export-download">Download ${esc(name)}</a></p><label class="field section-gap"><span class="field-label">Export contents</span><textarea readonly spellcheck="false" rows="10"></textarea></label><p class="subtext">Select the text and copy it into a file named <strong>${esc(name)}</strong>. Keep JSON backups private.</p>`;
  const a = dialog.querySelector("a");
  a.href = url;
  a.download = name;
  dialog.querySelector("textarea").value = content;
  dialog.querySelector("button").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    URL.revokeObjectURL(url);
    dialog.remove();
  }, {once:true});
  document.body.append(dialog);
  dialog.showModal();
  a.click();
}
function setTarget(value) {
  const n = number(value);
  if (n === null || n <= 0)
    throw new Error("Target finished kg must be greater than zero.");
  updatePath("targetKg", n);
  return {
    recipe: active().name,
    targetFinishedKg: result.targetKg,
    scaleFactor: result.factor,
    ingredientCostEUR: result.ingredientCost,
  };
}
app.addEventListener("input", (e) => {
  if (e.target.matches("input[data-path]:not([type=checkbox])"))
    updatePath(e.target.dataset.path, e.target.value, e.target);
});
app.addEventListener("change", async (e) => {
  if (e.target.matches("select[data-path],input[type=checkbox][data-path]"))
    updatePath(
      e.target.dataset.path,
      e.target.type === "checkbox" ? e.target.checked : e.target.value,
    );
  if (e.target.id === "recipe-picker") {
    state.activeId = e.target.value;
    persist();
    render();
  }
  if (e.target.id === "tub-preset") {
    if (e.target.value === "custom") {
      active().production.weightG = "";
      persist();
      render();
      document.querySelector('[data-path="production.weightG"]')?.focus();
    } else updatePath("production.weightG", Number(e.target.value));
  }
  if (e.target.id === "import-file") {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 2_000_000)
        throw new Error("Maximum backup size is 2 MB.");
      const imported = validateBackup(JSON.parse(await file.text()));
      if (state.recipes.length + imported.recipes.length > 100)
        throw new Error("This import would exceed 100 recipes.");
      const copies = imported.recipes.map((r) => {
        const c = duplicateRecipe(r);
        c.name = r.name;
        return c;
      });
      state.recipes.push(...copies);
      state.activeId = copies[0].id;
      persist();
      render();
      toast(
        `Imported ${copies.length} recipe${copies.length === 1 ? "" : "s"}. Existing recipes were kept.`,
      );
    } catch (error) {
      toast(`Import failed: ${error.message}`);
    }
  }
});
app.addEventListener("click", (e) => {
  const button = e.target.closest("button");
  if (!button) return;
  if (button.dataset.tab) {
    tab = button.dataset.tab;
    render();
    document
      .querySelector(`[data-tab="${tab}"]`)
      ?.focus({ preventScroll: true });
    return;
  }
  const action = button.dataset.action;
  if (["new", "example", "duplicate"].includes(action)) {
    if (state.recipes.length >= 100) {
      toast(
        "The workspace supports up to 100 recipes. Export a backup before starting a separate workspace.",
      );
      return;
    }
    const r =
      action === "duplicate"
        ? duplicateRecipe(active())
        : createRecipe(action === "new");
    state.recipes.push(r);
    state.activeId = r.id;
    tab = "recipe";
    persist();
    render();
    toast(
      action === "duplicate"
        ? "Recipe duplicated."
        : action === "new"
          ? "Blank recipe created. Enter your measurements."
          : "Illustrative example added.",
    );
  }
  if (action === "save") {
    if (!active().name.trim()) {
      toast("Add a recipe name before saving.");
      return;
    }
    persist();
    render();
    toast(
      storageAvailable
        ? "Recipe and settings saved in this browser."
        : "Export JSON to keep this recipe; browser storage is unavailable.",
    );
  }
  if (action === "add") {
    if (active().ingredients.length >= 100) {
      toast("A recipe supports up to 100 ingredients.");
      return;
    }
    active().ingredients.push(newIngredient());
    persist();
    render();
    const fields = document.querySelectorAll(".ingredient-name");
    fields[fields.length - 1]?.focus();
  }
  if (action === "remove") {
    const removed = active().ingredients.find(
      (i) => i.id === button.dataset.id,
    );
    active().ingredients = active().ingredients.filter(
      (i) => i.id !== button.dataset.id,
    );
    persist();
    render();
    toast(`${removed.name} removed.`);
  }
  if (action === "enable-production") {
    active().production.enabled = true;
    tab = "production";
    persist();
    render();
  }
  if (action === "export") {
    download(
      JSON.stringify(state, null, 2),
      "application/json",
      "hummus-workshop-backup.json",
    );
    toast("JSON backup exported.");
  }
  if (action === "csv") {
    download(
      makeCsv(active(), result),
      "text/csv;charset=utf-8",
      "hummus-batch-costs.csv",
    );
    toast("Ingredient and cost results exported.");
  }
  if (action === "import") document.querySelector("#import-file").click();
  if (action === "print") showPrintableSummary();
});
persist();
render();
if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  const tools = [
    {
      name: "read_hummus_batch",
      description:
        "Read the active recipe calculation and validation messages.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: () => ({
        recipe: active().name,
        result: JSON.parse(
          JSON.stringify(result, (_, v) =>
            v === Infinity ? "No finite volume" : v,
          ),
        ),
      }),
    },
    {
      name: "set_hummus_target_batch",
      description:
        "Set and locally save the active recipe target finished batch weight in kilograms.",
      inputSchema: {
        type: "object",
        properties: { finishedKg: { type: "number", exclusiveMinimum: 0 } },
        required: ["finishedKg"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input) => {
        if (
          !input ||
          Object.keys(input).length !== 1 ||
          typeof input.finishedKg !== "number"
        )
          throw new Error("Provide only a numeric finishedKg.");
        return setTarget(input.finishedKg);
      },
    },
  ];
  for (const tool of tools) {
    try {
      Promise.resolve(
        document.modelContext.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {});
    } catch {
      /* Optional capability; ordinary UI remains available. */
    }
  }
  window.addEventListener("pagehide", () => lifecycle.abort(), { once: true });
}
