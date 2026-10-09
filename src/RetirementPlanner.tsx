import { useRef, useState, type RefObject } from "react";
import type { Account } from "./projection";
import {
  defaultAccess,
  defaultPlan,
  projectRetirement,
  seppCommitment,
  type Plan,
  type Access,
  type Annual,
} from "./retirement";
import { TAX_RULES } from "./tax";
import {
  initialInputs,
  inputsFromPlan,
  planFromInputs,
  exportScenario,
  parseScenario,
  resultsCsv,
  MAX_SCENARIO_BYTES,
  type Scenario,
} from "./scenario";
const money = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);
const compact = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(v);
function download(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function BalanceChart({ rows }: { rows: Annual[] }) {
  const max = Math.max(...rows.map((r) => r.balance), 1),
    x = (i: number) => 68 + (i / Math.max(1, rows.length - 1)) * 650,
    y = (v: number) => 220 - (v / max) * 190;
  const path = (key: "balance" | "accessible") =>
    rows.map((r, i) => `${i ? "L" : "M"}${x(i)},${y(r[key])}`).join(" ");
  return (
    <svg
      viewBox="0 0 760 270"
      role="img"
      aria-labelledby="balance-title balance-description"
    >
      <title id="balance-title">Year-end assets and accessible funds</title>
      <desc id="balance-description">
        Teal shows total assets including retained cash; dashed gray shows
        accessible funds. Exact values are in the results table and annual
        details.
      </desc>
      {[0, 0.5, 1].map((v) => (
        <g key={v}>
          <line
            x1="68"
            x2="718"
            y1={y(v * max)}
            y2={y(v * max)}
            stroke="#dbe4ea"
          />
          <text x="60" y={y(v * max) + 5} textAnchor="end">
            {compact(v * max)}
          </text>
        </g>
      ))}
      <path d={path("balance")} fill="none" stroke="#008a6b" strokeWidth="3" />
      <path
        d={path("accessible")}
        fill="none"
        stroke="#788a9c"
        strokeWidth="2.5"
        strokeDasharray="6 5"
      />
      {rows.length === 1 && (
        <circle cx={x(0)} cy={y(rows[0].balance)} r="4" fill="#008a6b" />
      )}
      <text x="68" y="253">
        {rows[0].year}
      </text>
      <text x="718" y="253" textAnchor="end">
        {rows.at(-1)!.year}
      </text>
    </svg>
  );
}
export function RetirementPlanner({
  accounts,
  onAccounts,
  savingsYears,
  onSavingsYears,
  onConfigure,
  configureRef,
  onResetAll,
}: {
  accounts: Account[];
  onAccounts: (a: Account[]) => void;
  savingsYears: string;
  onSavingsYears: (v: string) => void;
  onConfigure: () => void;
  configureRef: RefObject<HTMLButtonElement | null>;
  onResetAll: () => void;
}) {
  const [values, setValues] = useState({ ...initialInputs }),
    [access, setAccess] = useState<Record<string, Access>>({}),
    [household, setHousehold] = useState("1");
  const [notice, setNotice] = useState(""),
    [pending, setPending] = useState<Scenario | null>(null),
    [reading, setReading] = useState(false);
  const fileGeneration = useRef(0);
  const update = (key: string, value: string) =>
    setValues((v) => ({ ...v, [key]: value }));
  const changeAccess = (id: string, patch: Partial<Access>) =>
    setAccess((a) => ({
      ...a,
      [id]: { ...(a[id] ?? defaultAccess()), ...patch },
    }));
  let result: ReturnType<typeof projectRetirement> | null = null,
    error = "",
    plan: Plan | null = null;
  try {
    plan = planFromInputs(values);
    result = projectRetirement(accounts, access, plan);
  } catch (e) {
    error = e instanceof Error ? e.message : "Check your assumptions.";
  }
  const number = (
    key: string,
    label: string,
    min = 0,
    max = 1e8,
    step: number | string = "any",
  ) => (
    <div className="field" key={key}>
      <label htmlFor={`plan-${key}`}>{label}</label>
      <input
        id={`plan-${key}`}
        type="number"
        required
        min={min}
        max={max}
        step={step}
        value={values[key]}
        onChange={(e) => update(key, e.target.value)}
      />
    </div>
  );
  const date = (key: string, label: string) => (
    <div className="field">
      <label htmlFor={`plan-${key}`}>{label}</label>
      <input
        id={`plan-${key}`}
        type="date"
        required
        value={values[key]}
        onChange={(e) => update(key, e.target.value)}
      />
    </div>
  );
  const check = (key: string, label: string) => (
    <label className="check">
      <input
        type="checkbox"
        checked={values[key] === "true"}
        onChange={(e) => update(key, String(e.target.checked))}
      />
      <span>{label}</span>
    </label>
  );
  const accessNumber = (
    a: Account,
    key: "taxableBasis" | "rothBasis" | "rothFirstYear" | "priorYearBalance",
    label: string,
    nullable = true,
  ) => {
    const o = access[a.id] ?? defaultAccess(),
      v = o[key];
    return (
      <div className="field">
        <label htmlFor={`${a.id}-${key}`}>{label}</label>
        <input
          id={`${a.id}-${key}`}
          type="number"
          min={key === "rothFirstYear" ? 1998 : 0}
          max={key === "rothFirstYear" ? Number(values.startYear) : 1e9}
          step={key === "rothFirstYear" ? 1 : "any"}
          value={v == null || Number.isNaN(v) ? "" : v}
          onChange={(e) =>
            changeAccess(a.id, {
              [key]:
                e.target.value === ""
                  ? nullable
                    ? null
                    : NaN
                  : Number(e.target.value),
            })
          }
        />
      </div>
    );
  };
  const final = result?.rows.at(-1),
    h = Number(household),
    fpl =
      Number.isInteger(h) && h >= 1 && h <= 20 ? 15650 + 5500 * (h - 1) : null;
  let commitment = "";
  try {
    commitment = seppCommitment(values.birthDate, values.sepp_firstPayment);
  } catch {
    commitment = "Enter valid dates";
  }
  async function readScenario(file: File | undefined) {
    if (!file) return;
    const generation = ++fileGeneration.current;
    setReading(true);
    setPending(null);
    setNotice("");
    try {
      if (file.size > MAX_SCENARIO_BYTES)
        throw new Error("Scenario exceeds the 128 KB limit.");
      const imported = parseScenario(await file.text());
      if (generation === fileGeneration.current) setPending(imported);
    } catch (e) {
      if (generation === fileGeneration.current)
        setNotice(e instanceof Error ? e.message : "Could not read that file.");
    } finally {
      if (generation === fileGeneration.current) setReading(false);
    }
  }
  function exportJson() {
    try {
      if (!plan || error)
        throw new Error("Correct planning inputs before exporting.");
      download(
        exportScenario(accounts, access, plan, h, Number(savingsYears)),
        "retirement-scenario-v1.json",
        "application/json",
      );
      setNotice(
        "Scenario download requested. Keep this file private; it includes your financial inputs.",
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Export failed.");
    }
  }
  return (
    <section className="planner" aria-label="Retirement cashflow planner">
      <div className="section-heading">
        <div>
          <h2>Your retirement plan</h2>
          <p className="muted">
            One owner. Clear assumptions. A transparent cashflow estimate.
          </p>
        </div>
        <a className="secondary" href="#plan-results">
          View results ↓
        </a>
      </div>
      <div className="rate-note">
        <strong>2026 federal estimate · State taxes: $0.</strong> Future tax
        brackets and ACA reference stay frozen. This is an educational scenario,
        not financial advice, an optimizer or a complete tax return.
      </div>
      <nav className="plan-nav" aria-label="Planner sections">
        <a href="#plan-timeline">Plan</a>
        <a href="#plan-accounts">Accounts</a>
        <a href="#plan-income">Income & early access</a>
        <a href="#plan-taxes">Taxes & healthcare</a>
        <a href="#plan-results">Results</a>
      </nav>
      <div className="plan-grid">
        <section
          className="card planner-controls"
          id="plan-timeline"
          aria-labelledby="timeline-title"
        >
          <p className="eyebrow">01 · PLAN</p>
          <h3 id="timeline-title">When work becomes retirement</h3>
          <div className="plan-fields">
            {number("startYear", "Starting calendar year", 2026, 2100, 1)}
            {date("birthDate", "Date of birth")}
            {number("retirementYears", "Retirement age: years", 18, 100, 1)}
            {number(
              "retirementMonths",
              "Retirement age: additional months",
              0,
              11,
              1,
            )}
            {number("years", "Projection horizon (years)", 1, 80, 1)}
            {number("salary", "Annual working salary ($)")}
          </div>
          <p className="hint">
            Salary and contributions stop at the first full month on or after
            retirement{result ? ` (${result.retirementDate})` : ""}. Salary
            surplus stays outside this portfolio; contributions are externally
            funded assumptions. No payroll tax or contribution deduction.
          </p>
          <h3>Retirement spending</h3>
          <div className="field">
            <label htmlFor="plan-mode">Spending method</label>
            <select
              id="plan-mode"
              value={values.mode}
              onChange={(e) => update("mode", e.target.value)}
            >
              <option value="spending">
                Annual spending, inflation adjusted
              </option>
              <option value="percent">Percent of opening annual assets</option>
            </select>
          </div>
          <div className="plan-fields">
            {values.mode === "spending" ? (
              <>
                {number(
                  "spending",
                  "Annual spending in start-year dollars ($)",
                )}
                {number("inflation", "Annual spending inflation (%)", 0, 20)}
              </>
            ) : (
              number(
                "withdrawalPercent",
                "Annual net spending (% of opening assets)",
                0,
                100,
              )
            )}
          </div>
          <p className="hint">
            Monthly spending is 1/12 of the annual target. Include healthcare
            premiums. Taxes require additional cash. Percent spending can fall
            to zero; it is not an income floor.
          </p>
        </section>
        <section
          className="card planner-controls"
          id="plan-accounts"
          aria-labelledby="accounts-heading"
        >
          <p className="eyebrow">02 · ACCOUNTS</p>
          <div className="section-heading">
            <h3 id="accounts-heading">Savings, contributions & access</h3>
            <button
              ref={configureRef}
              className="primary"
              onClick={onConfigure}
            >
              Configure accounts ({accounts.length})
            </button>
          </div>
          <p className="muted">
            {money(accounts.reduce((n, a) => n + a.balance, 0))} starting assets
            · {money(accounts.reduce((n, a) => n + a.monthlyContribution, 0))}
            /month while working
          </p>
          <p className="hint">
            All accounts belong to the person above. Employer accounts are
            entirely pretax. Use one pooled Roth IRA entry with that owner's
            earliest contribution year.
          </p>
          {accounts.map((a) => {
            const o = access[a.id] ?? defaultAccess();
            return (
              <details
                className="account-detail"
                key={a.id}
                open={accounts.length === 1}
              >
                <summary>
                  <strong>{a.name}</strong>
                  <span>
                    {a.type} · {money(a.balance)} ·{" "}
                    {money(a.monthlyContribution)}/mo
                  </span>
                </summary>
                <p className="hint">
                  {a.priceGrowth}% price growth + {a.incomeYield}% income yield.
                  Income is reinvested once; both rates are assumptions.
                </p>
                {a.type === "Taxable brokerage" &&
                  accessNumber(
                    a,
                    "taxableBasis",
                    "Current cost basis ($; blank blocks withdrawals)",
                  )}
                {a.type === "Roth IRA" && (
                  <>
                    {accessNumber(
                      a,
                      "rothBasis",
                      "Remaining regular contribution basis ($)",
                      false,
                    )}
                    {accessNumber(
                      a,
                      "rothFirstYear",
                      "Earliest same-owner Roth contribution tax year",
                    )}
                    <p className="hint">
                      Basis can exceed an underwater balance. Withdrawals never
                      exceed assets. Qualified earnings require age 59½ and five
                      tax years. Conversion lots are unsupported.
                    </p>
                  </>
                )}
                {a.type === "401(k) / 403(b)" && (
                  <>
                    <div className="field">
                      <label htmlFor={`${a.id}-separation`}>
                        Separation date from this employer
                      </label>
                      <input
                        id={`${a.id}-separation`}
                        type="date"
                        value={o.separationDate}
                        onChange={(e) =>
                          changeAccess(a.id, { separationDate: e.target.value })
                        }
                      />
                    </div>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={o.planAllows}
                        onChange={(e) =>
                          changeAccess(a.id, { planAllows: e.target.checked })
                        }
                      />
                      <span>
                        I verified this plan permits the modeled distributions
                        after separation.
                      </span>
                    </label>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={o.rule55}
                        onChange={(e) =>
                          changeAccess(a.id, { rule55: e.target.checked })
                        }
                      />
                      <span>
                        Apply Rule of 55 if separation occurred in the calendar
                        year I turned 55 or later.
                      </span>
                    </label>
                    <p className="hint">
                      Both permission and separation are needed at every age.
                      In-service distributions are not modeled.
                    </p>
                  </>
                )}
                {(a.type === "Traditional IRA" ||
                  a.type === "401(k) / 403(b)") && (
                  <>
                    {values.rmdEnabled === "true" &&
                      accessNumber(
                        a,
                        "priorYearBalance",
                        "Prior December 31 balance ($; blank uses starting balance)",
                      )}
                    <p className="hint">
                      Pretax withdrawals are ordinary income. IRA withdrawals
                      start at 59½ unless the dedicated SEPP below applies.
                      Nondeductible IRA basis is unsupported.
                    </p>
                  </>
                )}
                {a.type === "Savings / cash" && (
                  <p className="hint">
                    Accessible at every age; yield is ordinary income.
                  </p>
                )}
                {a.type === "Other" && (
                  <p className="hint">
                    Included in assets, unavailable for withdrawals because its
                    treatment is unspecified.
                  </p>
                )}
              </details>
            );
          })}
        </section>
        <section
          className="card planner-controls"
          id="plan-income"
          aria-labelledby="income-title"
        >
          <p className="eyebrow">03 · INCOME & EARLY ACCESS</p>
          <h3 id="income-title">Social Security</h3>
          {number(
            "socialSecurityMonthly",
            "Gross monthly benefit at first receipt ($)",
          )}
          {Number(values.socialSecurityMonthly) > 0 && (
            <div className="plan-fields">
              {date("socialSecurityStart", "First cash-receipt date")}
              {number(
                "socialSecurityCola",
                "Assumed annual benefit COLA (%)",
                0,
                20,
              )}
            </div>
          )}
          <p className="hint">
            Enter your estimate before Medicare withholding. Cash begins the
            first full month on or after this date; COLA applies each following
            January. No benefit calculation, earnings test, spousal/survivor
            claims, lump sums, repayments or SSI. Include Medicare premiums in
            spending.
          </p>
          <h3>Required minimum distributions</h3>
          {check("rmdEnabled", "Model owner-account RMDs")}
          {values.rmdEnabled === "true" && (
            <>
              <p className="hint">
                Prior December 31 balance ÷ current-age Uniform Lifetime factor.
                Calculated for each pretax account; taken as early as access
                allows. Distributions already taken count once. Mandatory income
                can exceed your MAGI target; unused cash is retained without
                interest.
              </p>
              {values.birthDate.startsWith("1959") && (
                <div className="field">
                  <label htmlFor="plan-rmd1959Age">
                    1959 birth cohort: explicit age assumption
                  </label>
                  <select
                    id="plan-rmd1959Age"
                    value={values.rmd1959Age}
                    onChange={(e) => update("rmd1959Age", e.target.value)}
                  >
                    <option value="73">73 (planning assumption; verify)</option>
                    <option value="75">
                      75 (alternative assumption; verify)
                    </option>
                  </select>
                </div>
              )}
              <p className="hint">
                No April 1 first-year deferral, still-working exception,
                inherited accounts or sole-beneficiary spouse more than 10 years
                younger. Roth lifetime RMDs are excluded.
              </p>
            </>
          )}
          <details className="subsection">
            <summary>Optional dedicated-IRA SEPP / 72(t)</summary>
            {check("sepp_enabled", "Include SEPP payments in this plan")}
            {values.sepp_enabled === "true" && (
              <>
                <div className="field">
                  <label htmlFor="plan-sepp_accountId">
                    Dedicated traditional IRA
                  </label>
                  <select
                    id="plan-sepp_accountId"
                    value={values.sepp_accountId}
                    onChange={(e) => update("sepp_accountId", e.target.value)}
                  >
                    <option value="">Choose an IRA</option>
                    {accounts
                      .filter((a) => a.type === "Traditional IRA")
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </select>
                </div>
                {date("sepp_firstPayment", "First SEPP payment date")}
                <div className="field">
                  <label htmlFor="plan-sepp_method">Payment method</label>
                  <select
                    id="plan-sepp_method"
                    value={values.sepp_method}
                    onChange={(e) => update("sepp_method", e.target.value)}
                  >
                    <option value="verified">
                      Professionally verified annual amount
                    </option>
                    <option value="rmd">
                      Single-life RMD method (annual recalculation)
                    </option>
                    <option value="amortization">
                      Single-life fixed amortization
                    </option>
                  </select>
                </div>
                {values.sepp_method === "verified" &&
                  number(
                    "sepp_annualPayment",
                    "Verified annual gross payment ($)",
                    0.01,
                  )}
                {values.sepp_method === "amortization" &&
                  number(
                    "sepp_rate",
                    "Fixed amortization interest rate (%)",
                    0,
                    5,
                  )}
                <p className="hint">
                  Commitment through {commitment}: both five years and age 59½
                  must have elapsed. This account is reserved until then; no
                  contributions or extra withdrawals. Afterwards ordinary
                  age-based access resumes.
                </p>
                {check(
                  "sepp_acknowledged",
                  "I understand this is an illustration requiring professional verification; modifying a SEPP can cause retroactive additional tax and interest.",
                )}
                <p className="hint">
                  Payments enter assets, spending cash, federal income and MAGI
                  once. The single-life factors use calendar-year attained age.
                  Fixed amortization is frozen; RMD method uses a new prior-year
                  balance and age annually. Rates are limited to 0–5%; higher
                  AFR-based rates require verification and are unsupported.
                </p>
                <p className="hint">
                  Monthly installments with prorated first/final years are a
                  timing approximation, not a compliance schedule. Starts must
                  be within the projection before 59½. No existing arrangements,
                  method switch, annuitization, recapture calculation or
                  transfers. Confirm first/final-year rules, valuation and
                  payment timing with a professional.
                </p>
              </>
            )}
          </details>
        </section>
        <section
          className="card planner-controls"
          id="plan-taxes"
          aria-labelledby="tax-title"
        >
          <p className="eyebrow">04 · TAXES & HEALTHCARE</p>
          <h3 id="tax-title">Federal tax & ACA MAGI</h3>
          <div className="field">
            <label htmlFor="plan-filing">Tax filing status</label>
            <select
              id="plan-filing"
              value={values.filing}
              onChange={(e) => update("filing", e.target.value)}
            >
              {Object.entries(TAX_RULES).map(([k, r]) => (
                <option key={k} value={k}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          {values.filing === "separate" &&
            check(
              "separateLivedTogether",
              "Lived with spouse at any time during the tax year (Social Security rule)",
            )}
          <div className="field">
            <label htmlFor="plan-strategy">Withdrawal priority</label>
            <select
              id="plan-strategy"
              value={values.strategy}
              onChange={(e) => update("strategy", e.target.value)}
            >
              <option value="spending">
                Fund spending from accessible assets
              </option>
              <option value="magi">
                Limit discretionary income-generating withdrawals to MAGI target
              </option>
            </select>
          </div>
          <div className="plan-fields">
            {number("magiTarget", "Annual ACA MAGI target ($)")}
            {number("taxExemptInterest", "Annual tax-exempt interest ($)")}
            {number("magiAddbacks", "Other annual ACA MAGI addbacks ($)")}
          </div>
          <p className="hint">
            Tax-exempt interest affects Social Security taxability and ACA MAGI
            but is not spendable cash here. Other addbacks (e.g. excluded
            foreign income) affect MAGI only. Do not include Social Security
            here: its full gross amount already enters ACA MAGI automatically.
            Complex foreign-income Social Security worksheets are unsupported.
          </p>
          <p className="hint">
            Cash reserve → cash accounts → brokerage → Roth → pretax. Mandatory
            RMD/SEPP overrides the MAGI target. Later yield can also breach it.
            Tax funding recalculates taxable Social Security. No global
            optimization or guaranteed cap.
          </p>
          <details className="subsection">
            <summary>ACA reference, not a subsidy quote</summary>
            <div className="field">
              <label htmlFor="household">Tax household size</label>
              <input
                id="household"
                type="number"
                min={1}
                max={20}
                step={1}
                value={household}
                onChange={(e) => setHousehold(e.target.value)}
              />
            </div>
            <p>
              {fpl === null
                ? "Enter a whole household size from 1 to 20."
                : `2026 coverage reference: 100% FPL ${money(fpl)}; 400% FPL ${money(fpl * 4)}.`}
            </p>
            <p className="hint">
              2025 guidelines for 2026 coverage, frozen for future scenarios;
              contiguous 48 states/DC only. No Alaska/Hawaii, premiums, credits
              or repayment estimates. Income alone does not establish
              eligibility; employer coverage, Medicaid, Medicare and filing
              rules matter. The general 2026 credit range is 100–400% FPL, with
              exceptions. Crossing 400% can eliminate the credit; advance-credit
              repayment caps were removed from 2026.
            </p>
          </details>
        </section>
      </div>
      <section
        id="plan-results"
        className="results-section"
        aria-labelledby="results-title"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">05 · RESULTS</p>
            <h2 id="results-title">The long view</h2>
          </div>
          <button
            className="secondary"
            disabled={!result}
            onClick={() =>
              result &&
              download(
                resultsCsv(result.rows, accounts),
                "retirement-results.csv",
                "text/csv;charset=utf-8",
              )
            }
          >
            Download results CSV
          </button>
        </div>
        {error ? (
          <div className="error card" role="alert">
            {error}
          </div>
        ) : (
          result &&
          final && (
            <>
              <div className="result-overview">
                <div className="summary">
                  <div className="summary-label">
                    PROJECTED ENDING ASSETS <span>{final.year}</span>
                  </div>
                  <div className="hero-number">{money(final.balance)}</div>
                  <div className="metrics">
                    <div>
                      <span>First spending, tax or payment gap</span>
                      <strong>{result.firstShortfall ?? "None modeled"}</strong>
                    </div>
                    <div>
                      <span>First year-end depletion</span>
                      <strong>{result.firstDepletion ?? "Not reached"}</strong>
                    </div>
                  </div>
                  <p className="summary-caption">
                    Includes {money(final.cashReserve)} retained cash.
                    Accessible funds: {money(final.accessible)}. Assets can
                    remain while accessible money runs out. No shortfall is not
                    a retirement-readiness assessment.
                  </p>
                </div>
                <div className="card chart-card">
                  <h3>Assets over time</h3>
                  <div className="legend">
                    <span>
                      <i />
                      Total assets
                    </span>
                    <span>
                      <i className="dashed" />
                      Accessible funds
                    </span>
                  </div>
                  <BalanceChart rows={result.rows} />
                </div>
              </div>
              <div className="card planner-notes">
                <h3>Year by year</h3>
                <p className="small">
                  Nominal dollars. Spending is a target; income is gross Social
                  Security plus account distributions (including RMD/SEPP),
                  excluding salary. Total federal tax includes wage tax paid
                  outside the portfolio. Expand any year for cash, tax and
                  account details.
                </p>
                <div
                  className="table-wrap"
                  tabIndex={0}
                  role="region"
                  aria-label="Retirement cashflow table"
                >
                  <table>
                    <caption className="sr-only">
                      Annual retirement cashflow in US dollars
                    </caption>
                    <thead>
                      <tr>
                        {[
                          "Year / age",
                          "Spending",
                          "Retirement inflows",
                          "Federal tax",
                          "End assets",
                          "Details",
                        ].map((t) => (
                          <th scope="col" key={t}>
                            {t}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((r) => (
                        <tr key={r.year}>
                          <th scope="row">
                            {r.year} / {r.age.toFixed(1)}
                            <span className="row-phase">{r.phase}</span>
                          </th>
                          <td>{money(r.spending)}</td>
                          <td>{money(r.socialSecurity + r.withdrawals)}</td>
                          <td>{money(r.federalTax)}</td>
                          <td>{money(r.balance)}</td>
                          <td>
                            <details className="year-details">
                              <summary>
                                {r.shortfall +
                                  r.taxShortfall +
                                  r.rmdShortfall +
                                  r.seppShortfall >
                                0.01
                                  ? "⚠ Gap · details"
                                  : "View details"}
                              </summary>
                              <dl>
                                {Object.entries({
                                  "Working salary": r.salary,
                                  "Pay after federal tax":
                                    r.paycheckAfterFederalTax,
                                  Contributions: r.contributions,
                                  "Gross Social Security": r.socialSecurity,
                                  "Taxable Social Security":
                                    r.taxableSocialSecurity,
                                  "All account withdrawals": r.withdrawals,
                                  "RMD required": r.rmdRequired,
                                  "RMD satisfied": r.rmdPaid,
                                  "Unfunded RMD": r.rmdShortfall,
                                  "SEPP payments": r.seppPayment,
                                  "Unfunded SEPP": r.seppShortfall,
                                  "Portfolio-funded tax": r.portfolioTax,
                                  AGI: r.agi,
                                  "Taxable income": r.taxableIncome,
                                  "ACA MAGI": r.magi,
                                  "MAGI target headroom":
                                    Number(values.magiTarget) - r.magi,
                                  "Unpaid spending": r.shortfall,
                                  "Unpaid portfolio tax": r.taxShortfall,
                                  "Retained cash": r.cashReserve,
                                  "Accessible funds": r.accessible,
                                  "Investment growth / loss":
                                    r.investmentGrowth,
                                  ...Object.fromEntries(
                                    accounts.map((a, i) => [
                                      `${a.name} balance`,
                                      r.accounts[i],
                                    ]),
                                  ),
                                }).map(([label, value]) => (
                                  <div key={label}>
                                    <dt>{label}</dt>
                                    <dd>{money(value)}</dd>
                                  </div>
                                ))}
                              </dl>
                            </details>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {result.warnings.length > 0 && (
                <details className="card planner-notes">
                  <summary>
                    Model notes & assumptions needing attention (
                    {result.warnings.length})
                  </summary>
                  <ul>
                    {result.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )
        )}
      </section>
      <section
        className="card planner-notes scenario-files"
        aria-labelledby="scenario-title"
      >
        <h3 id="scenario-title">Keep a scenario, on your terms</h3>
        <p className="small">
          Nothing is saved automatically. Export a private JSON file to keep all
          inputs, or import one to review and replace the current scenario.
          Files stay in your browser; no uploads. Refresh clears changes. CSV
          contains annual results, not a restorable scenario.
        </p>
        <div className="file-actions">
          <button className="primary" disabled={!!error} onClick={exportJson}>
            Export scenario JSON
          </button>
          <div className="field">
            <label htmlFor="scenario-import">
              Import scenario JSON (version 1; max 128 KB)
            </label>
            <input
              id="scenario-import"
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                void readScenario(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
        </div>
        {reading && <p role="status">Reading scenario…</p>}
        {pending && (
          <div className="rate-note">
            <p>
              Ready to import {pending.accounts.length} accounts, starting in{" "}
              {pending.plan.startYear}, over {pending.plan.years} years. This
              replaces account balances, access, plan, income, household and
              savings horizon.
            </p>
            <div className="file-actions">
              <button
                className="primary"
                onClick={() => {
                  onAccounts(pending.accounts);
                  onSavingsYears(String(pending.savingsYears));
                  setValues(inputsFromPlan(pending.plan));
                  setAccess(pending.access);
                  setHousehold(String(pending.household));
                  setPending(null);
                  setNotice("Scenario imported. Inputs remain memory-only.");
                }}
              >
                Replace with imported scenario
              </button>
              <button
                className="secondary"
                onClick={() => {
                  setPending(null);
                  setNotice("Import canceled.");
                }}
              >
                Cancel import
              </button>
            </div>
          </div>
        )}
        <p role="status">{notice}</p>
        <details className="subsection">
          <summary>Reset options</summary>
          <p className="hint">
            Reset plan settings restores dates, spending, income and tax
            settings plus household size; account balances, contributions, rates
            and access stay unchanged. Reset everything restores the fictional
            account and every scenario setting, including the savings horizon.
          </p>
          <div className="file-actions">
            <button
              className="secondary"
              onClick={() => {
                fileGeneration.current++;
                setReading(false);
                setPending(null);
                setValues(inputsFromPlan(defaultPlan));
                setHousehold("1");
                setNotice(
                  "Plan, income and tax settings reset. Account settings retained.",
                );
              }}
            >
              Reset plan settings
            </button>
            <button
              className="secondary"
              onClick={() => {
                fileGeneration.current++;
                onResetAll();
              }}
            >
              Reset everything to example
            </button>
          </div>
        </details>
      </section>
      <details className="method">
        <summary>Assumptions, limitations & official sources</summary>
        <div>
          <p>
            Single-owner, constant-return, monthly planning model in nominal
            USD. Annual price growth excludes yield; the combined effective
            return is smoothed monthly. Brokerage yield is ordinary income and
            reinvested; gains use proportional basis, no loss harvesting or
            qualified dividends. Annual taxes are settled at year end; no
            withholding calendar, estimated-tax penalties or inflation-indexed
            future tax law. Unpaid spending/tax is reported, not carried as
            debt.
          </p>
          <p>
            Tax scope: 2026 ordinary brackets, standard deduction and
            preferential long-term capital gains with ordinary-rate ceiling,
            plus simplified Social Security. No NIIT, AMT,
            itemized/age/senior/contribution deductions, credits, nondeductible
            IRA basis, conversion lots, estate, multi-owner or inherited
            accounts. All pretax accounts are entirely taxable. State taxes are
            zero by request. No healthcare subsidy optimization or eligibility
            determination.
          </p>
          <p>
            RMD cohorts: before July 1, 1949: 70½; later 1949–1950: 72;
            1951–1958: 73; 1960 onward: 75. Age 73 for 1959 is an explicitly
            adjustable assumption because the relevant 2024 final-regulation
            paragraph was reserved. Uniform factors cover every modeled RMD age
            through 120. Each account funds its own requirement; IRA aggregation
            is not optimized.
          </p>
          <p>
            Social Security thresholds are not inflation indexed. Qualifying
            surviving spouse uses single thresholds for benefit taxation but
            joint ordinary-tax brackets. Separate filers have a
            lived-with-spouse choice. Tax-exempt interest raises combined
            income. Full gross benefits enter ACA MAGI; do not add them again.
            Foreign-income exclusions may require a more complex benefits
            worksheet than this model.
          </p>
          <ul>
            <li>
              <a
                href="https://www.irs.gov/irb/2025-45_IRB#REV-PROC-2025-32"
                target="_blank"
                rel="noreferrer"
              >
                IRS 2026 tax parameters, Revenue Procedure 2025-32
              </a>
            </li>
            <li>
              <a
                href="https://www.irs.gov/publications/p505"
                target="_blank"
                rel="noreferrer"
              >
                IRS Publication 505, preferential tax worksheet
              </a>
            </li>
            <li>
              <a
                href="https://www.irs.gov/publications/p915"
                target="_blank"
                rel="noreferrer"
              >
                IRS Publication 915, Social Security Worksheet 1
              </a>
            </li>
            <li>
              <a
                href="https://www.irs.gov/publications/p590b"
                target="_blank"
                rel="noreferrer"
              >
                IRS Publication 590-B, IRA access and life tables
              </a>
            </li>
            <li>
              <a
                href="https://www.irs.gov/irb/2024-33_IRB"
                target="_blank"
                rel="noreferrer"
              >
                IRS 2024 final RMD regulations, birth cohorts
              </a>
            </li>
            <li>
              <a
                href="https://www.irs.gov/irb/2022-05_IRB#NOT-2022-06"
                target="_blank"
                rel="noreferrer"
              >
                IRS Notice 2022-6, SEPP methods
              </a>
            </li>
            <li>
              <a
                href="https://www.irs.gov/retirement-plans/substantially-equal-periodic-payments"
                target="_blank"
                rel="noreferrer"
              >
                IRS SEPP FAQ and modification risks
              </a>
            </li>
            <li>
              <a
                href="https://www.healthcare.gov/income-and-household-information/income/"
                target="_blank"
                rel="noreferrer"
              >
                HealthCare.gov, household MAGI
              </a>
            </li>
            <li>
              <a
                href="https://www.irs.gov/newsroom/questions-and-answers-on-the-premium-tax-credit"
                target="_blank"
                rel="noreferrer"
              >
                IRS premium tax credit guidance
              </a>
            </li>
          </ul>
          <p>
            Income-module sources checked October 9, 2026. Verify law and your
            individual circumstances before acting.
          </p>
        </div>
      </details>
    </section>
  );
}
