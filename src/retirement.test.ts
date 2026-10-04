import { test } from "node:test";
import assert from "node:assert/strict";
import { federalTax, TAX_RULES } from "./tax.ts";
import {
  accessLimit,
  addMonths,
  dateOf,
  ageAt,
  defaultPlan,
  defaultAccess,
  projectRetirement,
  seppCommitment,
  seppIllustration,
} from "./retirement.ts";
import { projectAccounts, type Account } from "./projection.ts";
const near = (a: number, b: number, t = 0.001) =>
  assert.ok(Math.abs(a - b) < t, `${a} != ${b}`);
const account: Account = {
  id: "a",
  name: "Test",
  type: "Savings / cash",
  balance: 100000,
  monthlyContribution: 0,
  priceGrowth: 0,
  incomeYield: 0,
};
const retired = {
  ...defaultPlan,
  birthDate: "1960-01-01",
  retirementAgeMonths: 65 * 12,
  years: 1,
  spending: 12000,
  inflation: 0,
};
test("2026 deduction and each ordinary bracket boundary across all filing statuses", () => {
  for (const status of Object.keys(TAX_RULES) as (keyof typeof TAX_RULES)[]) {
    const r = TAX_RULES[status];
    near(federalTax(r.deduction, 0, status), 0);
    let expected = 0,
      lower = 0;
    r.brackets.forEach((upper, i) => {
      expected += (upper - lower) * [0.1, 0.12, 0.22, 0.24, 0.32, 0.35][i];
      near(federalTax(r.deduction + upper, 0, status), expected);
      near(
        federalTax(r.deduction + upper + 1, 0, status) - expected,
        [0.12, 0.22, 0.24, 0.32, 0.35, 0.37][i],
      );
      lower = upper;
    });
  }
});
test("capital gains stack over ordinary income; unused deduction offsets gains", () => {
  near(federalTax(0, 16100 + 49450, "single"), 0);
  near(federalTax(0, 16100 + 49451, "single"), 0.15);
  near(
    federalTax(16100 + 49450, 1000, "single") -
      federalTax(16100 + 49450, 0, "single"),
    125,
  );
  near(
    federalTax(16100 + 545500, 1000, "single") -
      federalTax(16100 + 545500, 0, "single"),
    200,
  );
});
test("invalid dates, ages, horizon, filing status and monetary inputs rejected", () => {
  assert.throws(() => dateOf("2026-02-30"));
  for (const patch of [
    { years: 0 },
    { years: 81 },
    { retirementAgeMonths: 713.5 },
    { salary: NaN },
    { inflation: -1 },
    { startYear: 2025 },
    { birthDate: "2020-01-01" },
  ])
    assert.throws(() =>
      projectRetirement([account], {}, { ...retired, ...patch }),
    );
  assert.throws(() => federalTax(-1, 0, "single"));
});
test("age 59½ boundary is exact, including leap-day clamping", () => {
  const a = { ...account, type: "Traditional IRA" as const },
    b = dateOf("1966-07-15"),
    o = defaultAccess();
  assert.equal(accessLimit(a, o, 100, 0, b, dateOf("2026-01-14")), 0);
  assert.equal(accessLimit(a, o, 100, 0, b, dateOf("2026-01-15")), 100);
  assert.equal(
    addMonths(dateOf("1964-02-29"), 714).toISOString().slice(0, 10),
    "2023-08-29",
  );
  near(ageAt(dateOf("1986-01-15"), dateOf("2026-01-14")), 39 + 11 / 12);
});
test("Rule55 requires same-plan verified availability and calendar-year separation", () => {
  const a = { ...account, type: "401(k) / 403(b)" as const },
    b = dateOf("1971-12-31"),
    o = {
      ...defaultAccess(),
      rule55: true,
      planAllows: true,
      separationDate: "2026-01-01",
    };
  assert.equal(accessLimit(a, o, 100, 0, b, dateOf("2026-01-02")), 100);
  assert.equal(
    accessLimit(
      a,
      { ...o, separationDate: "2025-12-31" },
      100,
      0,
      b,
      dateOf("2026-12-31"),
    ),
    0,
  );
  assert.equal(
    accessLimit(
      a,
      { ...o, planAllows: false },
      100,
      0,
      b,
      dateOf("2026-12-31"),
    ),
    0,
  );
  assert.equal(
    accessLimit(
      { ...a, type: "Traditional IRA" },
      o,
      100,
      0,
      b,
      dateOf("2026-12-31"),
    ),
    0,
  );
  assert.equal(accessLimit(a, o, 100, 0, b, dateOf("2025-12-31")), 0);
});
test("Roth basis and qualification five-tax-year clock are distinct", () => {
  const a = { ...account, type: "Roth IRA" as const },
    b = dateOf("1960-01-01"),
    o = { ...defaultAccess(), rothBasis: 20, rothFirstYear: 2022 };
  assert.equal(accessLimit(a, o, 100, 20, b, dateOf("2026-12-31")), 20);
  assert.equal(accessLimit(a, o, 100, 20, b, dateOf("2027-01-01")), 100);
  assert.equal(
    accessLimit(
      a,
      { ...o, rothFirstYear: null },
      100,
      20,
      b,
      dateOf("2027-01-01"),
    ),
    20,
  );
});
test("transition stops salary and contributions at first full retired month", () => {
  const r = projectRetirement(
    [{ ...account, monthlyContribution: 100 }],
    {},
    { ...retired, birthDate: "1961-07-15", salary: 12000 },
  ).rows[0];
  assert.equal(r.phase, "Transition");
  near(r.salary, 7000);
  near(r.contributions, 700);
  near(r.spending, 5000);
  near(r.balance, 95700);
});
test("cash withdrawals fund spending without MAGI or tax", () => {
  const r = projectRetirement([account], {}, retired).rows[0];
  near(r.balance, 88000);
  near(r.magi, 0);
  near(r.federalTax, 0);
  near(r.withdrawals, 12000);
});
test("net retirement spending gross-up pays tax on pretax tax withdrawals", () => {
  const r = projectRetirement(
    [{ ...account, type: "Traditional IRA" }],
    {},
    { ...retired, spending: 40000 },
  ).rows[0];
  near(r.withdrawals - r.federalTax, 40000);
  near(r.taxShortfall, 0);
  near(r.magi, r.withdrawals);
  assert.ok(r.withdrawals > 40000);
});
test("inaccessible funds cause shortfall before depletion", () => {
  const r = projectRetirement(
    [{ ...account, type: "Traditional IRA" }],
    {},
    { ...retired, birthDate: "1986-01-01", retirementAgeMonths: 480 },
  );
  assert.equal(r.firstShortfall, 2026);
  assert.equal(r.firstDepletion, null);
  near(r.rows[0].balance, 100000);
  near(r.rows[0].shortfall, 12000);
});
test("unknown brokerage basis blocks proceeds; known basis is returned tax-free", () => {
  const a = { ...account, type: "Taxable brokerage" as const };
  near(projectRetirement([a], {}, retired).rows[0].shortfall, 12000);
  const r = projectRetirement(
    [a],
    { a: { ...defaultAccess(), taxableBasis: 100000 } },
    retired,
  ).rows[0];
  near(r.magi, 0);
  near(r.balance, 88000);
});
test("zero-tax realized gains still raise ACA MAGI; standard deduction does not reduce it", () => {
  const r = projectRetirement(
    [{ ...account, type: "Taxable brokerage" }],
    { a: { ...defaultAccess(), taxableBasis: 50000 } },
    retired,
  ).rows[0];
  near(r.magi, 6000);
  near(r.federalTax, 0);
});
test("MAGI target strategy exposes infeasible spending and mandatory income excess", () => {
  let r = projectRetirement(
    [{ ...account, type: "Traditional IRA" }],
    {},
    { ...retired, spending: 40000, strategy: "magi", magiTarget: 10000 },
  ).rows[0];
  near(r.magi, 10000);
  near(r.shortfall, 30000);
  r = projectRetirement(
    [account],
    {},
    {
      ...retired,
      spending: 0,
      magiAddbacks: 62601,
      magiTarget: 62600,
      strategy: "magi",
    },
  ).rows[0];
  assert.equal(r.magiExceeded, true);
  near(r.magi, 62601);
});
test("MAGI cap can leave tax unpaid without negative account balances", () => {
  const r = projectRetirement(
    [{ ...account, type: "Traditional IRA" }],
    {},
    { ...retired, strategy: "magi", magiTarget: 40000, spending: 40000 },
  ).rows[0];
  near(r.shortfall, 0);
  assert.ok(r.taxShortfall > 0);
  near(r.magi, 40000);
  assert.ok(r.balance >= 0);
});
test("working tax-sheltered return and contributions match v2 exactly; no double-counted yield", () => {
  const a = {
    ...account,
    type: "401(k) / 403(b)" as const,
    priceGrowth: 4,
    incomeYield: 2,
    monthlyContribution: 500,
  };
  const p = { ...defaultPlan, years: 2 };
  const r = projectRetirement([a], {}, p);
  near(r.rows[1].balance, projectAccounts([a], 2).rows[2].balance);
});
test("taxable reinvested yield raises basis and MAGI once", () => {
  const a = {
    ...account,
    type: "Taxable brokerage" as const,
    priceGrowth: 0,
    incomeYield: 5,
  };
  const r = projectRetirement(
    [a],
    { a: { ...defaultAccess(), taxableBasis: 100000 } },
    { ...retired, spending: 0 },
  ).rows[0];
  near(r.balance, 105000);
  near(r.magi, 5000);
  near(r.federalTax, 0);
});
test("inflation adjusts start-year spending, percentage resets to each opening balance", () => {
  const a = { ...account, balance: 1e6 };
  const rows = projectRetirement(
    [a],
    {},
    { ...retired, years: 2, inflation: 10 },
  ).rows;
  near(rows[1].spending, 13200);
  const pct = projectRetirement(
    [a],
    {},
    { ...retired, years: 2, mode: "percent", withdrawalPercent: 10 },
  ).rows;
  near(pct[0].spending, 100000);
  near(pct[1].spending, 90000);
});
test("depletion reports unfunded spending and never overdraws", () => {
  const r = projectRetirement([{ ...account, balance: 1000 }], {}, retired);
  assert.equal(r.firstDepletion, 2026);
  near(r.rows[0].balance, 0);
  near(r.rows[0].shortfall, 11000);
});
test("SEPP commitment later-of exact anniversary and 59½; illustrative payments remain fixed", () => {
  assert.equal(seppCommitment("1970-08-20", "2026-02-15"), "2031-02-15");
  assert.equal(seppCommitment("1980-08-20", "2026-02-15"), "2040-02-20");
  const s = seppIllustration("1970-08-20", "2026-02-15", 100000, 12000, 0);
  assert.equal(s.rows.length, 60);
  s.rows.forEach((r) => near(r.payment, 1000));
  near(s.rows.at(-1)!.balance, 40000);
  const d = seppIllustration("1970-08-20", "2026-02-15", 1000, 12000, 0);
  assert.ok(d.rows[1].gap > 0);
  assert.throws(() => seppIllustration("1960-01-01", "2026-01-01", 1, 1, 0));
});
test("AGI, taxable income, addbacks and spendable proceeds stay distinct", () => {
  const r = projectRetirement(
    [account],
    {},
    { ...defaultPlan, years: 1, salary: 50000, magiAddbacks: 1000 },
  ).rows[0];
  near(r.agi, 50000);
  near(r.taxableIncome, 33900);
  near(r.magi, 51000);
  near(r.paycheckAfterFederalTax, 50000 - federalTax(50000, 0, "single"));
});
test("negative-return brokerage and Roth basis cannot make negative balances", () => {
  const accounts: Account[] = [
    { ...account, type: "Taxable brokerage", priceGrowth: -40, incomeYield: 2 },
    { ...account, id: "r", type: "Roth IRA", priceGrowth: -30 },
  ];
  const p = projectRetirement(
    accounts,
    {
      a: { ...defaultAccess(), taxableBasis: 100000 },
      r: { ...defaultAccess(), rothBasis: 80000, rothFirstYear: 2020 },
    },
    { ...retired, years: 5, spending: 40000 },
  );
  assert.ok(
    p.rows.every((r) => r.accounts.every((b) => Number.isFinite(b) && b >= 0)),
  );
  assert.ok(p.firstShortfall);
});
test("later investment income can breach withdrawal MAGI guardrail and is flagged", () => {
  const a = { ...account, type: "Traditional IRA" as const },
    b = {
      ...account,
      id: "b",
      type: "Savings / cash" as const,
      incomeYield: 10,
    };
  const r = projectRetirement(
    [a, b],
    {},
    { ...retired, strategy: "magi", magiTarget: 100, spending: 0 },
  ).rows[0];
  assert.equal(r.magiExceeded, true);
  assert.ok(r.magi > 100);
});

