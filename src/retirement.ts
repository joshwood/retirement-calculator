import { projectAccounts, type Account } from "./projection.ts";
import { federalTax, TAX_RULES, type FilingStatus } from "./tax.ts";
export type Access = {
  taxableBasis: number | null;
  rothBasis: number;
  rothFirstYear: number | null;
  separationDate: string;
  rule55: boolean;
  planAllows: boolean;
};
export type Plan = {
  startYear: number;
  birthDate: string;
  retirementAgeMonths: number;
  years: number;
  salary: number;
  spending: number;
  inflation: number;
  mode: "spending" | "percent";
  withdrawalPercent: number;
  filing: FilingStatus;
  strategy: "spending" | "magi";
  magiTarget: number;
  magiAddbacks: number;
};
export type Annual = {
  year: number;
  age: number;
  phase: string;
  salary: number;
  contributions: number;
  spending: number;
  withdrawals: number;
  federalTax: number;
  portfolioTax: number;
  agi: number;
  taxableIncome: number;
  paycheckAfterFederalTax: number;
  magi: number;
  shortfall: number;
  taxShortfall: number;
  balance: number;
  accessible: number;
  accounts: number[];
  magiExceeded: boolean;
};
export const defaultAccess = (): Access => ({
  taxableBasis: null,
  rothBasis: 0,
  rothFirstYear: null,
  separationDate: "",
  rule55: false,
  planAllows: false,
});
export const defaultPlan: Plan = {
  startYear: 2026,
  birthDate: "1986-01-01",
  retirementAgeMonths: 780,
  years: 50,
  salary: 80000,
  spending: 40000,
  inflation: 2.5,
  mode: "spending",
  withdrawalPercent: 4,
  filing: "single",
  strategy: "spending",
  magiTarget: 60000,
  magiAddbacks: 0,
};
export function dateOf(value: string): Date {
  const d = new Date(value + "T00:00:00Z");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(+d) ||
    d.toISOString().slice(0, 10) !== value
  )
    throw new RangeError("Enter a valid calendar date.");
  return d;
}
export function addMonths(d: Date, n: number): Date {
  const r = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  r.setUTCDate(
    Math.min(
      d.getUTCDate(),
      new Date(
        Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0),
      ).getUTCDate(),
    ),
  );
  return r;
}
export function ageAt(birth: Date, date: Date) {
  let m =
    (date.getUTCFullYear() - birth.getUTCFullYear()) * 12 +
    date.getUTCMonth() -
    birth.getUTCMonth();
  if (date < addMonths(birth, m)) m--;
  return m / 12;
}
const traditional = (a: Account) =>
  a.type === "Traditional IRA" || a.type === "401(k) / 403(b)";
