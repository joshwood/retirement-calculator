# Release scope and limitations

## Completion release

This is a finished, bounded educational scenario planner, not an open-ended implementation promise. It combines the existing savings and working/retirement phases with gross Social Security, owner-account RMDs, integrated dedicated-IRA SEPP, scenario JSON import/export and annual CSV downloads. The UI is grouped around Plan, Accounts, Income & early access, Taxes & healthcare, Results and expandable assumptions. State taxes remain zero.

The release preserves precise age-59½ access, conservative employer-plan permission/separation, Rule of 55, pooled owner Roth basis/qualification, 2026 ordinary and preferential taxes, salary/contributions stopping at retirement, and both spending modes. All requested data handling is user-initiated; no automatic saving or uploads.

## Important boundaries

- **Not a tax return:** no NIIT, AMT, itemized deductions, age/blind/senior deductions, credits, payroll tax, nondeductible IRA basis, contribution limits/deductions, qualified dividends, capital-loss carryforwards or changing federal-law years.
- **One owner:** no spouse-specific portfolio, inherited accounts, designated Roth employer plans, Roth conversion lots, estate planning or account connections. Joint filing status only selects tax parameters; it does not add a second owner's assets/income. All pretax assets are fully taxable.
- **RMD timing:** current-year distributions, taken as early as modeled access permits. No April 1 deferral, still-working exception or sole-beneficiary spouse over ten years younger. Each account funds its own requirement. Outstanding requirements remain visible if permission, separation or assets prevent payment; no excise-tax calculation.
- **1959 birth cohort:** the 2024 final-regulation provision is reserved. Default age 73 is a disclosed planning assumption, adjustable to 75; verify current law before distributions. Other cohorts follow the dated rules linked below.
- **SEPP:** verified user amount, single-life RMD method and fixed amortization only. IRS Single Life Table factors are transcribed for ages 18–65, covering new arrangements before 59½ and their five-year commitments. Rate selection is bounded to 0–5% (not a minimum); higher dated AFR ceilings are unsupported. No annuitization, fixed-to-RMD switch, existing payment histories, transfers, contributions or recapture tax calculation. Account is conservatively reserved from scenario start through commitment. Initial valuation uses prior month-end balance; annual RMD-method recalculation uses prior December balance. Monthly installment timing and prorated first/final calendar years are planning approximations requiring professional verification.
- **Social Security:** user-provided gross amount before Medicare withholding; first full cash-receipt month and annual January COLA. Basic nonnegative Worksheet 1 income only, not benefit eligibility, earnings-test, spousal/survivor benefit, lump-sum/repayment/SSI or foreign-income worksheets. Qualifying surviving spouse uses the single benefit-tax thresholds with joint ordinary brackets. Separate filing asks whether the spouses lived together.
- **Cash accounting:** benefits and mandatory distributions fund spending/tax; excess stays as zero-return cash. Salary surplus is outside the portfolio, contributions externally funded. Unpaid spending and tax are exposed but not carried as debt; projections after a gap do not represent a fully funded plan. Both account balances and the reserve remain visible.
- **MAGI/healthcare:** AGI includes taxable benefits; ACA MAGI adds their nontaxable portion, exempt interest and other entered addbacks. Enter no Social Security twice. Tax-exempt/other addbacks do not fund cash spending here. No exact ACA subsidies, premium/repayment amount, Medicaid/Medicare eligibility or IRMAA. Reference uses 2025 FPL for 2026 coverage, contiguous 48/DC, frozen in future scenarios.
- **Uncertainty:** no stochastic returns, inflation-indexed tax brackets, sequence analysis, linked comparison optimizer, salary changes or full household budgeting. Constant returns are assumptions, not a prediction.

These are explicitly unsupported features, not promised follow-up work. Add them only for a separate user request with fresh rule verification and testing.

## Verified primary sources

Income-module sources checked October 9, 2026. Federal tables are a frozen 2026 illustration, not a forecast of future law.

- [IRS Revenue Procedure 2025-32: 2026 federal amounts](https://www.irs.gov/pub/irs-drop/rp-25-32.pdf)
- [IRS Publication 505 (2026): preferential gain-tax ceiling](https://www.irs.gov/pub/irs-prior/p505--2026.pdf)
- [IRS Publication 915: Social Security Worksheet 1](https://www.irs.gov/publications/p915)
- [IRS Publication 590-B: Roth ordering, Single Life Table I and Uniform Lifetime Table III](https://www.irs.gov/publications/p590b)
- [IRS 2024 final RMD regulations: required beginning age by birth cohort](https://www.irs.gov/irb/2024-33_IRB)
- [IRS Notice 2022-6: SEPP methods, tables and rate ceiling](https://www.irs.gov/irb/2022-05_IRB#NOT-2022-06)
- [IRS SEPP FAQ: commitment and modification risks](https://www.irs.gov/retirement-plans/substantially-equal-periodic-payments)
- [IRS employer-plan general distribution rules](https://www.irs.gov/retirement-plans/plan-participant-employee/401k-resource-guide-plan-participants-general-distribution-rules)
- [IRS early-distribution exceptions](https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-exceptions-to-tax-on-early-distributions)
- [IRS premium tax credit Q&A](https://www.irs.gov/affordable-care-act/individuals-and-families/questions-and-answers-on-the-premium-tax-credit)
- [HealthCare.gov: household MAGI](https://www.healthcare.gov/income-and-household-information/income/)
- [HealthCare.gov: poverty reference](https://www.healthcare.gov/glossary/federal-poverty-level-fpl/)
- [IRS NIIT, deliberately excluded](https://www.irs.gov/individuals/net-investment-income-tax)