test("IRS Worksheet 2-7 final minimum protects the 12-percent ordinary band", () => {
  near(federalTax(65550, 950, "single"), 5800);
  near(federalTax(65550, 1000, "single"), 5811);
  near(federalTax(65550, 950, "single"), federalTax(66500, 0, "single"));
  // Both sides of the final minimum: preferential tax wins once enough gains
  // extend into the 22-percent ordinary band.
  near(federalTax(65550, 2000, "single"), 5986);
  for (const status of Object.keys(TAX_RULES) as (keyof typeof TAX_RULES)[]) {
    for (const ordinary of [0, 30000, 65550, 120000, 600000]) {
      for (const gains of [0, 950, 2000, 100000]) {
        assert.ok(
          federalTax(ordinary, gains, status) <=
            federalTax(ordinary + gains, 0, status) + 1e-8,
        );
      }
    }
  }
});
test("employer-plan permission and separation are required even after age 59½", () => {
  const a = { ...account, type: "401(k) / 403(b)" as const },
    birth = dateOf("1966-01-01"),
    date = dateOf("2026-12-31");
  for (const o of [
    defaultAccess(),
    { ...defaultAccess(), planAllows: true },
    { ...defaultAccess(), separationDate: "2026-01-01" },
    { ...defaultAccess(), planAllows: true, separationDate: "2027-01-01" },
  ])
    assert.equal(accessLimit(a, o, 100000, 0, birth, date), 0);
  const permitted = {
    ...defaultAccess(),
    planAllows: true,
    separationDate: "2026-07-15",
  };
  assert.equal(
    accessLimit(a, permitted, 100000, 0, birth, dateOf("2026-07-14")),
    0,
  );
  assert.equal(
    accessLimit(a, permitted, 100000, 0, birth, dateOf("2026-07-15")),
    100000,
  );
  assert.equal(
    accessLimit(
      { ...a, type: "Traditional IRA" },
      defaultAccess(),
      100000,
      0,
      birth,
      date,
    ),
    100000,
  );
});
test("active employee age60 cannot withdraw an unverified employer plan to pay investment tax", () => {
  const a = { ...account, type: "401(k) / 403(b)" as const },
    brokerage = {
      ...account,
      id: "brokerage",
      type: "Taxable brokerage" as const,
      incomeYield: 5,
    };
  const p = {
    ...defaultPlan,
    birthDate: "1966-01-01",
    retirementAgeMonths: 65 * 12,
    years: 1,
    salary: 80000,
  };
  const r = projectRetirement([a, brokerage], {}, p).rows[0];
  near(r.accounts[0], 100000);
  near(r.withdrawals, 0);
  near(r.magi, 85000);
  near(r.taxShortfall, 1100);
  const allowed = projectRetirement(
    [a, brokerage],
    {
      a: { ...defaultAccess(), planAllows: true, separationDate: "2026-01-01" },
    },
    p,
  ).rows[0];
  near(allowed.taxShortfall, 0);
  assert.ok(allowed.accounts[0] < 100000);
  assert.ok(allowed.withdrawals > 1100);
});