export function accessLimit(
  a: Account,
  o: Access,
  balance: number,
  basis: number,
  birth: Date,
  date: Date,
): number {
  if (a.type === "Savings / cash") return balance;
  if (a.type === "Taxable brokerage")
    return o.taxableBasis === null ? 0 : balance;
  if (traditional(a)) {
    // Age determines the additional-tax exception, not plan distribution rights.
    // This bounded model supports only verified distributions after separation;
    // in-service distributions remain unavailable even after age 59½.
    if (
      a.type === "401(k) / 403(b)" &&
      (!o.planAllows || !o.separationDate || dateOf(o.separationDate) > date)
    )
      return 0;
    if (date >= addMonths(birth, 714)) return balance;
    if (
      a.type === "401(k) / 403(b)" &&
      o.rule55 &&
      o.planAllows &&
      o.separationDate
    ) {
      const s = dateOf(o.separationDate);
      if (s <= date && s.getUTCFullYear() >= birth.getUTCFullYear() + 55)
        return balance;
    }
    return 0;
  }
  if (a.type === "Roth IRA") {
    if (
      date >= addMonths(birth, 714) &&
      o.rothFirstYear !== null &&
      date.getUTCFullYear() >= o.rothFirstYear + 5
    )
      return balance;
    return Math.min(balance, basis);
  }
  return 0;
}
export function validatePlan(
  accounts: Account[],
  options: Record<string, Access>,
  p: Plan,
) {
  projectAccounts(accounts, 0);
  if (accounts.filter((a) => a.type === "Roth IRA").length > 1)
    throw new RangeError(
      "Retirement cashflow supports one pooled same-owner Roth IRA entry. Combine that owner's Roth IRA balances, remaining regular contribution basis and earliest contribution year before planning; separate Roth IRA entries are unsupported.",
    );
  const birth = dateOf(p.birthDate),
    start = new Date(Date.UTC(p.startYear, 0, 1));
  if (
    !Number.isInteger(p.startYear) ||
    p.startYear < 2026 ||
    p.startYear > 2100
  )
    throw new RangeError("Start year must be a whole year from 2026 to 2100.");
  if (ageAt(birth, start) < 18 || ageAt(birth, start) > 100)
    throw new RangeError("Age at start must be 18–100.");
  if (
    !Number.isInteger(p.years) ||
    p.years < 1 ||
    p.years > 80 ||
    ageAt(birth, addMonths(start, p.years * 12)) > 120
  )
    throw new RangeError("Choose 1–80 projection years, ending by age 120.");
  if (
    !Number.isInteger(p.retirementAgeMonths) ||
    p.retirementAgeMonths < 216 ||
    p.retirementAgeMonths > 1200
  )
    throw new RangeError("Retirement age must be 18–100, in whole months.");
  for (const k of ["salary", "spending", "magiTarget", "magiAddbacks"] as const)
    if (!Number.isFinite(p[k]) || p[k] < 0 || p[k] > 1e8)
      throw new RangeError(
        "Dollar assumptions must be between 0 and 100 million.",
      );
  if (
    !Number.isFinite(p.inflation) ||
    p.inflation < 0 ||
    p.inflation > 20 ||
    !Number.isFinite(p.withdrawalPercent) ||
    p.withdrawalPercent < 0 ||
    p.withdrawalPercent > 100
  )
    throw new RangeError(
      "Inflation must be 0–20%; withdrawal rate must be 0–100%.",
    );
  if (
    !TAX_RULES[p.filing] ||
    !["spending", "magi"].includes(p.strategy) ||
    !["spending", "percent"].includes(p.mode)
  )
    throw new RangeError("Choose valid planning options.");
  for (const a of accounts) {
    const o = options[a.id] ?? defaultAccess();
    if (a.type === "Roth IRA" && o.rothFirstYear === null)
      throw new RangeError(
        `${a.name}: enter the earliest same-owner Roth IRA contribution tax year. For a new Roth with no prior history, enter the projected first contribution year (the start year if contributing from the start).`,
      );
    for (const v of [o.taxableBasis, o.rothBasis])
      if (v !== null && (!Number.isFinite(v) || v < 0 || v > 1e9))
        throw new RangeError("Basis must be between 0 and 1 billion.");
    if (o.rothBasis > a.balance)
      throw new RangeError(
        `${a.name}: remaining Roth regular contribution basis cannot exceed balance in this simplified model.`,
      );
    if (
      o.rothFirstYear !== null &&
      (!Number.isInteger(o.rothFirstYear) ||
        o.rothFirstYear < 1998 ||
        o.rothFirstYear > p.startYear)
    )
      throw new RangeError(
        "Roth first contribution tax year must be 1998 through the start year.",
      );
    if (o.separationDate) dateOf(o.separationDate);
  }
}
export function projectRetirement(
  accounts: Account[],
  options: Record<string, Access>,
  p: Plan,
) {
  validatePlan(accounts, options, p);
  const birth = dateOf(p.birthDate),
    retire = addMonths(birth, p.retirementAgeMonths);
  const states = accounts.map((a) => {
    const o = options[a.id] ?? defaultAccess();
    return {
      a,
      o,
      balance: a.balance,
      basis: a.type === "Roth IRA" ? o.rothBasis : (o.taxableBasis ?? 0),
    };
  });
  const rows: Annual[] = [];
  let firstShortfall: number | null = null,
    firstDepletion: number | null = null;
  const warnings = new Set<string>();
  for (const s of states) {
    if (s.a.type === "401(k) / 403(b)") {
      warnings.add(
        `${s.a.name}: employer-plan withdrawals require a separation date and verified permission at every age. In-service distributions are not modeled; age 59½ alone does not establish plan access.`,
      );
    }
    if (s.a.type === "Other")
      warnings.add(
        "Other accounts count as assets but cannot fund withdrawals: tax/access treatment is unspecified.",
      );
    if (s.a.type === "Taxable brokerage" && s.o.taxableBasis === null)
      warnings.add(
        `${s.a.name}: enter cost basis to enable withdrawals; reinvested yield is still taxed.`,
      );
    if (s.a.type === "Roth IRA")
      warnings.add(
        "Roth IRA: only entered regular contribution basis is accessible before qualification. Conversion lots and other exceptions are not modeled.",
      );
    if (
      s.o.rule55 &&
      (!s.o.planAllows ||
        !s.o.separationDate ||
        s.a.type !== "401(k) / 403(b)" ||
        dateOf(s.o.separationDate).getUTCFullYear() <
          birth.getUTCFullYear() + 55)
    )
      warnings.add(
        `${s.a.name}: Rule of 55 conditions are incomplete or outside this model; exception not enabled.`,
      );
  }
  for (let offset = 0; offset < p.years; offset++) {
    const year = p.startYear + offset,
      opening = states.reduce((n, s) => n + s.balance, 0);
    let ordinary = 0,
      gains = 0,
      salary = 0,
      contributions = 0,
      spending = 0,
      withdrawals = 0,
      shortfall = 0,
      retiredMonths = 0;
    const annualSpending =
      p.mode === "percent"
        ? (opening * p.withdrawalPercent) / 100
        : p.spending * (1 + p.inflation / 100) ** offset;
    ordinary = Array.from({ length: 12 }, (_, m) =>
      new Date(Date.UTC(year, m, 1)) < retire ? p.salary / 12 : 0,
    ).reduce((a, b) => a + b, 0);
    const withdraw = (amount: number, date: Date): number => {
      let remaining = amount;
      const priority = (a: Account) =>
        a.type === "Savings / cash"
          ? 0
          : a.type === "Taxable brokerage"
            ? 1
            : a.type === "Roth IRA"
              ? 2
              : 3;
      for (const s of [...states].sort(
        (a, b) => priority(a.a) - priority(b.a),
      )) {
        const available = accessLimit(
            s.a,
            s.o,
            s.balance,
            s.basis,
            birth,
            date,
          ),
          fraction =
            s.a.type === "Taxable brokerage"
              ? s.balance
                ? Math.max(0, 1 - s.basis / s.balance)
                : 0
              : traditional(s.a)
                ? 1
                : 0;
        const room =
            p.strategy === "magi" && fraction > 0
              ? Math.max(
                  0,
                  p.magiTarget - (ordinary + gains + p.magiAddbacks),
                ) / fraction
              : Infinity,
          take = Math.max(0, Math.min(remaining, available, room));
        if (!take) continue;
        if (traditional(s.a)) ordinary += take;
        if (s.a.type === "Taxable brokerage") {
          gains += take * fraction;
          s.basis *= 1 - take / s.balance;
        }
        if (s.a.type === "Roth IRA") s.basis = Math.max(0, s.basis - take);
        s.balance = Math.max(0, s.balance - take);
        remaining -= take;
        withdrawals += take;
        if (remaining < 1e-8) break;
      }
      return amount - remaining;
    };
    for (let month = 0; month < 12; month++) {
      const start = new Date(Date.UTC(year, month, 1)),
        end = new Date(Date.UTC(year, month + 1, 0)),
        retired = start >= retire;
      if (retired) retiredMonths++;
      else salary += p.salary / 12;
      for (const s of states) {
        const total = s.a.priceGrowth + s.a.incomeYield,
          rate = Math.expm1(Math.log1p(total / 100) / 12),
          yieldRate =
            Math.abs(total) > 1e-10
              ? (rate * s.a.incomeYield) / total
              : s.a.incomeYield / 1200,
          income = s.balance * yieldRate;
        s.balance *= 1 + rate;
        if (s.a.type === "Taxable brokerage" || s.a.type === "Savings / cash") {
          ordinary += income;
          if (s.a.type === "Taxable brokerage") s.basis += income;
        }
        if (!retired) {
          const add = s.a.monthlyContribution;
          s.balance += add;
          contributions += add;
          if (s.a.type === "Taxable brokerage" || s.a.type === "Roth IRA")
            s.basis += add;
        }
      }
      if (retired) {
        const target = annualSpending / 12;
        spending += target;
        shortfall += target - withdraw(target, end);
      }
    }
    const wageTax = federalTax(salary, 0, p.filing);
    let paid = 0;
    for (let i = 0; i < 100; i++) {
      const due = Math.max(
        0,
        federalTax(ordinary, gains, p.filing) - wageTax - paid,
      );
      if (due < 0.000001) break;
      const funded = withdraw(due, new Date(Date.UTC(year, 11, 31)));
      paid += funded;
      if (funded < due - 0.000001) break;
    }
    const tax = federalTax(ordinary, gains, p.filing),
      portfolioTax = Math.max(0, tax - wageTax),
      taxShortfall = Math.max(0, portfolioTax - paid),
      balance = states.reduce((n, s) => n + s.balance, 0),
      magi = ordinary + gains + p.magiAddbacks;
    if (shortfall + taxShortfall > 0.01 && firstShortfall === null)
      firstShortfall = year;
    if (balance < 0.01 && firstDepletion === null) firstDepletion = year;
    if (contributions > salary - wageTax)
      warnings.add(
        "Some working-year contributions exceed modeled after-federal-tax wages. Contributions remain externally funded assumptions; this is not a household budget.",
      );
    rows.push({
      year,
      age: ageAt(birth, new Date(Date.UTC(year, 11, 31))),
      phase:
        retiredMonths === 0
          ? "Working"
          : retiredMonths === 12
            ? "Retired"
            : "Transition",
      salary,
      contributions,
      spending,
      withdrawals,
      federalTax: tax,
      portfolioTax,
      agi: ordinary + gains,
      taxableIncome: Math.max(
        0,
        ordinary + gains - TAX_RULES[p.filing].deduction,
      ),
      paycheckAfterFederalTax: salary - wageTax,
      magi,
      shortfall,
      taxShortfall,
      balance,
      accessible: states.reduce(
        (n, s) =>
          n +
          accessLimit(
            s.a,
            s.o,
            s.balance,
            s.basis,
            birth,
            new Date(Date.UTC(year, 11, 31)),
          ),
        0,
      ),
      accounts: states.map((s) => s.balance),
      magiExceeded: magi > p.magiTarget + 0.01,
    });
  }
  return {
    rows,
    warnings: [...warnings],
    firstShortfall,
    firstDepletion,
    retirementDate: retire.toISOString().slice(0, 10),
  };
}
/** Commitment only: not an IRS-approved payment calculation. */
export function seppCommitment(birthDate: string, firstPayment: string) {
  const b = dateOf(birthDate),
    f = dateOf(firstPayment);
  if (f < b) throw new RangeError("First payment must follow birth.");
  return new Date(Math.max(+addMonths(f, 60), +addMonths(b, 714)))
    .toISOString()
    .slice(0, 10);
}
export function seppIllustration(
  birthDate: string,
  firstPayment: string,
  balance: number,
  annualPayment: number,
  annualReturn: number,
) {
  const birth = dateOf(birthDate),
    first = dateOf(firstPayment),
    end = dateOf(seppCommitment(birthDate, firstPayment));
  if (ageAt(birth, first) < 18 || ageAt(birth, first) >= 59.5)
    throw new RangeError(
      "This early-access illustration requires a first-payment age from 18 to under 59½.",
    );
  if (
    ![balance, annualPayment, annualReturn].every(Number.isFinite) ||
    balance < 0 ||
    balance > 1e9 ||
    annualPayment < 0 ||
    annualPayment > 1e8 ||
    annualReturn < -99 ||
    annualReturn > 30
  )
    throw new RangeError(
      "Enter valid separate-account amounts and a return from −99% to 30%.",
    );
  const monthlyRate = Math.expm1(Math.log1p(annualReturn / 100) / 12),
    rows: { date: string; payment: number; gap: number; balance: number }[] =
      [];
  for (let n = 0; addMonths(first, n) < end; n++) {
    const date = addMonths(first, n);
    if (n > 0) balance *= 1 + monthlyRate;
    const target = annualPayment / 12,
      payment = Math.min(balance, target);
    balance -= payment;
    rows.push({
      date: date.toISOString().slice(0, 10),
      payment,
      gap: target - payment,
      balance,
    });
  }
  return { end: end.toISOString().slice(0, 10), rows };
}
