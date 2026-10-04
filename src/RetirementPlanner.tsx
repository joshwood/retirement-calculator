import { useState } from "react";
import type { Account } from "./projection";
import {
  defaultPlan,
  defaultAccess,
  projectRetirement,
  seppCommitment,
  seppIllustration,
  ageAt,
  dateOf,
  type Plan,
  type Access,
} from "./retirement";
import { TAX_RULES, type FilingStatus } from "./tax";
const money = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);
const initial: Record<string, string> = {
  retirementYears: "65",
  retirementMonths: "0",
  ...Object.fromEntries(
    Object.entries(defaultPlan).map(([k, v]) => [k, String(v)]),
  ),
};
export function RetirementPlanner({ accounts }: { accounts: Account[] }) {
  const [values, setValues] = useState(initial),
    [access, setAccess] = useState<Record<string, Access>>({}),
    [household, setHousehold] = useState("1"),
    [seppStart, setSeppStart] = useState("2026-01-01"),
    [seppValues, setSeppValues] = useState({
      balance: "400000",
      payment: "20000",
      growth: "4",
    });
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
    if (Object.values(values).some((v) => v.trim() === ""))
      throw new Error("Complete every planning assumption.");
    if (
      !Number.isInteger(+values.retirementYears) ||
      !Number.isInteger(+values.retirementMonths) ||
      +values.retirementMonths < 0 ||
      +values.retirementMonths > 11
    )
      throw new Error("Use whole retirement years and 0–11 additional months.");
    plan = {
      startYear: +values.startYear,
      birthDate: values.birthDate,
      retirementAgeMonths:
        +values.retirementYears * 12 + +values.retirementMonths,
      years: +values.years,
      salary: +values.salary,
      spending: +values.spending,
      inflation: +values.inflation,
      mode: values.mode as Plan["mode"],
      withdrawalPercent: +values.withdrawalPercent,
      filing: values.filing as FilingStatus,
      strategy: values.strategy as Plan["strategy"],
      magiTarget: +values.magiTarget,
      magiAddbacks: +values.magiAddbacks,
    };
    result = projectRetirement(accounts, access, plan);
  } catch (e) {
    error = e instanceof Error ? e.message : "Check your inputs.";
  }
  const number = (
    key: string,
    label: string,
    min: number,
    max: number,
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
  const final = result?.rows.at(-1),
    h = Number(household),
    fpl =
      Number.isInteger(h) && h >= 1 && h <= 20 ? 15650 + 5500 * (h - 1) : null;
  let schedule: ReturnType<typeof seppIllustration> | null = null,
    seppError = "";
  try {
    if (Object.values(seppValues).some((v) => v.trim() === ""))
      throw new Error("Fill in all SEPP illustration assumptions.");
    schedule = seppIllustration(
      values.birthDate,
      seppStart,
      +seppValues.balance,
      +seppValues.payment,
      +seppValues.growth,
    );
  } catch (e) {
    seppError = e instanceof Error ? e.message : "Check assumptions.";
  }
  let sepp = "";
  try {
    sepp = seppCommitment(values.birthDate, seppStart);
  } catch {
    sepp = "Enter valid birth and first-payment dates.";
  }
  return (
    <section className="planner" aria-label="Retirement cashflow planner">
      <div className="section-heading">
        <div>
          <h2>Work, retire, draw down</h2>
          <p className="muted">
            Fictional starting assumptions. Change dates, spending and account
            access.
          </p>
        </div>
        <button
          className="secondary"
          onClick={() => {
            setValues(initial);
            setAccess({});
            setHousehold("1");
            setSeppStart("2026-01-01");
            setSeppValues({ balance: "400000", payment: "20000", growth: "4" });
          }}
        >
          Reset plan
        </button>
      </div>
      <div className="rate-note">
        <strong>
          Simplified 2026 federal estimate · State taxes assumed zero.
        </strong>{" "}
        Federal rules and the ACA reference stay frozen in future years.
        Excludes RMDs, Social Security, NIIT and other adjustments described
        below. This illustration is not tax optimization or a complete tax
        return.
      </div>
      <div className="planner-layout">
        <div className="card planner-controls">
          <h3>Timeline & paychecks</h3>
          <div className="plan-fields">
            {number("startYear", "Starting calendar year", 2026, 2100, 1)}
            <div className="field">
              <label htmlFor="plan-birthDate">
                Date of birth (sets current age)
              </label>
              <input
                id="plan-birthDate"
                type="date"
                value={values.birthDate}
                onChange={(e) => update("birthDate", e.target.value)}
              />
            </div>
            {number("retirementYears", "Retirement age: years", 18, 100, 1)}
            {number(
              "retirementMonths",
              "Retirement age: additional months",
              0,
              11,
              1,
            )}
            {number("years", "Projection horizon (years)", 1, 80, 1)}
            {number("salary", "Annual working salary ($)", 0, 1e8)}
          </div>
          {plan && result && (
            <p className="hint">
              Starts at age{" "}
              {ageAt(
                dateOf(plan.birthDate),
                new Date(Date.UTC(plan.startYear, 0, 1)),
              ).toFixed(1)}
              ; retirement at {Math.floor(plan.retirementAgeMonths / 12)} years{" "}
              {plan.retirementAgeMonths % 12} months ({result.retirementDate});
              ends at age {final?.age.toFixed(1)}. Retirement begins the first
              full month on or after that date.
            </p>
          )}
          <p className="hint">
            Salary and contributions stop together. Paycheck surplus is not
            invested automatically. Contributions are externally funded; salary
            is informational. No payroll tax or contribution tax deduction is
            applied.
          </p>
          <h3>Retirement income target</h3>
          <div className="field">
            <label htmlFor="plan-mode">Spending method</label>
            <select
              id="plan-mode"
              value={values.mode}
              onChange={(e) => update("mode", e.target.value)}
            >
              <option value="spending">
                Annual after-tax spending, inflation adjusted
              </option>
              <option value="percent">
                Percent of each year's opening portfolio
              </option>
            </select>
          </div>
          <div className="plan-fields">
            {values.mode === "spending" ? (
              <>
                {number(
                  "spending",
                  "Annual retirement spending, in start-year dollars ($)",
                  0,
                  1e8,
                )}
                {number("inflation", "Annual spending inflation (%)", 0, 20)}
              </>
            ) : (
              number(
                "withdrawalPercent",
                "Annual net spending as % of opening balance",
                0,
                100,
              )
            )}
          </div>
          <p className="hint">
            Retired months receive 1/12 of the annual target. Taxes require
            additional withdrawals. Percentage spending varies with assets and
            can fall to zero; it is not a guaranteed income floor.
          </p>
          <h3>Federal tax & MAGI</h3>
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
                Limit income-generating withdrawals to MAGI target
              </option>
            </select>
          </div>
          <div className="plan-fields">
            {number("magiTarget", "Annual ACA MAGI target ($)", 0, 1e8)}
            {number("magiAddbacks", "Annual ACA MAGI addbacks ($)", 0, 1e8)}
          </div>
          <p className="hint">
            Addbacks: tax-exempt interest, nontaxable Social Security and
            excluded foreign income. These increase MAGI only; they do not fund
            spending here. Do not use this field for taxable income.
          </p>
          <p className="hint">
            Order: cash → brokerage → Roth IRA → pretax; input order breaks
            ties. MAGI priority may leave spending or tax unpaid. Later
            investment income can still push MAGI above target; this heuristic
            does not guarantee a cap.
          </p>
        </div>
        <div className="results">
          {error ? (
            <div className="error card" role="alert">
              {error}
            </div>
          ) : (
            result &&
            final && (
              <>
                <div className="summary" aria-live="polite">
                  <div className="summary-label">
                    PROJECTED ENDING ASSETS <span>{final.year}</span>
                  </div>
                  <div className="hero-number">{money(final.balance)}</div>
                  <div className="metrics">
                    <div>
                      <span>First spending / tax shortfall</span>
                      <strong>{result.firstShortfall ?? "None modeled"}</strong>
                    </div>
                    <div>
                      <span>First year-end depletion</span>
                      <strong>{result.firstDepletion ?? "Not reached"}</strong>
                    </div>
                  </div>
                  <p className="summary-caption">
                    Accessible at end: {money(final.accessible)}. Assets can
                    remain while accessible funds run out. No modeled shortfall
                    is not a retirement-readiness assessment.
                  </p>
                </div>
                {result.warnings.length > 0 && (
                  <div className="card planner-notes">
                    <h3>Assumptions needing attention</h3>
                    <ul>
                      {result.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="card planner-notes">
                  <h3>Annual cashflow & access</h3>
                  <p className="small">
                    Nominal dollars. Federal tax includes wage tax; portfolio
                    withdrawals cover spending plus incremental portfolio tax.
                    Wage tax is paid outside the portfolio. Shortfall includes
                    unpaid spending and unpaid portfolio tax.
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
                            "Phase",
                            "Salary",
                            "Pay after federal tax",
                            "Contributions",
                            "Spending target",
                            "Gross withdrawals",
                            "Federal tax",
                            "Portfolio tax",
                            "AGI",
                            "Taxable income",
                            "ACA MAGI",
                            "Target headroom",
                            "Spending gap",
                            "Tax gap",
                            "End assets",
                            "Accessible",
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
                            </th>
                            <td>{r.phase}</td>
                            <td>{money(r.salary)}</td>
                            <td>{money(r.paycheckAfterFederalTax)}</td>
                            <td>{money(r.contributions)}</td>
                            <td>{money(r.spending)}</td>
                            <td>{money(r.withdrawals)}</td>
                            <td>{money(r.federalTax)}</td>
                            <td>{money(r.portfolioTax)}</td>
                            <td>{money(r.agi)}</td>
                            <td>{money(r.taxableIncome)}</td>
                            <td
                              className={r.magiExceeded ? "warning-text" : ""}
                            >
                              {money(r.magi)}
                              {r.magiExceeded ? " (over target)" : ""}
                            </td>
                            <td>{money(+values.magiTarget - r.magi)}</td>
                            <td>{money(r.shortfall)}</td>
                            <td>{money(r.taxShortfall)}</td>
                            <td>{money(r.balance)}</td>
                            <td>{money(r.accessible)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="card account-results">
                  <h3>Ending assets by account</h3>
                  <ul>
                    {accounts.map((a, i) => (
                      <li key={a.id}>
                        <div>
                          <strong>{a.name}</strong>
                          <span>{a.type}</span>
                        </div>
                        <strong>{money(final.accounts[i])}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )
          )}
          <div className="card planner-notes">
            <h3>ACA reference, not a subsidy quote</h3>
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
            <p>
              {fpl === null
                ? "Enter a whole household size from 1 to 20."
                : `2026 coverage reference: 100% FPL ${money(fpl)}; 400% FPL ${money(fpl * 4)}.`}
            </p>
            <p className="small">
              Contiguous 48 states and DC only. Uses 2025 poverty guidelines for
              2026 coverage, frozen as a future scenario assumption.
              Alaska/Hawaii are unsupported. Household size is separate from
              filing status. Your MAGI target is a planning input, not an
              eligibility threshold.
            </p>
            <p className="small">
              General 2026 premium-tax-credit income range is 100–400% FPL;
              income alone does not establish eligibility. Employer coverage,
              Medicaid, Medicare and other rules matter. Married filing
              separately is generally ineligible with narrow exceptions.
              Crossing 400% can eliminate the credit. Excess advance-credit
              repayment caps were removed beginning in 2026. No premium, subsidy
              or repayment amount is estimated.
            </p>
          </div>
        </div>
      </div>
      <details className="method" open>
        <summary>Account access & tax assumptions</summary>
        <div>
          <p>
            Use Configure accounts above for balances and monthly contributions.
            Access details below apply only to this retirement planner. The
            401(k) / 403(b) label means entirely pretax, not a designated Roth
            plan. Early-distribution exceptions do not remove ordinary income
            tax. Unsupported exceptions remain unavailable here, not legally
            impossible.
          </p>
          {accounts.map((a) => {
            const o = access[a.id] ?? defaultAccess();
            return (
              <fieldset className="account-editor" key={a.id}>
                <legend>
                  {a.name} · {a.type}
                </legend>
                {a.type === "Taxable brokerage" && (
                  <>
                    <label htmlFor={`${a.id}-basis`}>
                      Total current cost basis ($; blank = unknown / withdrawals
                      blocked)
                    </label>
                    <input
                      id={`${a.id}-basis`}
                      type="number"
                      min={0}
                      max={1e9}
                      value={o.taxableBasis ?? ""}
                      onChange={(e) =>
                        changeAccess(a.id, {
                          taxableBasis:
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                        })
                      }
                    />
                    <p className="hint">
                      Pro-rata basis allocation, all positive realized gains
                      assumed long-term. Dividends/yield taxed as ordinary
                      income. Loss deductions, lot selection and qualified
                      dividends are excluded.
                    </p>
                  </>
                )}
                {a.type === "Roth IRA" && (
                  <div className="plan-fields">
                    <div>
                      <label htmlFor={`${a.id}-roth-basis`}>
                        Remaining regular contribution basis ($)
                      </label>
                      <input
                        id={`${a.id}-roth-basis`}
                        type="number"
                        min={0}
                        max={a.balance}
                        value={Number.isNaN(o.rothBasis) ? "" : o.rothBasis}
                        onChange={(e) =>
                          changeAccess(a.id, {
                            rothBasis:
                              e.target.value === "" ? NaN : +e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label htmlFor={`${a.id}-roth-year`}>
                        Earliest same-owner Roth IRA contribution tax year
                        (required)
                      </label>
                      <input
                        id={`${a.id}-roth-year`}
                        type="number"
                        min={1998}
                        max={values.startYear}
                        step={1}
                        value={o.rothFirstYear ?? ""}
                        onChange={(e) =>
                          changeAccess(a.id, {
                            rothFirstYear:
                              e.target.value === "" ? null : +e.target.value,
                          })
                        }
                      />
                    </div>
                    <p className="hint">
                      Use one pooled same-owner Roth IRA entry: combined
                      balances, combined remaining regular contribution basis,
                      and the earliest contribution tax year across that owner's
                      Roth IRAs. Separate entries and spouse-owned Roth IRAs are
                      unsupported in this planner. For a new Roth with no prior
                      history, enter the projected first contribution year; use
                      the start year when modeled contributions begin
                      immediately. Contributions first. Remaining assets require
                      both age 59½ and the five-tax-year qualification clock.
                      Conversion histories are not modeled. Future Roth
                      contributions are assumed regular and eligible; verify
                      limits yourself.
                    </p>
                  </div>
                )}
                {a.type === "401(k) / 403(b)" && (
                  <>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={o.rule55}
                        onChange={(e) =>
                          changeAccess(a.id, { rule55: e.target.checked })
                        }
                      />
                      Model Rule of 55 for this employer's pretax plan
                    </label>
                    <>
                      <label htmlFor={`${a.id}-separation`}>
                        Separation date for this plan's employer
                      </label>
                      <input
                        id={`${a.id}-separation`}
                        type="date"
                        value={o.separationDate}
                        onChange={(e) =>
                          changeAccess(a.id, {
                            separationDate: e.target.value,
                          })
                        }
                      />
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={o.planAllows}
                          onChange={(e) =>
                            changeAccess(a.id, {
                              planAllows: e.target.checked,
                            })
                          }
                        />
                        I have verified this plan permits the modeled
                        distributions after the specified separation date
                        (required at every age)
                      </label>
                      <p className="hint">
                        In-service withdrawals are not modeled. At any age, this
                        account stays unavailable until the entered separation
                        date and verified plan permission. Age 59½ removes the
                        additional-tax restriction; it does not establish
                        distribution rights. For Rule of 55, separation must
                        occur in or after the calendar year turning 55. Reaching
                        55 after an earlier separation does not qualify. This
                        exception is unavailable for IRAs. Public-safety
                        exceptions and rollover histories are not modeled.
                      </p>
                    </>
                  </>
                )}
                {a.type === "Traditional IRA" && (
                  <p className="hint">
                    Fully taxable withdrawals from age 59½. Nondeductible basis
                    and earlier exceptions are unsupported. Do not classify an
                    inherited, SIMPLE or SEP arrangement here without checking
                    its distinct rules.
                  </p>
                )}
                {a.type === "Savings / cash" && (
                  <p className="hint">
                    Always accessible. Interest is ordinary income; principal
                    withdrawals do not increase MAGI.
                  </p>
                )}
                {a.type === "Other" && (
                  <p className="hint">
                    Included in assets; withdrawals blocked pending a supported
                    classification.
                  </p>
                )}
              </fieldset>
            );
          })}
        </div>
      </details>
      <details className="method">
        <summary>Optional SEPP 72(t): separate-account illustration</summary>
        <div>
          <p>
            This separate hypothetical account is not included in portfolio
            cashflows. Enter a fixed annual payment supplied or verified
            independently; this tool does not derive or certify an IRS-qualified
            amount. No contributions, transfers, inflation increases or
            discretionary withdrawals are modeled. Payments below are monthly
            illustrations, not a compliance schedule.
          </p>
          <label htmlFor="sepp-start">Exact first-payment date</label>
          <input
            id="sepp-start"
            type="date"
            value={seppStart}
            onChange={(e) => setSeppStart(e.target.value)}
          />
          <p>
            Later of fifth anniversary or age 59½: <strong>{sepp}</strong>.
          </p>
          <div className="plan-fields">
            {(
              [
                ["balance", "Separate account balance ($)"],
                ["payment", "Fixed annual payment ($; independently verified)"],
                [
                  "growth",
                  "Assumed investment return (%; not a statutory rate)",
                ],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <label htmlFor={`sepp-${key}`}>{label}</label>
                <input
                  id={`sepp-${key}`}
                  type="number"
                  value={seppValues[key]}
                  onChange={(e) =>
                    setSeppValues((v) => ({ ...v, [key]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          {seppError ? (
            <p role="status">{seppError}</p>
          ) : (
            schedule && (
              <>
                <p>
                  {schedule.rows.length} illustrative monthly payments before{" "}
                  {schedule.end}. Ending separate balance:{" "}
                  {money(schedule.rows.at(-1)?.balance ?? 0)}. Total unfunded
                  payments:{" "}
                  {money(schedule.rows.reduce((n, r) => n + r.gap, 0))}.
                </p>
                <div
                  className="table-wrap"
                  tabIndex={0}
                  role="region"
                  aria-label="Separate SEPP illustration"
                >
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Payment date</th>
                        <th scope="col">Payment</th>
                        <th scope="col">Unfunded</th>
                        <th scope="col">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedule.rows.map((r) => (
                        <tr key={r.date}>
                          <th scope="row">{r.date}</th>
                          <td>{money(r.payment)}</td>
                          <td>{money(r.gap)}</td>
                          <td>{money(r.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )
          )}
          <p>
            The next release needs verified life-expectancy tables, permitted
            statutory rates and modification/recapture checks before calculating
            qualifying payments. The maximum permitted rate uses the greater of
            5% or 120% of the relevant federal mid-term rate; investment return
            is not that rate. RMD, fixed amortization and fixed annuitization
            are different methods. Transfers, additions, payment history and
            partial-year mechanics need individual review. Do not start or alter
            a SEPP based on this illustration.
          </p>
        </div>
      </details>
      <details className="method">
        <summary>Model conventions & verified sources</summary>
        <div>
          <p>
            Monthly returns and end-of-month contributions retain the
            accumulation calculator's convention: effective annual price growth
            plus yield, smoothed monthly. Yield is reinvested once, allocated
            proportionally from that monthly return, and taxable outside
            retirement accounts. Cash and brokerage income is conservatively all
            ordinary; positive realized brokerage gains are long-term. The
            standard deduction lowers taxable income, never ACA MAGI. All pretax
            assets are assumed fully taxable.
          </p>
          <p>
            Spending is withdrawn monthly after growth. Access is evaluated at
            each month end. Retirement stops wages/contributions at the first
            full month on or after the chosen date; there is no partial-month
            proration. Incremental federal portfolio tax is funded at year end
            with iterative gross-up, which can consume accessible assets or
            create a separate unpaid-tax gap. Tax shortfalls are reported in
            their year, not carried as debt; projections after a shortfall are
            not fully funded plans. No inflation indexing of tax rules, Social
            Security, RMDs, NIIT, AMT, credits, penalties, payroll tax,
            qualified dividend treatment or state taxes. Salary never
            automatically supplies retirement spending or portfolio taxes.
          </p>
          <p>
            <a href="https://www.irs.gov/pub/irs-drop/rp-25-32.pdf">
              2026 federal tables
            </a>{" "}
            ·{" "}
            <a href="https://www.irs.gov/pub/irs-prior/p505--2026.pdf">
              Capital-gain tax worksheet
            </a>{" "}
            ·{" "}
            <a href="https://www.irs.gov/publications/p575">
              Employer plans / Rule of 55
            </a>{" "}
            ·{" "}
            <a href="https://www.irs.gov/publications/p590b">
              Roth IRA distributions
            </a>{" "}
            ·{" "}
            <a href="https://www.irs.gov/affordable-care-act/individuals-and-families/questions-and-answers-on-the-premium-tax-credit">
              ACA premium tax credit
            </a>{" "}
            ·{" "}
            <a href="https://www.healthcare.gov/income-and-household-information/income/">
              ACA MAGI
            </a>{" "}
            ·{" "}
            <a href="https://www.healthcare.gov/glossary/federal-poverty-level-fpl/">
              Poverty guidelines
            </a>{" "}
            ·{" "}
            <a href="https://www.irs.gov/pub/irs-drop/n-22-06.pdf">
              SEPP Notice 2022-6
            </a>
          </p>
        </div>
      </details>
      <details className="method">
        <summary>Staged roadmap: available now & deferred</summary>
        <div>
          <p>
            <strong>Available now:</strong> configurable dates/ages/horizon,
            working-to-retired transition, inflation or percentage spending,
            account access, basic federal tax gross-up, MAGI
            visibility/priority, conservative Rule of 55 and Roth inputs,
            shortfall/depletion reporting, and a separate illustrative
            fixed-payment SEPP account/commitment date.
          </p>
          <p>
            <strong>Next: verified income and access.</strong> IRS-derived SEPP
            payment amounts with method tables and history checks; Roth
            conversion lots and conversions; Social Security tax worksheets;
            RMDs with beneficiary and birth-cohort rules.
          </p>
          <p>
            <strong>Then: deeper tax and health coverage.</strong> NIIT,
            qualified dividends, loss carryforwards, contribution deductions,
            senior/age deductions, credits, exact ACA eligibility/premiums,
            Medicare IRMAA. State taxes stay zero in this release by request;
            future state support is optional.
          </p>
          <p>
            <strong>Later: uncertainty and comparisons.</strong>{" "}
            Sequence-of-returns scenarios, explicit strategy comparisons, fees
            and household cash budgets. No claim of globally optimal
            withdrawals. All inputs live only in memory; refresh clears them. No
            banking integration, saved financial data or transactions.
          </p>
        </div>
      </details>
    </section>
  );
}
