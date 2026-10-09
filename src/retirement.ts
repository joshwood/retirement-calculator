import {
  taxableSocialSecurity,
  rmdStartAge,
  ownerRmd,
  seppPayment,
} from "./income.ts";
import { projectAccounts, type Account } from "./projection.ts";
import { federalTax, TAX_RULES, type FilingStatus } from "./tax.ts";
export type Access = {
  taxableBasis: number | null;
  rothBasis: number;
  rothFirstYear: number | null;
  separationDate: string;
  rule55: boolean;
  planAllows: boolean;
  priorYearBalance?: number | null;
};
export type IncomePlan = {
  socialSecurityMonthly: number;
  socialSecurityStart: string;
  socialSecurityCola: number;
  taxExemptInterest: number;
  separateLivedTogether: boolean;
  rmdEnabled: boolean;
  rmd1959Age: 73 | 75;
  sepp: {
    enabled: boolean;
    accountId: string;
    firstPayment: string;
    method: "verified" | "rmd" | "amortization";
    annualPayment: number;
    rate: number;
    acknowledged: boolean;
  };
};
export const defaultIncome: IncomePlan = {
  socialSecurityMonthly: 0,
  socialSecurityStart: "2053-01-01",
  socialSecurityCola: 0,
  taxExemptInterest: 0,
  separateLivedTogether: true,
  rmdEnabled: true,
  rmd1959Age: 73,
  sepp: {
    enabled: false,
    accountId: "",
    firstPayment: "2026-01-01",
    method: "verified",
    annualPayment: 20000,
    rate: 4,
    acknowledged: false,
  },
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
  income?: IncomePlan;
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
  socialSecurity: number;
  taxableSocialSecurity: number;
  rmdRequired: number;
  rmdPaid: number;
  rmdShortfall: number;
  seppPayment: number;
  seppShortfall: number;
  cashReserve: number;
  investmentGrowth: number;
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
      a.type === "Roth IRA" &&
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
  for (const k of [
    "salary",
    ...(p.mode === "spending" ? ["spending"] : []),
    "magiTarget",
    "magiAddbacks",
  ] as ("salary" | "spending" | "magiTarget" | "magiAddbacks")[])
    if (!Number.isFinite(p[k]) || p[k] < 0 || p[k] > 1e8)
      throw new RangeError(
        "Dollar assumptions must be between 0 and 100 million.",
      );
  if (
    (p.mode === "spending" &&
      (!Number.isFinite(p.inflation) || p.inflation < 0 || p.inflation > 20)) ||
    (p.mode === "percent" &&
      (!Number.isFinite(p.withdrawalPercent) ||
        p.withdrawalPercent < 0 ||
        p.withdrawalPercent > 100))
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
    for (const v of a.type === "Roth IRA"
      ? [o.rothBasis]
      : a.type === "Taxable brokerage"
        ? [o.taxableBasis]
        : [])
      if (v !== null && (!Number.isFinite(v) || v < 0 || v > 1e9))
        throw new RangeError("Basis must be between 0 and 1 billion.");
    if (
      a.type === "Roth IRA" &&
      o.rothFirstYear !== null &&
      (!Number.isInteger(o.rothFirstYear) ||
        o.rothFirstYear < 1998 ||
        o.rothFirstYear > p.startYear)
    )
      throw new RangeError(
        "Roth first contribution tax year must be 1998 through the start year.",
      );
    if (a.type === "401(k) / 403(b)" && o.separationDate)
      dateOf(o.separationDate);
    if (
      (p.income ?? defaultIncome).rmdEnabled &&
      traditional(a) &&
      o.priorYearBalance != null &&
      (!Number.isFinite(o.priorYearBalance) ||
        o.priorYearBalance < 0 ||
        o.priorYearBalance > 1e9)
    )
      throw new RangeError("Prior December 31 balance must be 0–1 billion.");
  }
  const income = p.income ?? defaultIncome;
  for (const v of [income.socialSecurityMonthly, income.taxExemptInterest])
    if (!Number.isFinite(v) || v < 0 || v > 1e8)
      throw new RangeError("Income amounts must be 0–100 million.");
  if (
    !Number.isFinite(income.socialSecurityCola) ||
    income.socialSecurityCola < 0 ||
    income.socialSecurityCola > 20
  )
    throw new RangeError("Social Security COLA must be 0–20%.");
  if (
    income.socialSecurityMonthly > 0 &&
    dateOf(income.socialSecurityStart) < birth
  )
    throw new RangeError("Social Security start must follow birth.");
  if (![73, 75].includes(income.rmd1959Age))
    throw new RangeError("Choose a 1959-cohort RMD assumption.");
  const sp = income.sepp;
  if (sp.enabled) {
    const a = accounts.find((a) => a.id === sp.accountId),
      first = dateOf(sp.firstPayment);
    if (!a || a.type !== "Traditional IRA")
      throw new RangeError("Select a dedicated traditional IRA for SEPP.");
    if (a.monthlyContribution !== 0)
      throw new RangeError(
        "The dedicated SEPP IRA must have zero contributions throughout this model.",
      );
    if (!sp.acknowledged)
      throw new RangeError(
        "Acknowledge the SEPP commitment and dedicated-account restrictions.",
      );
    if (first < start || first >= addMonths(start, p.years * 12))
      throw new RangeError(
        "SEPP must start within the projection; existing arrangements are unsupported.",
      );
    if (ageAt(birth, first) < 18 || first >= addMonths(birth, 714))
      throw new RangeError("SEPP must start at age 18 to under 59½.");
    if (!["verified", "rmd", "amortization"].includes(sp.method))
      throw new RangeError("Choose a supported SEPP method.");
    if (
      sp.method === "verified" &&
      (!Number.isFinite(sp.annualPayment) ||
        sp.annualPayment <= 0 ||
        sp.annualPayment > 1e8)
    )
      throw new RangeError(
        "Enter a verified positive annual SEPP payment up to 100 million.",
      );
    if (sp.method === "amortization")
      seppPayment(
        a.balance,
        first.getUTCFullYear() - birth.getUTCFullYear(),
        "amortization",
        sp.rate,
      );
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
  const income = p.income ?? defaultIncome,
    sp = income.sepp;
  const spFirst = sp.enabled ? dateOf(sp.firstPayment) : null;
  const spEnd = sp.enabled
    ? dateOf(seppCommitment(p.birthDate, sp.firstPayment))
    : null;
  const states = accounts.map((a) => ({
    a,
    o: options[a.id] ?? defaultAccess(),
    balance: a.balance,
    basis:
      a.type === "Roth IRA"
        ? (options[a.id] ?? defaultAccess()).rothBasis
        : (options[a.id]?.taxableBasis ?? 0),
    distributed: 0,
  }));
  const locked = (id: string, date: Date) =>
    sp.enabled && id === sp.accountId && date < spEnd!;
  const rows: Annual[] = [],
    warnings = new Set<string>();
  let firstShortfall: number | null = null,
    firstDepletion: number | null = null;
  let cashReserve = 0,
    fixedSepp: number | null = null;
  if (income.socialSecurityMonthly > 0)
    warnings.add(
      "Social Security is entered gross before Medicare withholding. Include premiums in spending. Benefits use your first cash-receipt date (first full month on or after it); no earnings-test, benefit estimation or claiming advice.",
    );
  if (income.rmdEnabled)
    warnings.add(
      "Owner RMDs use the Uniform Lifetime Table, each account separately, with no first-year April deferral, still-working exception, inherited accounts or younger-spouse table. Blank initial prior-year balance means the entered January 1 balance. Mandatory cash is retained without interest.",
    );
  if (birth.getUTCFullYear() === 1959 && income.rmdEnabled)
    warnings.add(
      `1959 birth cohort: age ${income.rmd1959Age} is an explicit planning assumption; the 2024 final-regulation paragraph was reserved. Verify current law before taking distributions.`,
    );
  if (sp.enabled)
    warnings.add(
      "SEPP is a planning approximation, not a compliance schedule: monthly installments, prorated first/final calendar years, first-payment/prior-year balance valuation and calendar-year attained age. A professional must verify amount, valuation, first/final-year timing and commitment before implementation. Modifications can cause retroactive additional tax plus interest; no switch, transfers, recapture calculation or annuitization is modeled.",
    );
  for (const s of states) {
    if (s.a.type === "401(k) / 403(b)")
      warnings.add(
        `${s.a.name}: employer-plan withdrawals require verified permission and separation at every age. Any unfunded modeled RMD is reported, not silently waived. Still-working RMD deferral is unsupported.`,
      );
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
        "Roth IRA: one pooled owner entry; only remaining regular contribution basis is accessible before qualification. No conversion lots or other exceptions. Basis can exceed an underwater balance.",
      );
    if (
      s.a.type === "401(k) / 403(b)" &&
      s.o.rule55 &&
      (!s.o.planAllows ||
        !s.o.separationDate ||
        dateOf(s.o.separationDate).getUTCFullYear() <
          birth.getUTCFullYear() + 55)
    )
      warnings.add(
        `${s.a.name}: Rule of 55 conditions are incomplete; exception not enabled.`,
      );
  }
  for (let offset = 0; offset < p.years; offset++) {
    const year = p.startYear + offset,
      endYear = new Date(Date.UTC(year, 11, 31));
    const opening = cashReserve + states.reduce((n, s) => n + s.balance, 0);
    const attainedAge = year - birth.getUTCFullYear();
    const rmdAge =
      birth.getUTCFullYear() === 1959
        ? income.rmd1959Age
        : rmdStartAge(p.birthDate);
    const rmdTargets = states.map((s) =>
      income.rmdEnabled && traditional(s.a) && attainedAge >= rmdAge
        ? ownerRmd(
            offset === 0 ? (s.o.priorYearBalance ?? s.balance) : s.balance,
            attainedAge,
          )
        : 0,
    );
    states.forEach((s) => (s.distributed = 0));
    let ordinary = 0,
      gains = 0,
      salary = 0,
      contributions = 0,
      spending = 0,
      withdrawals = 0,
      shortfall = 0,
      retiredMonths = 0,
      seppTotal = 0,
      seppShortfall = 0,
      investmentGrowth = 0;
    const ssStart =
      income.socialSecurityMonthly > 0
        ? dateOf(income.socialSecurityStart)
        : null;
    const monthlySS = ssStart
      ? income.socialSecurityMonthly *
        (1 + income.socialSecurityCola / 100) **
          Math.max(0, year - ssStart.getUTCFullYear())
      : 0;
    const socialSecurity = Array.from({ length: 12 }, (_, m) =>
      ssStart && new Date(Date.UTC(year, m, 1)) >= ssStart ? monthlySS : 0,
    ).reduce((a, b) => a + b, 0);
    const taxableSS = () =>
      taxableSocialSecurity(
        socialSecurity,
        ordinary + gains,
        income.taxExemptInterest,
        p.filing,
        income.separateLivedTogether,
      );
    const totalTax = () => federalTax(ordinary + taxableSS(), gains, p.filing);
    // Full gross Social Security enters ACA MAGI, independent of its taxable portion.
    const magiNow = () =>
      ordinary +
      gains +
      socialSecurity +
      income.taxExemptInterest +
      p.magiAddbacks;
    const annualSpending =
      p.mode === "percent"
        ? (opening * p.withdrawalPercent) / 100
        : p.spending * (1 + p.inflation / 100) ** offset;
    ordinary = Array.from({ length: 12 }, (_, m) =>
      new Date(Date.UTC(year, m, 1)) < retire ? p.salary / 12 : 0,
    ).reduce((a, b) => a + b, 0);
    const distribute = (s: (typeof states)[number], amount: number) => {
      const take = Math.min(Math.max(0, amount), s.balance);
      if (!take) return 0;
      if (traditional(s.a)) ordinary += take;
      if (s.a.type === "Taxable brokerage") {
        gains += take * Math.max(0, 1 - s.basis / s.balance);
        s.basis *= 1 - take / s.balance;
      }
      if (s.a.type === "Roth IRA") s.basis = Math.max(0, s.basis - take);
      s.balance = Math.max(0, s.balance - take);
      s.distributed += take;
      withdrawals += take;
      return take;
    };
    const withdraw = (amount: number, date: Date) => {
      const fromReserve = Math.min(cashReserve, amount);
      cashReserve -= fromReserve;
      let remaining = amount - fromReserve;
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
        if (locked(s.a.id, date)) continue;
        const available = accessLimit(
          s.a,
          s.o,
          s.balance,
          s.basis,
          birth,
          date,
        );
        const fraction =
          s.a.type === "Taxable brokerage"
            ? s.balance
              ? Math.max(0, 1 - s.basis / s.balance)
              : 0
            : traditional(s.a)
              ? 1
              : 0;
        const room =
          p.strategy === "magi" && fraction > 0
            ? Math.max(0, p.magiTarget - magiNow()) / fraction
            : Infinity;
        remaining -= distribute(s, Math.min(remaining, available, room));
        if (remaining < 1e-8) break;
      }
      return amount - remaining;
    };
    let annualSepp = 0;
    if (
      sp.enabled &&
      year > spFirst!.getUTCFullYear() &&
      new Date(Date.UTC(year, 0, 1)) < spEnd!
    ) {
      const s = states.find((s) => s.a.id === sp.accountId)!;
      annualSepp =
        sp.method === "rmd"
          ? seppPayment(s.balance, attainedAge, "rmd", sp.rate)
          : fixedSepp!;
    }
    for (let month = 0; month < 12; month++) {
      const start = new Date(Date.UTC(year, month, 1)),
        end = new Date(Date.UTC(year, month + 1, 0)),
        retired = start >= retire;
      if (retired) retiredMonths++;
      else salary += p.salary / 12;
      if (ssStart && start >= ssStart) cashReserve += monthlySS;
      // The first-payment valuation is the prior month-end balance, before this month's growth.
      if (
        sp.enabled &&
        year === spFirst!.getUTCFullYear() &&
        month === spFirst!.getUTCMonth()
      ) {
        const s = states.find((s) => s.a.id === sp.accountId)!;
        annualSepp =
          sp.method === "verified"
            ? sp.annualPayment
            : seppPayment(s.balance, attainedAge, sp.method, sp.rate);
        fixedSepp = annualSepp;
      }
      for (const s of states) {
        const total = s.a.priceGrowth + s.a.incomeYield,
          rate = Math.expm1(Math.log1p(total / 100) / 12);
        const yieldRate =
          Math.abs(total) > 1e-10
            ? (rate * s.a.incomeYield) / total
            : s.a.incomeYield / 1200;
        const earned = s.balance * yieldRate;
        investmentGrowth += s.balance * rate;
        s.balance *= 1 + rate;
        if (s.a.type === "Taxable brokerage" || s.a.type === "Savings / cash") {
          ordinary += earned;
          if (s.a.type === "Taxable brokerage") s.basis += earned;
        }
        if (!retired) {
          const add = s.a.monthlyContribution;
          s.balance += add;
          contributions += add;
          if (s.a.type === "Taxable brokerage" || s.a.type === "Roth IRA")
            s.basis += add;
        }
      }
      if (sp.enabled) {
        const n =
          (year - spFirst!.getUTCFullYear()) * 12 +
          month -
          spFirst!.getUTCMonth();
        const paymentDate = addMonths(spFirst!, n);
        if (n >= 0 && paymentDate < spEnd!) {
          const paid = distribute(
            states.find((s) => s.a.id === sp.accountId)!,
            annualSepp / 12,
          );
          cashReserve += paid;
          seppTotal += paid;
          seppShortfall += annualSepp / 12 - paid;
        }
      }
      // Satisfy outstanding RMD as early as access allows. Other distributions count once.
      states.forEach((s, i) => {
        const remaining = Math.max(0, rmdTargets[i] - s.distributed);
        if (remaining > 0 && !locked(s.a.id, end))
          cashReserve += distribute(
            s,
            Math.min(
              remaining,
              accessLimit(s.a, s.o, s.balance, s.basis, birth, end),
            ),
          );
      });
      if (retired) {
        const target = annualSpending / 12;
        spending += target;
        shortfall += target - withdraw(target, end);
      }
    }
    const wageTax = federalTax(salary, 0, p.filing);
    let paid = 0;
    for (let i = 0; i < 200; i++) {
      const due = Math.max(0, totalTax() - wageTax - paid);
      if (due < 1e-6) break;
      const funded = withdraw(due, endYear);
      paid += funded;
      if (funded < due - 1e-6) break;
    }
    const tax = totalTax(),
      portfolioTax = Math.max(0, tax - wageTax),
      taxShortfall = Math.max(0, portfolioTax - paid);
    const balance = cashReserve + states.reduce((n, s) => n + s.balance, 0),
      magi = magiNow(),
      taxableBenefit = taxableSS();
    const rmdRequired = rmdTargets.reduce((a, b) => a + b, 0),
      rmdPaid = states.reduce(
        (n, s, i) => n + Math.min(rmdTargets[i], s.distributed),
        0,
      ),
      rmdShortfall = Math.max(0, rmdRequired - rmdPaid);
    if (
      shortfall + taxShortfall + seppShortfall + rmdShortfall > 0.01 &&
      firstShortfall === null
    )
      firstShortfall = year;
    if (balance < 0.01 && firstDepletion === null) firstDepletion = year;
    if (contributions > salary - wageTax)
      warnings.add(
        "Some working-year contributions exceed modeled after-federal-tax wages. Contributions remain externally funded assumptions; this is not a household budget.",
      );
    rows.push({
      year,
      age: ageAt(birth, endYear),
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
      agi: ordinary + gains + taxableBenefit,
      taxableIncome: Math.max(
        0,
        ordinary + gains + taxableBenefit - TAX_RULES[p.filing].deduction,
      ),
      paycheckAfterFederalTax: salary - wageTax,
      magi,
      shortfall,
      taxShortfall,
      balance,
      accessible:
        cashReserve +
        states.reduce(
          (n, s) =>
            n +
            (locked(s.a.id, endYear)
              ? 0
              : accessLimit(s.a, s.o, s.balance, s.basis, birth, endYear)),
          0,
        ),
      accounts: states.map((s) => s.balance),
      magiExceeded: magi > p.magiTarget + 0.01,
      socialSecurity,
      taxableSocialSecurity: taxableBenefit,
      rmdRequired,
      rmdPaid,
      rmdShortfall,
      seppPayment: seppTotal,
      seppShortfall,
      cashReserve,
      investmentGrowth,
    });
  }
  return {
    rows,
    warnings: [...warnings],
    firstShortfall,
    firstDepletion,
    retirementDate: retire.toISOString().slice(0, 10),
    seppEnd: spEnd?.toISOString().slice(0, 10) ?? null,
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
