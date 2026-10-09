import { test } from "node:test";
import assert from "node:assert/strict";
import {
  taxableSocialSecurity as ssTax,
  ownerRmd,
  rmdStartAge,
  seppPayment,
  UNIFORM_FACTORS,
  SINGLE_FACTORS,
} from "./income.ts";
import {
  defaultPlan,
  defaultIncome,
  defaultAccess,
  projectRetirement,
  type Plan,
  type IncomePlan,
} from "./retirement.ts";
import {
  initialInputs,
  planFromInputs,
  inputsFromPlan,
  exportScenario,
  parseScenario,
  resultsCsv,
  MAX_SCENARIO_BYTES,
} from "./scenario.ts";
import { federalTax } from "./tax.ts";
import type { Account } from "./projection.ts";
const near = (a: number, b: number, t = 1e-5) =>
  assert.ok(Math.abs(a - b) < t, `${a} != ${b}`);
const account: Account = {
  id: "a",
  name: "Test",
  type: "Traditional IRA",
  balance: 500000,
  monthlyContribution: 0,
  priceGrowth: 0,
  incomeYield: 0,
};
const retired: Plan = {
  ...defaultPlan,
  birthDate: "1953-01-01",
  retirementAgeMonths: 60 * 12,
  years: 1,
  spending: 0,
  inflation: 0,
};
const inc = (patch: Partial<IncomePlan> = {}): IncomePlan => ({
  ...defaultIncome,
  sepp: { ...defaultIncome.sepp },
  ...patch,
});
test("Social Security zero, tier edges and 85% cap match Worksheet 1", () => {
  for (const [combined, expected] of [
    [25000, 0],
    [25001, 0.5],
    [34000, 4500],
    [34001, 4500.85],
    [100000, 17000],
  ])
    near(ssTax(20000, combined - 10000, 0, "single"), expected);
  near(ssTax(20000, 10000, 1000, "single"), 0);
  near(ssTax(20000, 20000, 0, "single"), 2500);
  near(ssTax(20000, 20000, 1000, "single"), 3000);
  near(ssTax(20000, 22000, 0, "joint"), 0);
  near(ssTax(20000, 34000, 0, "joint"), 6000);
  near(ssTax(20000, 34001, 0, "joint"), 6000.85);
  near(ssTax(20000, 20000, 0, "survivor"), 2500);
  near(ssTax(20000, 20000, 0, "head"), 2500);
  near(ssTax(20000, 20000, 0, "separate", false), 2500);
  near(ssTax(20000, 0, 0, "separate", true), 8500);
  near(ssTax(0, 1e6, 0, "single"), 0);
  assert.throws(() => ssTax(1, NaN, 0, "single"));
});
test("benefit tax is recomputed for tax-funding withdrawals; ACA includes gross benefit once", () => {
  const p = {
    ...retired,
    birthDate: "1960-01-01",
    spending: 50000,
    income: inc({
      socialSecurityMonthly: 2000,
      socialSecurityStart: "2026-01-01",
      taxExemptInterest: 1000,
    }),
  };
  const r = projectRetirement([account], {}, p).rows[0];
  near(r.socialSecurity, 24000);
  near(r.magi, r.withdrawals + 24000 + 1000);
  near(r.agi, r.withdrawals + r.taxableSocialSecurity);
  near(r.taxableSocialSecurity, ssTax(24000, r.withdrawals, 1000, "single"));
  near(r.federalTax, federalTax(r.agi, 0, "single"));
  near(r.taxShortfall, 0);
  near(
    r.socialSecurity + r.withdrawals,
    r.spending + r.federalTax + r.cashReserve,
  );
});
test("Social Security cash receipt partial-year and COLA; working surplus is retained", () => {
  const p = {
    ...defaultPlan,
    years: 2,
    income: inc({
      socialSecurityMonthly: 1000,
      socialSecurityStart: "2026-07-15",
      socialSecurityCola: 10,
    }),
  };
  const r = projectRetirement(
    [{ ...account, type: "Savings / cash" }],
    {},
    p,
  ).rows;
  near(r[0].socialSecurity, 5000);
  near(r[1].socialSecurity, 13200);
  assert.ok(r[0].cashReserve > 0);
});
test("ACA MAGI guardrail reserves full gross SS; mandatory income can exceed it", () => {
  const p = {
    ...retired,
    birthDate: "1960-01-01",
    spending: 40000,
    strategy: "magi" as const,
    magiTarget: 30000,
    income: inc({
      socialSecurityMonthly: 2000,
      socialSecurityStart: "2026-01-01",
    }),
  };
  const r = projectRetirement([account], {}, p).rows[0];
  near(r.magi, 30000);
  near(r.withdrawals, 6000);
  near(r.shortfall, 10000);
  const low = projectRetirement([account], {}, { ...p, magiTarget: 10000 })
    .rows[0];
  assert.equal(low.magiExceeded, true);
  near(low.withdrawals, 0);
});
test("RMD birth cohorts, all table endpoints and golden amounts", () => {
  assert.equal(rmdStartAge("1949-06-30"), 70.5);
  assert.equal(rmdStartAge("1949-07-01"), 72);
  assert.equal(rmdStartAge("1950-12-31"), 72);
  assert.equal(rmdStartAge("1951-01-01"), 73);
  assert.equal(rmdStartAge("1958-12-31"), 73);
  assert.equal(rmdStartAge("1959-01-01"), 73);
  assert.equal(rmdStartAge("1960-01-01"), 75);
  assert.equal(UNIFORM_FACTORS.length, 49);
  assert.equal(UNIFORM_FACTORS[0], 27.4);
  assert.equal(UNIFORM_FACTORS.at(-1), 2);
  near(ownerRmd(500000, 73), 18867.92452830189);
  near(ownerRmd(500000, 75), 20325.20325203252);
  near(ownerRmd(500000, 120), 250000);
  assert.throws(() => ownerRmd(1, 71));
  assert.throws(() => ownerRmd(-1, 73));
});
test("RMD uses explicit prior balance, retains cash, overrides cap, counts once", () => {
  const p = { ...retired, years: 2, strategy: "magi" as const, magiTarget: 0 };
  const r = projectRetirement(
    [account],
    { a: { ...defaultAccess(), priorYearBalance: 600000 } },
    p,
  ).rows;
  near(r[0].rmdRequired, 600000 / 26.5);
  near(r[0].withdrawals, r[0].rmdRequired);
  near(r[0].rmdPaid, r[0].rmdRequired);
  near(r[0].balance, 500000 - r[0].federalTax);
  near(r[0].cashReserve, r[0].withdrawals - r[0].federalTax);
  near(r[1].rmdRequired, r[0].accounts[0] / 25.5);
  assert.equal(r[0].magiExceeded, true);
});
test("RMD still requires employer access; Roth is exempt; disabled RMDs take none", () => {
  const r = projectRetirement(
    [{ ...account, type: "401(k) / 403(b)" }],
    {},
    retired,
  ).rows[0];
  near(r.rmdShortfall, r.rmdRequired);
  near(r.withdrawals, 0);
  near(r.balance, 500000);
  const roth = projectRetirement(
    [{ ...account, type: "Roth IRA" }],
    { a: { ...defaultAccess(), rothFirstYear: 2000 } },
    retired,
  ).rows[0];
  near(roth.rmdRequired, 0);
  near(
    projectRetirement(
      [account],
      {},
      { ...retired, income: inc({ rmdEnabled: false }) },
    ).rows[0].withdrawals,
    0,
  );
});
test("1959 explicit assumption and 1960 age75 first year boundaries", () => {
  const run = (birthDate: string, year: number, age: 73 | 75 = 73) =>
    projectRetirement(
      [account],
      {},
      {
        ...retired,
        birthDate,
        startYear: year,
        income: inc({ rmd1959Age: age }),
      },
    ).rows[0].rmdRequired;
  near(run("1959-12-31", 2031), 0);
  assert.ok(run("1959-12-31", 2032) > 0);
  near(run("1959-12-31", 2032, 75), 0);
  near(run("1960-12-31", 2034), 0);
  assert.ok(run("1960-12-31", 2035) > 0);
});
test("SEPP named-method goldens, zero rate, table bounds", () => {
  near(seppPayment(400000, 50, "rmd", 0), 11049.723756906077);
  near(seppPayment(408304, 51, "rmd", 0), 11566.685552407934);
  near(seppPayment(400000, 50, "amortization", 0), 400000 / 36.2);
  near(
    seppPayment(400000, 50, "amortization", 4),
    (400000 * 0.04) / (1 - 1.04 ** -36.2),
  );
  assert.equal(SINGLE_FACTORS.length, 48);
  near(seppPayment(229000, 65, "rmd", 0), 10000);
  assert.throws(() => seppPayment(1, 50, "amortization", 5.01));
  assert.throws(() => seppPayment(1, 17, "rmd", 0));
});
const seppPlan = (
  method: "verified" | "rmd" | "amortization" = "verified",
): Plan => ({
  ...retired,
  birthDate: "1976-01-01",
  retirementAgeMonths: 40 * 12,
  years: 3,
  spending: 12000,
  income: inc({
    sepp: {
      enabled: true,
      accountId: "a",
      firstPayment: "2026-01-01",
      method,
      annualPayment: 24000,
      rate: 4,
      acknowledged: true,
    },
  }),
});
test("dedicated SEPP is integrated once, ordinary taxable, locked and conservative", () => {
  const p = seppPlan(),
    r = projectRetirement([account], {}, p).rows;
  near(r[0].seppPayment, 24000);
  near(r[0].withdrawals, 24000);
  near(r[0].magi, 24000);
  near(r[0].accounts[0], 476000);
  near(r[0].shortfall, 0);
  near(r[0].balance, 500000 - r[0].spending - r[0].federalTax);
  near(r[0].accessible, r[0].cashReserve);
  const high = projectRetirement([account], {}, { ...p, spending: 30000 })
    .rows[0];
  near(high.withdrawals, 24000);
  assert.ok(high.shortfall > 0);
  assert.ok(high.accounts[0] > 0);
});
test("SEPP amortization stays fixed, RMD recalculates annually", () => {
  for (const method of ["rmd", "amortization"] as const) {
    const p = seppPlan(method),
      rows = projectRetirement(
        [{ ...account, balance: 400000, priceGrowth: 4 }],
        {},
        p,
      ).rows;
    near(rows[0].seppPayment, seppPayment(400000, 50, method, 4));
    near(
      rows[1].seppPayment,
      method === "rmd" ? rows[0].accounts[0] / 35.3 : rows[0].seppPayment,
    );
  }
});
test("SEPP age64-to65 final calendar year, partial start, release and depletion gap", () => {
  const p = {
    ...seppPlan("rmd"),
    birthDate: "1966-12-01",
    years: 8,
    income: inc({
      sepp: { ...seppPlan("rmd").income!.sepp, firstPayment: "2026-05-01" },
    }),
  };
  const r = projectRetirement([account], {}, p);
  assert.equal(r.seppEnd, "2031-05-01");
  assert.ok(r.rows[5].seppPayment > 0);
  near(r.rows[6].seppPayment, 0);
  assert.ok(r.rows[5].accessible > r.rows[5].cashReserve);
  const depleted = projectRetirement(
    [{ ...account, balance: 1000 }],
    {},
    seppPlan(),
  ).rows[0];
  near(depleted.seppPayment, 1000);
  near(depleted.seppShortfall, 23000);
  near(depleted.accounts[0], 0);
});
test("SEPP rejects contribution, nonIRA, outside start, missing acknowledgement and age59½", () => {
  const p = seppPlan();
  assert.throws(() =>
    projectRetirement([{ ...account, monthlyContribution: 1 }], {}, p),
  );
  assert.throws(() =>
    projectRetirement([{ ...account, type: "401(k) / 403(b)" }], {}, p),
  );
  for (const patch of [
    { acknowledged: false },
    { firstPayment: "2025-01-01" },
    { firstPayment: "2030-01-01" },
    { accountId: "missing" },
    { annualPayment: 0 },
  ])
    assert.throws(() =>
      projectRetirement(
        [account],
        {},
        { ...p, income: inc({ sepp: { ...p.income!.sepp, ...patch } }) },
      ),
    );
  assert.throws(() =>
    projectRetirement([account], {}, { ...p, birthDate: "1966-07-01" }),
  );
});
test("portfolio conservation across returns, income, taxes, contributions and mandatory flows", () => {
  for (const spending of [0, 20000, 100000])
    for (const growth of [-30, 0, 10]) {
      const p = {
        ...retired,
        years: 8,
        spending,
        income: inc({
          socialSecurityMonthly: 2000,
          socialSecurityStart: "2026-07-01",
        }),
      };
      const rows = projectRetirement(
        [
          { ...account, priceGrowth: growth },
          {
            ...account,
            id: "cash",
            type: "Savings / cash",
            balance: 10000,
            incomeYield: 3,
          },
        ],
        {},
        p,
      ).rows;
      let opening = 510000;
      for (const r of rows) {
        near(
          r.balance,
          opening +
            r.contributions +
            r.investmentGrowth +
            r.socialSecurity -
            (r.spending - r.shortfall) -
            (r.portfolioTax - r.taxShortfall),
          0.001,
        );
        near(
          r.balance,
          r.accounts.reduce((a, b) => a + b, 0) + r.cashReserve,
          0.001,
        );
        assert.ok(r.accounts.every((n) => n >= 0 && Number.isFinite(n)));
        opening = r.balance;
      }
    }
});
test("inactive spending fields and stale Roth metadata do not block a changed mode/type", () => {
  const values = {
    ...initialInputs,
    spending: "",
    inflation: "",
    mode: "percent",
    sepp_annualPayment: "",
  };
  assert.doesNotThrow(() => planFromInputs(values));
  assert.doesNotThrow(() =>
    projectRetirement(
      [account],
      { a: { ...defaultAccess(), rothBasis: NaN, rothFirstYear: 1800 } },
      retired,
    ),
  );
  const p = {
    ...retired,
    birthDate: "1980-01-01",
    retirementAgeMonths: 40 * 12,
    spending: 1000,
  };
  const row = projectRetirement(
    [{ ...account, type: "Roth IRA", balance: 500 }],
    { a: { ...defaultAccess(), rothBasis: 10000, rothFirstYear: 2020 } },
    p,
  ).rows[0];
  near(row.withdrawals, 500);
  near(row.shortfall, 500);
});
test("scenario versioned roundtrip and pure drafts preserve all active inputs", () => {
  const p = seppPlan("amortization"),
    text = exportScenario([account], {}, p, 2, 30),
    read = parseScenario(text);
  assert.deepEqual(read.plan, p);
  assert.deepEqual(read.accounts, [account]);
  assert.equal(read.household, 2);
  assert.equal(read.savingsYears, 30);
  assert.deepEqual(
    projectRetirement([account], {}, planFromInputs(inputsFromPlan(p))).rows,
    projectRetirement([account], {}, p).rows,
  );
  assert.deepEqual(
    projectRetirement(read.accounts, read.access, read.plan).rows,
    projectRetirement([account], {}, p).rows,
  );
});
test("scenario malformed, oversized, unsupported and hostile files are rejected atomically", () => {
  const valid = JSON.parse(exportScenario([account], {}, retired, 1, 30));
  for (const text of [
    "",
    "{",
    "null",
    "[]",
    "1",
    "x".repeat(MAX_SCENARIO_BYTES + 1),
    '"😀"'.repeat(MAX_SCENARIO_BYTES / 2),
  ])
    assert.throws(() => parseScenario(text));
  const bad = [
    { ...valid, version: 2 },
    { ...valid, extra: true },
    { ...valid, household: 0 },
    { ...valid, savingsYears: 81 },
    { ...valid, accounts: [] },
    { ...valid, accounts: [{ ...account, id: "__proto__" }] },
    { ...valid, accounts: [{ ...account, balance: "100" }] },
    { ...valid, plan: { ...valid.plan, salary: null } },
    {
      ...valid,
      plan: {
        ...valid.plan,
        income: { ...valid.plan.income, rmdEnabled: "true" },
      },
    },
    { ...valid, access: { a: { ...valid.access.a, planAllows: "yes" } } },
    { ...valid, accounts: Array(21).fill(account) },
  ];
  for (const raw of bad)
    assert.throws(() => parseScenario(JSON.stringify(raw)));
  assert.throws(() =>
    parseScenario(
      JSON.stringify(valid).replace('"salary":80000', '"salary":1e999'),
    ),
  );
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});
test("export canonicalizes stale access and CSV quotes hostile names without mangling numeric losses", () => {
  const text = exportScenario(
    [account],
    { a: { ...defaultAccess(), rothBasis: NaN, rothFirstYear: 1800 } },
    retired,
    1,
    30,
  );
  assert.equal(parseScenario(text).access.a.rothBasis, 0);
  const rows = projectRetirement(
    [{ ...account, priceGrowth: -10 }],
    {},
    retired,
  ).rows;
  const csv = resultsCsv(rows, [{ ...account, name: '=HYPERLINK("bad")' }]);
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"") balance"'));
  assert.ok(csv.includes('"-'));
  assert.ok(csv.startsWith('"year"'));
});

test("inactive RMD balance does not block disabled module and exports cleanly", () => {
  const access = { a: { ...defaultAccess(), priorYearBalance: -1 } },
    p = { ...retired, income: inc({ rmdEnabled: false }) };
  assert.doesNotThrow(() => projectRetirement([account], access, p));
  assert.equal(
    parseScenario(exportScenario([account], access, p, 1, 30)).access.a
      .priorYearBalance,
    null,
  );
  assert.throws(() =>
    projectRetirement([account], access, { ...p, income: inc() }),
  );
});
