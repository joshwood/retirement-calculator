# Retirement planning roadmap

This release is a deterministic educational planner, not an optimizer, tax return, eligibility determination or account instruction. Defaults are fictional. State taxes are **zero by request**. No financial inputs are saved, transmitted or connected to real accounts.

## Implemented in this increment

- Preserve deployed v2's 1–20 account drawer and standalone Savings growth calculation.
- Retirement cashflow mode: editable birth date/current age, start calendar year, retirement years plus months, and projection horizon. Exact access dates; retirement takes effect at the first full month on/after its date.
- Working salary and account contributions stop at retirement. Contributions are externally funded assumptions; paycheck surplus is not automatically invested, and working living expenses/payroll taxes are not modeled.
- Annual after-tax retirement spending in start-year dollars, inflated annually, or a percentage of each calendar year's opening assets. Monthly spending; percentage mode is not an income floor.
- Monthly per-account balances, tax-aware withdrawal ordering, gross withdrawals, federal/portfolio taxes, ACA MAGI/headroom, spending/tax gaps, accessible balances and year-end depletion.
- Transparent withdrawal heuristic: cash, brokerage, Roth IRA, pretax; stable input order within types. Optional MAGI target caps income-producing withdrawals using income recognized so far plus the year's wages. Later yield can breach the target. It is not global optimization or a guaranteed MAGI cap.
- Federal ordinary brackets and positive long-term capital-gain stacking from verified 2026 tables. Standard deduction for four filing statuses. Constants frozen, not indexed in future projections.
- Brokerage pro-rata basis; entered basis required to withdraw. Positive gains assumed long-term, reinvested dividends/interest conservatively ordinary. No realized-loss deduction or carryforward.
- Conservative pretax age-59½ access, verified-plan Rule of 55 conditions, Roth regular contribution basis and separate qualified-distribution five-tax-year clock. Unknown/unsupported access is blocked explicitly.
- ACA MAGI addbacks and fixed 2026 reference FPL, contiguous 48/DC only. No premium credit, eligibility or repayment calculation. Alaska/Hawaii not supported in this increment.
- SEPP: optional separate hypothetical account, fixed user-supplied annual payment illustrated monthly, investment return, depletion/gaps, and commitment to the later of exact fifth anniversary or age 59½. **Not integrated with main portfolio and not an IRS payment calculation or certified schedule.**

## Next: verified income and early-access modules

1. IRS-derived SEPP payment amounts using versioned life-expectancy tables, statutory interest-rate selection and mortality annuity factors; method switches, payment history, modification/recapture warnings, partial-year rules and separate-account integration. Keep fixed payments fixed; never use investment return as the statutory rate.
2. Roth conversions and conversion-year lots, taxable/nontaxable ordering, designated Roth employer plans, and substantiated exception routes. Do not infer basis from balances.
3. Social Security timing and taxation with relevant filing/household inputs. Taxable benefits and full ACA MAGI treatment must remain separate.
4. RMDs: prior-year balance, applicable divisor/beneficiary inputs, cohort/versioned law, first-year delay and double-distribution effects. Resolve/disclose 1959 birth-cohort uncertainty before eligibility claims.

## Then: deeper taxes and health coverage

- NIIT, qualified dividends, lot selection, losses/carryforwards, pretax/nondeductible contributions, age/blind/senior deductions, credits, AMT and federal law-year changes.
- Full ACA household/coverage/benchmark-premium eligibility and subsidy calculations; Alaska/Hawaii poverty guidelines; advance-credit repayment risk. Employer/Medicaid/Medicare eligibility cannot be inferred from MAGI.
- Medicare IRMAA and lookback inputs.
- Optional verified state models only if later requested. This release assumes zero throughout.

## Later: uncertainty and comparison

Sequence-of-returns scenarios, fees, household cash budgeting, salary changes, linked strategy comparisons, and clearly bounded objectives. No optimization claim until a tested objective and constraints exist.

## Modeling limits that matter now

All pretax assets are assumed fully taxable. No contribution limits or contribution deductions, NIIT, payroll tax, AMT, tax credits, age/blind or temporary senior deductions, qualified dividends, Social Security, RMDs or Medicare. Missing RMDs especially can materially understate future mandatory income and tax; late-life projections remain illustrative.

Salary federal tax is paid outside the portfolio. Additional portfolio tax is funded from accounts at year end with iterative gross-up, including tax on those withdrawals. Account access is checked at each spending date and the tax-payment date. Unpaid tax and spending are reported separately and are **not carried as debt** into later years; later values are not a fully funded plan after the first shortfall.

MAGI is AGI plus entered ACA addbacks. The standard deduction never reduces MAGI. Addbacks are not cashflows in this model; enter no taxable income in that field. Spending, gross proceeds, income, taxable income and MAGI are distinct concepts.

No user-facing preview handoff occurs in this delegated task. Native private publishing must wait for parent review. The cloud environment lacks Sites' bundled `site-workflow.mjs`; obtain supported tooling before the normal source-opening/save/deploy workflow. Preserve project `appgprj_6abf9566570c8191ba3b7d43f71d82da`, owner-only access and `.openai/hosting.json`. GitHub and Sites do not automatically synchronize.

## Verified rule sources

Research supplied by the parent research task; 2026 base-year assumptions, not a forecast of future law:

- [IRS Rev. Proc. 2025-32: 2026 federal amounts](https://www.irs.gov/pub/irs-drop/rp-25-32.pdf)
- [IRS Publication 505 (2026): gain tax worksheet](https://www.irs.gov/pub/irs-prior/p505--2026.pdf)
- [IRS Publication 575: employer plan distributions](https://www.irs.gov/publications/p575)
- [IRS early-distribution exceptions](https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-exceptions-to-tax-on-early-distributions)
- [IRS Publication 590-B: Roth ordering and qualification](https://www.irs.gov/publications/p590b)
- [IRS Notice 2022-6: SEPP methods and requirements](https://www.irs.gov/pub/irs-drop/n-22-06.pdf)
- [IRS premium tax credit Q&A](https://www.irs.gov/affordable-care-act/individuals-and-families/questions-and-answers-on-the-premium-tax-credit)
- [HealthCare.gov: MAGI](https://www.healthcare.gov/income-and-household-information/income/)
- [HealthCare.gov: FPL](https://www.healthcare.gov/glossary/federal-poverty-level-fpl/)
- [IRS: NIIT (currently excluded)](https://www.irs.gov/individuals/net-investment-income-tax)
