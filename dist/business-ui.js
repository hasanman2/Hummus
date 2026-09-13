import {
  calculateBusiness,
  solveVolume,
  div,
  mul,
  sum,
  valid,
} from "./business-calculations.js";
import { presets, tasks } from "./business-data.js";
export function businessUI(r, c, state, h) {
  const {
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
    } = h,
    b = r.business;
  const f = (label, path, unit = "", help = "", optional = false) =>
    field(label, path, { unit, help, optional });
  const s = (label, path, options, help = "") =>
    select(
      label,
      path,
      options.map((x) => (Array.isArray(x) ? x : [x, x])),
      help,
    );
  const text = (label, path) => field(label, path, { type: "text" });
  const detail = (key, title, body, open = false) =>
    `<details class="business-detail" data-detail="${esc(key)}" ${open ? "open" : ""}><summary>${title}</summary>${body}</details>`;
  const actions = (path, kind, index) =>
    `<div class="actions row-actions"><button class="quiet small" data-row="duplicate" data-collection="${path}" data-kind="${kind}" data-index="${index}">Duplicate</button><button class="quiet small" data-row="delete" data-collection="${path}" data-kind="${kind}" data-index="${index}">Delete</button></div>`;
  const add = (path, kind, label) =>
    `<button class="quiet add-ingredient" data-row="add" data-collection="${path}" data-kind="${kind}">+ ${label}</button>`;
  const rows = (path, kind, items, body) =>
    items
      .map((i, n) =>
        detail(
          `${kind}-${i.id}`,
          `${esc(i.name)} <span class="tag">${i.enabled ? "ACTIVE" : "DISABLED"}</span>`,
          grid(
            text(`${kind} name`, `${path}.${n}.name`) +
              check("Enabled", `${path}.${n}.enabled`),
          ) +
            body(i, `${path}.${n}`, n) +
            actions(path, kind, n),
        ),
      )
      .join("") + add(path, kind, `Add ${kind}`);
  const vatFields = (p) =>
    grid(
      f(
        "Purchase VAT",
        `${p}.vatPct`,
        "%",
        "Prices entered before purchase VAT; nonrecoverable VAT increases cost.",
      ) + check("Purchase VAT is recoverable", `${p}.recoverable`),
    );
  const basis = [
    ["kg", "per packed kg"],
    ["packed_tub", "per packed tub"],
    ["paid_tub", "per paid tub"],
    ["batch", "per batch"],
    ["delivery", "per delivery"],
    ["month", "per month"],
  ];
  const viewName = {
    before: "Before founder compensation",
    actual: "After actual founder compensation",
    target: "After target founder compensation",
  };
  const warnings = (items, title = "Incomplete estimate") =>
    items.length
      ? `<div class="warnings"><strong>${title}</strong><ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div>`
      : "";
  const resultsTable = (headers, items) =>
    `<div class="table-wrap"><table class="result-table"><thead><tr>${headers.map((x) => `<th>${x}</th>`).join("")}</tr></thead><tbody>${items.map((row) => `<tr>${row.map((x) => `<td>${x}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  const paySelector = () =>
    s("Founder-pay view", "business.targets.payView", Object.entries(viewName));
  const costTable = () =>
    resultsTable(
      [
        "Cost",
        "Month",
        "Packed tub",
        "Paid tub",
        "Packed kg",
        "Sold kg",
        "Batch",
      ],
      c.costRows.map((x) => [
        esc(x.name),
        ...[
          x.amount,
          x.perPackedTub,
          x.perPaidTub,
          x.perPackedKg,
          x.perPaidKg,
          x.perBatch,
        ].map(money),
      ]),
    );
  const financialTable = () =>
    table([
      ["Producer revenue (excluding VAT)", money(c.revenue)],
      ["Ingredients · all packed output", money(c.ingredientCost)],
      ["Packaging · all packed tubs", money(c.packagingCost)],
      ["Labor · selected pay view", money(c.view.labor)],
      ["Operating overhead", money(c.overhead)],
      ["Cash operating expenses", money(c.view.cashCost)],
      [
        "Contribution",
        `${money(c.contribution)} · ${fmt(c.contributionMargin)}%`,
      ],
      ["Manufacturing cost incl. depreciation", money(c.view.manufacturing)],
      [
        "Manufacturing gross profit incl. wasted output",
        `${money(c.view.manufacturingProfit)} · ${fmt(c.view.manufacturingMargin)}%`,
      ],
      ["Full business cost incl. depreciation", money(c.view.fullCost)],
      [
        "Cash operating surplus before financing and tax",
        money(c.view.cashSurplus),
      ],
      ["Depreciation", money(c.view.depreciation)],
      ["Operating profit (EBIT)", money(c.view.ebit)],
      ["Profit before tax, after interest", money(c.view.pbt)],
      ["Illustrative tax (no benefit on losses)", money(c.view.tax)],
      ["After-tax profit", money(c.view.afterTax)],
      [
        "Cash remaining after payments, investment, WC and drawings",
        money(c.view.cashRemaining),
      ],
      ["Sales VAT collected · outside profit", money(c.vatCollected)],
    ]);
  const quantities = () =>
    metrics([
      ["Packed output", `${fmt(c.kg)} kg`],
      ["Packed tubs", fmt(c.tubs)],
      ["Paid output", `${fmt(c.paidKg)} kg`],
      ["Paid tubs", fmt(c.paidTubs)],
      [
        "Daily packed output",
        `${fmt(c.dailyKg)} kg / ${fmt(c.dailyTubs)} tubs`,
      ],
      [
        "Required batches",
        `${fmt(c.batches)} planned · ${fmt(c.wholeBatches)} rounded up`,
      ],
    ]);
  function overview() {
    return (
      panel(
        "Your business at a glance",
        grid(text("Scenario name", "name") + paySelector()) +
          note(
            c.view.pay === 0
              ? "This is a surplus before paying founders. Unpaid work and sustainable target compensation are shown separately."
              : `${viewName[b.targets.payView]}. Compensation is a cost to the business, not personal take-home pay.`,
          ) +
          warnings(c.issues.concat(c.planningIssues)) +
          quantities(),
      ) +
      panel(
        "Revenue, costs and cash",
        financialTable() +
          detail(
            "financial-formulas",
            "How these results are calculated",
            note(
              "Revenue = paid tubs × realized price, excluding VAT. Ingredients and packaging are charged on all packed output, including unsold stock. Contribution deducts variable operating costs. Manufacturing includes manufacturing labor and overhead plus depreciation. Full cost also includes administration, sales and distribution. Interest is below operating profit. Principal, investment, working-capital changes and drawings affect cash only. Startup debt and equity are funding sources, not recurring monthly revenue.",
            ),
          ),
      ) +
      panel(
        "Three ways to view founder pay",
        resultsTable(
          [
            "View",
            "Founder expense",
            "Cash surplus",
            "EBIT",
            "After-tax profit",
          ],
          Object.entries(c.views).map(([key, x]) => [
            viewName[key],
            money(x.pay),
            money(x.cashSurplus),
            money(x.ebit),
            money(x.afterTax),
          ]),
        ),
      ) +
      panel(
        "Costs at every scale",
        costTable() +
          resultsTable(
            [
              "Result",
              "Month",
              "Packed tub",
              "Paid tub",
              "Packed kg",
              "Sold kg",
              "Batch",
            ],
            [
              ["Net revenue", c.revenue],
              ["Contribution", c.contribution],
              ["Cash surplus", c.view.cashSurplus],
              ["Operating profit", c.view.ebit],
            ].map(([name, amount]) => [
              name,
              ...[
                amount,
                div(amount, c.tubs),
                div(amount, c.paidTubs),
                div(amount, c.kg),
                div(amount, c.paidKg),
                div(amount, c.batches),
              ].map(money),
            ]),
          ) +
          note(
            "Per-unit and per-batch figures allocate shared monthly fixed costs at this production volume. They are average costs, not marginal costs. A dash means missing input or an undefined allocation (for example, zero paid tubs).",
          ),
      ) +
      panel(
        "Capacity and funding",
        metrics([
          ["Startup funding", money(c.startup.funding)],
          ["Funding gap after loan / equity", money(c.startup.fundingGap)],
          [
            "Known capacity limit",
            c.capacityKg === null ? "Unknown" : `${fmt(c.capacityKg)} kg/month`,
          ],
          [
            "Capacity status",
            c.overCapacity
              ? "Above current capacity"
              : c.capacityComplete
                ? "Within entered capacity"
                : "Needs real measurements",
          ],
        ]) +
          note(
            "Workshop cost presets are planning assumptions. Supplier quotes, packaging scope, VAT treatment, team time and equipment capacities need confirmation.",
          ),
      )
    );
  }
  function recipeIntro() {
    return panel(
      "Ingredient costing method",
      grid(
        s("Active ingredient costing", "business.ingredientMode", [
          ["aggregate", "Aggregate workshop cost"],
          ["detailed", "Detailed recipe and purchase prices"],
        ]) +
          f(
            "Aggregate ingredient cost",
            "business.aggregatePerKg",
            "€/finished kg",
            "€2.2558 is the workshop fallback; detailed ingredients are excluded when this is active.",
          ),
      ) +
        grid(
          f(
            "Aggregate ingredient purchase VAT",
            "business.ingredientVatPct",
            "%",
          ) +
            check(
              "Aggregate ingredient VAT recoverable",
              "business.ingredientRecoverable",
            ),
        ) +
        note(
          "The aggregate fallback is already per usable finished kg. Do not apply recipe process loss to it again. Recipe quantities below remain saved; no workshop quantities were inferred from costs.",
        ) +
        detail(
          "workshop-cost-reference",
          "Workshop cost reference · 3,000 finished kg",
          table([
            ["Chickpeas", "€900.00"],
            ["Tahini", "€3,750.00"],
            ["Lemon juice", "€262.50"],
            ["Oil", "€1,200.00"],
            ["Garlic", "€249.90"],
            ["Salt", "€180.00"],
            ["Spices", "€225.00"],
            ["Blending water · supplied zero", "€0.00"],
            ["Total", "€6,767.40"],
          ]) +
            note(
              "Cost contributions only. These figures cannot reconstruct ingredient quantities or purchase prices.",
            ),
        ),
    );
  }
  function ingredientOptions() {
    return panel(
      "Ingredient mass, yield and VAT",
      r.ingredients
        .map((i, n) =>
          detail(
            `business-ingredient-${i.id}`,
            esc(i.name),
            grid(
              check("Ingredient enabled", `ingredients.${n}.enabled`) +
                check(
                  "Contributes to finished recipe mass",
                  `ingredients.${n}.contributesMass`,
                ) +
                (!i.chickpea
                  ? f(
                      "Prepared kg per purchased kg",
                      `ingredients.${n}.preparedYield`,
                      "×",
                      "Optional: recipe quantity is prepared quantity. This replaces a one-to-one purchase requirement.",
                      true,
                    )
                  : note(
                      "Chickpea dry/cooked conversion above is used; generic yield is inactive.",
                    )),
            ) +
              grid(
                f(
                  "Purchased-form density",
                  `ingredients.${n}.purchaseDensity`,
                  "kg/L",
                  "Optional separate density for a purchased-to-prepared conversion.",
                  true,
                ),
              ) +
              vatFields(`ingredients.${n}`) +
              actions("ingredients", "ingredient", n),
          ),
        )
        .join("") +
        note(
          "Discarded process aids keep their purchasing cost but add no recipe mass. Disabled ingredients contribute neither mass nor cost.",
        ) +
        resultsTable(
          [
            "Detailed ingredient",
            "Reference batch",
            "Finished kg",
            "Packed tub",
            "Target batch",
            "Month",
          ],
          c.ingredientRows.map((i) => [
            esc(i.name),
            ...[i.reference, i.perKg, i.perTub, i.batch, i.month].map(money),
          ]),
        ) +
        note(
          b.ingredientMode === "aggregate"
            ? "Detailed costs in this table are informational and are not added to the active aggregate cost."
            : "Detailed ingredient costs are active.",
        ),
    );
  }
  function production() {
    return (
      panel(
        "Monthly production plan",
        grid(
          s("Driving production input", "business.volume.driver", [
            ["kg", "Packed kg per month"],
            ["tubs", "Packed tubs per month"],
            ["batches", "Finished batches per month"],
          ]) +
            f("Monthly production", "business.volume.amount", b.volume.driver) +
            f(
              "Target finished batch",
              "targetKg",
              "kg",
              "Required for batch planning and per-batch workload; enter your real batch output.",
            ) +
            f("Production days per month", "business.volume.days", "days") +
            f(
              "Unsold / spoiled / credited output",
              "business.volume.unsoldPct",
              "%",
              "All packed output incurs costs. This is the only returns allowance.",
            ) +
            f(
              "Deliveries per month",
              "business.volume.deliveries",
              "deliveries",
            ),
        ) +
          quantities() +
          note(
            "Monthly planning permits fractional tubs and proportional batches. Rounded-up batch count is for scheduling; extra output is not silently added to costs. Physical packing uses actual fill weight (label + overfill). Labeled kg: " +
              fmt(c.labeledKg) +
              ". Process loss is already in finished output; unsold output is a separate downstream allowance.",
          ),
      ) +
      panel(
        "Choose package size and mix",
        grid(
          s("Package allocation basis", "business.volume.mixMode", [
            ["single", "One selected package"],
            ["kg", "Mix by packed kg"],
            ["tubs", "Mix by packed tub count"],
          ]) +
            s(
              "Selected package",
              "business.volume.packageId",
              b.packages.map((p) => [p.id, esc(p.name)]),
            ),
        ) +
          note(
            "Changing package size is explicit. Enabled mix shares must add to 100%. In single-package mode, shares are ignored.",
          ) +
          rows(
            "business.packages",
            "package",
            b.packages,
            (p, path) =>
              grid(
                f("Labeled package size", `${path}.sizeG`, "g") +
                  f("Overfill per tub", `${path}.overfillG`, "g") +
                  f("Mix allocation", `${path}.mixPct`, "%") +
                  s("Packaging cost method", `${path}.mode`, [
                    ["aggregate", "Aggregate per packed tub"],
                    ["items", "Itemized per packed tub"],
                  ]),
              ) +
              (p.mode === "aggregate"
                ? grid(
                    f(
                      "Aggregate packaging per tub",
                      `${path}.aggregate`,
                      "€/packed tub",
                    ),
                  ) + vatFields(path)
                : rows(
                    `${path}.items`,
                    "item",
                    p.items,
                    (i, ip) =>
                      grid(
                        f("Item cost per packed tub", `${ip}.cost`, "€/tub"),
                      ) + vatFields(ip),
                  )) +
              note(
                p.sizeG === 200
                  ? "€0.35 starting aggregate: confirm which packaging items it covers."
                  : "€0.24 (250 g) and €0.33 (500 g) are older planning assumptions.",
              ),
          ),
      ) +
      panel(
        "Package output",
        resultsTable(
          [
            "Package",
            "Actual fill",
            "Packed tubs",
            "Paid tubs",
            "Packaging / tub",
            "Monthly packaging",
          ],
          c.packages.map((p) => [
            esc(p.name),
            `${fmt(mul(p.fillKg, 1000))} g`,
            fmt(p.tubs),
            fmt(p.paidTubs),
            money(p.packaging),
            money(p.packagingTotal),
          ]),
        ),
      )
    );
  }
  function pricing() {
    return (
      panel(
        "Retail and channel assumptions",
        grid(
          f("Consumer retail cap", "pricing.ceiling", "€ incl. VAT") +
            f(
              "Sales VAT assumption",
              "pricing.vatPct",
              "%",
              "7% is an editable assumption requiring confirmation.",
            ) +
            f(
              "Retailer gross margin",
              "pricing.marginPct",
              "%",
              "Margin on net sales, not markup on purchase price.",
            ) +
            check(
              "Enable direct consumer channel",
              "business.sales.directEnabled",
            ) +
            (b.sales.directEnabled
              ? f(
                  "Direct share of paid tubs",
                  "business.sales.directPct",
                  "%",
                  "The remainder is wholesale.",
                )
              : ""),
        ) +
          note(
            "Shelf prices are planning inputs; retailers determine their own selling prices. Purchase prices elsewhere are entered excluding VAT, with an explicit recoverability setting. Sales VAT is kept outside profit.",
          ),
      ) +
      panel(
        "Selling prices by package",
        b.packages
          .map((p, n) =>
            detail(
              `price-${p.id}`,
              esc(p.name),
              grid(
                s(
                  "Wholesale price method",
                  `business.packages.${n}.priceMode`,
                  [
                    ["ceiling", "Backwards from shelf price"],
                    ["actual", "Direct wholesale input"],
                  ],
                ) +
                  f(
                    "Planned retailer shelf price",
                    `business.packages.${n}.shelf`,
                    "€ incl. VAT",
                  ) +
                  (p.priceMode === "actual"
                    ? f(
                        "Wholesale selling price",
                        `business.packages.${n}.wholesale`,
                        "€ excl. VAT",
                      )
                    : "") +
                  (b.sales.directEnabled
                    ? f(
                        "Direct consumer shelf price",
                        `business.packages.${n}.directShelf`,
                        "€ incl. VAT",
                      )
                    : ""),
              ),
            ),
          )
          .join("") +
          resultsTable(
            [
              "Active size",
              "Wholesale",
              "Retail net",
              "Retailer GP",
              "Implied retailer margin",
              "Implied shelf",
              "Above cap",
            ],
            c.packages.map((p) => [
              esc(p.name),
              money(p.wholesale),
              money(p.retailNet),
              money(p.retailerProfit),
              `${fmt(p.impliedMargin)}%`,
              money(p.impliedShelf),
              money(p.capExcess),
            ]),
          ) +
          detail(
            "margin-comparison",
            "Quick retailer margin comparison",
            resultsTable(
              ["Retailer margin", "Maximum wholesale at cap"],
              [25, 30, 35, 40].map((m) => [
                `${m}%`,
                money(
                  div(
                    mul(valid(r.pricing.ceiling), 1 - m / 100),
                    1 + Number(r.pricing.vatPct) / 100,
                  ),
                ),
              ]),
            ) +
              note(
                "Retail net = shelf ÷ (1 + VAT). Wholesale = retail net × (1 − margin). Implied shelf = wholesale ÷ (1 − margin) × (1 + VAT).",
              ),
          ),
      ) +
      panel(
        "Discounts, rebates and channel deductions",
        rows("business.sales.fees", "fee", b.sales.fees, (i, p) =>
          grid(
            s("Fee channel", `${p}.channel`, [
              ["wholesale", "Wholesale only"],
              ["direct", "Direct only"],
              ["all", "Both channels"],
            ]) +
              s("Deduction basis", `${p}.basis`, [
                ["gross", "Percent of channel gross revenue"],
                ["paid_tub", "EUR per paid channel tub"],
              ]) +
              f(
                "Deduction rate",
                `${p}.rate`,
                i.basis === "gross" ? "%" : "€/paid tub",
              ),
          ),
        ) +
          note(
            "Each percentage applies independently to gross revenue in the selected channel; fees are not compounded. Do not add a returns fee already covered by unsold/credited output. All deductions here reduce taxable selling consideration; model a separately invoiced service in expenses instead.",
          ),
      ) +
      panel(
        "Gross-to-realized revenue bridge",
        table([
          ["Gross producer revenue, excluding VAT", money(c.grossRevenue)],
          ...b.sales.fees
            .filter((f) => f.enabled)
            .map((f) => [
              esc(f.name),
              money(
                sum(
                  c.packages.map((p) =>
                    mul(
                      p.paidTubs,
                      p.feeRows.find((x) => x.id === f.id)?.amount ?? 0,
                    ),
                  ),
                ),
              ),
            ]),
          ["Total deductions", money(c.fees)],
          ["Realized producer net revenue", money(c.revenue)],
          ["Realized per paid tub", money(c.realizedPerPaid)],
          ["Revenue per kg sold", money(c.revenuePerPaidKg)],
          ["VAT collected separately", money(c.vatCollected)],
        ]),
      )
    );
  }
  function team() {
    return (
      panel(
        "Our three-person team",
        note(
          "Actual compensation can be zero. Sustainable targets and available hours start unknown. Salaries are business costs; drawings reduce cash without automatically reducing operating profit. Target compensation is a hypothetical total business expense replacing actual founder expense; drawings remain separate.",
        ) +
          rows(
            "business.founders",
            "founder",
            b.founders,
            (i, p) =>
              grid(
                f("Available monthly hours", `${p}.availableHours`, "hours") +
                  s("Actual compensation method", `${p}.payMode`, [
                    ["cost", "Total business compensation cost"],
                    ["salary", "Gross salary plus employer costs"],
                    ["drawings", "Owner drawings / distributions"],
                  ]) +
                  (i.payMode === "salary"
                    ? f("Monthly gross salary", `${p}.gross`, "€") +
                      f("Employer costs", `${p}.employerPct`, "%")
                    : f(
                        "Actual monthly compensation / drawings",
                        `${p}.actual`,
                        "€",
                      )) +
                  f(
                    "Sustainable target business compensation",
                    `${p}.target`,
                    "€/month",
                    "Optional until target-pay view is used.",
                    true,
                  ) +
                  f(
                    "Unpaid work economic rate",
                    `${p}.economicRate`,
                    "€/hour",
                    "Informational opportunity cost only.",
                    true,
                  ),
              ) +
              detail(
                `allocation-${i.id}`,
                "Work allocation · must sum to 100%",
                grid(
                  tasks
                    .map((t) =>
                      f(
                        t[0].toUpperCase() + t.slice(1) + " allocation",
                        `${p}.allocations.${t}`,
                        "%",
                      ),
                    )
                    .join(""),
                ),
              ),
          ),
      ) +
      panel(
        "Optional hired staff",
        rows("business.staff", "staff", b.staff, (i, p) =>
          grid(
            s("Staff pay basis", `${p}.payMode`, [
              ["monthly", "Monthly total gross pay"],
              ["hourly", "Hourly gross pay"],
            ]) +
              f(
                "Staff pay rate",
                `${p}.rate`,
                i.payMode === "monthly" ? "€/month" : "€/hour",
              ) +
              (i.payMode === "hourly"
                ? f("Paid staff hours", `${p}.hours`, "hours/month")
                : "") +
              f("Staff employer costs", `${p}.employerPct`, "%") +
              s("Staff cost classification", `${p}.classification`, [
                "manufacturing",
                "administration",
                "sales",
                "distribution",
              ]),
          ),
        ) +
          note(
            "No hired staff are required by default. The historical €10,843.75 payroll is available only as a separate scenario. Hired labor costs do not silently add capacity to the founder team; revise measured capacity or founder/task assumptions explicitly.",
          ),
      ) +
      panel(
        "Workload by task",
        rows("business.workload", "workload", b.workload, (i, p) =>
          grid(
            s("Task allocation", `${p}.task`, tasks) +
              f("Required hours rate", `${p}.rate`, "hours") +
              s("Hours calculation basis", `${p}.basis`, basis),
          ),
        ) +
          resultsTable(
            ["Task", "Required hours", "Allocated founder hours", "Status"],
            c.teamTasks.map((t) => [
              esc(t.task),
              fmt(t.hours),
              fmt(t.available),
              t.hours === null || t.available === null
                ? "Unknown"
                : t.overloaded
                  ? "Over capacity"
                  : "Within allocation",
            ]),
          ) +
          metrics([
            ["Required founder hours", fmt(c.requiredHours)],
            ["Available founder hours", fmt(c.availableHours)],
            ["Unpaid assigned hours", fmt(c.unpaidHours)],
            ["Unpaid work economic value", money(c.economicValue)],
          ]) +
          note(
            "Unpaid hours allocate task demand across founders by available hours and task allocation. This informational value is not added to expenses. Paid staff workload must be removed from founder task demand if staff take over those tasks.",
          ) +
          warnings(
            c.capacityIssues,
            "Workload and capacity inputs to complete",
          ),
      )
    );
  }
  function expenses() {
    const categories = [...new Set(c.expenseRows.map((e) => e.category))];
    return (
      panel(
        "Operating model",
        grid(
          s("Production arrangement", "business.operatingMode", [
            ["own", "Our own production facility"],
            ["shared", "Shared kitchen"],
            ["contract", "Contract manufacturing"],
          ]) +
            (b.operatingMode === "shared"
              ? f("Shared kitchen charge", "business.sharedMonthly", "€/month")
              : "") +
            (b.operatingMode === "contract"
              ? f(
                  "Contract manufacturing charge",
                  "business.contractPerKg",
                  "€/packed kg",
                ) +
                check(
                  "Contract rate includes ingredients",
                  "business.contractIncludesIngredients",
                ) +
                check(
                  "Contract rate includes packaging",
                  "business.contractIncludesPackaging",
                )
              : ""),
        ) +
          note(
            "Choose which individual expense rows are replaced by shared-kitchen or contract fees. Replaced rows are excluded and labeled below. Contract ingredient / packaging switches replace those whole categories. Selected equipment leases remain commitments unless disabled separately.",
          ),
      ) +
      panel(
        "Every monthly expense",
        rows(
          "business.expenses",
          "expense",
          b.expenses,
          (i, p, n) =>
            grid(
              text("Expense category", `${p}.category`) +
                s("Cost classification", `${p}.classification`, [
                  "manufacturing",
                  "administration",
                  "sales",
                  "distribution",
                ]) +
                s("Input status", `${p}.status`, [
                  ["supplied", "Supplied input"],
                  ["planning", "Planning assumption"],
                  ["target", "Target"],
                  ["quotation", "Quotation needed"],
                ]) +
                s("Cost behavior", `${p}.behavior`, [
                  ["fixed", "Fixed monthly"],
                  ["variable", "Variable with base charge"],
                  ["step", "Capacity step with base charge"],
                ]) +
                f("Fixed base charge", `${p}.base`, "€/month") +
                f("Rate per consumption unit", `${p}.rate`, "€") +
                f("Consumption multiplier", `${p}.consumption`, "units") +
                text("Consumption unit", `${p}.consumptionUnit`) +
                (i.behavior !== "fixed"
                  ? s("Expense calculation basis", `${p}.basis`, basis)
                  : "") +
                (i.behavior === "step"
                  ? f(
                      "Capacity per step",
                      `${p}.stepSize`,
                      "basis units",
                      "Cost = base + rate × consumption × ceil(basis quantity / step size). Zero output incurs base only.",
                    )
                  : ""),
            ) +
            vatFields(p) +
            grid(
              check("Replaced by shared kitchen", `${p}.replaceShared`) +
                check(
                  "Replaced by contract manufacturing",
                  `${p}.replaceContract`,
                ),
            ) +
            table([
              ["Monthly amount", money(c.expenseRows[n]?.amount)],
              [
                "Allocated per paid tub",
                money(div(c.expenseRows[n]?.amount ?? null, c.paidTubs)),
              ],
              [
                "Status",
                c.expenseRows[n]?.replaced
                  ? "Replaced by operating arrangement"
                  : i.enabled
                    ? "Included"
                    : "Disabled",
              ],
            ]),
        ) +
          note(
            "Fixed = base + rate × consumption. Variable = base + rate × consumption × basis amount. Water starts at 0.01 m³/kg (10 L/kg) × €5/m³. Delivery count is an explicit monthly assumption. Current worksheet drivers reconcile to €4,460 fixed + €0.64 per kg = €6,380 at 3,000 kg.",
          ),
      ) +
      panel(
        "Expense category totals",
        table(
          categories
            .map((category) => [
              esc(category),
              money(
                sum(
                  c.expenseRows
                    .filter((e) => e.category === category)
                    .map((e) => e.amount),
                ),
              ),
            ])
            .concat([
              ["Total operating overhead", money(c.overhead)],
              ["Fixed component", money(c.fixedOverhead)],
              [
                "Volume-dependent and step component",
                money(c.variableOverhead),
              ],
            ]),
        ),
      )
    );
  }
  function equipment() {
    return (
      panel(
        "Equipment budget and depreciation",
        grid(
          s("Equipment purchase budgeting", "business.equipmentMode", [
            ["aggregate", "Aggregate equipment budget"],
            ["items", "Selected itemized purchases"],
          ]) +
            (b.equipmentMode === "aggregate"
              ? f("Aggregate equipment budget", "business.equipmentBudget", "€")
              : "") +
            s("Depreciation method", "business.depreciationMode", [
              ["historical", "Historical reconciliation override"],
              ["assets", "Asset useful lives"],
            ]) +
            (b.depreciationMode === "historical"
              ? f(
                  "Historical monthly depreciation",
                  "business.historicalDep",
                  "€/month",
                  "€708.333333 is for historical reconciliation only.",
                )
              : b.equipmentMode === "aggregate"
                ? f(
                    "Aggregate equipment useful life",
                    "business.equipmentLifeYears",
                    "years",
                  ) +
                  f(
                    "Aggregate equipment residual value",
                    "business.equipmentResidual",
                    "€",
                  )
                : ""),
        ) +
          note(
            "Purchase budgeting is exclusive: aggregate or itemized. Owned assets have no new purchase charge. Purchased equipment depreciation is (cost − residual) ÷ life in months. Selected leases are operating expenses, including when aggregate purchase budgeting is active. Facility conversion / installation are startup capital; the asset-life model here depreciates equipment only. Add capitalized fit-out as an asset and avoid duplicating its startup amount if it must be depreciated.",
          ),
      ) +
      panel(
        "Equipment register",
        rows(
          "business.assets",
          "asset",
          b.assets,
          (i, p) =>
            grid(
              f("Equipment quantity", `${p}.quantity`, "units") +
                f(
                  "Unit purchase cost",
                  `${p}.unitCost`,
                  "€",
                  "Required for selected purchased assets in itemized mode.",
                  true,
                ) +
                s("Equipment priority", `${p}.priority`, [
                  ["essential", "Essential"],
                  ["optional", "Optional"],
                  ["manual", "Manual-first upgrade"],
                ]) +
                s("Equipment ownership", `${p}.ownership`, [
                  ["owned", "Already owned"],
                  ["purchase", "Purchase"],
                  ["lease", "Lease"],
                ]) +
                f(
                  "Useful life",
                  `${p}.lifeYears`,
                  "years",
                  "Required when asset depreciation is active.",
                  true,
                ) +
                f("Residual per unit", `${p}.residual`, "€") +
                (i.ownership === "lease"
                  ? f("Lease per unit per month", `${p}.leaseMonthly`, "€")
                  : "") +
                f(
                  "Monthly capacity per unit",
                  `${p}.capacityKg`,
                  "kg",
                  "Sustainable usable capacity, including cleaning and downtime; leave unknown until measured.",
                  true,
                ),
            ) + vatFields(p),
        ),
      ) +
      panel(
        "Startup budget and reserve",
        grid(
          f("Facility conversion", "business.startup.conversion", "€") +
            f("Installation", "business.startup.installation", "€") +
            f("Refundable deposits", "business.startup.deposits", "€") +
            f("Food safety and launch setup", "business.startup.launch", "€") +
            f("Branding / artwork", "business.startup.branding", "€") +
            f("Opening inventory", "business.startup.openingStock", "€") +
            f(
              "Capital contingency",
              "business.startup.contingencyPct",
              "%",
              "Equipment + conversion + installation.",
            ) +
            s("Working-capital method", "business.startup.reserveMode", [
              ["simple", "Simple cash reserve"],
              ["calculated", "Calculated operating working capital"],
            ]) +
            (b.startup.reserveMode === "simple"
              ? f("Editable cash reserve", "business.startup.reserve", "€")
              : "") +
            f(
              "Customer payment terms",
              "business.startup.receivableDays",
              "days",
              "Needed for calculated working capital.",
              true,
            ) +
            f(
              "Inventory coverage",
              "business.startup.inventoryDays",
              "days",
              "Ingredient + packaging purchases on a 30-day month.",
              true,
            ) +
            f(
              "Supplier credit",
              "business.startup.supplierDays",
              "days",
              "Credit on ingredient + packaging purchases.",
              true,
            ),
        ) +
          table([
            ["Equipment purchases", money(c.startup.equipment)],
            ["Capital investment before contingency", money(c.startup.capital)],
            ["Capital contingency", money(c.startup.contingency)],
            ["Startup expenses", money(c.startup.startupExpenses)],
            ["Refundable deposits", money(c.startup.deposits)],
            ["Opening inventory", money(c.startup.openingStock)],
            ["Additional reserve", money(c.startup.reserve)],
            ["Total startup funding", money(c.startup.funding)],
          ]) +
          detail(
            "working-capital-formula",
            "Working-capital calculation and stock treatment",
            table([
              ["Receivables", money(c.startup.receivables)],
              ["Inventory requirement", money(c.startup.inventory)],
              ["Supplier credit", money(c.startup.payables)],
              [
                "Net operating working capital",
                money(c.startup.workingCapital),
              ],
            ]) +
              note(
                "Working capital = net monthly revenue × customer days / 30 + ingredient and packaging costs × (inventory days − supplier days) / 30. Calculated additional reserve = max(0, working capital − opening inventory already budgeted). It replaces the simple reserve. Opening inventory is a startup funding use; consumption is expensed through monthly ingredients and packaging, never as a second monthly opening-stock charge. This is a net-of-recoverable-VAT planning estimate; it excludes VAT timing.",
              ),
          ) +
          warnings(c.startupIssues, "Startup estimate inputs"),
      ) +
      panel(
        "Funding, tax and monthly cash movements",
        grid(
          f("Startup loan funding", "business.startup.loan", "€") +
            f("Startup equity funding", "business.startup.equity", "€") +
            f(
              "Monthly interest expense",
              "business.startup.interest",
              "€/month",
            ) +
            f(
              "Monthly principal repayment",
              "business.startup.principal",
              "€/month",
            ) +
            f("Illustrative profit tax", "business.startup.taxPct", "%") +
            f(
              "Investment paid this month",
              "business.startup.investment",
              "€",
            ) +
            field(
              "Working-capital increase this month",
              "business.startup.wcChange",
              {
                unit: "€",
                min: -Infinity,
                help: "Positive consumes cash; negative releases cash.",
              },
            ) +
            f(
              "Other owner drawings this month",
              "business.startup.drawings",
              "€",
              "Additional to founder records.",
            ),
        ) +
          table([
            ["Unfunded startup gap", money(c.startup.fundingGap)],
            ["Selected-view cash remaining", money(c.view.cashRemaining)],
          ]),
      )
    );
  }
  function chart() {
    const be = solveVolume(r, { view: b.targets.payView }),
      max =
        Math.max(
          c.kg || 0,
          Number.isFinite(be.kg) ? be.kg : 0,
          Number.isFinite(c.capacityKg) ? c.capacityKg : 0,
          100,
        ) * 1.3;
    const data = Array.from({ length: 25 }, (_, i) => {
      const kg = (max * i) / 24;
      return [
        kg,
        calculateBusiness(r, kg, { noRecipeRows: true }).views[
          b.targets.payView
        ].ebit,
      ];
    });
    if (data.some((p) => p[1] === null))
      return note(
        "Complete active cost and price inputs to draw the profit chart.",
      );
    const low = Math.min(0, ...data.map((p) => p[1])),
      high = Math.max(1, ...data.map((p) => p[1])),
      x = (v) => 65 + (v / max) * 565,
      y = (v) => 245 - ((v - low) / (high - low)) * 200;
    const line = data
      .map(
        (p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(2)},${y(p[1]).toFixed(2)}`,
      )
      .join(" ");
    const mark = (kg, color, label) =>
      kg !== null && Number.isFinite(kg) && kg <= max
        ? `<line x1="${x(kg)}" x2="${x(kg)}" y1="38" y2="245" stroke="${color}" stroke-dasharray="4 4"/><text x="${Math.min(550, x(kg) + 4)}" y="${label === "Capacity" ? 30 : 16}" fill="${color}">${label} ${fmt(kg, 0)} kg</text>`
        : "";
    return (
      `<svg class="profit-chart" viewBox="0 0 680 290" role="img" aria-label="Operating profit versus monthly packed kilograms; break-even and known capacity marked"><line x1="65" x2="630" y1="${y(0)}" y2="${y(0)}" stroke="#9b9c88"/><path d="${line}" fill="none" stroke="#617448" stroke-width="3"/>${mark(be.kg, "#56703c", "Break-even")}${mark(c.capacityKg, "#ad653d", "Capacity")}<text x="5" y="50">€${fmt(high, 0)}</text><text x="5" y="245">€${fmt(low, 0)}</text><text x="65" y="270">0</text><text x="450" y="270">${fmt(max, 0)} packed kg / month</text></svg>` +
      note(
        "Chart samples 25 volumes; exact step-cost break-even is solved separately. Dashed capacity uses only entered limits; unknown bottlenecks remain unverified.",
      )
    );
  }
  function scenarios() {
    const be = [];
    for (const key of ["before", "actual", "target"])
      for (const accounting of [false, true]) {
        const result = solveVolume(r, { view: key, accounting });
        be.push([
          `${viewName[key]} · ${accounting ? "accounting" : "cash"}`,
          fmt(result.kg),
          fmt(result.tubs),
          fmt(result.paidTubs),
          fmt(result.dailyKg),
          esc(result.status),
        ]);
      }
    const target = solveVolume(r, {
      view: b.targets.payView,
      profit: b.targets.profit,
      marginPct: b.targets.marginPct,
    });
    const neededValues = [
        valid(b.targets.profit),
        mul(c.revenue, div(valid(b.targets.marginPct, 0, 99.9999999), 100)),
      ],
      needed = neededValues.includes(null) ? null : Math.max(...neededValues),
      reduction =
        needed === null || c.view.ebit === null
          ? null
          : Math.max(0, needed - c.view.ebit);
    return (
      panel(
        "Break-even for each founder-pay view",
        resultsTable(
          [
            "View",
            "Packed kg",
            "Packed tubs",
            "Paid tubs",
            "Daily kg",
            "Feasibility",
          ],
          be,
        ) +
          detail(
            "break-even-formula",
            "Calculation and search limits",
            note(
              "For linear costs: contribution per packed tub = paid fraction × realized price − variable cost per packed tub; break-even = fixed costs ÷ contribution. Accounting adds depreciation. Capacity-step scenarios are solved interval by interval using the actual cost function. With no positive contribution there is no finite break-even. Search is bounded by the editable maximum; capacity does not hide an economically required but unattainable volume.",
            ) +
              grid(
                f(
                  "Maximum break-even search volume",
                  "business.targets.searchKg",
                  "kg",
                ),
              ),
          ),
      ) +
      panel(
        "Targets and retailer plan",
        grid(
          paySelector() +
            f(
              "Target monthly operating profit",
              "business.targets.profit",
              "€",
            ) +
            f(
              "Target operating margin",
              "business.targets.marginPct",
              "%",
              "Both targets must be met: EBIT must reach the larger of the profit target and margin × revenue.",
            ) +
            f(
              "Planned retailer count",
              "business.targets.retailers",
              "retailers",
              "Used to calculate paid tubs per retailer per week.",
              true,
            ) +
            f(
              "Paid tubs per retailer per week",
              "business.targets.paidPerRetailerWeek",
              "tubs",
              "Used to calculate the required retailer count.",
              true,
            ),
        ) +
          table([
            ["Target packed kg", fmt(target.kg)],
            ["Target paid tubs", fmt(target.paidTubs)],
            ["Target packed tubs", fmt(target.tubs)],
            ["Target daily kg", fmt(target.dailyKg)],
            [
              "Retailers required",
              target.retailers === null
                ? "—"
                : fmt(Math.ceil(target.retailers)),
            ],
            ["Paid tubs / retailer / week", fmt(target.paidPerRetailerWeek)],
            ["Target feasibility", esc(target.status)],
            ["Current-volume monthly cost reduction needed", money(reduction)],
            ["Reduction per paid tub", money(div(reduction, c.paidTubs))],
          ]) +
          note(
            "Retailer calculations use wholesale paid tubs only and 52/12 weeks per month. Volume targets preserve the selected package mix and channel mix.",
          ),
      ) +
      panel(
        "Production bottlenecks",
        rows("business.capacity", "capacity", b.capacity, (i, p) =>
          grid(
            f(
              "Sustainable monthly capacity",
              `${p}.amount`,
              i.basis === "kg" ? "kg" : "tubs",
              "Leave blank for unknown; 0 means no capacity.",
            ) +
              s("Capacity measurement", "" + p + ".basis", [
                ["kg", "Packed kg per month"],
                ["tubs", "Packed tubs per month"],
              ]),
          ),
        ) +
          resultsTable(
            ["Bottleneck", "Monthly kg limit"],
            c.capacityRows.map((x) => [
              esc(x.name),
              x.kg === Infinity ? "No task-rate limit" : fmt(x.kg),
            ]),
          ) +
          warnings(c.capacityIssues, "Capacity not yet verified"),
      ) +
      panel("Profit versus production", chart()) +
      panel(
        "Named scenarios",
        `<p class="subtext">Presets create a separate scenario. Existing quantities and saved scenarios are kept. Reset restores the active scenario’s business preset and archives a copy first; recipe quantities remain saved.</p><div class="actions preset-actions">${presets.map(([key, label]) => `<button data-preset="${key}">${label}</button>`).join("")}<button data-action="reset-scenario">Reset business assumptions</button></div>` +
          resultsTable(
            [
              "Scenario",
              "Package / mix",
              "Shelf",
              "Retailer margin",
              "Packed kg",
              "Unsold",
              "Founder pay",
              "Ingredients / kg",
              "Packaging / tub",
              "Revenue",
              "EBIT",
            ],
            state.recipes.map((scenario) => {
              const x = calculateBusiness(scenario);
              return [
                esc(scenario.name),
                esc(x.packages.map((p) => `${p.sizeG} g`).join(" + ")),
                x.packages.map((p) => money(p.shelf)).join(" / "),
                `${fmt(Number(scenario.pricing.marginPct))}%`,
                fmt(x.kg),
                `${fmt(Number(scenario.business.volume.unsoldPct))}%`,
                money(x.view.pay),
                money(x.ingredientRate),
                money(div(x.packagingCost, x.tubs)),
                money(x.revenue),
                money(x.view.ebit),
              ];
            }),
          ),
      ) +
      panel(
        "Package-size comparison at current packed kg",
        resultsTable(
          [
            "Explicit alternative",
            "Packed tubs",
            "Paid tubs",
            "Packaging",
            "Revenue",
            "Operating profit",
          ],
          b.packages
            .filter((p) => p.enabled)
            .map((p) => {
              const copy = structuredClone(r);
              copy.business.volume.mixMode = "single";
              copy.business.volume.packageId = p.id;
              const x = calculateBusiness(copy, c.kg);
              return [
                esc(p.name),
                fmt(x.tubs),
                fmt(x.paidTubs),
                money(x.packagingCost),
                money(x.revenue),
                money(x.view.ebit),
              ];
            }),
        ) +
          note(
            "Each alternative uses its own saved packaging and price assumptions at the same packed kg. Selecting a row here does not change the active package. Duplicate the scenario to compare shelf price, margins, spoilage, production, pay and costs.",
          ),
      )
    );
  }
  function sidebar() {
    return `<aside class="summary" id="summary"><div class="summary-card summary-inner"><p class="eyebrow">LIVE BUSINESS ESTIMATE</p><h2>${esc(r.name)}</h2>${note(viewName[b.targets.payView])}${c.incomplete || c.planningIssues.length ? '<div class="warnings"><strong>Incomplete estimate</strong><p>Complete active inputs. Unknowns are shown as —.</p></div>' : ""}${metrics(
      [
        ["Monthly net revenue", money(c.revenue)],
        ["Operating profit", money(c.view.ebit)],
      ],
    )}${table([
      ["Packed / paid tubs", `${fmt(c.tubs)} / ${fmt(c.paidTubs)}`],
      ["Full cost / paid tub", money(div(c.view.fullCost, c.paidTubs))],
      ["Full cost / sold kg", money(div(c.view.fullCost, c.paidKg))],
      ["Cash surplus", money(c.view.cashSurplus)],
      ["Cash remaining", money(c.view.cashRemaining)],
      ["Startup funding", money(c.startup.funding)],
    ])}${note(c.view.pay === 0 ? "Surplus before paying founders." : viewName[b.targets.payView])}${note(c.overCapacity ? "Required production exceeds an entered capacity limit." : c.capacityComplete ? "Within entered capacity." : "Capacity remains unverified.")}<a href="#inputs" class="mobile-summary-link">Back to inputs ↑</a></div></aside>`;
  }
  function print() {
    return `<section class="print-only"><h1>Hummus business plan · ${esc(r.name)}</h1><p>${viewName[b.targets.payView]} · EUR excluding recoverable VAT · ${new Date().toLocaleDateString()}</p>${warnings(c.issues.concat(c.planningIssues))}${quantities()}${financialTable()}<h2>Costs and allocations</h2>${costTable()}<h2>Startup funding</h2>${table(Object.entries(c.startup).map(([k, v]) => [esc(k), money(v)]))}<h2>Planning assumptions</h2>${table(
      [
        ["Ingredient method", esc(b.ingredientMode)],
        ["Ingredient cost / kg", money(c.ingredientRate)],
        [
          "Package sizes",
          c.packages
            .map((p) => `${p.sizeG} g + ${p.overfillG} g overfill`)
            .join(", "),
        ],
        ["Retail cap", money(Number(r.pricing.ceiling))],
        ["Sales VAT assumption", `${r.pricing.vatPct}%`],
        ["Retailer margin", `${r.pricing.marginPct}%`],
        ["Unsold output", `${b.volume.unsoldPct}%`],
        ["Depreciation method", esc(b.depreciationMode)],
      ],
    )}${note("All workshop costs are editable planning inputs. Confirm supplier costs, VAT treatment, workload and capacities. Fractional tubs and batches are proportional monthly planning estimates. Fixed-cost allocations are not marginal costs.")}${warnings(c.capacityIssues, "Unverified capacity")}${warnings(c.startupIssues, "Startup inputs")}</section>`;
  }
  return {
    overview,
    recipeIntro,
    ingredientOptions,
    production,
    pricing,
    team,
    expenses,
    equipment,
    scenarios,
    sidebar,
    print,
  };
}
