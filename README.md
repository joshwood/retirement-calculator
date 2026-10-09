# Retirement Calculator

A private, browser-only retirement cashflow planner and savings calculator built with React, TypeScript and Vite. All defaults are fictional examples. State taxes are zero by request.

## Use the planner

1. **Plan:** set birth date, retirement age (years/months), horizon and working salary. Choose inflation-adjusted spending or a percentage of opening assets.
2. **Accounts:** configure up to 20 sources, their balances/contributions/rates, and access/basis details together. All accounts belong to one owner. Combine that owner's Roth IRAs into one pooled entry.
3. **Income & early access:** enter gross Social Security, owner RMD assumptions and an optional dedicated traditional-IRA SEPP.
4. **Taxes & healthcare:** choose federal filing status, withdrawal priority and ACA MAGI assumptions. Taxable Social Security and gross ACA income are separate.
5. **Results:** inspect assets/access chart, six-column annual table and expandable tax/cash/account details. Unpaid spending, taxes and required payments are exposed.

**Scenario files:** Export scenario JSON downloads a version-1 file containing all active plan/account settings, household size and savings horizon. Import reads a user-selected file in the browser, validates it and previews a replacement before applying. Cancel leaves the current scenario untouched. Files over 128 KB, unsupported versions, invalid schemas and invalid active assumptions are rejected. Results CSV is a separate, full annual export, not a restorable scenario. Keep downloaded financial files private.

**Reset scopes:** Reset plan settings resets dates, spending, income, taxes and household size but preserves account balances, contributions, returns and access. Reset everything restores the fictional accounts and all settings. Savings growth's Reset horizon changes only its horizon. Switching calculator modes preserves edits; refreshing clears them.

## Modeling scope

- Monthly, constant effective returns: price growth plus income yield, converted to a monthly rate without a cross-product. Income is reinvested once; contributions arrive at month-end while working. If a rate already includes dividends, enter it as growth with yield zero.
- Salary and contributions stop at the first full month on/after retirement. Contributions are externally funded assumptions; salary surplus is not added to the portfolio. Wage tax is paid outside the portfolio. Working expenses and payroll taxes are absent.
- Retirement spending uses 1/12 of each annual target. Gross account distributions and Social Security feed spending and incremental federal tax. Unused mandatory/benefit cash stays in a separate zero-return reserve, included in assets and accessible funds.
- Account-aware cash → brokerage → Roth → pretax ordering after retained cash. Employer plans need both verified permission and a reached separation date at every age. Rule of 55 is a separately verified exception. Roth regular contribution basis can exceed an underwater balance; accessible money cannot exceed assets. Roth conversion lots are unsupported.
- Federal ordinary brackets, standard deductions and long-term capital-gain stacking frozen to 2026. The preferential calculation is capped by ordinary-only tax. Qualifying surviving spouse has its own filing option because its Social Security thresholds differ from joint filing.
- Gross Social Security uses a user estimate, first cash-receipt date and optional COLA. Taxable benefits follow the basic nonnegative-income Publication 915 Worksheet 1 tiers. Full gross benefits enter ACA MAGI once. Medicare withholding is not deducted; include premiums in spending. No benefit/claiming optimizer, earnings test, lump sums, repayments, SSI or foreign-income worksheet.
- Owner RMDs use each pretax account's prior December 31 balance and the Uniform Lifetime Table. Blank initial prior-year balance means the entered January 1 balance. Later years use modeled prior-year closing balances. Mandatory income overrides the MAGI target. Age 73 for the reserved 1959 cohort is explicitly adjustable to 75. No first-year April deferral, still-working exception, younger-spouse table, inherited accounts or IRA aggregation optimization.
- Optional SEPP reserves one contribution-free traditional IRA. Choose a professionally verified amount, single-life RMD method (annual recalculation), or fixed amortization (frozen dollars, rate 0–5%). Payments reduce the selected IRA and enter cash/income/tax/MAGI once. No discretionary withdrawals until both five years and age 59½ have elapsed. The model uses monthly installments, prorated first/final years and simplified valuation timing; it is **not a compliance schedule**. Verify timing, amount and valuation professionally before acting. Modifications can trigger retroactive additional tax and interest. Annuitization and method switching are deliberately unsupported.
- The MAGI strategy is a transparent heuristic, not a global optimizer or guaranteed cap. Mandatory distributions and later investment yield can breach the target. ACA is an income reference, not a subsidy or eligibility quote.

See [ROADMAP.md](ROADMAP.md) for the completed release boundary, unsupported features and primary sources.

## Development and checks

Requires Node.js 24+ and npm. Preserve `package-lock.json`.

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run dev
```

Pure logic lives in `src/retirement.ts`, `src/income.ts`, `src/tax.ts` and `src/scenario.ts`. Savings math is preserved in `src/projection.ts`. The test suite includes all 43 earlier regressions plus Social Security tiers/tax gross-up, RMD cohorts/prior balances, SEPP methods/commitment/depletion, cash conservation, ignored hidden inputs and hostile scenario files. CI runs clean install, tests, typecheck and production build. No lint script is configured.

`scripts/browser-smoke.mjs` is an optional Playwright regression suite for a browser-capable development environment with Playwright already installed. Use `TEST_URL` and `CHROMIUM_PATH` as needed. Browser tooling is test-only, not shipped. This cloud shell's preview has not been reachable by the supported cloud browser; independent UI QA must be reported separately from pure tests/build, and is not a formal screen-reader/WCAG audit.

## Privacy and publication

No application backend, analytics, localStorage, database, account connections or automatic input transmission. Inputs live only in memory unless the user explicitly exports a file. Import does not upload. Hosting may process ordinary requests independently.

GitHub `joshwood/retirement-calculator` is the source of truth. Its draft PR is separate from the Site's managed source repository; no automatic synchronization. Publish only the independently reviewed and tested source through the official Sites workflow, preserving `.openai/hosting.json`, the existing project and owner-private access. Neither PR merging nor broader sharing is part of this release task.
