import {
  defaultPlan,
  defaultIncome,
  defaultAccess,
  validatePlan,
  type Plan,
  type Access,
  type IncomePlan,
  type Annual,
} from "./retirement.ts";
import { projectAccounts, type Account } from "./projection.ts";
export const SCENARIO_VERSION = 1;
export const MAX_SCENARIO_BYTES = 128 * 1024;
export type Scenario = {
  format: "retirement-calculator";
  version: 1;
  accounts: Account[];
  access: Record<string, Access>;
  plan: Plan;
  household: number;
  savingsYears: number;
};
export function inputsFromPlan(p: Plan): Record<string, string> {
  const i = p.income ?? defaultIncome;
  return {
    ...Object.fromEntries(
      Object.entries(p)
        .filter(([k]) => k !== "income")
        .map(([k, v]) => [k, String(v)]),
    ),
    retirementYears: String(Math.floor(p.retirementAgeMonths / 12)),
    retirementMonths: String(p.retirementAgeMonths % 12),
    ...Object.fromEntries(
      Object.entries(i)
        .filter(([k]) => k !== "sepp")
        .map(([k, v]) => [k, String(v)]),
    ),
    ...Object.fromEntries(
      Object.entries(i.sepp).map(([k, v]) => ["sepp_" + k, String(v)]),
    ),
  };
}
export const initialInputs = inputsFromPlan(defaultPlan);
export function planFromInputs(v: Record<string, string>): Plan {
  const num = (key: string) => {
    if (!v[key]?.trim() || !Number.isFinite(Number(v[key])))
      throw new RangeError(
        `Complete ${key.replaceAll("_", " ")} with a finite number.`,
      );
    return Number(v[key]);
  };
  const years = num("retirementYears"),
    months = num("retirementMonths");
  if (
    !Number.isInteger(years) ||
    !Number.isInteger(months) ||
    months < 0 ||
    months > 11
  )
    throw new RangeError(
      "Use whole retirement years and 0–11 additional months.",
    );
  const enabled = v.sepp_enabled === "true",
    ss = num("socialSecurityMonthly");
  return {
    startYear: num("startYear"),
    birthDate: v.birthDate,
    retirementAgeMonths: years * 12 + months,
    years: num("years"),
    salary: num("salary"),
    mode: v.mode as Plan["mode"],
    spending: v.mode === "spending" ? num("spending") : defaultPlan.spending,
    inflation: v.mode === "spending" ? num("inflation") : defaultPlan.inflation,
    withdrawalPercent:
      v.mode === "percent"
        ? num("withdrawalPercent")
        : defaultPlan.withdrawalPercent,
    filing: v.filing as Plan["filing"],
    strategy: v.strategy as Plan["strategy"],
    magiTarget: num("magiTarget"),
    magiAddbacks: num("magiAddbacks"),
    income: {
      socialSecurityMonthly: ss,
      socialSecurityStart:
        ss > 0 ? v.socialSecurityStart : defaultIncome.socialSecurityStart,
      socialSecurityCola: ss > 0 ? num("socialSecurityCola") : 0,
      taxExemptInterest: num("taxExemptInterest"),
      separateLivedTogether: v.separateLivedTogether === "true",
      rmdEnabled: v.rmdEnabled === "true",
      rmd1959Age: Number(v.rmd1959Age) as 73 | 75,
      sepp: enabled
        ? {
            enabled,
            accountId: v.sepp_accountId,
            firstPayment: v.sepp_firstPayment,
            method: v.sepp_method as IncomePlan["sepp"]["method"],
            annualPayment:
              v.sepp_method === "verified"
                ? num("sepp_annualPayment")
                : defaultIncome.sepp.annualPayment,
            rate: v.sepp_method === "amortization" ? num("sepp_rate") : 4,
            acknowledged: v.sepp_acknowledged === "true",
          }
        : { ...defaultIncome.sepp },
    },
  };
}
function object(
  value: unknown,
  keys: string[],
  label: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new RangeError(`${label} must be an object.`);
  const obj = value as Record<string, unknown>;
  if (Object.keys(obj).some((k) => !keys.includes(k)))
    throw new RangeError(`${label} contains an unsupported field.`);
  return obj;
}
function shape(
  value: unknown,
  template: Record<string, unknown>,
  label: string,
) {
  const o = object(value, Object.keys(template), label);
  for (const [k, t] of Object.entries(template)) {
    const x = o[k];
    if (
      t === null
        ? x !== null && (typeof x !== "number" || !Number.isFinite(x))
        : typeof t === "number"
          ? typeof x !== "number" || !Number.isFinite(x)
          : typeof x !== typeof t
    )
      throw new RangeError(`${label}.${k} has an invalid type.`);
  }
  return o;
}
export function parseScenario(text: string): Scenario {
  if (new TextEncoder().encode(text).byteLength > MAX_SCENARIO_BYTES)
    throw new RangeError("Scenario exceeds the 128 KB limit.");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new RangeError("Choose a valid JSON scenario file.");
  }
  const root = object(
    raw,
    [
      "format",
      "version",
      "accounts",
      "access",
      "plan",
      "household",
      "savingsYears",
    ],
    "Scenario",
  );
  if (
    root.format !== "retirement-calculator" ||
    root.version !== SCENARIO_VERSION
  )
    throw new RangeError(
      "Unsupported scenario format or version. Expected version 1.",
    );
  if (!Array.isArray(root.accounts) || root.accounts.length > 20)
    throw new RangeError("Scenario needs 1–20 accounts.");
  const accounts = root.accounts.map(
    (a) =>
      shape(
        a,
        {
          id: "",
          name: "",
          type: "",
          balance: 0,
          monthlyContribution: 0,
          priceGrowth: 0,
          incomeYield: 0,
        },
        "Account",
      ) as unknown as Account,
  );
  if (
    accounts.some(
      (a) =>
        !/^[-a-zA-Z0-9_]{1,100}$/.test(a.id) ||
        ["__proto__", "constructor", "prototype"].includes(a.id),
    )
  )
    throw new RangeError("Invalid account identifier.");
  projectAccounts(accounts, 0);
  const accessRaw = object(
      root.access,
      accounts.map((a) => a.id),
      "Account access",
    ),
    access: Record<string, Access> = {};
  for (const [id, a] of Object.entries(accessRaw))
    access[id] = shape(
      a,
      { ...defaultAccess(), priorYearBalance: null },
      "Account access",
    ) as unknown as Access;
  const planObj = object(
    root.plan,
    [...Object.keys(defaultPlan), "income"],
    "Plan",
  );
  shape(
    Object.fromEntries(Object.entries(planObj).filter(([k]) => k !== "income")),
    defaultPlan,
    "Plan",
  );
  const inc = object(planObj.income, Object.keys(defaultIncome), "Income");
  shape(
    Object.fromEntries(Object.entries(inc).filter(([k]) => k !== "sepp")),
    Object.fromEntries(
      Object.entries(defaultIncome).filter(([k]) => k !== "sepp"),
    ),
    "Income",
  );
  shape(inc.sepp, defaultIncome.sepp, "SEPP");
  const plan = planObj as unknown as Plan;
  validatePlan(accounts, access, plan);
  const household = root.household,
    savingsYears = root.savingsYears;
  if (
    typeof household !== "number" ||
    !Number.isInteger(household) ||
    household < 1 ||
    household > 20
  )
    throw new RangeError("Household must be 1–20.");
  if (
    typeof savingsYears !== "number" ||
    !Number.isInteger(savingsYears) ||
    savingsYears < 0 ||
    savingsYears > 80
  )
    throw new RangeError("Savings horizon must be 0–80.");
  return {
    format: "retirement-calculator",
    version: 1,
    accounts,
    access,
    plan,
    household,
    savingsYears,
  };
}
export function exportScenario(
  accounts: Account[],
  access: Record<string, Access>,
  plan: Plan,
  household: number,
  savingsYears: number,
) {
  // Inactive metadata is omitted/reset so switching account types cannot poison a file.
  const normalized = Object.fromEntries(
    accounts.map((a) => {
      const o = access[a.id] ?? defaultAccess(),
        clean = { ...defaultAccess(), priorYearBalance: null } as Access;
      if (a.type === "Roth IRA")
        Object.assign(clean, {
          rothBasis: o.rothBasis,
          rothFirstYear: o.rothFirstYear,
        });
      if (a.type === "Taxable brokerage") clean.taxableBasis = o.taxableBasis;
      if (
        (plan.income ?? defaultIncome).rmdEnabled &&
        (a.type === "Traditional IRA" || a.type === "401(k) / 403(b)")
      )
        clean.priorYearBalance = o.priorYearBalance ?? null;
      if (a.type === "401(k) / 403(b)")
        Object.assign(clean, {
          separationDate: o.separationDate,
          rule55: o.rule55,
          planAllows: o.planAllows,
        });
      return [a.id, clean];
    }),
  );
  const text = JSON.stringify(
    {
      format: "retirement-calculator",
      version: 1,
      accounts,
      access: normalized,
      plan: { ...plan, income: plan.income ?? defaultIncome },
      household,
      savingsYears,
    },
    null,
    2,
  );
  parseScenario(text);
  return text;
}
export function resultsCsv(rows: Annual[], accounts: Account[]) {
  const keys = (Object.keys(rows[0] ?? {}) as (keyof Annual)[]).filter(
    (k) => k !== "accounts",
  );
  const quote = (value: unknown) => {
    let s = String(value);
    if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return [
    [...keys, ...accounts.map((a) => `${a.name} balance`)].map(quote).join(","),
    ...rows.map((r) =>
      [...keys.map((k) => r[k]), ...r.accounts].map(quote).join(","),
    ),
  ].join("\r\n");
}