test("multiple same-owner Roth IRA entries are rejected instead of misallocating aggregate basis", () => {
  const a = {
      ...account,
      type: "Roth IRA" as const,
      balance: 10000,
      priceGrowth: -99,
    },
    b = { ...account, id: "b", type: "Roth IRA" as const };
  assert.throws(
    () =>
      projectRetirement(
        [a, b],
        {
          a: { ...defaultAccess(), rothBasis: 10000, rothFirstYear: 2020 },
          b: { ...defaultAccess(), rothFirstYear: 2020 },
        },
        {
          ...retired,
          birthDate: "1986-01-01",
          retirementAgeMonths: 480,
          spending: 10000,
        },
      ),
    /one pooled same-owner/,
  );
});
test("Roth planner requires first year and supports explicit projected first contribution year", () => {
  const a = {
    ...account,
    type: "Roth IRA" as const,
    balance: 0,
    monthlyContribution: 100,
    incomeYield: 5,
  };
  const p = {
    ...defaultPlan,
    birthDate: "1960-01-01",
    retirementAgeMonths: 72 * 12,
    years: 7,
    spending: 1200,
    inflation: 0,
  };
  assert.throws(() => projectRetirement([a], {}, p), /earliest same-owner/);
  const r = projectRetirement(
    [a],
    { a: { ...defaultAccess(), rothFirstYear: 2026 } },
    p,
  ).rows.at(-1)!;
  assert.equal(r.phase, "Retired");
  near(r.accessible, r.balance);
  near(r.shortfall, 0);
});
