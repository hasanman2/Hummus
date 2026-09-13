import {
  calculateRecipe as calculate,
  calculateBusiness,
  number,
} from "./business-calculations.js";
import { businessUI } from "./business-ui.js";
import { createPreset, createRow, uid } from "./business-data.js";
import {
  initialState,
  createRecipe,
  newIngredient,
  duplicateRecipe,
  validateBackup,
  loadState,
  saveState,
  makeCsv,
} from "./business-data.js";
const app = document.querySelector("#app");
let state,
  storageAvailable = true,
  storageError = "",
  tab = "overview",
  result,
  businessResult,
  business;
try {
  state = loadState(localStorage);
} catch {
  state = initialState();
  storageAvailable = false;
  storageError =
    "Stored data could not be read. Existing browser data has been left untouched. Export this session before closing.";
}
const tabs = [
  ["overview", "Overview"],
  ["recipe", "Recipe & batch yield"],
  ["production", "Packaging & production"],
  ["pricing", "Pricing & sales"],
  ["team", "Our team & workload"],
  ["expenses", "Monthly expenses"],
  ["equipment", "Equipment & startup"],
  ["scenarios", "Break-even & scenarios"],
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
          return `<div class="ingredient-row"><input class="ingredient-name" aria-label="Ingredient ${n + 1} name" data-path="ingredients.${n}.name" value="${esc(i.name)}" maxlength="200"><div class="quantity-group"><input type="number" min="0" step="any" data-path="ingredients.${n}.quantity" aria-label="${esc(i.name)} reference quantity" value="${esc(i.quantity)}" ${number(i.quantity) === null || number(i.quantity) < 0 ? 'aria-invalid="true"' : ""}><select data-path="ingredients.${n}.unit" aria-label="${esc(i.name)} recipe unit">${["g", "kg", "ml", "l"].map((u) => `<option ${i.unit === u ? "selected" : ""}>${u}</option>`).join("")}</select></div><span class="cell-number scaled">${qty(c.targetQuantity, i.unit)}</span><span class="cell-number percentage">${fmt(c.percentage, 1)}${c.percentage === null ? "" : "%"}</span><button class="delete" data-action="remove" data-id="${esc(i.id)}" aria-label="Remove ${esc(i.name)}">×</button><div class="density-row"><details data-detail="ingredient-${esc(i.id)}"><summary>${i.chickpea ? `Chickpea conversion · ${i.recipeForm} recipe / ${i.purchaseForm} purchase` : "Density & ingredient options"}</summary><div class="detail-grid">${ingredientField(n, "density", `${esc(i.name)} density`, { unit: "kg/L", min: 0.000001, optional: !["ml", "l"].includes(i.unit), help: "Required for mass ↔ volume. Confirm example densities." })}<div>${check("This is a chickpea ingredient", `ingredients.${n}.chickpea`)}</div>${
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
function printSummary() {
  return business.print();
}
function showPrintableSummary() {
  const dialog = document.createElement("dialog");
  dialog.className = "export-dialog print-preview-dialog";
  dialog.setAttribute("aria-label", "Printable recipe summary");
  dialog.innerHTML = `<div class="actions print-preview-actions"><button class="primary" data-print>Print / Save PDF</button><button data-close>Close summary</button></div>${printSummary().replace('class="print-only"', 'class="print-preview-content"')}`;
  dialog
    .querySelector("[data-print]")
    .addEventListener("click", () => window.print());
  dialog
    .querySelector("[data-close]")
    .addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
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
  const nextKept = [...next.childNodes].find((node) =>
    node.contains(nextInput),
  );
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
  businessResult = calculateBusiness(active());
  const r = active();
  business = businessUI(r, businessResult, state, {
    field,
    select,
    check,
    grid,
    panel,
    note,
    metrics,
    table,
    money,
    fmt,
    esc,
  });
  const html = `<div class="page-heading"><div><p class="eyebrow">FROM RECIPE TO RETAIL</p><h1>A better batch starts here.</h1><p class="subtext">Plan your recipe, team, startup and sustainable sales.</p></div><div class="actions"><button data-action="csv">Export CSV</button><button data-action="print">Print summary</button></div></div><div class="recipe-bar"><div class="recipe-select"><label for="recipe-picker">Your scenarios</label><select id="recipe-picker">${state.recipes.map((i) => `<option value="${esc(i.id)}" ${i.id === r.id ? "selected" : ""}>${esc(i.name)}</option>`).join("")}</select><span class="save-state">${storageAvailable ? "Autosaved in this browser" : "Session only · export a backup"}</span></div><div class="actions"><button class="quiet small" data-action="new">+ New scenario</button><button class="quiet small" data-action="duplicate">Duplicate</button><button class="primary small" data-action="save">Save scenario</button></div></div>${storageError ? `<div class="warnings">${esc(storageError)}</div>` : ""}<nav class="tabs" aria-label="Calculator sections">${tabs.map(([key, label], n) => `<button class="tab ${tab === key ? "active" : ""}" data-tab="${key}" ${tab === key ? 'aria-current="page"' : ""}><span>${n + 1}</span>${label}</button>`).join("")}</nav><a class="mobile-summary-link" href="#summary">View live results ↓</a><div class="workspace" id="workspace"><div id="inputs">${tab === "recipe" ? business.recipeIntro() + recipePanel() + business.ingredientOptions() + pricesPanel() : business[tab]()}</div>${business.sidebar()}</div><footer class="footer"><span>Hummus Workshop · Local-first, no account needed.</span><div class="actions"><button class="quiet small" data-action="export">Export JSON backup</button><button class="quiet small" data-action="import">Import JSON</button><input type="file" id="import-file" accept=".json,application/json" hidden><button class="quiet small" data-action="example">Add example</button></div></footer>${printSummary()}`;
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
  dialog
    .querySelector("button")
    .addEventListener("click", () => dialog.close());
  dialog.addEventListener(
    "close",
    () => {
      URL.revokeObjectURL(url);
      dialog.remove();
    },
    { once: true },
  );
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
      if (file.size > 20_000_000)
        throw new Error("Maximum backup size is 20 MB.");
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

  if (button.dataset.row) {
    const path = button.dataset.collection;
    if (
      !/^(ingredients|business\.(packages(?:\.\d+\.items)?|sales\.fees|founders|staff|workload|expenses|assets|capacity))$/.test(
        path,
      )
    )
      return;
    const list = get(path),
      index = Number(button.dataset.index),
      operation = button.dataset.row;
    if (!Array.isArray(list)) return;
    if (operation === "delete") {
      if (path === "business.packages" && list.length === 1) {
        toast("Keep at least one package.");
        return;
      }
      list.splice(index, 1);
      if (
        path === "business.packages" &&
        !list.some((p) => p.id === active().business.volume.packageId)
      )
        active().business.volume.packageId = list[0].id;
    } else {
      if (list.length >= 100) {
        toast("Maximum 100 rows.");
        return;
      }
      const row =
        operation === "duplicate"
          ? structuredClone(list[index])
          : createRow(button.dataset.kind);
      row.id = uid();
      if (operation === "duplicate") row.name += " (copy)";
      list.push(row);
    }
    persist();
    render();
    return;
  }
  if (button.dataset.preset || button.dataset.action === "reset-scenario") {
    if (state.recipes.length >= 100) {
      toast("Maximum 100 scenarios. Export before starting another workspace.");
      return;
    }
    if (button.dataset.action === "reset-scenario") {
      const previous = duplicateRecipe(active());
      previous.name = active().name + " (before reset)";
      state.recipes.push(previous);
      const fresh = createPreset(active().business.preset);
      active().business = fresh.business;
      active().pricing = fresh.pricing;
      toast(
        "Business assumptions reset. A copy of the previous scenario was saved; recipe quantities were retained.",
      );
    } else {
      const fresh = createPreset(button.dataset.preset);
      state.recipes.push(fresh);
      state.activeId = fresh.id;
      toast("Preset added as a separate scenario.");
    }
    persist();
    render();
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
      makeCsv(active(), businessResult),
      "text/csv;charset=utf-8",
      "hummus-batch-costs.csv",
    );
    toast("Scenario inputs and business results exported.");
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
